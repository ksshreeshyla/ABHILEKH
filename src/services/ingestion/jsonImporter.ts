/**
 * JSON ARCHIVAL DATA IMPORTER
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Ingests structured JSON data payloads:
 * - Single document object
 * - Array of document records
 * - Wrapped archival export format ({ version, sourceCollection, records: [...] })
 */

import { RawIngestionRecord, IngestionSummary, SupportedSourceCollectionId } from './types';
import { IngestionValidator } from './validator';
import { IngestionNormalizer } from './normalizer';

export class JsonImporter {
  /**
   * Parses and processes a raw JSON payload string into a validated IngestionSummary.
   */
  public static parseAndProcess(
    jsonString: string,
    defaultSourceCollectionId: SupportedSourceCollectionId = 'source-ambedkar-foundation',
    existingArchiveIds: Set<string> = new Set(),
    existingSourceIdentifiers: Set<string> = new Set()
  ): IngestionSummary {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        totalProcessed: 0,
        validCount: 0,
        invalidCount: 1,
        skippedDuplicates: 0,
        importedItems: [],
        validationReports: [
          {
            recordIndex: 0,
            title: 'Invalid JSON Payload',
            identifier: 'PARSE_ERROR',
            result: {
              isValid: false,
              errors: [{ field: 'json', message: `Malformed JSON: ${msg}`, severity: 'error' }],
              warnings: []
            }
          }
        ]
      };
    }

    // Extract records list
    let records: RawIngestionRecord[] = [];
    let payloadSourceCollection = defaultSourceCollectionId;

    if (Array.isArray(parsed)) {
      records = parsed as RawIngestionRecord[];
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.sourceCollection === 'string') {
        payloadSourceCollection = obj.sourceCollection;
      } else if (typeof obj.sourceCollectionId === 'string') {
        payloadSourceCollection = obj.sourceCollectionId;
      }

      if (Array.isArray(obj.records)) {
        records = obj.records as RawIngestionRecord[];
      } else if (Array.isArray(obj.items)) {
        records = obj.items as RawIngestionRecord[];
      } else if (Array.isArray(obj.data)) {
        records = obj.data as RawIngestionRecord[];
      } else {
        // Single record object
        records = [obj as RawIngestionRecord];
      }
    }

    const summary: IngestionSummary = {
      totalProcessed: records.length,
      validCount: 0,
      invalidCount: 0,
      skippedDuplicates: 0,
      importedItems: [],
      validationReports: []
    };

    const sessionSeenIds = new Set<string>();

    records.forEach((raw, idx) => {
      // Inherit source collection if not explicitly specified on the record
      if (!raw.sourceCollection && !raw.sourceCollectionId) {
        raw.sourceCollectionId = payloadSourceCollection;
      }

      const rawId = String(raw.archiveId || raw.identifier || raw.sourceIdentifier || '').trim();
      const rawTitle = String(raw.title || `Record #${idx + 1}`).trim();

      // Check for in-batch duplicates
      if (rawId && sessionSeenIds.has(rawId)) {
        summary.skippedDuplicates++;
        summary.invalidCount++;
        summary.validationReports.push({
          recordIndex: idx,
          title: rawTitle,
          identifier: rawId,
          result: {
            isValid: false,
            errors: [
              {
                field: 'archiveId',
                message: `Duplicate identifier "${rawId}" found within the same import batch at index ${idx}.`,
                severity: 'error'
              }
            ],
            warnings: []
          }
        });
        return;
      }

      const valResult = IngestionValidator.validate(raw, existingArchiveIds, existingSourceIdentifiers);

      summary.validationReports.push({
        recordIndex: idx,
        title: rawTitle,
        identifier: rawId || `ROW-${idx + 1}`,
        result: valResult
      });

      if (valResult.isValid) {
        if (rawId) sessionSeenIds.add(rawId);
        const normalized = IngestionNormalizer.normalize(raw, 'JSON_IMPORT');
        summary.importedItems.push(normalized);
        summary.validCount++;
      } else {
        summary.invalidCount++;
      }
    });

    return summary;
  }
}
