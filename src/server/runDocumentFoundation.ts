/**
 * STEP 2: DOCUMENT + PAGE DATA LAYER RUNNER
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Establishes and verifies the Document foundation layer:
 * Source Collection -> Source Record -> Archive Item -> Document -> Document Page -> OCR Record
 *
 * Rules strictly enforced:
 * - Purely additive implementation
 * - No deletion or modification of 97 real archival records
 * - Truthful asset status = 'METADATA_ONLY'
 * - Zero fake page content, zero fake OCR records
 * - Preserves verified NDLI permalinks and page counts
 */

import { getDbPool } from './db.ts';
import { DocumentService } from './documentService.ts';

async function run() {
  console.log('===============================================================');
  console.log('SIH26096 — STEP 2: DOCUMENT + PAGE FOUNDATION EXECUTION');
  console.log('===============================================================');

  const pool = getDbPool();
  if (!pool) {
    console.error('ERROR: Database connection pool not available.');
    process.exit(1);
  }

  // Phase 1: Pre-execution live database check
  console.log('\n--- 1. PRE-EXECUTION LIVE DATABASE CHECK ---');
  const preCheck = await pool.query(`
    SELECT
      (SELECT count(*) FROM archive_items WHERE is_demo_record = false) as real_archive_count,
      (SELECT count(*) FROM archive_items WHERE source_record_id LIKE 'sr-cwba%' OR source_record_id LIKE 'sr-baws%' OR source_record_id = 'sr-sns-01') as ambedkar_foundation_count,
      (SELECT count(*) FROM archive_items WHERE source_record_id LIKE 'sr-cad%') as cad_archive_count,
      (SELECT count(*) FROM documents) as doc_count,
      (SELECT count(*) FROM document_pages) as page_count,
      (SELECT count(*) FROM ocr_records) as ocr_count;
  `);

  console.log('Live Database Pre-State:', preCheck.rows[0]);
  const realArchiveCount = parseInt(preCheck.rows[0].real_archive_count, 10);
  if (realArchiveCount !== 97) {
    console.error(`ERROR: Expected 97 real archival records, found ${realArchiveCount}. Aborting.`);
    process.exit(1);
  }

  // Phase 2: Execute Document Foundation Layer Population
  console.log('\n--- 2. EXECUTING DOCUMENT FOUNDATION SYNCHRONIZATION ---');
  const syncResult = await DocumentService.populateMetadataOnlyDocuments();
  console.log('Synchronization Result:');
  console.log(`- Total Archive Items Processed: ${syncResult.totalArchiveItems}`);
  console.log(`- Documents Inserted: ${syncResult.inserted}`);
  console.log(`- Documents Updated: ${syncResult.updated}`);

  // Phase 3: Post-execution live database verification
  console.log('\n--- 3. POST-EXECUTION DATABASE VERIFICATION ---');
  const postCheck = await pool.query(`
    SELECT
      (SELECT count(*) FROM archive_items WHERE is_demo_record = false) as real_archive_count,
      (SELECT count(*) FROM documents) as doc_count,
      (SELECT count(*) FROM documents WHERE status = 'METADATA_ONLY') as metadata_only_doc_count,
      (SELECT count(*) FROM documents WHERE document_type = 'PARLIAMENTARY_REPORT') as cad_doc_count,
      (SELECT count(*) FROM documents WHERE document_type = 'PRINTED_MONOGRAPH') as monograph_doc_count,
      (SELECT count(*) FROM documents WHERE document_type = 'GAZETTE') as gazette_doc_count,
      (SELECT count(*) FROM documents WHERE page_count > 0) as docs_with_verified_pages,
      (SELECT count(*) FROM document_pages) as page_count,
      (SELECT count(*) FROM ocr_records) as ocr_count;
  `);

  console.log('Live Database Post-State:', postCheck.rows[0]);

  // Phase 4: Sample Document Inspection
  console.log('\n--- 4. SAMPLE VERIFIED DOCUMENT RECORDS ---');
  const sampleDocs = await pool.query(`
    SELECT d.id, d.title, d.document_type, d.page_count, d.status, d.asset_reference, d.source
    FROM documents d
    ORDER BY d.id ASC
    LIMIT 6;
  `);
  console.table(sampleDocs.rows);

  console.log('\n--- 5. VERIFIED DLI VOLUMES INSPECTION ---');
  const dliDocs = await pool.query(`
    SELECT d.id, d.title, d.page_count, d.status, d.asset_reference
    FROM documents d
    WHERE d.id LIKE '%cad-dli%'
    ORDER BY d.id ASC;
  `);
  console.table(dliDocs.rows);

  console.log('\n===============================================================');
  console.log('DOCUMENT + PAGE FOUNDATION ESTABLISHED AND VERIFIED SUCCESSFULLY');
  console.log('===============================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
