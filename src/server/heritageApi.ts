import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express, { type Request, type Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { getDbPool } from './db.ts';
import { requireAdmin } from './adminAuth.ts';
import { DocumentStorageService } from './storage/documentStorage.ts';

export const heritageRouter = express.Router();
const uploadDir = path.join(os.tmpdir(), 'abhilekh-heritage-uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({ destination: uploadDir, filename: (_req, _file, callback) => callback(null, `panorama-${crypto.randomUUID()}.tmp`) }),
  limits: { fileSize: 80 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});
const id = () => crypto.randomUUID();
const safeId = (value: string) => /^[A-Za-z0-9_-]{1,100}$/.test(value);
const statuses = new Set(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

async function audit(req: Request, action: string, title: string, details: string): Promise<void> {
  const pool = getDbPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO audit_logs (id, action, performed_by, user_role, document_title, details, ip_address)
       VALUES ($1,$2,'authenticated-archivist','ADMINISTRATOR',$3,$4,$5);`,
      [id(), action, title.slice(0, 500), details.slice(0, 2000), String(req.ip || '').slice(0, 45) || null],
    );
  } catch (error) { console.error('[Heritage audit] Could not record admin action:', error instanceof Error ? error.message : 'unknown error'); }
}

function panoramaMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function errorResponse(res: Response, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return res.status(message.includes('not found') ? 404 : 400).json({ ok: false, message });
}

async function validateTarget(type: string, targetId: string | null, targetViewpointId: string | null) {
  const pool = getDbPool();
  if (!pool) throw new Error('Archive database unavailable.');
  if (type === 'none') return;
  if (type === 'viewpoint') {
    const viewpointId = targetViewpointId || targetId;
    if (!viewpointId || !safeId(viewpointId)) throw new Error('Choose an existing viewpoint target.');
    const found = await pool.query('SELECT 1 FROM heritage_viewpoints WHERE id = $1 AND status <> \'ARCHIVED\';', [viewpointId]);
    if (!found.rowCount) throw new Error('Target viewpoint was not found.');
    return;
  }
  const tables: Record<string, string> = { archive_item: 'archive_items', document: 'documents', person: 'people', event: 'events', media: 'media_records', knowledge_node: 'knowledge_nodes' };
  const table = tables[type];
  if (!table || !targetId || !safeId(targetId)) throw new Error('Hotspot target type or identifier is invalid.');
  const found = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1 LIMIT 1;`, [targetId]);
  if (!found.rowCount) throw new Error('Hotspot target was not found in the archive database.');
}

heritageRouter.get('/locations', async (_req, res) => {
  const pool = getDbPool();
  if (!pool) return res.status(503).json({ ok: false, data: [], message: 'Heritage viewer requires the archive database.' });
  try {
    const result = await pool.query(
      `SELECT l.id, l.title, l.description, l.city, l.state, l.country, l.latitude, l.longitude,
        COALESCE(json_agg(json_build_object(
          'id', v.id, 'title', v.title, 'description', v.description,
          'initialHeading', v.initial_heading, 'initialPitch', v.initial_pitch, 'initialZoom', v.initial_zoom,
          'sortOrder', v.sort_order, 'panoramaWidth', v.panorama_width, 'panoramaHeight', v.panorama_height,
          'panoramaUrl', '/api/heritage/viewpoints/' || v.id || '/panorama',
          'hotspots', COALESCE((SELECT json_agg(json_build_object(
            'id', h.id, 'title', h.title, 'description', h.description, 'heading', h.heading, 'pitch', h.pitch,
            'targetType', h.target_type, 'targetId', h.target_id, 'targetViewpointId', h.target_viewpoint_id
          ) ORDER BY h.id) FROM heritage_hotspots h WHERE h.viewpoint_id = v.id), '[]'::json)
        ) ORDER BY v.sort_order, v.id) FILTER (WHERE v.id IS NOT NULL), '[]'::json) AS viewpoints
       FROM heritage_locations l
       LEFT JOIN heritage_viewpoints v ON v.heritage_location_id = l.id AND v.status = 'PUBLISHED' AND v.panorama_asset_reference IS NOT NULL
       WHERE l.status = 'PUBLISHED'
       GROUP BY l.id ORDER BY l.title;`
    );
    return res.json({ ok: true, source: 'database', data: result.rows });
  } catch { return res.status(503).json({ ok: false, source: 'database_unavailable', data: [], message: 'Heritage locations could not be loaded.' }); }
});

heritageRouter.get('/admin/locations', requireAdmin, async (_req, res) => {
  const pool = getDbPool();
  if (!pool) return res.status(503).json({ ok: false, message: 'Archive database unavailable.' });
  try {
    const locations = await pool.query('SELECT * FROM heritage_locations ORDER BY title;');
    const viewpoints = await pool.query(
      `SELECT id, heritage_location_id, title, description, initial_heading, initial_pitch, initial_zoom,
        sort_order, status, panorama_width, panorama_height,
        (panorama_asset_reference IS NOT NULL) AS has_panorama, created_at, updated_at
       FROM heritage_viewpoints ORDER BY heritage_location_id, sort_order, title;`,
    );
    const hotspots = await pool.query('SELECT * FROM heritage_hotspots ORDER BY viewpoint_id, title;');
    return res.json({ ok: true, data: { locations: locations.rows, viewpoints: viewpoints.rows, hotspots: hotspots.rows } });
  } catch { return res.status(503).json({ ok: false, message: 'Heritage administration schema is unavailable. Apply migration 0002.' }); }
});

heritageRouter.post('/admin/locations', requireAdmin, async (req, res) => {
  const pool = getDbPool();
  if (!pool) return res.status(503).json({ ok: false, message: 'Archive database unavailable.' });
  const { title, description = '', city = null, state = null, country = null, latitude = null, longitude = null } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || title.length > 255) return res.status(400).json({ ok: false, message: 'A location title (up to 255 characters) is required.' });
  try {
    const result = await pool.query(
      `INSERT INTO heritage_locations (id,title,description,city,state,country,latitude,longitude)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *;`,
      [id(), title.trim(), String(description).slice(0, 10000), city, state, country, latitude, longitude]
    );
    void audit(req, 'HERITAGE_LOCATION_CREATED', title.trim(), `Created draft heritage location ${result.rows[0].id}.`);
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) { return errorResponse(res, error, 'Location could not be created.'); }
});

