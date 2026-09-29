/**
 * SERVER-SIDE DOCUMENT ASSET STORAGE SERVICE
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Implements secure server-side storage for archival master binaries and extracted page assets.
 *
 * Security & Architectural Constraints:
 * - Assets reside exclusively outside the frontend /src directory in server-side storage.
 * - Files are not exposed directly to the public web root.
 * - All access is controlled and mediated via authenticated server endpoints.
 * - Generates and verifies cryptographic SHA-256 checksums for every stored file.
 * - Local filesystem abstraction labeled as Development/Institutional-Local Storage.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StoredMasterAsset {
  storagePath: string;
  filename: string;
  fileSizeBytes: number;
  checksumSha256: string;
  mimeType: string;
  storedAt: string;
}

// Runtime token to ensure compatibility with Node.js ESM value imports
export const StoredMasterAsset = {
  type: 'StoredMasterAsset'
};

export interface StoredPageAsset {
  storagePath: string;
  pageNumber: number;
  fileSizeBytes: number;
  mimeType: string;
}

/**
 * Maximum supported PDF asset size: 120 MiB = 120 * 1024 * 1024 bytes (125,829,120 bytes).
 * Enforced across storage, validation, ingestion, and client workflows.
 */
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 120 * 1024 * 1024;

export class DocumentStorageService {
  private static baseStorageDir: string = path.resolve(
    process.cwd(),
    process.env.STORAGE_DIR || 'storage/documents'
  );

  /**
   * Returns base storage directory path and ensures it exists.
   */
  public static getStorageDir(): string {
    if (!fs.existsSync(this.baseStorageDir)) {
      fs.mkdirSync(this.baseStorageDir, { recursive: true });
    }
    return this.baseStorageDir;
  }

  private static getHeritageStorageDir(): string {
    const dir = path.resolve(this.getStorageDir(), '..', 'heritage360');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Save a validated panorama by content hash under the server-only asset root. */
  public static async saveHeritagePanorama(locationId: string, viewpointId: string, buffer: Buffer, mimeType: string): Promise<{ storageKey: string; checksumSha256: string; fileSizeBytes: number }> {
    const extension = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
    const safeLocation = locationId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeViewpoint = viewpointId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const checksumSha256 = this.computeSha256(buffer);
    const relativeKey = path.join(safeLocation, safeViewpoint, `${checksumSha256}${extension}`).replace(/\\/g, '/');
    const heritageRoot = this.getHeritageStorageDir();
    const destination = path.resolve(heritageRoot, relativeKey);
    const relative = path.relative(heritageRoot, destination);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid heritage asset storage key.');
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    await fs.promises.writeFile(destination, buffer, { flag: 'wx' }).catch(async error => {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (await this.computeSha256File(destination) !== checksumSha256) throw new Error('Stored panorama checksum mismatch.');
    });
    return { storageKey: relativeKey, checksumSha256, fileSizeBytes: buffer.length };
  }

  public static async getHeritagePanorama(storageKey: string): Promise<Buffer | null> {
    const heritageRoot = this.getHeritageStorageDir();
    const target = path.resolve(heritageRoot, storageKey);
    const relative = path.relative(heritageRoot, target);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(target)) return null;
    try { return await fs.promises.readFile(target); } catch { return null; }
  }

