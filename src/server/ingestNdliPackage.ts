/**
 * NDLI AMBEDKAR ARCHIVAL INGESTION SERVICE
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Implements two distinct phases:
 * 1. validateAndPreview(): Non-destructive validation & report generation
 * 2. commitIngestion(): Transactional commit to Supabase PostgreSQL and verification
 */

import { getDbPool } from './db';
import { buildNdliArchivalPackages, NdliArchivalEntry, NDLI_CWBA_URL, NDLI_BAWS_URL, NDLI_SNS_URL } from './ndliDataset';

export interface ValidationPreviewReport {
  isValid: boolean;
  totalRecords: number;
  cwbaVolumeCount: number;
  bawsVolumeCount: number;
  snsParentCount: number;
  cwbaTitles: Array<{ volume: number; title: string; url: string }>;
  bawsTitles: Array<{ volume: string; title: string; url: string }>;
  snsTitles: Array<{ title: string; url: string }>;
  sourceUrls: {
    cwba: string;
    baws: string;
    sns: string;
  };
  provenanceMapping: {
    publisher: string;
    federator: string;
    sourceCollectionId: string;
    isDemoRecord: boolean;
  };
  checks: {
    foreignKeysValid: boolean;
    allDemoFlagsFalse: boolean;
    allTitlesPresent: boolean;
    allUrlsPresent: boolean;
    noDuplicateIds: boolean;
  };
}

export function validateAndPreview(): ValidationPreviewReport {
  const entries = buildNdliArchivalPackages();
  
  const cwbaEntries = entries.filter(e => e.sourceRecord.id.startsWith('sr-cwba-'));
  const bawsEntries = entries.filter(e => e.sourceRecord.id.startsWith('sr-baws-'));
  const snsEntries = entries.filter(e => e.sourceRecord.id.startsWith('sr-samajik-'));

  const idSet = new Set<string>();
  let noDuplicateIds = true;
  for (const e of entries) {
    if (idSet.has(e.archiveItem.id) || idSet.has(e.sourceRecord.id) || idSet.has(e.dublinCore.id)) {
      noDuplicateIds = false;
      break;
    }
    idSet.add(e.archiveItem.id);
    idSet.add(e.sourceRecord.id);
    idSet.add(e.dublinCore.id);
  }

  const allDemoFlagsFalse = entries.every(
    e => e.archiveItem.isDemoRecord === false && e.sourceRecord.isDemoRecord === false
  );

  const allTitlesPresent = entries.every(
    e => !!e.archiveItem.title && !!e.dublinCore.title && !!e.sourceRecord.originalTitle
  );

  const allUrlsPresent = entries.every(
    e => !!e.sourceRecord.originalUrl && e.sourceRecord.originalUrl.includes('ndl.iitkgp.ac.in')
  );

  const foreignKeysValid = entries.every(
    e => e.sourceRecord.sourceCollectionId === 'source-ambedkar-foundation' &&
         e.archiveItem.sourceRecordId === e.sourceRecord.id &&
         e.dublinCore.archiveItemId === e.archiveItem.id
  );

  const isValid = (
    entries.length === 61 &&
    cwbaEntries.length === 40 &&
    bawsEntries.length === 20 &&
    snsEntries.length === 1 &&
    allDemoFlagsFalse &&
    allTitlesPresent &&
    allUrlsPresent &&
    foreignKeysValid &&
    noDuplicateIds
  );

  return {
    isValid,
    totalRecords: entries.length,
    cwbaVolumeCount: cwbaEntries.length,
    bawsVolumeCount: bawsEntries.length,
    snsParentCount: snsEntries.length,
    cwbaTitles: cwbaEntries.map(e => ({
      volume: (e.sourceRecord.sourceMetadata as any).volume,
      title: e.archiveItem.title,
      url: e.sourceRecord.originalUrl
    })),
    bawsTitles: bawsEntries.map(e => ({
      volume: (e.sourceRecord.sourceMetadata as any).volume,
      title: e.archiveItem.title,
      url: e.sourceRecord.originalUrl
    })),
    snsTitles: snsEntries.map(e => ({
      title: e.archiveItem.title,
      url: e.sourceRecord.originalUrl
    })),
    sourceUrls: {
      cwba: NDLI_CWBA_URL,
      baws: NDLI_BAWS_URL,
      sns: NDLI_SNS_URL
    },
    provenanceMapping: {
      publisher: 'Dr. Ambedkar Foundation (Ministry of Social Justice & Empowerment, Govt. of India)',
      federator: 'National Digital Library of India (NDLI, IIT Kharagpur)',
      sourceCollectionId: 'source-ambedkar-foundation',
      isDemoRecord: false
    },
    checks: {
      foreignKeysValid,
      allDemoFlagsFalse,
      allTitlesPresent,
      allUrlsPresent,
      noDuplicateIds
    }
  };
}

