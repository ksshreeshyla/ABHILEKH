/**
 * OCR PROVIDER ABSTRACTION LAYER
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Provides a truthful, extensible provider abstraction for archival OCR/HTR engines.
 *
 * Rules strictly enforced:
 * - Never claims OCR was executed unless a legitimate provider processed a real asset.
 * - Stores actual returned confidence or truthful 'Confidence unavailable'.
 * - No fake OCR text generation or synthetic confidence scores.
 */

export type OcrProcessingStatus =
  | 'NOT_PROCESSED'
  | 'PROCESSING'
  | 'OCR_COMPLETE'
  | 'NEEDS_REVIEW'
  | 'VERIFIED'
  | 'CORRECTED'
  | 'FAILED';

export type OcrVerificationStatus =
  | 'UNVERIFIED'
  | 'NEEDS_REVIEW'
  | 'VERIFIED'
  | 'CORRECTED'
  | 'REJECTED';

export interface BoundingBoxHighlight {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence?: number;
}

export const BoundingBoxHighlight = { type: 'BoundingBoxHighlight' };

export interface OcrProviderResult {
  rawText: string;
  processedText: string;
  textHi?: string;
  textMr?: string;
  textKn?: string;
  confidence: number | null; // Truthful confidence; null if provider does not return confidence
  language: string;
  ocrEngine: string;
  engineVersion?: string;
  boundingHighlights?: BoundingBoxHighlight[];
  pageDimensions?: {
    width: number;
    height: number;
    dpi?: number;
  };
  provenanceNotes?: string;
}

export interface IOcrProvider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  isConfigured(): boolean;
  supportsConfidence(): boolean;
  extractText(
    assetReference: string,
    options?: { language?: string; pageNumber?: number }
  ): Promise<OcrProviderResult>;
}

/**
 * NullOcrProvider
 * Default provider when no external OCR engine credentials are provided.
 * Rejects execution truthfully rather than fabricating fake OCR.
 */
export class NullOcrProvider implements IOcrProvider {
  public readonly id = 'null-provider';
  public readonly name = 'Unconfigured OCR Engine';
  public readonly description = 'Default placeholder when no production OCR engine is configured.';

  public isConfigured(): boolean {
    return false;
  }

  public supportsConfidence(): boolean {
    return false;
  }

  public async extractText(
    assetReference: string,
    _options?: { language?: string; pageNumber?: number }
  ): Promise<OcrProviderResult> {
    throw new Error(
      `OCR Execution Denied: No legitimate OCR engine credentials or local binary provider configured for asset "${assetReference}". Archival provenance prohibits synthetic text generation.`
    );
  }
}

function commandExists(command: string): boolean {
  if (path.isAbsolute(command) || command.includes(path.sep)) return fs.existsSync(command);
  const result = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [command], {
    encoding: 'utf8', windowsHide: true, timeout: 3000,
  });
  return result.status === 0;
}

function runFile(command: string, args: string[], timeout = 120_000, maxBuffer = 16 * 1024 * 1024): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8', windowsHide: true, timeout, maxBuffer }, (error, stdout, stderr) => {
      if (error) {
        const message = String(stderr || error.message).trim().slice(0, 800);
        reject(new Error(message || 'OCR command failed.'));
        return;
      }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

/** Tesseract + explicit PDF rasterizer. Both tools are detected instead of assumed. */
export class TesseractOcrProvider implements IOcrProvider {
  public readonly id = 'tesseract-archival';
  public readonly name = 'Tesseract OCR Archival Pipeline (v5.3+)';
  public readonly description = 'Open-source institutional neural OCR with Indic script models (eng, hin, mar, kan).';

  private get tesseractCommand(): string { return process.env.TESSERACT_PATH?.trim() || 'tesseract'; }
  private get rendererTool(): 'pdftoppm' | 'mutool' {
    return process.env.PDF_RENDERER_TOOL?.trim().toLowerCase() === 'mutool' ? 'mutool' : 'pdftoppm';
  }
  private get rendererCommand(): string { return process.env.PDF_RENDERER_PATH?.trim() || this.rendererTool; }

  public configurationIssue(): string | null {
    if (process.env.TESSERACT_ENABLED !== 'true') return 'Set TESSERACT_ENABLED=true to enable local OCR.';
    if (!commandExists(this.tesseractCommand)) return `Tesseract was not found. Install it or set TESSERACT_PATH to its executable.`;
    if (!commandExists(this.rendererCommand)) return `PDF renderer ${this.rendererTool} was not found. Install Poppler (pdftoppm) or MuPDF (mutool), then set PDF_RENDERER_PATH and PDF_RENDERER_TOOL if needed.`;
    return null;
  }

  public isConfigured(): boolean {
    return this.configurationIssue() === null;
  }

  public supportsConfidence(): boolean {
    return true;
  }