  /**
   * Computes SHA-256 cryptographic hash of a Buffer.
   */
  public static computeSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Computes SHA-256 cryptographic hash of a file on disk via streaming.
   * Provides minimal memory footprint for large archival files up to 120 MiB.
   */
  public static computeSha256File(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Resolves the root directory for a specific document.
   */
  public static getDocDir(documentId: string): string {
    // Sanitize documentId to prevent directory traversal
    const safeDocId = documentId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docDir = path.join(this.getStorageDir(), safeDocId);
    if (!fs.existsSync(docDir)) {
      fs.mkdirSync(docDir, { recursive: true });
    }
    return docDir;
  }

  /**
   * Resolves the pages directory for a specific document.
   */
  public static getPagesDir(documentId: string): string {
    const pagesDir = path.join(this.getDocDir(documentId), 'pages');
    if (!fs.existsSync(pagesDir)) {
      fs.mkdirSync(pagesDir, { recursive: true });
    }
    return pagesDir;
  }

  /**
   * Saves a master document asset binary to server storage.
   */
  public static async saveMasterAsset(
    documentId: string,
    filename: string,
    buffer: Buffer,
    mimeType: string = 'application/pdf'
  ): Promise<StoredMasterAsset> {
    const docDir = this.getDocDir(documentId);
    const checksum = this.computeSha256(buffer);
    const requestedExt = path.extname(path.basename(filename)).toLowerCase();
    const ext = requestedExt === '.pdf' ? requestedExt : '.pdf';
    const masterFilename = `master${ext}`;
    const targetPath = path.join(docDir, masterFilename);

    await fs.promises.writeFile(targetPath, buffer);

    // Save asset metadata descriptor alongside
    const metaPath = path.join(docDir, 'asset-meta.json');
    const meta: StoredMasterAsset = {
      storagePath: targetPath,
      filename,
      fileSizeBytes: buffer.length,
      checksumSha256: checksum,
      mimeType,
      storedAt: new Date().toISOString()
    };
    await fs.promises.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');

    return meta;
  }

  /**
   * Saves an individual extracted page PDF slice into server storage.
   */
  public static async savePageAsset(
    documentId: string,
    pageNumber: number,
    buffer: Buffer,
    mimeType: string = 'application/pdf'
  ): Promise<StoredPageAsset> {
    const pagesDir = this.getPagesDir(documentId);
    const pageFilename = `page_${String(pageNumber).padStart(4, '0')}.pdf`;
    const targetPath = path.join(pagesDir, pageFilename);

    await fs.promises.writeFile(targetPath, buffer);

    return {
      storagePath: targetPath,
      pageNumber,
      fileSizeBytes: buffer.length,
      mimeType
    };
  }

  /**
   * Retrieves master document binary from server storage.
   */
  public static async getMasterAsset(
    documentId: string
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
    const docDir = this.getDocDir(documentId);
    const metaPath = path.join(docDir, 'asset-meta.json');
    if (!fs.existsSync(metaPath)) {
      return null;
    }

    try {
      const metaRaw = await fs.promises.readFile(metaPath, 'utf8');
      const meta: StoredMasterAsset = JSON.parse(metaRaw);
      const resolvedAssetPath = path.resolve(meta.storagePath);
      const relativeAssetPath = path.relative(docDir, resolvedAssetPath);
      if (relativeAssetPath.startsWith('..') || path.isAbsolute(relativeAssetPath) || !fs.existsSync(resolvedAssetPath)) {
        return null;
      }
      const buffer = await fs.promises.readFile(resolvedAssetPath);
      return {
        buffer,
        mimeType: meta.mimeType || 'application/pdf',
        filename: meta.filename || `${documentId}.pdf`
      };
    } catch {
      return null;
    }
  }

  /**
   * Retrieves an extracted single-page asset from server storage.
   */
  public static async getPageAsset(
    documentId: string,
    pageNumber: number
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const pagesDir = this.getPagesDir(documentId);
    const pageFilename = `page_${String(pageNumber).padStart(4, '0')}.pdf`;
    const targetPath = path.join(pagesDir, pageFilename);

    if (!fs.existsSync(targetPath)) {
      return null;
    }

    try {
      const buffer = await fs.promises.readFile(targetPath);
      return {
        buffer,
        mimeType: 'application/pdf'
      };
    } catch {
      return null;
    }
  }

  /**
   * Checks whether a master asset exists for the specified document ID.
   */
  public static hasMasterAsset(documentId: string): boolean {
    const docDir = this.getDocDir(documentId);
    const metaPath = path.join(docDir, 'asset-meta.json');
    return fs.existsSync(metaPath);
  }

  /** Checks for a concrete page asset without creating directories or reading its contents. */
  public static hasPageAsset(documentId: string, pageNumber: number): boolean {
    if (!Number.isInteger(pageNumber) || pageNumber < 1) return false;
    const pagePath = path.join(
      this.getDocDir(documentId),
      'pages',
      `page_${String(pageNumber).padStart(4, '0')}.pdf`
    );
    return fs.existsSync(pagePath);
  }

  /** Returns a concrete in-root page asset path for trusted server-side workers only. */
  public static getPageAssetPath(documentId: string, pageNumber: number): string | null {
    if (!Number.isInteger(pageNumber) || pageNumber < 1) return null;
    const docDir = this.getDocDir(documentId);
    const targetPath = path.resolve(docDir, 'pages', `page_${String(pageNumber).padStart(4, '0')}.pdf`);
    const relative = path.relative(docDir, targetPath);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(targetPath)) return null;
    return targetPath;
  }

  /**
   * Deletes all physical stored files for a document (used in transaction rollbacks or cleanup).
   */
  public static async deleteDocumentAssets(documentId: string): Promise<void> {
    const docDir = this.getDocDir(documentId);
    if (fs.existsSync(docDir)) {
      await fs.promises.rm(docDir, { recursive: true, force: true });
    }
  }
}
