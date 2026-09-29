/**
 * INGESTION DATA VALIDATOR
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Implements strict archival schema validation before database insertion:
 * - Mandatory title & archival identifier checks
 * - Valid source collection mapping (Dr. Ambedkar Foundation, CAD Archive, NDLI)
 * - Historical date & year range validation (1850 - 2026)
 * - Category domain validation
 * - Duplicate archiveId / source identifier detection
 * - Meaningful field-level diagnostics
 */

import { RawIngestionRecord, ValidationResult, ValidationError, OFFICIAL_SOURCE_COLLECTIONS } from './types';
import { DocumentCategory } from '../../types/archive';

const VALID_CATEGORIES: DocumentCategory[] = [
  'Books & Writings',
  'Speeches',
  'Constituent Assembly Debates',
  'Rare Manuscripts',
  'Photographs',
  'Historical Records',
  'Documentaries',
  'Lectures & Interviews'
];

export class IngestionValidator {
  /**
   * Validates a single raw ingestion record.
   *
   * @param raw Raw input object from JSON or CSV
   * @param existingArchiveIds Set of archive IDs already in database/repository
   * @param existingSourceIdentifiers Set of source identifiers already recorded
   */
  public static validate(
    raw: RawIngestionRecord,
    existingArchiveIds: Set<string> = new Set(),
    existingSourceIdentifiers: Set<string> = new Set()
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // 1. Title Validation (Mandatory)
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title) {
      errors.push({
        field: 'title',
        message: 'Record is missing a mandatory title.',
        severity: 'error'
      });
    } else if (title.length < 3) {
      errors.push({
        field: 'title',
        message: 'Title must be at least 3 characters long.',
        severity: 'error'
      });
    }

    // 2. Archival Identifier / Call Number (Mandatory for Provenance)
    const rawId = raw.archiveId || raw.identifier || raw.sourceIdentifier;
    const identifier = typeof rawId === 'string' ? rawId.trim() : '';
    if (!identifier) {
      errors.push({
        field: 'archiveId / identifier',
        message: 'Record is missing a unique archival identifier / call number.',
        severity: 'error'
      });
    } else {
      // Duplicate checks
      if (existingArchiveIds.has(identifier)) {
        errors.push({
          field: 'archiveId',
          message: `Duplicate archive identifier detected: "${identifier}" is already registered in the repository.`,
          severity: 'error'
        });
      }
      if (existingSourceIdentifiers.has(identifier)) {
        warnings.push({
          field: 'sourceIdentifier',
          message: `Source identifier "${identifier}" is already indexed in provenance tables.`,
          severity: 'warning'
        });
      }
    }

    // 3. Source Collection Validation
    const sourceCol = raw.sourceCollectionId || raw.sourceCollection;
    const sourceColStr = typeof sourceCol === 'string' ? sourceCol.trim() : '';
    const recognizedSource = OFFICIAL_SOURCE_COLLECTIONS.find(
      s => s.id === sourceColStr || s.name.toLowerCase() === sourceColStr.toLowerCase()
    );

    if (!sourceColStr) {
      errors.push({
        field: 'sourceCollection',
        message: 'Source collection must be specified (e.g. "Dr. Ambedkar Foundation", "Constituent Assembly Debates Archive", or "National Digital Library of India").',
        severity: 'error'
      });
    } else if (!recognizedSource) {
      warnings.push({
        field: 'sourceCollection',
        message: `Source collection "${sourceColStr}" is not in the primary official list (Dr. Ambedkar Foundation, CAD Archive, NDLI). It will be indexed as an external institutional holding.`,
        severity: 'warning'
      });
    }

    // 4. Category Validation
    const category = (raw.category || raw.itemType) as string;
    if (!category) {
      warnings.push({
        field: 'category',
        message: 'No category supplied. Defaulting to "Historical Records".',
        severity: 'warning'
      });
    } else if (!VALID_CATEGORIES.includes(category as DocumentCategory)) {
      warnings.push({
        field: 'category',
        message: `Category "${category}" is not in standard taxonomy. It will be mapped to the closest standard category.`,
        severity: 'warning'
      });
    }

    // 5. Year / Date Validation
    const yearVal = raw.year;
    if (yearVal !== undefined && yearVal !== null && yearVal !== '') {
      const parsedYear = Number(yearVal);
      if (isNaN(parsedYear) || parsedYear < 1850 || parsedYear > 2026) {
        errors.push({
          field: 'year',
          message: `Year "${yearVal}" is outside the valid historical archival window (1850 - 2026).`,
          severity: 'error'
        });
      }
    } else {
      warnings.push({
        field: 'year',
        message: 'No numeric year supplied. Will attempt to infer from date string.',
        severity: 'warning'
      });
    }

    // 6. Text / OCR Content Check
    const fullText = (raw.fullText || raw.ocrText || raw.description) as string;
    if (!fullText || typeof fullText !== 'string' || fullText.trim().length === 0) {
      warnings.push({
        field: 'fullText / ocrText',
        message: 'Record contains no OCR or full-text transcript. Document will be indexed as metadata-only.',
        severity: 'warning'
      });
    }

    // 7. Language Validation
    const lang = raw.language;
    if (lang && typeof lang === 'string') {
      const allowedLangs = ['en', 'hi', 'mr', 'kn', 'english', 'hindi', 'marathi', 'kannada', 'sanskrit', 'urdu', 'marathi/english'];
      if (!allowedLangs.includes(lang.toLowerCase().trim())) {
        warnings.push({
          field: 'language',
          message: `Language "${lang}" is not one of the primary localized languages (en, hi, mr, kn).`,
          severity: 'warning'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
