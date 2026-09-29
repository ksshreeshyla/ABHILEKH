-- ============================================================================
-- MIGRATION: 0001_initial_schema.sql
-- PROJECT: Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
-- TARGET DATABASE: PostgreSQL 14+ / Cloud SQL for PostgreSQL / Supabase
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- Vector extension for future AI Semantic Search & RAG Embeddings
-- Note: Activated when pgvector extension is available on the PostgreSQL host
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "vector";
EXCEPTION
  WHEN undefined_file THEN
    RAISE NOTICE 'pgvector extension not installed on host. Vector tables will use array fallback.';
END $$;

-- Set timezone to Asia/Kolkata
SET timezone = 'Asia/Kolkata';

-- ============================================================================
-- 1. SOURCE COLLECTIONS & PROVENANCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS source_collections (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  organization VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  source_url VARCHAR(512),
  source_type VARCHAR(64) NOT NULL,
  access_information TEXT NOT NULL,
  total_records_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_records (
  id VARCHAR(64) PRIMARY KEY,
  source_collection_id VARCHAR(64) NOT NULL REFERENCES source_collections(id) ON DELETE RESTRICT,
  original_source_identifier VARCHAR(255) NOT NULL,
  original_title TEXT NOT NULL,
  original_url VARCHAR(512),
  repository VARCHAR(255) NOT NULL,
  source_metadata JSONB DEFAULT '{}'::jsonb,
  ingestion_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ingestion_method VARCHAR(64) NOT NULL,
  provenance_notes TEXT NOT NULL,
  is_demo_record BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_source_record UNIQUE (source_collection_id, original_source_identifier)
);

CREATE INDEX IF NOT EXISTS idx_source_records_collection ON source_records(source_collection_id);
CREATE INDEX IF NOT EXISTS idx_source_records_is_demo ON source_records(is_demo_record);

-- ============================================================================
-- 2. ARCHIVE ITEMS (CENTRAL CORPUS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS archive_items (
  id VARCHAR(64) PRIMARY KEY,
  archive_id VARCHAR(128) NOT NULL UNIQUE,
  source_record_id VARCHAR(64) REFERENCES source_records(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  title_hi TEXT,
  title_mr TEXT,
  title_kn TEXT,
  category VARCHAR(64) NOT NULL,
  date VARCHAR(64) NOT NULL,
  year INTEGER NOT NULL,
  author VARCHAR(255) NOT NULL,
  collection VARCHAR(255) NOT NULL,
  source_institution VARCHAR(255) NOT NULL,
  source_provenance TEXT,
  language VARCHAR(32) DEFAULT 'English',
  original_holding TEXT,
  description TEXT NOT NULL,
  description_hi TEXT,
  description_mr TEXT,
  description_kn TEXT,
  full_text TEXT NOT NULL,
  ai_summary TEXT NOT NULL,
  ai_summary_hi TEXT,
  ai_summary_mr TEXT,
  ai_summary_kn TEXT,
  key_concepts TEXT[] DEFAULT '{}',
  publishing_status VARCHAR(32) NOT NULL DEFAULT 'Draft',
  is_featured BOOLEAN DEFAULT FALSE,
  is_demo_record BOOLEAN DEFAULT FALSE,
  thumbnail_url TEXT,
  download_url TEXT,
  -- PostgreSQL Full-Text Search tsvector column
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(author, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(full_text, '')), 'D')
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_archive_items_category ON archive_items(category);
CREATE INDEX IF NOT EXISTS idx_archive_items_year ON archive_items(year);
CREATE INDEX IF NOT EXISTS idx_archive_items_status ON archive_items(publishing_status);
CREATE INDEX IF NOT EXISTS idx_archive_items_demo ON archive_items(is_demo_record);
CREATE INDEX IF NOT EXISTS idx_archive_items_fts ON archive_items USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_archive_items_title_trgm ON archive_items USING gin(title gin_trgm_ops);

-- ============================================================================
-- 3. DUBLIN CORE METADATA (ISO 15836)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dublin_core_metadata (
  id VARCHAR(64) PRIMARY KEY,
  archive_item_id VARCHAR(64) NOT NULL UNIQUE REFERENCES archive_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  creator VARCHAR(255) NOT NULL,
  subject TEXT[] DEFAULT '{}',
  description TEXT NOT NULL,
  publisher VARCHAR(255) NOT NULL,
  contributor VARCHAR(255),
  date VARCHAR(64) NOT NULL,
  type VARCHAR(64) NOT NULL,
  format VARCHAR(128) NOT NULL,
  identifier VARCHAR(128) NOT NULL,
  source TEXT NOT NULL,
  language VARCHAR(64) NOT NULL,
  relation TEXT[] DEFAULT '{}',
  coverage TEXT NOT NULL,
  rights TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dc_identifier ON dublin_core_metadata(identifier);

-- ============================================================================
-- 4. DOCUMENTS, PAGES & OCR RECORDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(64) PRIMARY KEY,
  archive_item_id VARCHAR(64) NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type VARCHAR(64) NOT NULL,
  language VARCHAR(32) DEFAULT 'en',
  page_count INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL,
  original_identifier VARCHAR(128),
  asset_reference TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'DIGITIZED',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_pages (
  id VARCHAR(64) PRIMARY KEY,
  document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  original_asset_reference TEXT,
  svg_scan_type VARCHAR(64),
  page_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_doc_page UNIQUE (document_id, page_number)
);

CREATE TABLE IF NOT EXISTS ocr_records (
  id VARCHAR(64) PRIMARY KEY,
  page_id VARCHAR(64) NOT NULL UNIQUE REFERENCES document_pages(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  processed_text TEXT NOT NULL,
  text_hi TEXT,
  text_mr TEXT,
  text_kn TEXT,
  confidence NUMERIC(5, 4) NOT NULL DEFAULT 0.9850, -- e.g. 0.9920
  language VARCHAR(32) NOT NULL DEFAULT 'en',
  processing_status VARCHAR(32) NOT NULL DEFAULT 'EXTRACTED',
  ocr_engine VARCHAR(64) NOT NULL DEFAULT 'Institutional-OCR-Pipeline',
  bounding_highlights JSONB DEFAULT '[]'::jsonb,
  -- Search vector for full-text search across OCR texts
  ocr_search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(processed_text, ''))
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ocr_records_confidence ON ocr_records(confidence);
CREATE INDEX IF NOT EXISTS idx_ocr_records_fts ON ocr_records USING gin(ocr_search_vector);

-- ============================================================================
-- 5. PEOPLE, EVENTS & TOPICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS people (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  alternate_names TEXT[] DEFAULT '{}',
  description TEXT NOT NULL,
  birth_year INTEGER,
  death_year INTEGER,
  roles TEXT[] DEFAULT '{}',
  source_references TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(64) PRIMARY KEY,
  title TEXT NOT NULL,
  title_hi TEXT,
  title_mr TEXT,
  title_kn TEXT,
  year INTEGER NOT NULL,
  date_formatted VARCHAR(128) NOT NULL,
  theme VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  description_hi TEXT,
  description_mr TEXT,
  description_kn TEXT,
  detailed_description TEXT,
  location VARCHAR(255) NOT NULL,
  key_quote TEXT,
  source_provenance TEXT,
  photo_caption TEXT,
  photo_provenance TEXT,
  photo_placeholder TEXT,
  is_demo_record BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_year ON events(year);
CREATE INDEX IF NOT EXISTS idx_events_theme ON events(theme);

CREATE TABLE IF NOT EXISTS topics (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  parent_topic_id VARCHAR(64) REFERENCES topics(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. MULTIMEDIA & TIME-CODED TRANSCRIPTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_records (
  id VARCHAR(64) PRIMARY KEY,
  archive_item_id VARCHAR(64) REFERENCES archive_items(id) ON DELETE SET NULL,
  media_type VARCHAR(16) NOT NULL, -- 'audio' or 'video'
  title TEXT NOT NULL,
  title_hi TEXT,
  title_mr TEXT,
  title_kn TEXT,
  category VARCHAR(64) NOT NULL,
  date VARCHAR(64) NOT NULL,
  duration VARCHAR(32) NOT NULL,
  language VARCHAR(32) NOT NULL,
  speaker VARCHAR(255) NOT NULL,
  speaker_hi TEXT,
  speaker_mr TEXT,
  speaker_kn TEXT,
  source TEXT NOT NULL,
  archive_citation TEXT NOT NULL,
  original_holding TEXT NOT NULL,
  description TEXT NOT NULL,
  description_hi TEXT,
  description_mr TEXT,
  description_kn TEXT,
  original_asset_reference TEXT,
  is_demo_record BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transcripts (
  id VARCHAR(64) PRIMARY KEY,
  media_id VARCHAR(64) NOT NULL REFERENCES media_records(id) ON DELETE CASCADE,
  timestamp VARCHAR(16) NOT NULL,
  seconds INTEGER NOT NULL,
  speaker VARCHAR(255) NOT NULL,
  speaker_hi TEXT,
  speaker_mr TEXT,
  speaker_kn TEXT,
  text TEXT NOT NULL,
  text_hi TEXT,
  text_mr TEXT,
  text_kn TEXT,
  language VARCHAR(16) NOT NULL DEFAULT 'en',
  sequence_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transcripts_media ON transcripts(media_id, sequence_order);

-- ============================================================================
-- 7. MULTILINGUAL TRANSLATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS translations (
  id VARCHAR(64) PRIMARY KEY,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  field_name VARCHAR(64) NOT NULL,
  language VARCHAR(16) NOT NULL,
  translated_text TEXT NOT NULL,
  original_language VARCHAR(16) NOT NULL DEFAULT 'en',
  translation_status VARCHAR(32) NOT NULL DEFAULT 'HUMAN_VERIFIED',
  verified_by VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_translation_entry UNIQUE (entity_type, entity_id, field_name, language)
);

CREATE INDEX IF NOT EXISTS idx_translations_lookup ON translations(entity_type, entity_id, language);

-- ============================================================================
-- 8. CITATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS citations (
  id VARCHAR(64) PRIMARY KEY,
  archive_item_id VARCHAR(64) NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  document_id VARCHAR(64) REFERENCES documents(id) ON DELETE CASCADE,
  page_id VARCHAR(64) REFERENCES document_pages(id) ON DELETE CASCADE,
  source_record_id VARCHAR(64) REFERENCES source_records(id) ON DELETE SET NULL,
  style VARCHAR(32) NOT NULL, -- 'APA', 'MLA', 'CHICAGO', 'BIBTEX'
  formatted_citation TEXT NOT NULL,
  citation_key VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_citations_item ON citations(archive_item_id);

-- ============================================================================
-- 9. KNOWLEDGE GRAPH ONTOLOGY
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id VARCHAR(64) PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  label_hi TEXT,
  label_mr TEXT,
  label_kn TEXT,
  category VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  description_hi TEXT,
  description_mr TEXT,
  description_kn TEXT,
  x NUMERIC(8, 2),
  y NUMERIC(8, 2),
  related_doc_id VARCHAR(64) REFERENCES archive_items(id) ON DELETE SET NULL,
  is_demo_record BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_links (
  id VARCHAR(64) PRIMARY KEY,
  source_node_id VARCHAR(64) NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  target_node_id VARCHAR(64) NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  relationship VARCHAR(128) NOT NULL,
  weight NUMERIC(4, 2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_graph_edge UNIQUE (source_node_id, target_node_id, relationship)
);

-- ============================================================================
-- 10. JUNCTION TABLES (MANY-TO-MANY RELATIONSHIPS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS archive_item_people (
  archive_item_id VARCHAR(64) NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  person_id VARCHAR(64) NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role VARCHAR(64) DEFAULT 'MENTIONED',
  PRIMARY KEY (archive_item_id, person_id)
);

CREATE TABLE IF NOT EXISTS archive_item_events (
  archive_item_id VARCHAR(64) NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  event_id VARCHAR(64) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  PRIMARY KEY (archive_item_id, event_id)
);

CREATE TABLE IF NOT EXISTS archive_item_topics (
  archive_item_id VARCHAR(64) NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  topic_id VARCHAR(64) NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  PRIMARY KEY (archive_item_id, topic_id)
);

CREATE TABLE IF NOT EXISTS timeline_event_documents (
  event_id VARCHAR(64) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  archive_item_id VARCHAR(64) NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, archive_item_id)
);

-- ============================================================================
-- 11. VECTOR EMBEDDINGS (PREPARED FOR PGVECTOR RAG SEARCH)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rag_chunk_embeddings (
  id VARCHAR(64) PRIMARY KEY,
  archive_item_id VARCHAR(64) NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  document_id VARCHAR(64) REFERENCES documents(id) ON DELETE CASCADE,
  page_id VARCHAR(64) REFERENCES document_pages(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  embedding_dimensions INTEGER DEFAULT 768,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_item ON rag_chunk_embeddings(archive_item_id);

-- ============================================================================
-- 12. AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  action VARCHAR(128) NOT NULL,
  performed_by VARCHAR(128) NOT NULL,
  user_role VARCHAR(64) NOT NULL,
  document_id VARCHAR(64),
  document_title TEXT,
  details TEXT NOT NULL,
  ip_address VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- ============================================================================
-- INITIAL SEED: THE 3 OFFICIAL SOURCE COLLECTIONS
-- ============================================================================

INSERT INTO source_collections (
  id, name, organization, description, source_url, source_type, access_information, total_records_count
) VALUES 
(
  'source-ambedkar-foundation',
  'Dr. Ambedkar Foundation',
  'Dr. Ambedkar Foundation (DAF), Ministry of Social Justice and Empowerment, Government of India',
  'Apex institutional body established in 1992 to administer programs for propagating Dr. B. R. Ambedkar’s ideology, social justice doctrine, and custodian of the multi-volume official project "Babasaheb Ambedkar: Writings and Speeches" (BAWS).',
  'https://ambedkarfoundation.nic.in',
  'GOVERNMENT_FOUNDATION',
  'Official Government Publications / Public Domain Archival Access',
  0
),
(
  'source-cad-archive',
  'Constituent Assembly Debates Archive',
  'Lok Sabha Secretariat & Parliament Library Archival Wing, Sansad Bhavan, New Delhi',
  'Verbatim parliamentary proceedings, committee reports, drafting committee drafts, and official debates of the Constituent Assembly of India (1946–1950, Vols I–XII) chaired in drafting by Dr. B. R. Ambedkar.',
  'https://eparlib.nic.in',
  'PARLIAMENTARY_RECORDS',
  'Official Parliamentary Records, Public Access / Open Repository',
  0
),
(
  'source-ndli',
  'National Digital Library of India',
  'National Digital Library of India (NDLI), Ministry of Education, IIT Kharagpur',
  'National institutional knowledge repository hosting digitized copies of rare books, historical gazetteers, original theses (including Columbia University and London School of Economics dissertations), and academic research monographs.',
  'https://ndl.iitkgp.ac.in',
  'NATIONAL_DIGITAL_REPOSITORY',
  'Consortium Academic Open Access / Digital Preservation License',
  0
)
ON CONFLICT (id) DO UPDATE SET
  organization = EXCLUDED.organization,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;