heritageRouter.patch('/admin/locations/:locationId', requireAdmin, async (req, res) => {
  const pool = getDbPool();
  const locationId = req.params.locationId;
  if (!pool) return res.status(503).json({ ok: false, message: 'Archive database unavailable.' });
  if (!safeId(locationId)) return res.status(400).json({ ok: false, message: 'Invalid location identifier.' });
  const { title, description, city, state, country, latitude, longitude, status } = req.body || {};
  if (status !== undefined && !statuses.has(status)) return res.status(400).json({ ok: false, message: 'Location status is invalid.' });
  try {
    const result = await pool.query(
      `UPDATE heritage_locations SET title=COALESCE($2,title), description=COALESCE($3,description), city=COALESCE($4,city),
       state=COALESCE($5,state), country=COALESCE($6,country), latitude=COALESCE($7,latitude), longitude=COALESCE($8,longitude),
       status=COALESCE($9,status), updated_at=NOW() WHERE id=$1 RETURNING *;`,
      [locationId, title?.trim(), description === undefined ? null : String(description).slice(0, 10000), city, state, country, latitude, longitude, status]
    );
    if (!result.rowCount) return res.status(404).json({ ok: false, message: 'Heritage location was not found.' });
    void audit(req, 'HERITAGE_LOCATION_UPDATED', result.rows[0].title, `Updated heritage location ${locationId}; status ${result.rows[0].status}.`);
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) { return errorResponse(res, error, 'Location could not be updated.'); }
});

