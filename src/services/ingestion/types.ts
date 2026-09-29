/**
 * INGESTION FRAMEWORK TYPES
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Defines contracts for importing, validating, and normalizing archival data
 * from external source collections (Dr. Ambedkar Foundation, CAD Archive, NDLI).
 */

import type { DocumentCategoryEnum, LanguageCodeEnum, PublishingStatusEnum } from '../../db/schema.ts';
import type { ArchiveItem, DublinCoreMetadata, DocumentPage } from '../../types/archive.ts';

export type SupportedSourceCollectionId =
  | 'source-ambedkar-foundation'
  | 'source-cad-archive'
  | 'source-ndli'
  | string;

export interface SourceCollectionInfo {
  id: SupportedSourceCollectionId;
  name: string;
  organization: string;
  description: string;
  sourceUrl?: string;
  sourceType: string;
  accessInformation: string;
}

export const OFFICIAL_SOURCE_COLLECTIONS: SourceCollectionInfo[] = [
  {
    id: 'source-ambedkar-foundation',
    name: 'Dr. Ambedkar Foundation',
    organization: 'Dr. Ambedkar Foundation (DAF), Ministry of Social Justice and Empowerment, Government of India',
    description: 'Autonomous apex institution publishing the canonical "Babasaheb Ambedkar: Writings and Speeches" (BAWS, Vols 1–22) and administering national archival preservation programs.',
    sourceUrl: 'https://ambedkarfoundation.nic.in',
    sourceType: 'GOVERNMENT_FOUNDATION',
    accessInformation: 'Official Government Publications / Public Domain'
  },
  {
    id: 'source-cad-archive',
    name: 'Constituent Assembly Debates Archive',
    organization: 'Lok Sabha Secretariat & Parliament Library Archival Wing, Sansad Bhavan, New Delhi',
    description: 'Verbatim parliamentary debates, official drafting committee reports, and amendments of the Constituent Assembly of India (1946–1950, Vols I–XII).',
    sourceUrl: 'https://eparlib.nic.in',
    sourceType: 'PARLIAMENTARY_RECORDS',
    accessInformation: 'Official Parliamentary Records / Open Access'
  },
  {
    id: 'source-ndli',
    name: 'National Digital Library of India',
    organization: 'National Digital Library of India (NDLI), Ministry of Education, IIT Kharagpur',
    description: 'National academic repository preserving digitized copies of historical monographs, doctoral theses (Columbia & LSE), gazetteers, and institutional records.',
    sourceUrl: 'https://ndl.iitkgp.ac.in',
    sourceType: 'NATIONAL_DIGITAL_REPOSITORY',
    accessInformation: 'Academic Open Access / Digital Consortium License'
  }
];

export interface RawIngestionRecord {
  title?: unknown;
  titleHi?: unknown;
  titleMr?: unknown;
  titleKn?: unknown;
  archiveId?: unknown;
  identifier?: unknown;
  sourceIdentifier?: unknown;
  category?: unknown;
  itemType?: unknown;
  date?: unknown;
  year?: unknown;
  author?: unknown;
  creator?: unknown;
  collection?: unknown;
  sourceCollection?: unknown;
  sourceCollectionId?: unknown;
  sourceInstitution?: unknown;
  originalHolding?: unknown;
  repository?: unknown;
  description?: unknown;
  descriptionHi?: unknown;
  descriptionMr?: unknown;
  descriptionKn?: unknown;
  fullText?: unknown;
  ocrText?: unknown;
  language?: unknown;
  subjects?: unknown;
  keywords?: unknown;
  keyConcepts?: unknown;
  pages?: unknown;
  provenanceNotes?: unknown;
  originalUrl?: unknown;
  [key: string]: unknown;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface NormalizedArchivalPackage {
  archiveItem: ArchiveItem;
  dublinCore: DublinCoreMetadata;
  sourceRecord: {
    sourceCollectionId: string;
    originalSourceIdentifier: string;
    originalTitle: string;
    originalUrl?: string;
    repository: string;
    ingestionMethod: 'JSON_IMPORT' | 'CSV_IMPORT';
    provenanceNotes: string;
    isDemoRecord: boolean;
  };
  pages: DocumentPage[];
}

export interface IngestionSummary {
  totalProcessed: number;
  validCount: number;
  invalidCount: number;
  skippedDuplicates: number;
  importedItems: NormalizedArchivalPackage[];
  validationReports: Array<{
    recordIndex: number;
    title: string;
    identifier: string;
    result: ValidationResult;
  }>;
}
