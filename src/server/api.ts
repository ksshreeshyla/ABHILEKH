/**
 * BACKEND API ROUTER
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Implements server-side REST API endpoints for:
 * - PostgreSQL connection testing (SELECT 1)
 * - Migration status verification
 * - Archival data querying with automatic fallback
 * - Secure communication without exposing credentials to frontend
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI } from '@google/genai';
import { testConnection, checkSchemaStatus, getDbPool, hasDbConfig } from './db.ts';
import { getMigrationPlan } from './migrationRunner.ts';
import { MAX_DOCUMENT_FILE_SIZE_BYTES } from './storage/documentStorage.ts';
import { createAdminSession, clearAdminSession, hasAdminSession, requireAdmin } from './adminAuth.ts';
import { ShareSessionService, validateShareContext } from './shareSessionService.ts';
import { OcrBatchService } from './ocrBatchService.ts';
import { heritageRouter } from './heritageApi.ts';

export const apiRouter = express.Router();
apiRouter.use('/heritage', heritageRouter);
const shareCreateAttempts = new Map<string, number[]>();
const execFileAsync = promisify(execFile);
const renderedPageCache = new Map<string, Buffer>();

async function renderStoredPagePdf(pdf: Buffer, cacheKey: string): Promise<Buffer> {
  const cached = renderedPageCache.get(cacheKey);
  if (cached) return cached;
  const renderer = process.env.PDF_RENDERER_PATH?.trim() || 'mutool';
  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'abhilekh-page-view-'));
  const pdfPath = path.join(workDir, 'page.pdf');
  const pngPath = path.join(workDir, 'page.png');
  try {
    await fs.promises.writeFile(pdfPath, pdf, { flag: 'wx' });
    await execFileAsync(renderer, ['draw', '-q', '-r', '150', '-F', 'png', '-o', pngPath, pdfPath, '1'], {
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const image = await fs.promises.readFile(pngPath);
    if (image.length < 128 || image.readUInt32BE(0) !== 0x89504e47) {
      throw new Error('PDF renderer returned an invalid page image.');
    }
    renderedPageCache.set(cacheKey, image);
    while (renderedPageCache.size > 12) renderedPageCache.delete(renderedPageCache.keys().next().value!);
    return image;
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

const MAX_TRANSLATION_SOURCE_CHARS = 180_000;
const MAX_TRANSLATION_CHUNK_CHARS = 8_000;

function splitTranslationText(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_TRANSLATION_CHUNK_CHARS) {
    const limit = MAX_TRANSLATION_CHUNK_CHARS;
    const paragraphBreak = remaining.lastIndexOf('\n\n', limit);
    const lineBreak = remaining.lastIndexOf('\n', limit);
    const sentenceBreak = Math.max(
      remaining.lastIndexOf('. ', limit),
      remaining.lastIndexOf('? ', limit),
      remaining.lastIndexOf('! ', limit),
      remaining.lastIndexOf('। ', limit),
      remaining.lastIndexOf('; ', limit),
    );
    const wordBreak = remaining.lastIndexOf(' ', limit);
    const boundary = paragraphBreak > limit * 0.55 ? paragraphBreak
      : lineBreak > limit * 0.55 ? lineBreak
      : sentenceBreak > limit * 0.55 ? sentenceBreak + 1
      : wordBreak;
    if (boundary <= 0) throw new Error('A single OCR token exceeds the safe translation chunk size.');
    chunks.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

apiRouter.post('/admin/session', (req: Request, res: Response) => {
  const result = createAdminSession(req, res, req.body?.passcode);
  if (!result.ok) return res.status(result.message?.startsWith('Too many') ? 429 : result.message?.includes('not configured') ? 503 : 401).json({ ok: false, message: result.message });
  return res.json({ ok: true, data: { authenticated: true } });
});
apiRouter.get('/admin/session', (req: Request, res: Response) => res.json({ ok: true, data: { authenticated: hasAdminSession(req) } }));
apiRouter.delete('/admin/session', (req: Request, res: Response) => { clearAdminSession(req, res); res.json({ ok: true }); });

apiRouter.post('/share-sessions', async (req: Request, res: Response) => {
  const now = Date.now();
  const key = String(req.ip || req.socket.remoteAddress || 'unknown').slice(0, 100);
  const attempts = (shareCreateAttempts.get(key) || []).filter(time => now - time < 10 * 60_000);
  if (attempts.length >= 20) return res.status(429).json({ ok: false, message: 'Too many continuation links requested. Try again later.' });
  attempts.push(now);
  shareCreateAttempts.set(key, attempts);
  try {
    const context = validateShareContext(req.body?.context);
    const session = await ShareSessionService.create(context);
    return res.status(201).json({ ok: true, data: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create a continuation session.';
    return res.status(400).json({ ok: false, message });
  }
});

apiRouter.get('/share-sessions/:token', async (req: Request, res: Response) => {
  try {
    const result = await ShareSessionService.resolve(req.params.token);
    return res.json({ ok: true, data: result });
  } catch {
    return res.status(503).json({ ok: false, message: 'Continuation service is temporarily unavailable.' });
  }
});

// Temporary upload directory for streaming/binary multipart document uploads
const UPLOAD_TEMP_DIR = path.join(os.tmpdir(), 'daic-archive-uploads');
if (!fs.existsSync(UPLOAD_TEMP_DIR)) {
  fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_TEMP_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeExt = path.extname(file.originalname || '') || '.pdf';
    cb(null, `upload-${uniqueSuffix}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_DOCUMENT_FILE_SIZE_BYTES, // 120 MiB = 125,829,120 bytes
    files: 1
  }
});

/**
 * Express middleware helper to safely handle multipart PDF file uploads.
 * If request is not multipart/form-data, skips gracefully to next handler.
 * If file exceeds 120 MiB, returns standard structured validation rejection.
 */
function handlePdfUpload(fieldName: string = 'file') {
  const multerSingle = upload.single(fieldName);
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return next();
    }

    multerSingle(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(200).json({
            ok: true,
            data: {
              valid: false,
              filename: req.body?.filename || 'Uploaded file',
              fileSizeBytes: req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : MAX_DOCUMENT_FILE_SIZE_BYTES + 1,
              mimeType: 'application/pdf',
              pageCount: 0,
              checksumSha256: '',
              isDuplicate: false,
              error: `File size exceeds maximum allowed limit of 120 MB (120 MiB = 125,829,120 bytes).`
            }
          });
        }
        return res.status(400).json({
          ok: false,
          message: `File upload error: ${err.message || String(err)}`
        });
      }
      next();
    });
  };
}