heritageRouter.post('/admin/locations/:locationId/viewpoints', requireAdmin, async (req, res) => {
  const pool = getDbPool();
  const locationId = req.params.locationId;
  const { title, description = '', initialHeading = 0, initialPitch = 0, initialZoom = 1, sortOrder = 0 } = req.body || {};
  if (!pool) return res.status(503).json({ ok: false, message: 'Archive database unavailable.' });
  if (!safeId(locationId) || typeof title !== 'string' || !title.trim() || title.length > 255) return res.status(400).json({ ok: false, message: 'Valid location and viewpoint title are required.' });
  if (!Number.isFinite(Number(initialHeading)) || Number(initialHeading) < -360 || Number(initialHeading) > 360 || !Number.isFinite(Number(initialPitch)) || Number(initialPitch) < -90 || Number(initialPitch) > 90 || !Number.isFinite(Number(initialZoom)) || Number(initialZoom) < 1 || Number(initialZoom) > 3) return res.status(400).json({ ok: false, message: 'Initial camera values are outside allowed ranges.' });
  try {
    const result = await pool.query(
      `INSERT INTO heritage_viewpoints (id,heritage_location_id,title,description,initial_heading,initial_pitch,initial_zoom,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *;`,
      [id(), locationId, title.trim(), String(description).slice(0, 10000), Number(initialHeading), Number(initialPitch), Number(initialZoom), Math.trunc(Number(sortOrder) || 0)]
    );
    void audit(req, 'HERITAGE_VIEWPOINT_CREATED', title.trim(), `Created draft viewpoint ${result.rows[0].id} for location ${locationId}.`);
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) { return errorResponse(res, error, 'Viewpoint could not be created.'); }
});

heritageRouter.patch('/admin/viewpoints/:viewpointId', requireAdmin, async (req, res) => {
  const pool = getDbPool();
  const viewpointId = req.params.viewpointId;
  const { title, description, initialHeading, initialPitch, initialZoom, sortOrder, status } = req.body || {};
  if (!pool) return res.status(503).json({ ok: false, message: 'Archive database unavailable.' });
  if (!safeId(viewpointId) || (status !== undefined && !statuses.has(status))) return res.status(400).json({ ok: false, message: 'Viewpoint or status is invalid.' });
  if (status === 'PUBLISHED') {
    const asset = await pool.query('SELECT panorama_asset_reference FROM heritage_viewpoints WHERE id=$1;', [viewpointId]);
    if (!asset.rowCount || !asset.rows[0].panorama_asset_reference) return res.status(400).json({ ok: false, message: 'Upload a valid equirectangular panorama before publishing this viewpoint.' });
  }
  try {
    const result = await pool.query(
      `UPDATE heritage_viewpoints SET title=COALESCE($2,title), description=COALESCE($3,description),
       initial_heading=COALESCE($4,initial_heading), initial_pitch=COALESCE($5,initial_pitch), initial_zoom=COALESCE($6,initial_zoom),
       sort_order=COALESCE($7,sort_order), status=COALESCE($8,status), updated_at=NOW()
       WHERE id=$1 RETURNING *;`,
      [viewpointId, title?.trim(), description === undefined ? null : String(description).slice(0, 10000), initialHeading, initialPitch, initialZoom, sortOrder, status]
    );
    if (!result.rowCount) return res.status(404).json({ ok: false, message: 'Viewpoint was not found.' });
    void audit(req, 'HERITAGE_VIEWPOINT_UPDATED', result.rows[0].title, `Updated viewpoint ${viewpointId}; status ${result.rows[0].status}.`);
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) { return errorResponse(res, error, 'Viewpoint could not be updated.'); }
});

