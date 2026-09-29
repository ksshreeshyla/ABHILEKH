import crypto from 'crypto';
import { getDbPool } from './db.ts';

export type ShareContext =
  | { type: 'document'; documentId: string; pageNumber: number }
  | { type: 'research'; query?: string; documentId?: string; pageNumber?: number; references?: Array<{ documentId: string; pageNumber: number }> }
  | { type: 'heritage360'; locationId: string; viewpointId?: string; heading?: number; pitch?: number; zoom?: number; hotspotId?: string };

const safeId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);

export function validateShareContext(input: unknown): ShareContext {
  if (!input || typeof input !== 'object') throw new Error('A supported continuation context is required.');
  const value = input as Record<string, unknown>;
  if (value.type === 'document') {
    if (!safeId(value.documentId)) throw new Error('A valid document is required.');
    const pageNumber = Number(value.pageNumber);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 100_000) throw new Error('Page number is invalid.');
    return { type: 'document', documentId: value.documentId, pageNumber };
  }
  if (value.type === 'research') {
    const query = typeof value.query === 'string' ? value.query.trim().slice(0, 300) : undefined;
    const documentId = value.documentId;
    const pageNumber = value.pageNumber === undefined ? undefined : Number(value.pageNumber);
    if (documentId !== undefined && !safeId(documentId)) throw new Error('Document context is invalid.');
    if (pageNumber !== undefined && (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 100_000)) throw new Error('Page context is invalid.');
    const references = Array.isArray(value.references) ? value.references.slice(0, 5).flatMap((entry: any) =>
      safeId(entry?.documentId) && Number.isInteger(Number(entry?.pageNumber)) && Number(entry.pageNumber) > 0
        ? [{ documentId: entry.documentId as string, pageNumber: Number(entry.pageNumber) }] : []) : undefined;
    return { type: 'research', query: query || undefined, documentId: documentId as string | undefined, pageNumber, references };
  }
  if (value.type === 'heritage360') {
    if (!safeId(value.locationId)) throw new Error('A valid heritage location is required.');
    if (value.viewpointId !== undefined && !safeId(value.viewpointId)) throw new Error('Viewpoint context is invalid.');
    if (value.hotspotId !== undefined && !safeId(value.hotspotId)) throw new Error('Hotspot context is invalid.');
    const bounded = (field: 'heading' | 'pitch' | 'zoom', fallback: number, min: number, max: number) => {
      const number = value[field] === undefined ? fallback : Number(value[field]);
      if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${field} is outside its allowed range.`);
      return number;
    };
    return {
      type: 'heritage360', locationId: value.locationId, viewpointId: value.viewpointId as string | undefined,
      heading: bounded('heading', 0, -360, 360), pitch: bounded('pitch', 0, -90, 90), zoom: bounded('zoom', 1, 1, 3),
      hotspotId: value.hotspotId as string | undefined,
    };
  }
  throw new Error('Unsupported continuation context.');
}

function tokenHash(token: string): string { return crypto.createHash('sha256').update(token).digest('hex'); }
function ttlMinutes(): number {
  const value = Number(process.env.QR_SESSION_TTL_MINUTES || 30);
  return Math.max(5, Math.min(Number.isFinite(value) ? value : 30, 240));
}

export class ShareSessionService {
  static async create(context: ShareContext) {
    const pool = getDbPool();
    if (!pool) throw new Error('Share sessions require the archive database.');
    if (context.type === 'document') {
      const exists = await pool.query(
        `SELECT 1 FROM document_pages p JOIN documents d ON d.id=p.document_id WHERE d.id=$1 AND p.page_number=$2 LIMIT 1;`,
        [context.documentId, context.pageNumber]
      );
      if (!exists.rowCount) throw new Error('The selected document page is not available to share.');
    } else if (context.type === 'research') {
      const refs = [...(context.documentId ? [{ documentId: context.documentId, pageNumber: context.pageNumber }] : []), ...(context.references || [])].filter((ref): ref is { documentId: string; pageNumber: number } => Boolean(ref.documentId && ref.pageNumber));
      for (const ref of refs) {
        const exists = await pool.query('SELECT 1 FROM documents d JOIN document_pages p ON p.document_id=d.id WHERE d.id=$1 AND p.page_number=$2 LIMIT 1;', [ref.documentId, ref.pageNumber]);
        if (!exists.rowCount) throw new Error('A cited document page in this research context is unavailable.');
      }
    } else {
      const exists = await pool.query(
        `SELECT 1 FROM heritage_locations l JOIN heritage_viewpoints v ON v.heritage_location_id=l.id
         WHERE l.id=$1 AND l.status='PUBLISHED' AND v.status='PUBLISHED' AND v.panorama_asset_reference IS NOT NULL
           AND ($2::varchar IS NULL OR v.id=$2) LIMIT 1;`,
        [context.locationId, context.viewpointId || null]
      );
      if (!exists.rowCount) throw new Error('No published verified panorama exists for the selected location and viewpoint.');
      if (context.hotspotId) {
        const hotspot = await pool.query('SELECT 1 FROM heritage_hotspots WHERE id=$1 AND ($2::varchar IS NULL OR viewpoint_id=$2);', [context.hotspotId, context.viewpointId || null]);
        if (!hotspot.rowCount) throw new Error('The selected heritage hotspot is unavailable.');
      }
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + ttlMinutes() * 60_000);
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO share_sessions (id, token_hash, context_type, context_payload, expires_at)
       VALUES ($1, $2, $3, $4::jsonb, $5);`,
      [id, tokenHash(token), context.type, JSON.stringify(context), expiresAt.toISOString()]
    );
    return { token, expiresAt: expiresAt.toISOString(), contextType: context.type };
  }

  static async resolve(token: string) {
    if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return { state: 'invalid' as const };
    const pool = getDbPool();
    if (!pool) throw new Error('Share sessions require the archive database.');
    const result = await pool.query(
      `UPDATE share_sessions SET last_accessed_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
       RETURNING context_type, context_payload, expires_at;`, [tokenHash(token)]
    );
    if (result.rows.length) {
      const context = result.rows[0].context_payload as ShareContext;
      if (context.type === 'document') {
        const document = await pool.query('SELECT archive_item_id FROM documents WHERE id=$1;', [context.documentId]);
        if (!document.rowCount) return { state: 'unavailable' as const };
        return { state: 'valid' as const, context: { ...context, archiveItemId: document.rows[0].archive_item_id }, expiresAt: result.rows[0].expires_at };
      }
      if (context.type === 'research' && (context.references?.length || context.documentId)) {
        const ids = [...new Set([...(context.documentId ? [context.documentId] : []), ...(context.references || []).map(ref => ref.documentId)])];
        const documents = await pool.query('SELECT id, archive_item_id FROM documents WHERE id = ANY($1::varchar[]);', [ids]);
        const archiveItemByDocument = Object.fromEntries(documents.rows.map(row => [row.id, row.archive_item_id]));
        const references = context.references?.map(ref => ({ ...ref, archiveItemId: archiveItemByDocument[ref.documentId] })).filter(ref => ref.archiveItemId);
        return { state: 'valid' as const, context: { ...context, archiveItemId: context.documentId ? archiveItemByDocument[context.documentId] : undefined, references }, expiresAt: result.rows[0].expires_at };
      }
      return { state: 'valid' as const, context, expiresAt: result.rows[0].expires_at };
    }
    const expired = await pool.query('SELECT revoked_at, expires_at FROM share_sessions WHERE token_hash = $1 LIMIT 1;', [tokenHash(token)]);
    if (!expired.rows.length) return { state: 'invalid' as const };
    return { state: expired.rows[0].revoked_at ? 'revoked' as const : 'expired' as const };
  }
}
