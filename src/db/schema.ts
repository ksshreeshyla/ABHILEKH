/**
 * RELATIONAL DATABASE SCHEMA DEFINITION
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Designed for PostgreSQL with:
 * - Dublin Core Metadata Initiative (DCMI) conformance
 * - Complete provenance tracing (Source Collection -> Source Record -> Archive Item)
 * - Page-level OCR transcripts with multi-script support (En, Hi, Mr, Kn)
 * - Knowledge Graph relational storage (Nodes & Edges)
 * - Timecoded multimedia transcripts
 * - Dynamic academic citations (APA, MLA, Chicago, BibTeX)
 * - Prepared for PostgreSQL full-text search (tsvector/GIN) and Vector embeddings (pgvector)
 */

export type DocumentCategoryEnum =
  | 'Books & Writings'
  | 'Speeches'
  | 'Constituent Assembly Debates'
  | 'Rare Manuscripts'
  | 'Photographs'
  | 'Historical Records'
  | 'Documentaries'
  | 'Lectures & Interviews';

export type PublishingStatusEnum = 'Draft' | 'Review' | 'Approved' | 'Published';

export type ProvenanceTypeEnum = 'DEMO_SEED' | 'EXTERNAL_INGEST' | 'API_SYNC' | 'MANUAL_CURATION';

export type LanguageCodeEnum = 'en' | 'hi' | 'mr' | 'kn' | 'sa' | 'ur' | 'pa';

// ============================================================================
// 1. SOURCE COLLECTIONS & PROVENANCE
// ============================================================================