heritageRouter.post('/admin/viewpoints/:viewpointId/panorama', requireAdmin, (req, res, next) => {
  upload.single('file')(req, res, error => {
    if (error) return res.status(400).json({ ok: false, message: error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 'Panorama exceeds the 80 MiB limit.' : 'Panorama upload was rejected.' });
    next();
  });
}, async (req: Request, res: Response) => {
  const file = req.file;
  const pool = getDbPool();
  try {
    if (!file) return res.status(400).json({ ok: false, message: 'Choose a JPEG, PNG, or WebP panorama image.' });
    if (!pool) return res.status(503).json({ ok: false, message: 'Archive database unavailable.' });
    const viewpointId = req.params.viewpointId;
    if (!safeId(viewpointId)) return res.status(400).json({ ok: false, message: 'Invalid viewpoint identifier.' });
    const view = await pool.query('SELECT id, heritage_location_id FROM heritage_viewpoints WHERE id=$1;', [viewpointId]);
    if (!view.rowCount) return res.status(404).json({ ok: false, message: 'Viewpoint was not found.' });
    const buffer = await fs.promises.readFile(file.path);
    const actualMime = panoramaMime(buffer);
    if (!actualMime || actualMime !== file.mimetype) return res.status(400).json({ ok: false, message: 'Image content does not match a supported JPEG, PNG, or WebP file.' });
    const image = sharp(buffer, { limitInputPixels: 80_000_000, failOn: 'error' });
    const metadata = await image.metadata();
    await image.stats();
    if (!metadata.width || !metadata.height || metadata.width < 2048 || metadata.height < 1024 || metadata.width > 20000 || metadata.height > 10000 || Math.abs(metadata.width / metadata.height - 2) > 0.05) {
      return res.status(400).json({ ok: false, message: 'Panorama must be a decodable, approximately 2:1 equirectangular image at least 2048×1024 and no larger than 20000×10000.' });
    }
    const stored = await DocumentStorageService.saveHeritagePanorama(view.rows[0].heritage_location_id, viewpointId, buffer, actualMime);
    const update = await pool.query(
      `UPDATE heritage_viewpoints SET panorama_asset_reference=$2, panorama_width=$3, panorama_height=$4,
       panorama_checksum_sha256=$5, status='DRAFT', updated_at=NOW() WHERE id=$1 RETURNING id,title,status;`,
      [viewpointId, stored.storageKey, metadata.width, metadata.height, stored.checksumSha256]
    );
    void audit(req, 'HERITAGE_PANORAMA_STORED', update.rows[0].title, `Stored verified image bytes for viewpoint ${viewpointId}; SHA-256 ${stored.checksumSha256}, ${metadata.width}x${metadata.height}.`);
    return res.status(201).json({ ok: true, data: { ...update.rows[0], width: metadata.width, height: metadata.height, fileSizeBytes: stored.fileSizeBytes, checksumSha256: stored.checksumSha256, requiresReview: true } });
  } catch (error) { return errorResponse(res, error, 'Panorama could not be stored.'); }
  finally { if (file?.path) await fs.promises.unlink(file.path).catch(() => undefined); }
});

heritageRouter.get('/viewpoints/:viewpointId/panorama', async (req, res) => {
  const pool = getDbPool();
  if (!pool) return res.status(503).end();
  try {
    const result = await pool.query(
      `SELECT v.panorama_asset_reference, v.panorama_checksum_sha256, l.status AS location_status, v.status AS viewpoint_status
       FROM heritage_viewpoints v JOIN heritage_locations l ON l.id=v.heritage_location_id WHERE v.id=$1;`, [req.params.viewpointId]
    );
    if (!result.rowCount || result.rows[0].location_status !== 'PUBLISHED' || result.rows[0].viewpoint_status !== 'PUBLISHED' || !result.rows[0].panorama_asset_reference) return res.status(404).end();
    const buffer = await DocumentStorageService.getHeritagePanorama(result.rows[0].panorama_asset_reference);
    if (!buffer || DocumentStorageService.computeSha256(buffer) !== String(result.rows[0].panorama_checksum_sha256 || '').trim()) return res.status(404).end();
    const mime = panoramaMime(buffer);
    if (!mime) return res.status(404).end();
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(buffer);
  } catch { return res.status(503).end(); }
});

