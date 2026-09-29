/**
 * ARCHIVAL INGESTION SERVICE (ORCHESTRATOR)
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Provides a unified API for ingesting, validating, and previewing
 * external archival collections from Dr. Ambedkar Foundation,
 * Constituent Assembly Debates Archive, and National Digital Library of India.
 */

import {
  IngestionSummary,
  SupportedSourceCollectionId,
  OFFICIAL_SOURCE_COLLECTIONS,
  SourceCollectionInfo,
  NormalizedArchivalPackage,
  ValidationResult
} from './types';
import { JsonImporter } from './jsonImporter';
import { CsvImporter } from './csvImporter';
import { IngestionValidator } from './validator';

export class ArchivalIngestionService {
  /**
   * Retrieves official archival source collections supported by the platform.
   */
  public static getSourceCollections(): SourceCollectionInfo[] {
    return OFFICIAL_SOURCE_COLLECTIONS;
  }

  /**
   * Validates a single standalone record.
   */
  public static validateRecord(
    record: Record<string, unknown>,
    existingArchiveIds: Set<string> = new Set()
  ): ValidationResult {
    return IngestionValidator.validate(record, existingArchiveIds);
  }

  /**
   * Ingests JSON text data.
   */
  public static processJsonInput(
    jsonText: string,
    sourceCollectionId: SupportedSourceCollectionId = 'source-ambedkar-foundation',
    existingArchiveIds: Set<string> = new Set()
  ): IngestionSummary {
    return JsonImporter.parseAndProcess(jsonText, sourceCollectionId, existingArchiveIds);
  }

  /**
   * Ingests CSV spreadsheet text.
   */
  public static processCsvInput(
    csvText: string,
    sourceCollectionId: SupportedSourceCollectionId = 'source-ambedkar-foundation',
    existingArchiveIds: Set<string> = new Set()
  ): IngestionSummary {
    return CsvImporter.parseAndProcess(csvText, sourceCollectionId, existingArchiveIds);
  }

  /**
   * Generates a dry-run preview of an import batch without committing to storage.
   */
  public static previewImport(
    rawText: string,
    format: 'json' | 'csv',
    sourceCollectionId: SupportedSourceCollectionId,
    existingArchiveIds: Set<string> = new Set()
  ): {
    summary: IngestionSummary;
    previewItems: NormalizedArchivalPackage[];
  } {
    const summary = format === 'json'
      ? ArchivalIngestionService.processJsonInput(rawText, sourceCollectionId, existingArchiveIds)
      : ArchivalIngestionService.processCsvInput(rawText, sourceCollectionId, existingArchiveIds);

    return {
      summary,
      previewItems: summary.importedItems.slice(0, 5) // Return first 5 items as preview
    };
  }
}