// ============================================================================
// 1. DATABASE HEALTH & CONNECTION VERIFICATION
// ============================================================================

/**
 * GET /api/database/status
 * Returns sanitized connection health and schema migration state.
 * NEVER returns passwords or secrets.
 */
apiRouter.get('/database/status', async (_req: Request, res: Response) => {
  try {
    if (!hasDbConfig()) {
      return res.json({
        engine: 'Prepared-Repository-Adapter',
        isLiveConnection: false,
        connected: false,
        database: 'ambedkar_heritage_archive (in-memory)',
        version: 'In-Memory Relational Engine',
        latencyMs: 0,
        message: 'Standalone mode: Operating with in-memory seeded relational repository.',
        migrated: false,
        tablesFound: [],
        missingTables: [],
        preparedFeaturesForLiveDb: [
          'Configure DATABASE_URL to connect to live PostgreSQL database',
          'Execute 0001_initial_schema.sql to create public schema tables',
        ],
      });
    }

    const conn = await testConnection();
    const schema = await checkSchemaStatus();

    res.json({
      engine: conn.ok ? 'PostgreSQL (Supabase)' : 'Prepared-Repository-Adapter',
      isLiveConnection: conn.ok,
      connected: conn.ok,
      database: conn.database || 'postgres',
      version: conn.version || 'Unknown',
      latencyMs: conn.latencyMs || 0,
      message: conn.message,
      migrated: schema.migrated,
      tablesFound: schema.tablesFound,
      missingTables: schema.missingTables,
      extraTables: schema.extraTables,
      actualTableCount: schema.actualTableCount,
      preparedFeaturesForLiveDb: schema.migrated
        ? []
        : ['Execute 0001_initial_schema.sql to create public schema tables'],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      engine: 'Prepared-Repository-Adapter',
      isLiveConnection: false,
      connected: false,
      message: `Error querying database status: ${msg}`,
      migrated: false,
      tablesFound: [],
      missingTables: [],
      extraTables: [],
      actualTableCount: 0,
    });
  }
});

/**
 * GET /api/database/test
 * Explicit endpoint to perform SELECT 1 test.
 */