heritageRouter.post('/admin/viewpoints/:viewpointId/hotspots', requireAdmin, async (req, res) => {
  const pool = getDbPool();
  const viewpointId = req.params.viewpointId;
  const { title, description = '', heading, pitch, targetType = 'none', targetId = null, targetViewpointId = null } = req.body || {};
  if (!pool) return res.status(503).json({ ok: false, message: 'Archive database unavailable.' });
  if (!safeId(viewpointId) || typeof title !== 'string' || !title.trim() || title.length > 255 || !Number.isFinite(Number(heading)) || Number(heading) < -360 || Number(heading) > 360 || !Number.isFinite(Number(pitch)) || Number(pitch) < -90 || Number(pitch) > 90) return res.status(400).json({ ok: false, message: 'Hotspot title and heading/pitch values are required.' });
  try {
    await validateTarget(String(targetType), targetId, targetViewpointId);
    const result = await pool.query(
      `INSERT INTO heritage_hotspots (id,viewpoint_id,title,description,heading,pitch,target_type,target_id,target_viewpoint_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *;`,
      [id(), viewpointId, title.trim(), String(description).slice(0, 10000), Number(heading), Number(pitch), targetType, targetId, targetViewpointId]
    );
    void audit(req, 'HERITAGE_HOTSPOT_CREATED', title.trim(), `Created hotspot ${result.rows[0].id} for viewpoint ${viewpointId}.`);
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) { return errorResponse(res, error, 'Hotspot could not be created.'); }
});

heritageRouter.patch('/admin/hotspots/:hotspotId', requireAdmin, async (req, res) => {
  const pool = getDbPool();
  const hotspotId = req.params.hotspotId;
  if (!pool) return res.status(503).json({ ok: false, message: 'Archive database unavailable.' });
  if (!safeId(hotspotId)) return res.status(400).json({ ok: false, message: 'Invalid hotspot identifier.' });
  const current = await pool.query('SELECT * FROM heritage_hotspots WHERE id=$1;', [hotspotId]);
  if (!current.rowCount) return res.status(404).json({ ok: false, message: 'Hotspot was not found.' });
  const row = current.rows[0];
  const body = req.body || {};
  const targetType = body.targetType ?? row.target_type;
  const targetId = body.targetId === undefined ? row.target_id : body.targetId;
  const targetViewpointId = body.targetViewpointId === undefined ? row.target_viewpoint_id : body.targetViewpointId;
  try {
    await validateTarget(targetType, targetId, targetViewpointId);
    const result = await pool.query(
      `UPDATE heritage_hotspots SET title=COALESCE($2,title), description=COALESCE($3,description), heading=COALESCE($4,heading), pitch=COALESCE($5,pitch),
       target_type=$6,target_id=$7,target_viewpoint_id=$8,updated_at=NOW() WHERE id=$1 RETURNING *;`,
      [hotspotId, body.title?.trim(), body.description === undefined ? null : String(body.description).slice(0, 10000), body.heading, body.pitch, targetType, targetId, targetViewpointId]
    );
    void audit(req, 'HERITAGE_HOTSPOT_UPDATED', result.rows[0].title, `Updated hotspot ${hotspotId}.`);
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) { return errorResponse(res, error, 'Hotspot could not be updated.'); }
});

heritageRouter.delete('/admin/hotspots/:hotspotId', requireAdmin, async (req, res) => {
  const pool = getDbPool();
  if (!pool) return res.status(503).json({ ok: false, message: 'Archive database unavailable.' });
  const result = await pool.query('DELETE FROM heritage_hotspots WHERE id=$1 RETURNING id;', [req.params.hotspotId]);
  if (result.rowCount) void audit(req, 'HERITAGE_HOTSPOT_DELETED', 'Heritage hotspot', `Deleted hotspot ${req.params.hotspotId}.`);
  return result.rowCount ? res.json({ ok: true }) : res.status(404).json({ ok: false, message: 'Hotspot was not found.' });
});
