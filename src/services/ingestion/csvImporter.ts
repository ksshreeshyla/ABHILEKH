/**
 * CSV ARCHIVAL DATA IMPORTER
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Implements a robust RFC 4180-compliant CSV parser:
 * - Handles quotes, escaped commas, and multi-line cell values
 * - Flexible column header mapping for Dublin Core and archival catalog standards
 * - Per-row validation and normalization into relational models
 */

import { RawIngestionRecord, IngestionSummary, SupportedSourceCollectionId } from './types';
import { IngestionValidator } from './validator';
import { IngestionNormalizer } from './normalizer';

export class CsvImporter {
  /**
   * Parses and processes a CSV string into a validated IngestionSummary.
   */
  public static parseAndProcess(
    csvContent: string,
    defaultSourceCollectionId: SupportedSourceCollectionId = 'source-ambedkar-foundation',
    existingArchiveIds: Set<string> = new Set(),
    existingSourceIdentifiers: Set<string> = new Set()
  ): IngestionSummary {
    const rawRows = CsvImporter.parseCsvLines(csvContent);

    if (rawRows.length < 2) {
      return {
        totalProcessed: 0,
        validCount: 0,
        invalidCount: 1,
        skippedDuplicates: 0,
        importedItems: [],
        validationReports: [
          {
            recordIndex: 0,
            title: 'Empty or Insufficient CSV',
            identifier: 'CSV_ERROR',
            result: {
              isValid: false,
              errors: [{ field: 'csv', message: 'CSV file must contain at least a header row and one data row.', severity: 'error' }],
              warnings: []
            }
          }
        ]
      };
    }

    const headers = rawRows[0].map(h => h.trim().toLowerCase().replace(/[\s-_]+/g, ''));
    const dataRows = rawRows.slice(1);

    const summary: IngestionSummary = {
      totalProcessed: dataRows.length,
      validCount: 0,
      invalidCount: 0,
      skippedDuplicates: 0,
      importedItems: [],
      validationReports: []
    };

    const sessionSeenIds = new Set<string>();

    dataRows.forEach((row, idx) => {
      // Skip completely empty rows
      if (row.length === 0 || (row.length === 1 && !row[0].trim())) {
        return;
      }

      const rawRecord = CsvImporter.mapRowToRecord(headers, row, defaultSourceCollectionId);
      const rawId = String(rawRecord.archiveId || rawRecord.identifier || rawRecord.sourceIdentifier || '').trim();
      const rawTitle = String(rawRecord.title || `CSV Row #${idx + 2}`).trim();

      if (rawId && sessionSeenIds.has(rawId)) {
        summary.skippedDuplicates++;
        summary.invalidCount++;
        summary.validationReports.push({
          recordIndex: idx + 1,
          title: rawTitle,
          identifier: rawId,
          result: {
            isValid: false,
            errors: [
              {
                field: 'archiveId',
                message: `Duplicate identifier "${rawId}" found within CSV at row ${idx + 2}.`,
                severity: 'error'
              }
            ],
            warnings: []
          }
        });
        return;
      }

      const valResult = IngestionValidator.validate(rawRecord, existingArchiveIds, existingSourceIdentifiers);

      summary.validationReports.push({
        recordIndex: idx + 1,
        title: rawTitle,
        identifier: rawId || `ROW-${idx + 2}`,
        result: valResult
      });

      if (valResult.isValid) {
        if (rawId) sessionSeenIds.add(rawId);
        const normalized = IngestionNormalizer.normalize(rawRecord, 'CSV_IMPORT');
        summary.importedItems.push(normalized);
        summary.validCount++;
      } else {
        summary.invalidCount++;
      }
    });

    return summary;
  }

  /**
   * Maps a CSV row to a RawIngestionRecord using intelligent header alias matching.
   */
  private static mapRowToRecord(
    headers: string[],
    row: string[],
    defaultSourceCollectionId: string
  ): RawIngestionRecord {
    const record: RawIngestionRecord = {
      sourceCollectionId: defaultSourceCollectionId
    };

    headers.forEach((header, colIndex) => {
      const val = row[colIndex] ? row[colIndex].trim() : '';
      if (!val) return;

      switch (header) {
        case 'title':
        case 'documenttitle':
        case 'itemtitle':
          record.title = val;
          break;
        case 'titlehi':
        case 'hindititle':
          record.titleHi = val;
          break;
        case 'titlemr':
        case 'marathititle':
          record.titleMr = val;
          break;
        case 'titlekn':
        case 'kannadatitle':
          record.titleKn = val;
          break;
        case 'archiveid':
        case 'identifier':
        case 'callnumber':
        case 'id':
        case 'catalognumber':
          record.archiveId = val;
          break;
        case 'category':
        case 'type':
        case 'itemtype':
        case 'documentcategory':
          record.category = val;
          break;
        case 'year':
          record.year = val;
          break;
        case 'date':
        case 'datecreated':
          record.date = val;
          break;
        case 'author':
        case 'creator':
          record.author = val;
          break;
        case 'collection':
          record.collection = val;
          break;
        case 'sourcecollection':
        case 'sourcecollectionid':
        case 'source':
          record.sourceCollection = val;
          break;
        case 'sourceinstitution':
        case 'repository':
        case 'institution':
        case 'publisher':
          record.sourceInstitution = val;
          break;
        case 'originalholding':
        case 'holding':
          record.originalHolding = val;
          break;
        case 'description':
        case 'abstract':
        case 'summary':
          record.description = val;
          break;
        case 'descriptionhi':
          record.descriptionHi = val;
          break;
        case 'descriptionmr':
          record.descriptionMr = val;
          break;
        case 'descriptionkn':
          record.descriptionKn = val;
          break;
        case 'fulltext':
        case 'ocrtext':
        case 'transcript':
        case 'text':
          record.fullText = val;
          break;
        case 'language':
        case 'lang':
          record.language = val;
          break;
        case 'keywords':
        case 'subjects':
        case 'keyconcepts':
        case 'tags':
          record.keywords = val;
          break;
        case 'provenancenotes':
        case 'provenance':
          record.provenanceNotes = val;
          break;
        case 'originalurl':
        case 'sourceurl':
        case 'url':
          record.originalUrl = val;
          break;
        default:
          record[header] = val;
      }
    });

    return record;
  }

  /**
   * Parses CSV string adhering to RFC 4180 rules (quotes, newlines).
   */
  private static parseCsvLines(text: string): string[][] {
    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentCell += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell);
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // skip LF after CR
        }
        currentRow.push(currentCell);
        if (currentRow.length > 0 && currentRow.some(c => c.trim())) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell);
      if (currentRow.some(c => c.trim())) {
        lines.push(currentRow);
      }
    }

    return lines;
  }
}