  public async extractText(
    assetReference: string,
    options?: { language?: string; pageNumber?: number }
  ): Promise<OcrProviderResult> {
    const issue = this.configurationIssue();
    if (issue) throw new Error(issue);
    if (!fs.existsSync(assetReference) || !fs.statSync(assetReference).isFile()) {
      throw new Error('The stored page PDF is unavailable to the OCR worker.');
    }
    const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'abhilekh-ocr-'));
    try {
      const dpi = Math.min(400, Math.max(150, Number(process.env.TESSERACT_DPI || 260)));
      const imagePath = path.join(workDir, 'page.png');
      if (this.rendererTool === 'mutool') {
        await runFile(this.rendererCommand, ['draw', '-q', '-r', String(dpi), '-o', imagePath, assetReference, '1'], 120_000);
      } else {
        await runFile(this.rendererCommand, ['-f', '1', '-l', '1', '-singlefile', '-png', '-r', String(dpi), assetReference, path.join(workDir, 'page')], 120_000);
      }
      if (!fs.existsSync(imagePath)) throw new Error('PDF renderer did not produce a page image.');

      const language = this.toTesseractLanguage(options?.language || 'eng');
      const tesseract = await runFile(this.tesseractCommand, [imagePath, 'stdout', '-l', language, 'tsv'], 180_000);
      const parsed = this.parseTsv(tesseract.stdout);
      const version = await runFile(this.tesseractCommand, ['--version'], 10_000, 1024 * 1024).catch(() => ({ stdout: '', stderr: '' }));
      return {
        rawText: parsed.text,
        processedText: parsed.text,
        confidence: parsed.confidence,
        language,
        ocrEngine: 'Tesseract OCR',
        engineVersion: (version.stdout || version.stderr).split(/\r?\n/)[0] || undefined,
        boundingHighlights: [],
        provenanceNotes: `Rendered actual stored page PDF at ${dpi} DPI; OCR page ${options?.pageNumber || 1}. Work ${crypto.randomUUID()}`,
      };
    } finally {
      await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private toTesseractLanguage(language: string): string {
    const aliases: Record<string, string> = { en: 'eng', english: 'eng', hi: 'hin', hindi: 'hin', mr: 'mar', marathi: 'mar', kn: 'kan', kannada: 'kan' };
    const mapped = language.toLowerCase().split('+').map(part => aliases[part.trim()] || part.trim()).join('+');
    if (!/^[a-z]{3}(\+[a-z]{3})*$/.test(mapped)) throw new Error('Unsupported Tesseract language code.');
    return mapped;
  }

  private parseTsv(tsv: string): { text: string; confidence: number | null } {
    const lines = new Map<string, string[]>();
    const confidences: number[] = [];
    for (const row of tsv.split(/\r?\n/).slice(1)) {
      const columns = row.split('\t');
      if (columns[0] !== '5' || columns.length < 12) continue;
      const word = columns.slice(11).join('\t').trim();
      if (!word) continue;
      const key = columns.slice(1, 5).join(':');
      lines.set(key, [...(lines.get(key) || []), word]);
      const score = Number(columns[10]);
      if (Number.isFinite(score) && score >= 0) confidences.push(score / 100);
    }
    const text = [...lines.values()].map(words => words.join(' ')).join('\n').trim();
    const confidence = confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null;
    return { text, confidence };
  }
}

/**
 * GoogleCloudVisionOcrProvider
 * Provider skeleton ready for Google Cloud Vision Document Text Detection.
 */
export class GoogleCloudVisionOcrProvider implements IOcrProvider {
  public readonly id = 'google-cloud-vision';
  public readonly name = 'Google Cloud Vision Document AI';
  public readonly description = 'Enterprise document layout analysis with dense text detection and bounding polygons.';

  public isConfigured(): boolean {
    return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.CLOUD_VISION_API_KEY);
  }

  public supportsConfidence(): boolean {
    return true;
  }

  public async extractText(
    assetReference: string,
    _options?: { language?: string; pageNumber?: number }
  ): Promise<OcrProviderResult> {
    if (!this.isConfigured()) {
      throw new Error(
        `Google Cloud Vision is not configured. Missing credentials. To run Cloud Vision OCR, configure authorized GCP credentials.`
      );
    }

    throw new Error(
      `Cloud Vision OCR requested for asset "${assetReference}", but physical asset binary is pending acquisition.`
    );
  }
}

/**
 * ManualTranscriptionProvider
 * Certified scholarly transcription provider for primary historical sources.
 */
export class ManualTranscriptionProvider implements IOcrProvider {
  public readonly id = 'manual-archival-transcription';
  public readonly name = 'Certified Archival Transcription';
  public readonly description = 'Direct scholar transcription and editorial verification for high-fidelity archival records.';

  public isConfigured(): boolean {
    return true;
  }

  public supportsConfidence(): boolean {
    return true;
  }

  public async extractText(
    _assetReference: string,
    _options?: { language?: string; pageNumber?: number }
  ): Promise<OcrProviderResult> {
    throw new Error(
      'Manual transcription requires direct scholar input via the Admin Verification workbench.'
    );
  }
}

/**
 * OcrProviderRegistry
 * Central registry managing OCR engine providers.
 */
export class OcrProviderRegistry {
  private static providers: Map<string, IOcrProvider> = new Map<string, IOcrProvider>([
    ['null-provider', new NullOcrProvider()],
    ['tesseract-archival', new TesseractOcrProvider()],
    ['google-cloud-vision', new GoogleCloudVisionOcrProvider()],
    ['manual-archival-transcription', new ManualTranscriptionProvider()]
  ]);

  private static defaultProviderId = 'null-provider';

  public static registerProvider(provider: IOcrProvider): void {
    this.providers.set(provider.id, provider);
  }

  public static getProvider(id: string): IOcrProvider | null {
    return this.providers.get(id) || null;
  }

  public static getDefaultProvider(): IOcrProvider {
    return this.providers.get(this.defaultProviderId) || new NullOcrProvider();
  }

  public static listProviders(): Array<{
    id: string;
    name: string;
    description: string;
    isConfigured: boolean;
    supportsConfidence: boolean;
    configurationIssue?: string;
  }> {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      isConfigured: p.isConfigured(),
      supportsConfidence: p.supportsConfidence(),
      ...('configurationIssue' in p && typeof p.configurationIssue === 'function'
        ? { configurationIssue: p.configurationIssue() || undefined }
        : {})
    }));
  }
}
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile, spawnSync } from 'child_process';
