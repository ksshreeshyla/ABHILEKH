-- Adds resumable OCR progress, opaque QR continuation sessions, and verified 360 content.
-- Safe to re-run. This migration does not alter or remove archival records.

ALTER TABLE ocr_records ALTER COLUMN confidence DROP NOT NULL;
ALTER TABLE ocr_records ALTER COLUMN confidence DROP DEFAULT;

CREATE TABLE IF NOT EXISTS share_sessions (
  id VARCHAR(64) PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  context_type VARCHAR(24) NOT NULL CHECK (context_type IN ('document', 'research', 'heritage360')),
  context_payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_share_sessions_expiry ON share_sessions(expires_at);

CREATE TABLE IF NOT EXISTS heritage_locations (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  city VARCHAR(128),
  state VARCHAR(128),
  country VARCHAR(128),
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS heritage_viewpoints (
  id VARCHAR(64) PRIMARY KEY,
  heritage_location_id VARCHAR(64) NOT NULL REFERENCES heritage_locations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  panorama_asset_reference TEXT,
  thumbnail_asset_reference TEXT,
  initial_heading NUMERIC(7, 3) NOT NULL DEFAULT 0,
  initial_pitch NUMERIC(7, 3) NOT NULL DEFAULT 0,
  initial_zoom NUMERIC(5, 2) NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  panorama_width INTEGER,
  panorama_height INTEGER,
  panorama_checksum_sha256 CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_heritage_viewpoints_location ON heritage_viewpoints(heritage_location_id, sort_order);

CREATE TABLE IF NOT EXISTS heritage_hotspots (
  id VARCHAR(64) PRIMARY KEY,
  viewpoint_id VARCHAR(64) NOT NULL REFERENCES heritage_viewpoints(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  heading NUMERIC(7, 3) NOT NULL,
  pitch NUMERIC(7, 3) NOT NULL,
  target_type VARCHAR(24) NOT NULL DEFAULT 'none' CHECK (target_type IN ('none', 'archive_item', 'document', 'person', 'event', 'viewpoint', 'media', 'knowledge_node')),
  target_id VARCHAR(64),
  target_viewpoint_id VARCHAR(64) REFERENCES heritage_viewpoints(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_heritage_hotspots_viewpoint ON heritage_hotspots(viewpoint_id);

ALTER TABLE heritage_hotspots DROP CONSTRAINT IF EXISTS heritage_hotspots_target_type_check;
ALTER TABLE heritage_hotspots ADD CONSTRAINT heritage_hotspots_target_type_check
  CHECK (target_type IN ('none', 'archive_item', 'document', 'person', 'event', 'viewpoint', 'media', 'knowledge_node'));