apiRouter.get('/database/test', async (_req: Request, res: Response) => {
  try {
    const result = await testConnection();
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/**
 * GET /api/database/migration-status
 * Inspects migration file and database tables without executing anything.
 */
apiRouter.get('/database/migration-status', async (_req: Request, res: Response) => {
  try {
    const plan = await getMigrationPlan();
    res.json(plan);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

// ============================================================================
// 2. ARCHIVE DATA ENDPOINTS (HYBRID DB / FALLBACK)
// ============================================================================

/**
 * GET /api/archive/source-collections
 */
apiRouter.get('/archive/source-collections', async (_req: Request, res: Response) => {
  const pool = getDbPool();
  if (pool) {
    try {
      const dbRes = await pool.query('SELECT * FROM source_collections ORDER BY id ASC;');
      return res.json({ source: 'database', data: dbRes.rows });
    } catch {
      return res.status(503).json({ source: 'database_unavailable', data: [], message: 'Source collections could not be loaded from the archive database.' });
    }
  }
  return res.status(503).json({ source: 'database_unavailable', data: [], message: 'Source collections require the archive database.' });
});

/**
 * GET /api/archive/items
 */
apiRouter.get('/archive/items', async (req: Request, res: Response) => {
  const pool = getDbPool();
  const searchQ = typeof req.query.q === 'string' ? req.query.q.trim() : (typeof req.query.search === 'string' ? req.query.search.trim() : '');
  const categoryFilter = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const sourceColFilter = typeof req.query.source_collection === 'string' ? req.query.source_collection.trim() : (typeof req.query.sourceCollection === 'string' ? req.query.sourceCollection.trim() : '');
  const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
  const offsetParam = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;

  if (pool) {
    try {
      let sql = `
        SELECT 
          ai.*,
          sr.original_source_identifier,
          sc.id as source_collection_id,
          sc.name as source_collection_name
        FROM archive_items ai
        LEFT JOIN source_records sr ON ai.source_record_id = sr.id
        LEFT JOIN source_collections sc ON sr.source_collection_id = sc.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (categoryFilter && categoryFilter !== 'All') {
        params.push(categoryFilter);
        sql += ` AND ai.category = $${params.length}`;
      }

      if (sourceColFilter && sourceColFilter !== 'All') {
        params.push(`%${sourceColFilter}%`);
        sql += ` AND (sc.id ILIKE $${params.length} OR sc.name ILIKE $${params.length} OR ai.collection ILIKE $${params.length})`;
      }

      if (searchQ) {
        params.push(`%${searchQ}%`);
        const pIdx = params.length;
        sql += ` AND (
          ai.archive_id ILIKE $${pIdx} OR 
          ai.title ILIKE $${pIdx} OR 
          ai.title_hi ILIKE $${pIdx} OR 
          ai.title_mr ILIKE $${pIdx} OR 
          ai.author ILIKE $${pIdx} OR 
          ai.collection ILIKE $${pIdx} OR 
          ai.description ILIKE $${pIdx} OR 
          sr.original_source_identifier ILIKE $${pIdx} OR
          sc.name ILIKE $${pIdx}
        )`;
      }

      sql += ` ORDER BY ai.year ASC, ai.id ASC`;

      if (limitParam && limitParam > 0) {
        params.push(limitParam);
        sql += ` LIMIT $${params.length}`;
        if (offsetParam > 0) {
          params.push(offsetParam);
          sql += ` OFFSET $${params.length}`;
        }
      }

      const dbRes = await pool.query(sql, params);
      if (dbRes.rows.length >= 0) {
        const mapped = dbRes.rows.map(row => ({
          ...row,
          id: row.id,
          archiveId: row.archive_id,
          archive_id: row.archive_id,
          callNumber: row.archive_id,
          sourceRecordId: row.source_record_id,
          source_record_id: row.source_record_id,
          originalSourceIdentifier: row.original_source_identifier,
          original_source_identifier: row.original_source_identifier,
          sourceCollectionId: row.source_collection_id,
          source_collection_id: row.source_collection_id,
          sourceCollectionName: row.source_collection_name,
          source_collection_name: row.source_collection_name,
          title: row.title,
          titleHi: row.title_hi,
          titleMr: row.title_mr,
          titleKn: row.title_kn,
          category: row.category,
          date: row.date,
          year: row.year,
          author: row.author,
          collection: row.collection,
          sourceInstitution: row.source_institution,
          sourceProvenance: row.source_provenance,
          language: row.language,
          originalHolding: row.original_holding,
          description: row.description,
          descriptionHi: row.description_hi,
          descriptionMr: row.description_mr,
          descriptionKn: row.description_kn,
          fullText: row.full_text || '',
          aiSummary: row.ai_summary || '',
          aiSummaryHi: row.ai_summary_hi,
          aiSummaryMr: row.ai_summary_mr,
          aiSummaryKn: row.ai_summary_kn,
          keyConcepts: row.key_concepts || [],
          publishingStatus: row.publishing_status,
          isFeatured: row.is_featured,
          isDemoRecord: row.is_demo_record,
          thumbnailUrl: row.thumbnail_url,
          downloadUrl: row.download_url,
          citationChicago: `${row.author || 'Dr. B. R. Ambedkar'}. "${row.title}." ${row.source_institution || 'Dr. Ambedkar Foundation'}, ${row.year}.`,
          citationApa: `${row.author || 'Dr. B. R. Ambedkar'} (${row.year}). ${row.title}. ${row.source_institution || 'Dr. Ambedkar Foundation'}.`,
          citationMla: `${row.author || 'Dr. B. R. Ambedkar'}. "${row.title}." ${row.source_institution || 'Dr. Ambedkar Foundation'}, ${row.year}.`,
          citationBibtex: `@article{ambedkar_${row.id},\n  author = {${row.author || 'Dr. B. R. Ambedkar'}},\n  title = {${row.title}},\n  year = {${row.year}}\n}`,
          pages: [] // Truthful: 0 pages for uningested records
        }));
        return res.json({ ok: true, source: 'database', total: mapped.length, data: mapped });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[API] /archive/items database query error:', msg);
      return res.status(503).json({ ok: false, source: 'database_unavailable', data: [], message: 'Archive records could not be loaded from the database.' });
    }
  }
  return res.status(503).json({ ok: false, source: 'database_unavailable', data: [], total: 0, message: 'Archive records require the database.' });
});

/**
 * POST /api/research/ask
 * Retrieves only stored page-level OCR and uses a server-side Gemini key when configured.
 * No synthetic excerpts, page numbers, confidence values, or citation scores are returned.
 */
apiRouter.post('/research/ask', async (req: Request, res: Response) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 1000) : '';
  const responseLanguage = String(req.body?.responseLanguage || 'en').toLowerCase();
  const researchLanguages: Record<string, string> = { en: 'English', hi: 'Hindi', mr: 'Marathi', kn: 'Kannada' };
  if (!query) return res.status(400).json({ ok: false, message: 'Enter a research question.' });
  if (!researchLanguages[responseLanguage]) return res.status(400).json({ ok: false, message: 'Choose English, Hindi, Marathi, or Kannada for the response.' });

  const terms: string[] = [...new Set<string>(query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])].slice(0, 8);
  if (!terms.length) return res.status(400).json({ ok: false, message: 'Use at least one searchable word.' });

  const pool = getDbPool();
  if (!pool) {
    return res.json({ ok: true, data: {
      answer: 'Page-level OCR search is unavailable because this runtime is not connected to the archival database. No document evidence or page citation can be supplied.',
      sources: [], suggestedFollowUps: [], isGeminiPowered: false,
    } });
  }

  try {
    const clauses = terms.map((_, index) => `o.processed_text ILIKE $${index + 1}`);
    const params = terms.map(term => `%${term.replace(/[\\%_]/g, '\\$&')}%`);
    const result = await pool.query(
      `SELECT d.id AS document_id, d.title AS document_title, ai.archive_id,
              p.page_number, o.processed_text,
              COALESCE(sr.original_url, sc.source_url) AS source_url,
              sc.name AS source_collection_name
       FROM ocr_records o
       JOIN document_pages p ON p.id = o.page_id
       JOIN documents d ON d.id = p.document_id
       JOIN archive_items ai ON ai.id = d.archive_item_id
       LEFT JOIN source_records sr ON sr.id = ai.source_record_id
       LEFT JOIN source_collections sc ON sc.id = sr.source_collection_id
       WHERE (${clauses.join(' OR ')})
       ORDER BY p.page_number ASC
       LIMIT 8;`, params
    );

    const sources = result.rows.map(row => {
      const text = String(row.processed_text || '');
      const lower = text.toLowerCase();
      const foundAt = terms.map(term => lower.indexOf(term)).filter(index => index >= 0).sort((a, b) => a - b)[0] ?? 0;
      const start = Math.max(0, foundAt - 180);
      const end = Math.min(text.length, start + 520);
      return {
        documentId: row.document_id,
        documentTitle: row.document_title,
        archiveId: row.archive_id,
        pageNumber: Number(row.page_number),
        relevantExcerpt: `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`,
        sourceUrl: row.source_url || undefined,
      };
    });

    if (!sources.length) {
      const pendingOcr = await pool.query(
        `SELECT ai.archive_id, d.title
         FROM documents d
         JOIN archive_items ai ON ai.id = d.archive_item_id
         WHERE d.status = 'DOCUMENT_READY'
           AND EXISTS (SELECT 1 FROM document_pages p WHERE p.document_id = d.id)
           AND NOT EXISTS (
             SELECT 1 FROM ocr_records o
             JOIN document_pages p ON p.id = o.page_id
             WHERE p.document_id = d.id
           )
         ORDER BY d.updated_at DESC LIMIT 1;`
      );
      const pendingDocument = pendingOcr.rows[0];
      const answer = pendingDocument
        ? `${pendingDocument.title} (${pendingDocument.archive_id}) has been ingested, but searchable OCR is not yet available. I cannot provide an evidence-based answer or page citation until real OCR text is processed.`
        : 'No matching page-level OCR text was found in the connected archive. I cannot provide an evidence-based answer or page citation for this question.';
      return res.json({ ok: true, data: {
        answer,
        sources: [], suggestedFollowUps: [], isGeminiPowered: false,
      } });
    }

    let answer = `Matching archival OCR excerpts are available below. Review the cited pages in Document Explorer before relying on them.\n\n${sources.map(source => `${source.archiveId}, page ${source.pageNumber}: “${source.relevantExcerpt}”`).join('\n\n')}`;
    let isGeminiPowered = false;
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
          contents: `Answer the research question in ${researchLanguages[responseLanguage]} using only the archival OCR evidence below. Distinguish source text from interpretation. If the evidence does not answer the question, say so. Do not add quotations or facts absent from the evidence. Keep every bracketed archive ID and page citation exactly as written; do not translate, alter, or omit citation markers.\n\nEVIDENCE:\n${sources.map(source => `[${source.archiveId}, page ${source.pageNumber}] ${source.documentTitle}\n${source.relevantExcerpt}`).join('\n\n')}\n\nQUESTION: ${query}`,
        });
        if (response.text?.trim()) {
          answer = response.text.trim();
          isGeminiPowered = true;
        }
      } catch (error) {
        console.warn('[Research] Gemini request failed; returning retrieved OCR excerpts.');
      }
    }

    return res.json({ ok: true, data: { answer, sources, suggestedFollowUps: [], isGeminiPowered } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Research] OCR retrieval failed:', message);
    return res.status(500).json({ ok: false, message: 'Archival OCR retrieval failed.' });
  }
});

/**
 * GET /api/archive/timeline
 */
apiRouter.get('/archive/timeline', async (_req: Request, res: Response) => {
  const pool = getDbPool();
  if (pool) {
    try {
      const dbRes = await pool.query(`
        SELECT e.*,
          COALESCE((SELECT array_agg(ted.archive_item_id ORDER BY ted.archive_item_id)
                    FROM timeline_event_documents ted WHERE ted.event_id = e.id), ARRAY[]::varchar[]) AS related_document_ids,
          COALESCE((SELECT array_agg(DISTINCT aip.person_id ORDER BY aip.person_id)
                    FROM archive_item_events aie
                    JOIN archive_item_people aip ON aip.archive_item_id = aie.archive_item_id
                    WHERE aie.event_id = e.id), ARRAY[]::varchar[]) AS related_people,
          COALESCE((SELECT array_agg(DISTINCT ait.topic_id ORDER BY ait.topic_id)
                    FROM archive_item_events aie
                    JOIN archive_item_topics ait ON ait.archive_item_id = aie.archive_item_id
                    WHERE aie.event_id = e.id), ARRAY[]::varchar[]) AS related_topics
        FROM events e WHERE COALESCE(e.is_demo_record, FALSE) = FALSE ORDER BY e.year ASC;
      `);
      const events = dbRes.rows.map((row) => ({
        id: row.id,
        year: row.year,
        dateFormatted: row.date_formatted,
        title: row.title,
        titleHi: row.title_hi,
        titleMr: row.title_mr,
        titleKn: row.title_kn,
        theme: row.theme,
        description: row.description,
        descriptionHi: row.description_hi,
        descriptionMr: row.description_mr,
        descriptionKn: row.description_kn,
        detailedDescription: row.detailed_description,
        detailedDescriptionHi: row.detailed_description_hi,
        detailedDescriptionMr: row.detailed_description_mr,
        detailedDescriptionKn: row.detailed_description_kn,
        location: row.location,
        keyQuote: row.key_quote,
        relatedDocumentIds: row.related_document_ids,
        relatedPeople: row.related_people,
        relatedTopics: row.related_topics,
        photoPlaceholder: row.photo_placeholder,
        photoCaption: row.photo_caption,
        photoProvenance: row.photo_provenance,
        archiveSource: row.source_provenance,
        sourceProvenance: row.source_provenance,
      }));
      return res.json({ source: 'database', data: events });
    } catch {
      return res.status(503).json({ source: 'database_unavailable', data: [], message: 'Timeline records could not be loaded from the archive database.' });
    }
  }
  return res.json({ source: 'database_unavailable', data: [], message: 'Timeline records require the archive database.' });
});

/**
 * GET /api/archive/knowledge-graph
 */
apiRouter.get('/archive/knowledge-graph', async (_req: Request, res: Response) => {
  const pool = getDbPool();
  if (pool) {
    try {
      const nodesRes = await pool.query('SELECT * FROM knowledge_nodes WHERE COALESCE(is_demo_record, FALSE) = FALSE;');
      const linksRes = await pool.query(`
        SELECT l.* FROM knowledge_links l
        JOIN knowledge_nodes source ON source.id = l.source_node_id
        JOIN knowledge_nodes target ON target.id = l.target_node_id
        WHERE COALESCE(source.is_demo_record, FALSE) = FALSE
          AND COALESCE(target.is_demo_record, FALSE) = FALSE;
      `);
      const connectionsByNode = new Map<string, string[]>();
      for (const link of linksRes.rows) {
        connectionsByNode.set(link.source_node_id, [...(connectionsByNode.get(link.source_node_id) || []), link.target_node_id]);
        connectionsByNode.set(link.target_node_id, [...(connectionsByNode.get(link.target_node_id) || []), link.source_node_id]);
      }
      const nodes = nodesRes.rows.map((row) => ({
        id: row.id,
        label: row.label,
        labelHi: row.label_hi,
        labelMr: row.label_mr,
        labelKn: row.label_kn,
        category: row.category,
        description: row.description,
        descriptionHi: row.description_hi,
        descriptionMr: row.description_mr,
        descriptionKn: row.description_kn,
        x: row.x === null ? undefined : Number(row.x),
        y: row.y === null ? undefined : Number(row.y),
        connections: connectionsByNode.get(row.id) || [],
        relatedDocId: row.related_doc_id || undefined,
      }));
      const links = linksRes.rows.map((row) => ({ source: row.source_node_id, target: row.target_node_id, relationship: row.relationship }));
      return res.json({
        source: 'database',
        data: { nodes, links },
      });
    } catch {
      return res.status(503).json({ source: 'database_unavailable', data: { nodes: [], links: [] }, message: 'Knowledge graph records could not be loaded from the archive database.' });
    }
  }
  return res.json({ source: 'database_unavailable', data: { nodes: [], links: [] }, message: 'Knowledge graph records require the archive database.' });
});

/**
 * GET /api/audit-logs
 * Returns persisted archival audit records without network or credential data.
 */
apiRouter.get('/audit-logs', async (_req: Request, res: Response) => {
  const pool = getDbPool();
  if (!pool) {
    return res.status(503).json({ source: 'database_unavailable', data: [], message: 'Audit records require the archive database.' });
  }
  try {
    const result = await pool.query(
      `SELECT id, timestamp, action, performed_by, user_role, document_id, document_title, details
       FROM audit_logs ORDER BY timestamp DESC LIMIT 500;`
    );
    return res.json({ source: 'database', data: result.rows });
  } catch {
    return res.status(503).json({ source: 'database_unavailable', data: [], message: 'Audit records could not be loaded from the archive database.' });
  }
});

// ============================================================================
// 3. DOCUMENT & PAGE DATA LAYER ENDPOINTS
// ============================================================================

import { DocumentService } from './documentService.ts';

/**
 * GET /api/archive/items/:archiveId/document
 * Retrieves document hierarchy or truthful METADATA_ONLY state for an ArchiveItem
 */
apiRouter.get('/archive/items/:archiveId/document', async (req: Request, res: Response) => {
  try {
    const archiveId = req.params.archiveId;
    if (!archiveId || !archiveId.trim()) {
      return res.status(400).json({ ok: false, message: 'Invalid or missing archive ID.' });
    }

    const docStatus = await DocumentService.getDocumentByArchiveItem(archiveId);
    if (!docStatus) {
      return res.status(404).json({ ok: false, message: `Archive item "${archiveId}" not found.` });
    }

    res.json({ ok: true, data: docStatus });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/**
 * GET /api/documents
 * Lists documents with optional filtering (status, archiveItemId, documentType, limit, offset)
 */
apiRouter.get('/documents', async (req: Request, res: Response) => {
  try {
    const { status, archiveItemId, documentType, limit, offset } = req.query;
    const result = await DocumentService.getAllDocuments({
      status: status ? (String(status) as any) : undefined,
      archiveItemId: archiveItemId ? String(archiveItemId) : undefined,
      documentType: documentType ? String(documentType) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
      offset: offset ? parseInt(String(offset), 10) : undefined
    });
    res.json({ ok: true, data: result.documents, total: result.total });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/**
 * POST /api/documents/populate-metadata
 * Admin endpoint: Establishes Document layer for all real archival items in the database
 */
apiRouter.post('/documents/populate-metadata', async (_req: Request, res: Response) => {
  try {
    const result = await DocumentService.populateMetadataOnlyDocuments();
    res.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/**
 * GET /api/documents/:documentId
 * Retrieves a document record by primary key ID
 */
apiRouter.get('/documents/:documentId', async (req: Request, res: Response) => {
  try {
    const docId = req.params.documentId;
    const doc = await DocumentService.getDocumentById(docId);
    if (!doc) {
      return res.status(404).json({ ok: false, message: `Document "${docId}" not found.` });
    }
    res.json({ ok: true, data: doc });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/**
 * GET /api/documents/:documentId/pages
 * Retrieves all pages for a document
 */
apiRouter.get('/documents/:documentId/pages', async (req: Request, res: Response) => {
  try {
    const docId = req.params.documentId;
    const pages = await DocumentService.getDocumentPages(docId);
    res.json({ ok: true, data: pages, totalPages: pages.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/**
 * GET /api/documents/:documentId/pages/:pageNumber
 * Retrieves a specific page by page number
 */
apiRouter.get('/documents/:documentId/pages/:pageNumber', async (req: Request, res: Response) => {
  try {
    const docId = req.params.documentId;
    const pageNum = parseInt(req.params.pageNumber, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ ok: false, message: 'Invalid page number.' });
    }

    const page = await DocumentService.getDocumentPage(docId, pageNum);
    if (!page) {
      return res.status(404).json({ ok: false, message: `Page ${pageNum} for document "${docId}" not found.` });
    }
    res.json({ ok: true, data: page });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/**
 * POST /api/documents/register-external
 * Admin endpoint: Registers verified external document permalink / catalog reference
 */
apiRouter.post('/documents/register-external', async (req: Request, res: Response) => {
  try {
    const { archiveItemId, externalUrl, sourceProvider, title, documentType, language, pageCount, externalIdentifier, rightsInfo, provenanceNotes, accessRestriction } = req.body;
    if (!archiveItemId || !externalUrl || !sourceProvider) {
      return res.status(400).json({
        ok: false,
        message: 'Missing required fields: archiveItemId, externalUrl, and sourceProvider are required.'
      });
    }

    const doc = await DocumentService.registerExternalDocument({
      archiveItemId,
      externalUrl,
      sourceProvider,
      title,
      documentType,
      language,
      pageCount: pageCount ? parseInt(pageCount, 10) : 1,
      externalIdentifier,
      rightsInfo,
      provenanceNotes,
      accessRestriction
    });

    res.status(201).json({ ok: true, data: doc });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/**
 * POST /api/documents/register-asset
 * Admin endpoint: Registers an approved/acquired document asset with audit checksum
 */
apiRouter.post('/documents/register-asset', async (req: Request, res: Response) => {
  try {
    const {
      archiveItemId,
      assetReference,
      pageCount,
      acquisitionMethod,
      title,
      documentType,
      language,
      sourceUrl,
      checksumSha256,
      mimeType,
      fileSizeBytes,
      rightsInfo,
      provenanceNotes
    } = req.body;

    if (!archiveItemId || !assetReference || !acquisitionMethod) {
      return res.status(400).json({
        ok: false,
        message: 'Missing required fields: archiveItemId, assetReference, and acquisitionMethod are required.'
      });
    }

    const pages = pageCount ? parseInt(pageCount, 10) : 1;
    const result = await DocumentService.registerDocumentAsset({
      archiveItemId,
      assetReference,
      pageCount: pages,
      acquisitionMethod,
      title,
      documentType,
      language,
      sourceUrl,
      checksumSha256,
      mimeType,
      fileSizeBytes: fileSizeBytes ? parseInt(fileSizeBytes, 10) : undefined,
      rightsInfo,
      provenanceNotes
    });

    res.status(201).json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/**
 * PATCH /api/documents/:documentId/status
 * Admin endpoint: Updates document asset status
 */
apiRouter.patch('/documents/:documentId/status', async (req: Request, res: Response) => {
  try {
    const docId = req.params.documentId;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ ok: false, message: 'Status field is required.' });
    }

    const validStatuses = [
      'METADATA_ONLY',
      'EXTERNAL_DOCUMENT',
      'DOCUMENT_AVAILABLE',
      'DOCUMENT_PROCESSING',
      'DOCUMENT_READY',
      'ACCESS_RESTRICTED'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        ok: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updated = await DocumentService.updateDocumentStatus(docId, status, notes);
    if (!updated) {
      return res.status(404).json({ ok: false, message: `Document "${docId}" not found.` });
    }

    res.json({ ok: true, data: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

// ============================================================================
// STEP 4: REAL DOCUMENT INGESTION FOUNDATION ENDPOINTS
// ============================================================================

/**
 * POST /api/documents/validate-file
 * Pre-upload file validation: Checks MIME type, size, PDF structure, SHA-256 checksum,
 * and duplicate registration without committing anything to the database.
 * Supports both high-performance binary multipart/form-data (streaming/disk-backed) and JSON base64.
 */
apiRouter.post(['/documents/validate-file', '/documents/validate-file/'], handlePdfUpload('file'), async (req: Request, res: Response) => {
  const tempPath = req.file?.path;
  try {
    if (req.file) {
      // Multipart/form-data upload (Fast, binary-safe, low browser & server memory)
      const filename = req.file.originalname || req.body?.filename || 'document.pdf';
      const result = await DocumentService.validateDocumentFromPath(req.file.path, filename);
      return res.json({ ok: true, data: result });
    }

    // JSON fallback (Base64)
    const { fileBase64, filename } = req.body || {};
    if (!fileBase64 || !filename) {
      return res.status(400).json({
        ok: false,
        message: 'Missing required parameters: file (multipart) or fileBase64 + filename (JSON) are required for validation.'
      });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const result = await DocumentService.validateDocumentFile(buffer, filename);
    return res.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, message: msg });
  } finally {
    if (tempPath) {
      await fs.promises.unlink(tempPath).catch(() => {});
    }
  }
});

/**
 * POST /api/documents/:documentId/ingest
 * Admin endpoint: Ingests an authorized real PDF asset for an existing archive item.
 * Verifies provenance chain (archive_items -> source_records -> source_collections),
 * stores master binary, extracts actual pages, and updates documents + document_pages.
 * Supports both binary multipart/form-data (recommended) and JSON base64.
 */
apiRouter.post(['/documents/:documentId/ingest', '/documents/:documentId/ingest/'], handlePdfUpload('file'), async (req: Request, res: Response) => {
  const tempPath = req.file?.path;
  try {
    const documentId = req.params.documentId;
    let fileBuffer: Buffer;
    let filename: string;

    if (req.file) {
      filename = req.file.originalname || req.body?.filename || 'document.pdf';
      fileBuffer = await fs.promises.readFile(req.file.path);
    } else {
      const { fileBase64, filename: fn } = req.body || {};
      if (!fileBase64 || !fn) {
        return res.status(400).json({
          ok: false,
          message: 'Missing required fields: file (multipart) or fileBase64 + filename (JSON) are mandatory.'
        });
      }
      filename = fn;
      fileBuffer = Buffer.from(fileBase64, 'base64');
    }

    const {
      archiveItemId,
      acquisitionMethod,
      provenanceNotes,
      rightsInfo,
      reviewerId,
      reviewerName
    } = req.body || {};

    if (!archiveItemId) {
      return res.status(400).json({
        ok: false,
        message: 'Missing required fields: archiveItemId is mandatory.'
      });
    }

    const result = await DocumentService.ingestDocumentAsset({
      archiveItemId,
      documentId,
      fileBuffer,
      filename,
      acquisitionMethod: acquisitionMethod || 'ADMIN_UPLOAD',
      provenanceNotes,
      rightsInfo,
      reviewerId,
      reviewerName
    });

    return res.status(201).json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ ok: false, message: msg });
  } finally {
    if (tempPath) {
      await fs.promises.unlink(tempPath).catch(() => {});
    }
  }
});

/**
 * GET /api/documents/:documentId/assets
 * Returns storage and asset metadata for a document.
 */
apiRouter.get('/documents/:documentId/assets', async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId;
    const summary = await DocumentService.getDocumentAssetSummary(documentId);
    res.json({ ok: true, data: summary });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/**
 * GET /api/documents/:documentId/ingestion-status
 * Returns ingestion and readiness status of a document.
 */
apiRouter.get('/documents/:documentId/ingestion-status', async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId;
    const doc = await DocumentService.getDocumentById(documentId);
    if (!doc) {
      return res.status(404).json({ ok: false, message: `Document "${documentId}" not found.` });
    }

    const summary = await DocumentService.getDocumentAssetSummary(documentId);
    const pages = await DocumentService.getDocumentPages(documentId);

    res.json({
      ok: true,
      data: {
        documentId: doc.id,
        archiveItemId: doc.archiveItemId,
        status: doc.status,
        pageCount: doc.pageCount,
        hasMasterAsset: summary.hasMasterAsset,
        assetDetails: summary,
        pagesExtracted: pages.length,
        eligibleForOcr: pages.length > 0 && doc.status === 'DOCUMENT_READY'
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/**
 * GET /api/documents/:documentId/pages/:pageNumber/asset
 * Serves an individual extracted page PDF slice.
 */
apiRouter.get('/documents/:documentId/pages/:pageNumber/asset', async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId;
    const pageNumber = parseInt(req.params.pageNumber, 10);
    if (isNaN(pageNumber) || pageNumber < 1) {
      return res.status(400).json({ ok: false, message: 'Invalid page number.' });
    }

    const asset = await DocumentService.getPageAssetBinary(documentId, pageNumber);
    if (!asset) {
      return res.status(404).json({
        ok: false,
        message: `Extracted page asset for document "${documentId}", page ${pageNumber} not found.`
      });
    }

    res.setHeader('Content-Type', asset.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="page_${pageNumber}.pdf"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(asset.buffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/** Renders the authoritative stored single-page PDF to an actual scan image for browsers without PDF embedding. */
apiRouter.get('/documents/:documentId/pages/:pageNumber/rendered', async (req: Request, res: Response) => {
  try {
    const pageNumber = Number.parseInt(req.params.pageNumber, 10);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) return res.status(400).json({ ok: false, message: 'Invalid page number.' });
    const asset = await DocumentService.getPageAssetBinary(req.params.documentId, pageNumber);
    if (!asset) return res.status(404).json({ ok: false, message: 'Stored page asset was not found.' });
    const sourceHash = crypto.createHash('sha256').update(asset.buffer).digest('hex');
    const image = await renderStoredPagePdf(asset.buffer, `${req.params.documentId}:${pageNumber}:${sourceHash}`);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="page_${pageNumber}.png"`);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    res.setHeader('X-Archive-Page-Number', String(pageNumber));
    return res.send(image);
  } catch (error) {
    console.error('[Page viewer] Stored PDF could not be rendered:', error instanceof Error ? error.message : 'unknown error');
    return res.status(500).json({ ok: false, message: 'Digitized page could not be rendered.' });
  }
});

/**
 * GET /api/documents/:documentId/master-asset
 * Serves master archival document PDF binary.
 */
apiRouter.get('/documents/:documentId/master-asset', async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId;
    const asset = await DocumentService.getMasterAssetBinary(documentId);
    if (!asset) {
      return res.status(404).json({
        ok: false,
        message: `Master document asset for "${documentId}" not found in storage.`
      });
    }

    res.setHeader('Content-Type', asset.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${asset.filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(asset.buffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

// ============================================================================
// 4. ADVANCED OCR & VERIFICATION DATA LAYER ENDPOINTS
// ============================================================================

import { OcrService } from './ocrService.ts';
import { OcrProviderRegistry } from './ocrProvider.ts';

/**
 * GET /api/ocr/providers
 * Returns list of registered OCR engines and their environment configuration status.
 */
apiRouter.get('/ocr/providers', (_req: Request, res: Response) => {
  try {
    const providers = OcrProviderRegistry.listProviders();
    res.json({ ok: true, data: providers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

apiRouter.get('/ocr/documents/:documentId/progress', async (req: Request, res: Response) => {
  try {
    const progress = await OcrBatchService.getProgress(req.params.documentId);
    return res.json({ ok: true, data: progress });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'OCR progress could not be loaded.' });
  }
});

apiRouter.post('/ocr/documents/:documentId/start', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await OcrBatchService.start(req.params.documentId, false);
    return res.status(result.started ? 202 : 200).json({ ok: true, data: result });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : 'OCR job could not start.' });
  }
});

apiRouter.post('/ocr/documents/:documentId/retry-failed', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await OcrBatchService.start(req.params.documentId, true);
    return res.status(result.started ? 202 : 200).json({ ok: true, data: result });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : 'OCR retry could not start.' });
  }
});

/**
 * GET /api/ocr/pages/:pageId
 * Retrieves OCR record, raw machine text, verified text, and verification state for a page.
 */
apiRouter.get('/ocr/pages/:pageId', async (req: Request, res: Response) => {
  try {
    const pageId = req.params.pageId;
    if (!pageId || !pageId.trim()) {
      return res.status(400).json({ ok: false, message: 'Invalid or missing page ID.' });
    }

    const ocrStatus = await OcrService.getOCRForPage(pageId);
    res.json({ ok: true, data: ocrStatus });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/** Translate only the exact stored OCR for a page; cache by page, full source hash and target locale. */
apiRouter.post('/ocr/pages/:pageId/translate', async (req: Request, res: Response) => {
  try {
    const targetLanguage = String(req.body?.targetLanguage || '').toLowerCase();
    const languageNames: Record<string, string> = { en: 'English', hi: 'Hindi', mr: 'Marathi', kn: 'Kannada' };
    if (!languageNames[targetLanguage]) return res.status(400).json({ ok: false, message: 'Choose English, Hindi, Marathi, or Kannada.' });

    const page = await OcrService.getOCRForPage(req.params.pageId);
    const sourceText = page.ocr?.processedText?.trim() || page.ocr?.rawText?.trim() || '';
    if (!page.hasOcrRecord || !sourceText) return res.status(409).json({ ok: false, message: 'This page has no stored OCR text to translate.' });
    if (sourceText.length > MAX_TRANSLATION_SOURCE_CHARS) return res.status(413).json({ ok: false, message: `This page exceeds the safe ${MAX_TRANSLATION_SOURCE_CHARS.toLocaleString()}-character translation limit; no partial translation was created.` });

    const sourceHash = crypto.createHash('sha256').update(sourceText, 'utf8').digest('hex');
    const rawSourceLanguage = String(page.ocr?.language || 'und').toLowerCase();
    const sourceLanguage = rawSourceLanguage.startsWith('hi') || rawSourceLanguage === 'hin' ? 'hi'
      : rawSourceLanguage.startsWith('mr') || rawSourceLanguage === 'mar' ? 'mr'
      : rawSourceLanguage.startsWith('kn') || rawSourceLanguage === 'kan' ? 'kn'
      : rawSourceLanguage.startsWith('en') || rawSourceLanguage === 'eng' ? 'en' : 'und';
    if (sourceLanguage === targetLanguage) {
      return res.json({ ok: true, data: { translatedText: sourceText, sourceHash, sourceLanguage, targetLanguage, cached: false, sameLanguage: true, translationStatus: 'UNCHANGED' } });
    }

    const pool = getDbPool();
    if (!pool) return res.status(503).json({ ok: false, message: 'Translation storage is unavailable; no translation was generated.' });
    const cached = await pool.query(
      `SELECT translated_text FROM translations
       WHERE entity_type = 'OCR_PAGE' AND entity_id = $1 AND field_name = $2 AND language = $3
       LIMIT 1`,
      [page.pageId, sourceHash, targetLanguage]
    );
    if (cached.rows[0]) {
      return res.json({ ok: true, data: { translatedText: cached.rows[0].translated_text, sourceHash, sourceLanguage, targetLanguage, cached: true, translationStatus: 'TRANSLATED' } });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ ok: false, message: 'The translation provider is not configured; no translation was generated.' });
    const sourceName = languageNames[sourceLanguage] || `the OCR provider's ${rawSourceLanguage} language`;
    const ai = new GoogleGenAI({ apiKey });
    const sourceChunks = splitTranslationText(sourceText);
    const translatedChunks: string[] = [];
    for (const [index, sourceChunk] of sourceChunks.entries()) {
      const completionMarker = `__ABHILEKH_TRANSLATION_COMPLETE_${index + 1}_${sourceHash.slice(0, 12)}__`;
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: `Translate every natural-language word in this complete source segment from ${sourceName} to ${languageNames[targetLanguage]}. Do not summarize, shorten, paraphrase, omit, add facts, or add commentary. Preserve paragraph breaks, headings, lists, captions, labels, dates, numbers, names, archival/document/citation identifiers, URLs, ISBNs, reference numbers, and filenames exactly. Preserve the original order. Return the complete translation followed by this exact marker on its own final line: ${completionMarker}.\n\nSOURCE SEGMENT (${index + 1} of ${sourceChunks.length}):\n${sourceChunk}`,
      });
      const responseText = response.text?.trim();
      if (!responseText || !responseText.endsWith(completionMarker)) {
        return res.status(502).json({ ok: false, message: `Translation segment ${index + 1} did not return a complete response; no partial translation was saved.` });
      }
      const translatedChunk = responseText.slice(0, -completionMarker.length).trim();
      if (!translatedChunk) {
        return res.status(502).json({ ok: false, message: `Translation segment ${index + 1} was empty; no partial translation was saved.` });
      }
      translatedChunks.push(translatedChunk);
    }
    const translatedText = translatedChunks.join('\n\n');

    const translationId = `tr-${crypto.createHash('sha256').update(`${page.pageId}:${sourceHash}:${targetLanguage}`).digest('hex').slice(0, 60)}`;
    await pool.query(
      `INSERT INTO translations (id, entity_type, entity_id, field_name, language, translated_text, original_language, translation_status, updated_at)
       VALUES ($1, 'OCR_PAGE', $2, $3, $4, $5, $6, 'MACHINE', CURRENT_TIMESTAMP)
       ON CONFLICT (entity_type, entity_id, field_name, language)
       DO UPDATE SET translated_text = EXCLUDED.translated_text, original_language = EXCLUDED.original_language,
                     translation_status = 'MACHINE', updated_at = CURRENT_TIMESTAMP`,
      [translationId, page.pageId, sourceHash, targetLanguage, translatedText, sourceLanguage]
    );
    return res.json({ ok: true, data: { translatedText, sourceHash, sourceLanguage, targetLanguage, cached: false, translationStatus: 'TRANSLATED' } });
  } catch (error) {
    console.error('[Translation] Page translation failed:', error instanceof Error ? error.message : 'unknown error');
    return res.status(502).json({ ok: false, message: 'Page translation failed; no completed translation was recorded.' });
  }
});

/**
 * GET /api/ocr/pages/:pageId/history
 * Retrieves full audit history of OCR extraction, verification, and corrections for a page.
 */
apiRouter.get('/ocr/pages/:pageId/history', async (req: Request, res: Response) => {
  try {
    const pageId = req.params.pageId;
    const history = await OcrService.getOCRHistory(pageId);
    res.json({ ok: true, data: history });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/**
 * GET /api/ocr/pages/:pageId/citation
 * Traces the complete 6-level archival provenance chain:
 * Source Collection -> Source Record -> Archive Item -> Document -> Document Page -> OCR Record -> Verified Text
 */
apiRouter.get('/ocr/pages/:pageId/citation', async (req: Request, res: Response) => {
  try {
    const pageId = req.params.pageId;
    const citation = await OcrService.getCitationProvenance(pageId);
    if (!citation.isValid) {
      return res.status(404).json({ ok: false, message: citation.error });
    }
    res.json({ ok: true, data: citation });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message: msg });
  }
});

/**
 * POST /api/ocr/pages/:pageId/process
 * Admin endpoint: Triggers OCR processing on a legitimate page asset.
 * Strictly verifies physical binary exists and rejects METADATA_ONLY records.
 */
apiRouter.post('/ocr/pages/:pageId/process', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pageId = req.params.pageId;
    const { providerId, language } = req.body || {};

    const record = await OcrService.processPageOCR(pageId, {
      providerId,
      language
    });
    res.status(201).json({ ok: true, data: record });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ ok: false, message: msg });
  }
});

/**
 * POST /api/ocr/pages/:pageId/verify
 * Admin endpoint: Certified reviewer marks OCR output as verified.
 */
apiRouter.post('/ocr/pages/:pageId/verify', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pageId = req.params.pageId;
    const { reviewerId, reviewerName, notes } = req.body || {};

    if (!reviewerId) {
      return res.status(400).json({
        ok: false,
        message: 'Reviewer identifier (reviewerId) is required for verification audit.'
      });
    }

    const verified = await OcrService.markOCRVerified(pageId, {
      reviewerId,
      reviewerName,
      notes
    });
    res.json({ ok: true, data: verified });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ ok: false, message: msg });
  }
});