export interface SourceCollectionEntity {
  id: string; // e.g. "source-ambedkar-foundation"
  name: string; // e.g. "Dr. Ambedkar Foundation"
  organization: string; // "Ministry of Social Justice and Empowerment, Govt. of India"
  description: string;
  sourceUrl?: string;
  sourceType: 'GOVERNMENT_FOUNDATION' | 'PARLIAMENTARY_RECORDS' | 'NATIONAL_DIGITAL_REPOSITORY' | 'UNIVERSITY_LIBRARY';
  accessInformation: string;
  totalRecordsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SourceRecordEntity {
  id: string; // UUID or synthetic ID
  sourceCollectionId: string; // FK -> sourceCollections.id
  originalSourceIdentifier: string; // e.g. "BAWS-VOL-01-SEC-02" or "CAD-VOL-XI-1949"
  originalTitle: string;
  originalUrl?: string;
  repository: string; // Physical or digital holding institution
  sourceMetadata: Record<string, unknown>; // JSONB raw source metadata
  ingestionDate: string;
  ingestionMethod: 'JSON_IMPORT' | 'CSV_IMPORT' | 'API_CONNECTOR' | 'MANUAL_ENTRY' | 'DEMO_SEED';
  provenanceNotes: string;
  isDemoRecord: boolean; // Explicitly separates Demo Seed vs Real Source Ingested Data
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 2. CORE ARCHIVE ITEM
// ============================================================================

export interface ArchiveItemEntity {
  id: string; // Primary key (slug or UUID)
  archiveId: string; // Formal Archival Call Number (e.g. "DAIC-CAD-1949-XI-25")
  sourceRecordId?: string; // FK -> sourceRecords.id
  title: string;
  titleHi?: string;
  titleMr?: string;
  titleKn?: string;
  category: DocumentCategoryEnum;
  date: string; // Human-readable date string (e.g. "25 November 1949")
  year: number; // Integer for rapid chronological indexing & sorting
  author: string;
  collection: string;
  sourceInstitution: string;
  sourceProvenance?: string;
  language: string;
  originalHolding?: string;
  description: string;
  descriptionHi?: string;
  descriptionMr?: string;
  descriptionKn?: string;
  fullText: string;
  aiSummary: string;
  aiSummaryHi?: string;
  aiSummaryMr?: string;
  aiSummaryKn?: string;
  keyConcepts: string[]; // Stored as text array or JSONB
  publishingStatus: PublishingStatusEnum;
  isFeatured: boolean;
  isDemoRecord: boolean; // Flag distinguishing demo data from real verified imports
  thumbnailUrl?: string;
  downloadUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 3. DUBLIN CORE METADATA (ISO 15836)
// ============================================================================

export interface DublinCoreMetadataEntity {
  id: string;
  archiveItemId: string; // FK -> archiveItems.id (1:1 relationship)
  title: string;
  creator: string;
  subject: string[]; // Array of subject classifications
  description: string;
  publisher: string;
  contributor?: string;
  date: string;
  type: DocumentCategoryEnum;
  format: string; // e.g. "application/pdf", "image/tiff; resolution=600dpi"
  identifier: string; // Archival identifier
  source: string;
  language: string;
  relation?: string[];
  coverage: string; // Spatial / temporal coverage (e.g. "New Delhi, India; 1946-1950")
  rights: string; // e.g. "Public Domain / CC-BY-NC 4.0 / Government of India"
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 4. DOCUMENTS, PAGES & OCR TRANSCRIPTS
// ============================================================================

export interface DocumentEntity {
  id: string; // e.g. "doc-cad-closing-1949"
  archiveItemId: string; // FK -> archiveItems.id
  title: string;
  documentType: 'MANUSCRIPT' | 'PRINTED_MONOGRAPH' | 'GAZETTE' | 'TYPESCRIPT' | 'PARLIAMENTARY_REPORT';
  language: string;
  pageCount: number;
  source: string;
  originalIdentifier?: string;
  assetReference?: string; // Storage path or cloud URI
  metadata: Record<string, unknown>; // JSONB extensible metadata
  status: 'DRAFT' | 'VERIFIED' | 'DIGITIZED' | 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
}

export interface DocumentPageEntity {
  id: string;
  documentId: string; // FK -> documents.id
  pageNumber: number;
  originalAssetReference?: string;
  svgScanType?: 'draft_constitution' | 'cad_speech' | 'annihilation_manuscript' | 'rupee_book' | 'mahad_declaration';
  pageMetadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OcrRecordEntity {
  id: string;
  pageId: string; // FK -> documentPages.id (1:1)
  rawText: string;
  processedText: string;
  textHi?: string;
  textMr?: string;
  textKn?: string;
  confidence: number; // e.g. 0.992 (99.2%)
  language: string;
  processingStatus: 'PENDING' | 'EXTRACTED' | 'MANUALLY_VERIFIED' | 'CORRECTED';
  ocrEngine: string; // e.g. "Tesseract-5.3-Archival" or "Google Cloud Vision v1"
  boundingHighlights?: Array<{
    text: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 5. PEOPLE, EVENTS & TOPICAL TAXONOMY
// ============================================================================

export interface PersonEntity {
  id: string;
  name: string;
  alternateNames?: string[];
  description: string;
  birthYear?: number;
  deathYear?: number;
  roles: string[];
  sourceReferences?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EventEntity {
  id: string;
  title: string;
  titleHi?: string;
  titleMr?: string;
  titleKn?: string;
  year: number;
  dateFormatted: string;
  theme: 'Constitutional' | 'Social Reform' | 'Academic & Economics' | 'Spiritual & Dhamma';
  description: string;
  descriptionHi?: string;
  descriptionMr?: string;
  descriptionKn?: string;
  detailedDescription?: string;
  location: string;
  keyQuote?: string;
  sourceProvenance?: string;
  photoCaption?: string;
  photoProvenance?: string;
  photoPlaceholder?: string;
  isDemoRecord: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TopicEntity {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentTopicId?: string; // FK -> topics.id (hierarchical taxonomy)
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 6. MULTIMEDIA & TIME-CODED TRANSCRIPTS
// ============================================================================

export interface MediaRecordEntity {
  id: string;
  archiveItemId?: string; // FK -> archiveItems.id (nullable if standalone reel)
  mediaType: 'audio' | 'video';
  title: string;
  titleHi?: string;
  titleMr?: string;
  titleKn?: string;
  category: 'Speeches' | 'Lectures & Interviews' | 'Documentaries';
  date: string;
  duration: string; // e.g. "08:42"
  language: string;
  speaker: string;
  speakerHi?: string;
  speakerMr?: string;
  speakerKn?: string;
  source: string;
  archiveCitation: string;
  originalHolding: string;
  description: string;
  descriptionHi?: string;
  descriptionMr?: string;
  descriptionKn?: string;
  originalAssetReference?: string;
  isDemoRecord: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptSegmentEntity {
  id: string;
  mediaId: string; // FK -> mediaRecords.id
  timestamp: string; // e.g. "01:25"
  seconds: number; // Integer seconds for audio/video seeking
  speaker: string;
  speakerHi?: string;
  speakerMr?: string;
  speakerKn?: string;
  text: string;
  textHi?: string;
  textMr?: string;
  textKn?: string;
  language: string;
  sequenceOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 7. MULTILINGUAL TRANSLATIONS STORAGE
// ============================================================================

export interface TranslationEntity {
  id: string;
  entityType: 'ARCHIVE_ITEM' | 'EVENT' | 'KNOWLEDGE_NODE' | 'MEDIA' | 'OCR_PAGE';
  entityId: string;
  fieldName: string; // e.g. "title", "description", "fullText"
  language: LanguageCodeEnum;
  translatedText: string;
  originalLanguage: string;
  translationStatus: 'MACHINE' | 'HUMAN_VERIFIED' | 'SCHOLAR_APPROVED';
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 8. CITATIONS & SCHOLARLY PROVENANCE
// ============================================================================

export interface CitationEntity {
  id: string;
  archiveItemId: string; // FK -> archiveItems.id
  documentId?: string; // FK -> documents.id
  pageId?: string; // FK -> documentPages.id
  sourceRecordId?: string; // FK -> sourceRecords.id
  style: 'APA' | 'MLA' | 'CHICAGO' | 'BIBTEX' | 'HARVARD';
  formattedCitation: string;
  citationKey: string; // e.g. "ambedkar1949cad"
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 9. KNOWLEDGE GRAPH ONTOLOGY
// ============================================================================

export interface KnowledgeNodeEntity {
  id: string;
  label: string;
  labelHi?: string;
  labelMr?: string;
  labelKn?: string;
  category: 'Person' | 'Work' | 'Constitutional Idea' | 'Historical Event' | 'Document';
  description: string;
  descriptionHi?: string;
  descriptionMr?: string;
  descriptionKn?: string;
  x?: number;
  y?: number;
  relatedDocId?: string; // FK -> archiveItems.id
  isDemoRecord: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeLinkEntity {
  id: string;
  sourceNodeId: string; // FK -> knowledgeNodes.id
  targetNodeId: string; // FK -> knowledgeNodes.id
  relationship: string; // e.g. "Architect of", "Enforces", "Critiques"
  weight?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 10. JUNCTION TABLES FOR MANY-TO-MANY RELATIONSHIPS
// ============================================================================

export interface ArchiveItemPersonJunction {
  archiveItemId: string;
  personId: string;
  role: 'AUTHOR' | 'SPEAKER' | 'MENTIONED' | 'ADDRESSEE' | 'CHAIR';
}

export interface ArchiveItemEventJunction {
  archiveItemId: string;
  eventId: string;
}

export interface ArchiveItemTopicJunction {
  archiveItemId: string;
  topicId: string;
}

export interface TimelineEventPersonJunction {
  eventId: string;
  personId: string;
}

export interface TimelineEventDocumentJunction {
  eventId: string;
  archiveItemId: string;
}

// ============================================================================
// 11. VECTOR EMBEDDINGS & RAG CHUNKS (PREPARED FOR PGVECTOR)
// ============================================================================

export interface RagChunkEmbeddingEntity {
  id: string;
  archiveItemId: string;
  documentId?: string;
  pageId?: string;
  chunkIndex: number;
  chunkText: string;
  tokenCount: number;
  embeddingDimensions: number; // e.g. 768 or 1536
  // Stored as VECTOR(768) in PostgreSQL via pgvector extension
  embeddingVector?: number[]; // Prepared for future embedding generation
  metadata: {
    sourceCollection: string;
    archiveId: string;
    title: string;
    pageNumber?: number;
    year: number;
    category: string;
  };
  createdAt: string;
}

// ============================================================================
// 12. AUDIT & PRESERVATION LOG
// ============================================================================

export interface AuditLogEntity {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  userRole: string;
  documentId?: string;
  documentTitle?: string;
  details: string;
  ipAddress?: string;
}