export async function commitIngestion(): Promise<{
  success: boolean;
  insertedCounts: {
    sourceRecords: number;
    archiveItems: number;
    dublinCore: number;
  };
  verification: {
    totalSourceRecordsInDb: number;
    totalArchiveItemsInDb: number;
    totalDublinCoreInDb: number;
    realRecordsCount: number;
    demoRecordsCount: number;
    foreignKeysIntact: boolean;
    noDuplicates: boolean;
  };
  error?: string;
}> {
  const pool = getDbPool();
  if (!pool) {
    throw new Error('PostgreSQL connection pool is not available.');
  }

  // Phase 1: Validate first before touching the database
  const preview = validateAndPreview();
  if (!preview.isValid) {
    throw new Error('Pre-ingestion validation failed. Ingestion aborted.');
  }

  const entries = buildNdliArchivalPackages();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insert Source Records
    for (const entry of entries) {
      const sr = entry.sourceRecord;
      await client.query(`
        INSERT INTO public.source_records (
          id, source_collection_id, original_source_identifier, original_title,
          original_url, repository, source_metadata, ingestion_method,
          provenance_notes, is_demo_record, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          original_title = EXCLUDED.original_title,
          original_url = EXCLUDED.original_url,
          source_metadata = EXCLUDED.source_metadata,
          provenance_notes = EXCLUDED.provenance_notes,
          is_demo_record = EXCLUDED.is_demo_record,
          updated_at = CURRENT_TIMESTAMP;
      `, [
        sr.id,
        sr.sourceCollectionId,
        sr.originalSourceIdentifier,
        sr.originalTitle,
        sr.originalUrl,
        sr.repository,
        JSON.stringify(sr.sourceMetadata),
        sr.ingestionMethod,
        sr.provenanceNotes,
        sr.isDemoRecord
      ]);
    }

    // 2. Insert Archive Items
    for (const entry of entries) {
      const item = entry.archiveItem;
      await client.query(`
        INSERT INTO public.archive_items (
          id, archive_id, source_record_id, title, title_hi, category,
          date, year, author, collection, source_institution, source_provenance,
          language, original_holding, description, description_hi, full_text,
          ai_summary, key_concepts, publishing_status, is_featured, is_demo_record,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          archive_id = EXCLUDED.archive_id,
          source_record_id = EXCLUDED.source_record_id,
          title = EXCLUDED.title,
          title_hi = EXCLUDED.title_hi,
          category = EXCLUDED.category,
          date = EXCLUDED.date,
          year = EXCLUDED.year,
          author = EXCLUDED.author,
          collection = EXCLUDED.collection,
          source_institution = EXCLUDED.source_institution,
          source_provenance = EXCLUDED.source_provenance,
          language = EXCLUDED.language,
          original_holding = EXCLUDED.original_holding,
          description = EXCLUDED.description,
          description_hi = EXCLUDED.description_hi,
          full_text = EXCLUDED.full_text,
          ai_summary = EXCLUDED.ai_summary,
          key_concepts = EXCLUDED.key_concepts,
          publishing_status = EXCLUDED.publishing_status,
          is_featured = EXCLUDED.is_featured,
          is_demo_record = EXCLUDED.is_demo_record,
          updated_at = CURRENT_TIMESTAMP;
      `, [
        item.id,
        item.archiveId,
        item.sourceRecordId,
        item.title,
        item.titleHi || null,
        item.category,
        item.date,
        item.year,
        item.author,
        item.collection,
        item.sourceInstitution,
        item.sourceProvenance,
        item.language,
        item.originalHolding,
        item.description,
        item.descriptionHi || null,
        item.fullText,
        item.aiSummary,
        item.keyConcepts,
        item.publishingStatus,
        item.isFeatured,
        item.isDemoRecord
      ]);
    }

    // 3. Insert Dublin Core Metadata
    for (const entry of entries) {
      const dc = entry.dublinCore;
      await client.query(`
        INSERT INTO public.dublin_core_metadata (
          id, archive_item_id, title, creator, subject, description,
          publisher, contributor, date, type, format, identifier,
          source, language, relation, coverage, rights,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          archive_item_id = EXCLUDED.archive_item_id,
          title = EXCLUDED.title,
          creator = EXCLUDED.creator,
          subject = EXCLUDED.subject,
          description = EXCLUDED.description,
          publisher = EXCLUDED.publisher,
          contributor = EXCLUDED.contributor,
          date = EXCLUDED.date,
          type = EXCLUDED.type,
          format = EXCLUDED.format,
          identifier = EXCLUDED.identifier,
          source = EXCLUDED.source,
          language = EXCLUDED.language,
          relation = EXCLUDED.relation,
          coverage = EXCLUDED.coverage,
          rights = EXCLUDED.rights,
          updated_at = CURRENT_TIMESTAMP;
      `, [
        dc.id,
        dc.archiveItemId,
        dc.title,
        dc.creator,
        dc.subject,
        dc.description,
        dc.publisher,
        dc.contributor,
        dc.date,
        dc.type,
        dc.format,
        dc.identifier,
        dc.source,
        dc.language,
        dc.relation,
        dc.coverage,
        dc.rights
      ]);
    }

    // 4. Update total_records_count on source_collections
    await client.query(`
      UPDATE public.source_collections
      SET total_records_count = (
        SELECT count(*) FROM public.source_records WHERE source_collection_id = 'source-ambedkar-foundation'
      ),
      updated_at = CURRENT_TIMESTAMP
      WHERE id = 'source-ambedkar-foundation';
    `);

    await client.query('COMMIT');

    // Post-commit Verification Queries
    const srCount = await client.query('SELECT count(*)::int as count FROM public.source_records;');
    const aiCount = await client.query('SELECT count(*)::int as count FROM public.archive_items;');
    const dcCount = await client.query('SELECT count(*)::int as count FROM public.dublin_core_metadata;');
    
    const realCount = await client.query('SELECT count(*)::int as count FROM public.archive_items WHERE is_demo_record = false;');
    const demoCount = await client.query('SELECT count(*)::int as count FROM public.archive_items WHERE is_demo_record = true;');

    const fkCheck = await client.query(`
      SELECT count(*)::int as broken_count
      FROM public.archive_items ai
      LEFT JOIN public.source_records sr ON ai.source_record_id = sr.id
      WHERE sr.id IS NULL;
    `);

    const dupCheck = await client.query(`
      SELECT archive_id, count(*) as cnt
      FROM public.archive_items
      GROUP BY archive_id
      HAVING count(*) > 1;
    `);

    return {
      success: true,
      insertedCounts: {
        sourceRecords: entries.length,
        archiveItems: entries.length,
        dublinCore: entries.length
      },
      verification: {
        totalSourceRecordsInDb: srCount.rows[0].count,
        totalArchiveItemsInDb: aiCount.rows[0].count,
        totalDublinCoreInDb: dcCount.rows[0].count,
        realRecordsCount: realCount.rows[0].count,
        demoRecordsCount: demoCount.rows[0].count,
        foreignKeysIntact: fkCheck.rows[0].broken_count === 0,
        noDuplicates: dupCheck.rows.length === 0
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