/**
 * PUT /api/ocr/pages/:pageId/verification
 * Admin endpoint: Updates OCR verification status and reviewer audit notes.
 */
apiRouter.put('/ocr/pages/:pageId/verification', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pageId = req.params.pageId;
    const { status, reviewerId, reviewerName, notes } = req.body || {};

    if (!reviewerId) {
      return res.status(400).json({
        ok: false,
        message: 'Reviewer identifier (reviewerId) is required for verification audit.'
      });
    }

    if (!status) {
      return res.status(400).json({
        ok: false,
        message: 'Verification status is required.'
      });
    }

    const updated = await OcrService.updateOCRVerification(pageId, {
      status,
      reviewerId,
      reviewerName,
      notes
    });
    res.json({ ok: true, data: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ ok: false, message: msg });
  }
});

/**
 * POST /api/ocr/pages/:pageId/correct
 * Admin endpoint: Certified reviewer submits corrections.
 * CRITICAL: Preserves original raw_text (machine OCR) unchanged!
 */
apiRouter.post('/ocr/pages/:pageId/correct', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pageId = req.params.pageId;
    const { correctedText, reviewerId, reviewerName, correctionNotes } = req.body || {};

    if (!reviewerId || !correctedText) {
      return res.status(400).json({
        ok: false,
        message: 'Both reviewerId and correctedText are required to submit an OCR correction.'
      });
    }

    const corrected = await OcrService.correctOCR(pageId, {
      correctedText,
      reviewerId,
      reviewerName,
      correctionNotes: correctionNotes || 'Scholarly correction from original facsimile.'
    });
    res.json({ ok: true, data: corrected });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ ok: false, message: msg });
  }
});
