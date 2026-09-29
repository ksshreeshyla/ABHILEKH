/**
 * SERVER-SIDE DOCUMENT & PAGE SERVICE LAYER
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Implements the logical hierarchy:
 * Source Collection -> Source Record -> Archive Item -> Document -> Document Page -> OCR Record
 *
 * Enforces:
 * - Server-side only PostgreSQL pool execution
 * - Truthful document asset status (METADATA_ONLY, EXTERNAL_DOCUMENT, DOCUMENT_AVAILABLE, etc.)
 * - Zero fabrication of fake PDFs, fake OCR, or fake download URLs
 * - Preservation of NDLI permalinks and provenance chains
 */

import fs from 'fs';
import { getDbPool } from './db.ts';
import { PDFDocument } from 'pdf-lib';
import { DocumentStorageService, type StoredMasterAsset, MAX_DOCUMENT_FILE_SIZE_BYTES } from './storage/documentStorage.ts';

export { MAX_DOCUMENT_FILE_SIZE_BYTES };

export type DocumentAssetStatus =
  | 'METADATA_ONLY'
  | 'EXTERNAL_DOCUMENT'
  | 'DOCUMENT_AVAILABLE'
  | 'DOCUMENT_PROCESSING'
  | 'DOCUMENT_READY'
  | 'ACCESS_RESTRICTED';

export type PageStatus =
  | 'NOT_AVAILABLE'
  | 'AVAILABLE'
  | 'PROCESSING'
  | 'OCR_COMPLETE'
  | 'VERIFIED'
  | 'NEEDS_REVIEW';

export interface FileValidationResult {
  valid: boolean;
  filename: string;
  fileSizeBytes: number;
  mimeType: string;
  pageCount: number;
  checksumSha256: string;
  isDuplicate: boolean;
  existingDocument?: {
    id: string;
    archiveItemId: string;
    title: string;
    status: string;
  };
  error?: string;
}

export interface IngestDocumentAssetInput {
  archiveItemId: string;
  documentId?: string;
  fileBuffer: Buffer;
  filename: string;
  mimeType?: string;
  acquisitionMethod: 'ADMIN_UPLOAD' | 'APPROVED_OPEN_URL' | 'INSTITUTIONAL_REPOSITORY_EXPORT' | 'APPROVED_API_PACKAGE';
  provenanceNotes?: string;
  rightsInfo?: string;
  reviewerId?: string;
  reviewerName?: string;
}

export interface IngestDocumentAssetResult {
  success: boolean;
  document: DocumentRecordDto;
  pages: DocumentPageRecordDto[];
  pagesExtracted: number;
  checksumSha256: string;
  fileSizeBytes: number;
  storagePath: string;
  auditLogId?: string;
}

export interface DocumentRecordDto {
  id: string;
  archiveItemId: string;
  archiveId: string;
  title: string;
  documentType: string;
  language: string;
  pageCount: number;
  source: string;
  originalIdentifier?: string;
  assetReference?: string;
  metadata: Record<string, unknown>;
  status: DocumentAssetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentPageRecordDto {
  id: string;
  documentId: string;
  pageNumber: number;
  originalAssetReference?: string;
  svgScanType?: string;
  pageMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ArchiveItemDocumentStatusDto {
  hasDocumentRecord: boolean;
  document: DocumentRecordDto | null;
  archiveItemId: string;
  archiveId: string;
  title: string;
  assetStatus: DocumentAssetStatus;
  message: string;
  externalSourceUrl?: string;
  sourceInstitution: string;
  sourceProvenance?: string;
  rightsInformation?: string;
  pageCount: number;
  pages: DocumentPageRecordDto[];
}

export interface RegisterExternalDocumentInput {
  archiveItemId: string;
  title?: string;
  documentType?: string;
  language?: string;
  pageCount?: number;
  externalUrl: string;
  externalIdentifier?: string;
  sourceProvider: string;
  rightsInfo?: string;
  provenanceNotes?: string;
  accessRestriction?: string;
}

export interface RegisterDocumentAssetInput {
  archiveItemId: string;
  title?: string;
  documentType?: string;
  language?: string;
  pageCount: number;
  assetReference: string;
  acquisitionMethod: 'ADMIN_UPLOAD' | 'APPROVED_OPEN_URL' | 'INSTITUTIONAL_REPOSITORY_EXPORT' | 'APPROVED_API_PACKAGE';
  sourceUrl?: string;
  checksumSha256?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  rightsInfo?: string;
  provenanceNotes?: string;
}

export class DocumentService {
  /**
   * Retrieves document and page hierarchy for a given ArchiveItem.
   * If no explicit document binary row exists in PostgreSQL, returns a truthful METADATA_ONLY state
   * linked to the ArchiveItem's verified external permalink without fabricating dummy records.
   */
  public static async getDocumentByArchiveItem(archiveItemId: string): Promise<ArchiveItemDocumentStatusDto | null> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    // 1. First query archive_items to verify parent entity exists
    const itemRes = await pool.query(
      `SELECT ai.id, ai.archive_id, ai.title, ai.download_url, ai.source_institution,
              ai.source_provenance, ai.language, ai.category, dcm.rights, dcm.identifier as dc_identifier
       FROM archive_items ai
       LEFT JOIN dublin_core_metadata dcm ON dcm.archive_item_id = ai.id
       WHERE ai.id = $1 OR ai.archive_id = $1
       LIMIT 1;`,
      [archiveItemId]
    );

    if (itemRes.rows.length === 0) {
      return null;
    }

    const item = itemRes.rows[0];

    // 2. Query documents table for explicit registered document record
    const docRes = await pool.query(
      `SELECT id, archive_item_id, title, document_type, language, page_count,
              source, original_identifier, asset_reference, metadata, status, created_at, updated_at
       FROM documents
       WHERE archive_item_id = $1
       ORDER BY created_at DESC
       LIMIT 1;`,
      [item.id]
    );

    if (docRes.rows.length > 0) {
      const docRow = docRes.rows[0];
      const docDto: DocumentRecordDto = {
        id: docRow.id,
        archiveItemId: docRow.archive_item_id,
        archiveId: item.archive_id,
        title: docRow.title,
        documentType: docRow.document_type,
        language: docRow.language || 'en',
        pageCount: docRow.page_count || 1,
        source: docRow.source,
        originalIdentifier: docRow.original_identifier,
        assetReference: docRow.asset_reference,
        metadata: docRow.metadata || {},
        status: docRow.status as DocumentAssetStatus,
        createdAt: docRow.created_at,
        updatedAt: docRow.updated_at
      };

      // Fetch pages for this document
      const pagesRes = await pool.query(
        `SELECT id, document_id, page_number, original_asset_reference, svg_scan_type,
                page_metadata, created_at, updated_at
         FROM document_pages
         WHERE document_id = $1
         ORDER BY page_number ASC;`,
        [docDto.id]
      );

      const pagesDto: DocumentPageRecordDto[] = pagesRes.rows.map(p => ({
        id: p.id,
        documentId: p.document_id,
        pageNumber: p.page_number,
        originalAssetReference: p.original_asset_reference,
        svgScanType: p.svg_scan_type,
        pageMetadata: p.page_metadata || {},
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }));

      return {
        hasDocumentRecord: true,
        document: docDto,
        archiveItemId: item.id,
        archiveId: item.archive_id,
        title: docDto.title,
        assetStatus: docDto.status,
        message: docDto.status === 'METADATA_ONLY'
          ? 'Metadata available — document asset not currently available.'
          : `Document asset registered with status: ${docDto.status}`,
        externalSourceUrl: docDto.assetReference || item.download_url,
        sourceInstitution: item.source_institution,
        sourceProvenance: item.source_provenance,
        rightsInformation: item.rights,
        pageCount: docDto.pageCount,
        pages: pagesDto
      };
    }

    // 3. No document binary row exists in DB -> Truthful METADATA_ONLY representation
    return {
      hasDocumentRecord: false,
      document: null,
      archiveItemId: item.id,
      archiveId: item.archive_id,
      title: item.title,
      assetStatus: 'METADATA_ONLY',
      message: 'Metadata available — document asset not currently available.',
      externalSourceUrl: item.download_url || undefined,
      sourceInstitution: item.source_institution,
      sourceProvenance: item.source_provenance,
      rightsInformation: item.rights || 'NDLI Access / Historical Official Records',
      pageCount: 0,
      pages: []
    };
  }

  /**
   * Retrieves a single document by its primary key ID.
   */
  public static async getDocumentById(documentId: string): Promise<DocumentRecordDto | null> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    const res = await pool.query(
      `SELECT d.id, d.archive_item_id, ai.archive_id, d.title, d.document_type, d.language,
              d.page_count, d.source, d.original_identifier, d.asset_reference, d.metadata,
              d.status, d.created_at, d.updated_at
       FROM documents d
       JOIN archive_items ai ON d.archive_item_id = ai.id
       WHERE d.id = $1
       LIMIT 1;`,
      [documentId]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      archiveItemId: row.archive_item_id,
      archiveId: row.archive_id,
      title: row.title,
      documentType: row.document_type,
      language: row.language || 'en',
      pageCount: row.page_count,
      source: row.source,
      originalIdentifier: row.original_identifier,
      assetReference: row.asset_reference,
      metadata: row.metadata || {},
      status: row.status as DocumentAssetStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Retrieves all pages for a given document.
   */
  public static async getDocumentPages(documentId: string): Promise<DocumentPageRecordDto[]> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    const res = await pool.query(
      `SELECT id, document_id, page_number, original_asset_reference, svg_scan_type,
              page_metadata, created_at, updated_at
       FROM document_pages
       WHERE document_id = $1
       ORDER BY page_number ASC;`,
      [documentId]
    );

    return res.rows.map(p => ({
      id: p.id,
      documentId: p.document_id,
      pageNumber: p.page_number,
      originalAssetReference: p.original_asset_reference,
      svgScanType: p.svg_scan_type,
      pageMetadata: p.page_metadata || {},
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));
  }

  /**
   * Retrieves a specific page by document ID and page number.
   */
  public static async getDocumentPage(documentId: string, pageNumber: number): Promise<DocumentPageRecordDto | null> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    const res = await pool.query(
      `SELECT id, document_id, page_number, original_asset_reference, svg_scan_type,
              page_metadata, created_at, updated_at
       FROM document_pages
       WHERE document_id = $1 AND page_number = $2
       LIMIT 1;`,
      [documentId, pageNumber]
    );

    if (res.rows.length === 0) return null;
    const p = res.rows[0];
    return {
      id: p.id,
      documentId: p.document_id,
      pageNumber: p.page_number,
      originalAssetReference: p.original_asset_reference,
      svgScanType: p.svg_scan_type,
      pageMetadata: p.page_metadata || {},
      createdAt: p.created_at,
      updatedAt: p.updated_at
    };
  }

  /**
   * Registers an external document record for an archive item.
   * Useful when connecting official external digital repository permalinks.
   */
  public static async registerExternalDocument(input: RegisterExternalDocumentInput): Promise<DocumentRecordDto> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    // Verify parent archive item exists
    const itemRes = await pool.query(
      `SELECT id, archive_id, title, category, language FROM archive_items WHERE id = $1 LIMIT 1;`,
      [input.archiveItemId]
    );
    if (itemRes.rows.length === 0) {
      throw new Error(`ArchiveItem with id "${input.archiveItemId}" not found.`);
    }

    const item = itemRes.rows[0];
    const docId = `doc-ext-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const title = input.title || item.title;
    const docType = input.documentType || 'PARLIAMENTARY_REPORT';
    const lang = input.language || item.language || 'en';
    const pageCount = input.pageCount || 1;
    const status: DocumentAssetStatus = 'EXTERNAL_DOCUMENT';

    const metadata = {
      assetStatus: status,
      availabilityStatus: 'EXTERNAL_REPOSITORY',
      sourceProvider: input.sourceProvider,
      externalUrl: input.externalUrl,
      externalIdentifier: input.externalIdentifier || null,
      rightsInformation: input.rightsInfo || 'NDLI Cataloged / Access Restricted',
      provenanceNotes: input.provenanceNotes || 'External document registered with verified permalink.',
      accessRestriction: input.accessRestriction || 'NDLI_LOGIN_RESTRICTED',
      registeredAt: new Date().toISOString()
    };

    const insertRes = await pool.query(
      `INSERT INTO documents (
        id, archive_item_id, title, document_type, language, page_count,
        source, original_identifier, asset_reference, metadata, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      )
      RETURNING *;`,
      [
        docId,
        input.archiveItemId,
        title,
        docType,
        lang,
        pageCount,
        input.sourceProvider,
        input.externalIdentifier || null,
        input.externalUrl,
        JSON.stringify(metadata),
        status
      ]
    );

    const row = insertRes.rows[0];
    return {
      id: row.id,
      archiveItemId: row.archive_item_id,
      archiveId: item.archive_id,
      title: row.title,
      documentType: row.document_type,
      language: row.language,
      pageCount: row.page_count,
      source: row.source,
      originalIdentifier: row.original_identifier,
      assetReference: row.asset_reference,
      metadata: row.metadata,
      status: row.status as DocumentAssetStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Registers a legitimately acquired document asset with complete acquisition provenance.
   * If pageCount > 0, initializes page entries with pageStatus: AVAILABLE or PROCESSING.
   */
  public static async registerDocumentAsset(input: RegisterDocumentAssetInput): Promise<{
    document: DocumentRecordDto;
    pages: DocumentPageRecordDto[];
  }> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const itemRes = await client.query(
        `SELECT id, archive_id, title, category, language FROM archive_items WHERE id = $1 LIMIT 1;`,
        [input.archiveItemId]
      );
      if (itemRes.rows.length === 0) {
        throw new Error(`ArchiveItem with id "${input.archiveItemId}" not found.`);
      }

      const item = itemRes.rows[0];
      const docId = `doc-asset-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const title = input.title || item.title;
      const docType = input.documentType || 'PRINTED_MONOGRAPH';
      const lang = input.language || item.language || 'en';
      const status: DocumentAssetStatus = 'DOCUMENT_AVAILABLE';

      const metadata = {
        assetStatus: status,
        acquisitionMethod: input.acquisitionMethod,
        sourceUrl: input.sourceUrl || null,
        checksumSha256: input.checksumSha256 || null,
        mimeType: input.mimeType || 'application/pdf',
        fileSizeBytes: input.fileSizeBytes || null,
        rightsInformation: input.rightsInfo || 'Institutional Preservation Asset',
        provenanceNotes: input.provenanceNotes || 'Approved institutional document asset registered with audit checksum.',
        acquiredAt: new Date().toISOString()
      };

      const docRes = await client.query(
        `INSERT INTO documents (
          id, archive_item_id, title, document_type, language, page_count,
          source, original_identifier, asset_reference, metadata, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        )
        RETURNING *;`,
        [
          docId,
          input.archiveItemId,
          title,
          docType,
          lang,
          input.pageCount,
          input.acquisitionMethod,
          input.checksumSha256 ? `SHA256:${input.checksumSha256.substring(0, 16)}` : null,
          input.assetReference,
          JSON.stringify(metadata),
          status
        ]
      );

      const docRow = docRes.rows[0];

      // Create page entries for the document
      const pages: DocumentPageRecordDto[] = [];
      for (let pNum = 1; pNum <= input.pageCount; pNum++) {
        const pageId = `page-${docId}-${pNum}`;
        const pageMeta = {
          pageStatus: 'AVAILABLE' as PageStatus,
          ocrStatus: 'PENDING',
          verificationStatus: 'UNVERIFIED',
          provenance: `Extracted from master asset ${input.assetReference}`
        };

        const pageRes = await client.query(
          `INSERT INTO document_pages (
            id, document_id, page_number, original_asset_reference, page_metadata, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, NOW(), NOW()
          )
          RETURNING *;`,
          [
            pageId,
            docId,
            pNum,
            `${input.assetReference}#page=${pNum}`,
            JSON.stringify(pageMeta)
          ]
        );

        const pRow = pageRes.rows[0];
        pages.push({
          id: pRow.id,
          documentId: pRow.document_id,
          pageNumber: pRow.page_number,
          originalAssetReference: pRow.original_asset_reference,
          svgScanType: pRow.svg_scan_type,
          pageMetadata: pRow.page_metadata,
          createdAt: pRow.created_at,
          updatedAt: pRow.updated_at
        });
      }

      await client.query('COMMIT');

      const docDto: DocumentRecordDto = {
        id: docRow.id,
        archiveItemId: docRow.archive_item_id,
        archiveId: item.archive_id,
        title: docRow.title,
        documentType: docRow.document_type,
        language: docRow.language,
        pageCount: docRow.page_count,
        source: docRow.source,
        originalIdentifier: docRow.original_identifier,
        assetReference: docRow.asset_reference,
        metadata: docRow.metadata,
        status: docRow.status as DocumentAssetStatus,
        createdAt: docRow.created_at,
        updatedAt: docRow.updated_at
      };

      return { document: docDto, pages };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Updates document asset status and audit notes.
   */
  public static async updateDocumentStatus(
    documentId: string,
    status: DocumentAssetStatus,
    notes?: string
  ): Promise<DocumentRecordDto | null> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    const currentRes = await pool.query(
      `SELECT metadata FROM documents WHERE id = $1 LIMIT 1;`,
      [documentId]
    );
    if (currentRes.rows.length === 0) return null;

    const currentMeta = currentRes.rows[0].metadata || {};
    const updatedMeta = {
      ...currentMeta,
      assetStatus: status,
      statusLastUpdated: new Date().toISOString(),
      statusUpdateNotes: notes || null
    };

    const res = await pool.query(
      `UPDATE documents
       SET status = $1, metadata = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *;`,
      [status, JSON.stringify(updatedMeta), documentId]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    const aiRes = await pool.query(
      `SELECT archive_id FROM archive_items WHERE id = $1 LIMIT 1;`,
      [row.archive_item_id]
    );
    const archiveId = aiRes.rows.length > 0 ? aiRes.rows[0].archive_id : '';

    return {
      id: row.id,
      archiveItemId: row.archive_item_id,
      archiveId,
      title: row.title,
      documentType: row.document_type,
      language: row.language,
      pageCount: row.page_count,
      source: row.source,
      originalIdentifier: row.original_identifier,
      assetReference: row.asset_reference,
      metadata: row.metadata,
      status: row.status as DocumentAssetStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Retrieves all documents with optional filtering and pagination.
   */
  public static async getAllDocuments(filter?: {
    status?: DocumentAssetStatus;
    archiveItemId?: string;
    documentType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ documents: DocumentRecordDto[]; total: number }> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (filter?.status) {
      conditions.push(`d.status = $${pIdx++}`);
      params.push(filter.status);
    }
    if (filter?.archiveItemId) {
      conditions.push(`d.archive_item_id = $${pIdx++}`);
      params.push(filter.archiveItemId);
    }
    if (filter?.documentType) {
      conditions.push(`d.document_type = $${pIdx++}`);
      params.push(filter.documentType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT count(*)::int as total FROM documents d ${whereClause};`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const limit = filter?.limit && filter.limit > 0 ? filter.limit : 100;
    const offset = filter?.offset && filter.offset >= 0 ? filter.offset : 0;

    const queryParams = [...params, limit, offset];
    const dataRes = await pool.query(
      `SELECT d.id, d.archive_item_id, ai.archive_id, d.title, d.document_type, d.language,
              d.page_count, d.source, d.original_identifier, d.asset_reference, d.metadata,
              d.status, d.created_at, d.updated_at
       FROM documents d
       JOIN archive_items ai ON d.archive_item_id = ai.id
       ${whereClause}
       ORDER BY d.created_at ASC, d.id ASC
       LIMIT $${pIdx++} OFFSET $${pIdx++};`,
      queryParams
    );

    const documents: DocumentRecordDto[] = dataRes.rows.map(row => ({
      id: row.id,
      archiveItemId: row.archive_item_id,
      archiveId: row.archive_id,
      title: row.title,
      documentType: row.document_type,
      language: row.language || 'en',
      pageCount: row.page_count,
      source: row.source,
      originalIdentifier: row.original_identifier,
      assetReference: row.asset_reference,
      metadata: row.metadata || {},
      status: row.status as DocumentAssetStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return { documents, total };
  }

  /**
   * Establishes the Document Foundation layer for all real archival records in the database.
   *
   * Enforces:
   * - Strict 1:1 relationship from ArchiveItem -> Document
   * - Truthful asset status = 'METADATA_ONLY'
   * - Preserves verified NDLI permalink as external source reference
   * - Preserves verified page counts where documented in NDLI catalog metadata
   * - ZERO fabrication of fake document pages or fake OCR records (document_pages and ocr_records remain 0 rows)
   */
  public static async populateMetadataOnlyDocuments(): Promise<{
    totalArchiveItems: number;
    processed: number;
    inserted: number;
    updated: number;
    unchanged: number;
    documents: Array<{
      documentId: string;
      archiveItemId: string;
      archiveId: string;
      title: string;
      documentType: string;
      pageCount: number;
      assetStatus: DocumentAssetStatus;
      externalUrl: string;
    }>;
  }> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch all 97 real archival items with their Dublin Core and Source Record data
      const itemsRes = await client.query(
        `SELECT ai.id, ai.archive_id, ai.title, ai.category, ai.language, ai.download_url,
                ai.source_institution, ai.source_provenance,
                dcm.identifier as dc_identifier, dcm.rights as dc_rights,
                sr.original_source_identifier, sr.original_url as sr_original_url, sr.source_metadata
         FROM archive_items ai
         LEFT JOIN dublin_core_metadata dcm ON dcm.archive_item_id = ai.id
         LEFT JOIN source_records sr ON sr.id = ai.source_record_id
         WHERE ai.is_demo_record = false
         ORDER BY ai.id ASC;`
      );

      const items = itemsRes.rows;
      let inserted = 0;
      let updated = 0;
      let unchanged = 0;
      const results: Array<{
        documentId: string;
        archiveItemId: string;
        archiveId: string;
        title: string;
        documentType: string;
        pageCount: number;
        assetStatus: DocumentAssetStatus;
        externalUrl: string;
      }> = [];

      for (const item of items) {
        const docId = `doc-${item.id}`;

        // Determine logical document type based on category
        let docType = 'PRINTED_MONOGRAPH';
        if (item.category === 'Constituent Assembly Debates') {
          docType = 'PARLIAMENTARY_REPORT';
        } else if (item.category === 'Historical Records') {
          docType = 'GAZETTE';
        } else if (item.category === 'Rare Manuscripts') {
          docType = 'MANUSCRIPT';
        }

        // Extract verified page count from source metadata if available
        let pageCount = 0;
        const srMeta = item.source_metadata || {};
        if (typeof srMeta.pageCount === 'number' && srMeta.pageCount > 0) {
          pageCount = srMeta.pageCount;
        } else if (typeof srMeta.page_count === 'number' && srMeta.page_count > 0) {
          pageCount = srMeta.page_count;
        }

        const externalUrl = item.download_url || item.sr_original_url || '';
        const originalId = item.original_source_identifier || item.dc_identifier || item.archive_id;
        const status: DocumentAssetStatus = 'METADATA_ONLY';

        const metadata = {
          assetStatus: status,
          availabilityStatus: 'EXTERNAL_METADATA_ONLY',
          sourceProvider: item.source_institution || 'National Digital Library of India',
          externalUrl,
          externalIdentifier: originalId,
          rightsInformation: item.dc_rights || 'NDLI Access / Historical Official Records',
          provenanceNotes: item.source_provenance || 'Federated archival metadata from NDLI catalog.',
          hasLocalBinary: false,
          verifiedPageCount: pageCount > 0 ? pageCount : null,
          catalogSource: 'National Digital Library of India (NDLI)',
          registeredAt: new Date().toISOString()
        };

        const existingDoc = await client.query(
          `SELECT id, status, metadata FROM documents WHERE id = $1 LIMIT 1;`,
          [docId]
        );

        if (existingDoc.rows.length === 0) {
          await client.query(
            `INSERT INTO documents (
              id, archive_item_id, title, document_type, language, page_count,
              source, original_identifier, asset_reference, metadata, status, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
            );`,
            [
              docId,
              item.id,
              item.title,
              docType,
              item.language || 'en',
              pageCount,
              item.source_institution || 'National Digital Library of India',
              originalId,
              externalUrl,
              JSON.stringify(metadata),
              status
            ]
          );
          inserted++;
        } else {
          await client.query(
            `UPDATE documents
             SET title = $1, document_type = $2, language = $3, page_count = $4,
                 source = $5, original_identifier = $6, asset_reference = $7,
                 metadata = $8, status = $9, updated_at = NOW()
             WHERE id = $10;`,
            [
              item.title,
              docType,
              item.language || 'en',
              pageCount,
              item.source_institution || 'National Digital Library of India',
              originalId,
              externalUrl,
              JSON.stringify(metadata),
              status,
              docId
            ]
          );
          updated++;
        }

        results.push({
          documentId: docId,
          archiveItemId: item.id,
          archiveId: item.archive_id,
          title: item.title,
          documentType: docType,
          pageCount,
          assetStatus: status,
          externalUrl
        });
      }

      await client.query('COMMIT');

      return {
        totalArchiveItems: items.length,
        processed: items.length,
        inserted,
        updated,
        unchanged,
        documents: results
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * STEP 4: Validates a proposed document asset file before ingestion.
   */
  public static async validateDocumentFile(
    fileBuffer: Buffer,
    filename: string
  ): Promise<FileValidationResult> {
    const pool = getDbPool();
    const sha256 = DocumentStorageService.computeSha256(fileBuffer);
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    const maxSizeBytes = MAX_DOCUMENT_FILE_SIZE_BYTES; // 120 MiB = 120 * 1024 * 1024 bytes (125,829,120 bytes)

    if (!fileBuffer || fileBuffer.length === 0) {
      return {
        valid: false,
        filename,
        fileSizeBytes: 0,
        mimeType: 'application/octet-stream',
        pageCount: 0,
        checksumSha256: sha256,
        isDuplicate: false,
        error: 'File is empty (0 bytes). Archival ingestion requires a non-empty document.'
      };
    }

    if (fileBuffer.length > maxSizeBytes) {
      return {
        valid: false,
        filename,
        fileSizeBytes: fileBuffer.length,
        mimeType: 'application/pdf',
        pageCount: 0,
        checksumSha256: sha256,
        isDuplicate: false,
        error: `File size (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 120 MB (120 MiB).`
      };
    }

    if (ext !== '.pdf') {
      return {
        valid: false,
        filename,
        fileSizeBytes: fileBuffer.length,
        mimeType: 'application/octet-stream',
        pageCount: 0,
        checksumSha256: sha256,
        isDuplicate: false,
        error: `Invalid file extension "${ext}". Primary document ingestion format must be PDF (.pdf).`
      };
    }

    // Verify PDF magic bytes (%PDF-)
    const header = fileBuffer.subarray(0, 5).toString('ascii');
    if (!header.startsWith('%PDF-')) {
      return {
        valid: false,
        filename,
        fileSizeBytes: fileBuffer.length,
        mimeType: 'application/pdf',
        pageCount: 0,
        checksumSha256: sha256,
        isDuplicate: false,
        error: 'Invalid PDF format: File header does not begin with "%PDF-". The file may be corrupted.'
      };
    }

    // Parse with pdf-lib to ensure valid readable PDF structure & extract page count
    let pageCount = 0;
    try {
      const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: false });
      pageCount = pdfDoc.getPageCount();
      if (pageCount < 1) {
        return {
          valid: false,
          filename,
          fileSizeBytes: fileBuffer.length,
          mimeType: 'application/pdf',
          pageCount: 0,
          checksumSha256: sha256,
          isDuplicate: false,
          error: 'PDF document contains 0 readable pages.'
        };
      }
    } catch (pdfErr: unknown) {
      const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
      return {
        valid: false,
        filename,
        fileSizeBytes: fileBuffer.length,
        mimeType: 'application/pdf',
        pageCount: 0,
        checksumSha256: sha256,
        isDuplicate: false,
        error: `Corrupted or unreadable PDF structure: ${msg}`
      };
    }

    // Check for duplicate checksum in PostgreSQL if database is connected
    let isDuplicate = false;
    let existingDocument: FileValidationResult['existingDocument'] | undefined;

    if (pool) {
      try {
        const dupRes = await pool.query(
          `SELECT d.id, d.archive_item_id, d.title, d.status
           FROM documents d
           WHERE (d.metadata->>'checksumSha256' = $1 OR d.metadata->>'checksumSha256' = $2)
             AND d.status != 'METADATA_ONLY'
           LIMIT 1;`,
          [sha256, `SHA256:${sha256}`]
        );
        if (dupRes.rows.length > 0) {
          isDuplicate = true;
          existingDocument = {
            id: dupRes.rows[0].id,
            archiveItemId: dupRes.rows[0].archive_item_id,
            title: dupRes.rows[0].title,
            status: dupRes.rows[0].status
          };
        }
      } catch (dbErr) {
        console.warn('[DocumentService] Duplicate check DB warning:', dbErr);
      }
    }

    return {
      valid: !isDuplicate,
      filename,
      fileSizeBytes: fileBuffer.length,
      mimeType: 'application/pdf',
      pageCount,
      checksumSha256: sha256,
      isDuplicate,
      existingDocument,
      error: isDuplicate
        ? `Duplicate document asset detected. An asset with this identical SHA-256 checksum (${sha256.substring(0, 12)}...) is already registered for document "${existingDocument?.title}". Accidental duplicate ingestion is prohibited.`
        : undefined
    };
  }

  /**
   * STEP 4: Validates a proposed document asset file directly from temporary disk storage.
   * High performance: computes SHA-256 via streaming, reads minimal header bytes for magic check,
   * avoids duplicate in-memory Base64 allocations.
   */
  public static async validateDocumentFromPath(
    filePath: string,
    filename: string
  ): Promise<FileValidationResult> {
    const pool = getDbPool();
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    const maxSizeBytes = MAX_DOCUMENT_FILE_SIZE_BYTES; // 120 MiB = 120 * 1024 * 1024 bytes (125,829,120 bytes)

    let stats: fs.Stats;
    try {
      stats = await fs.promises.stat(filePath);
    } catch (statErr) {
      return {
        valid: false,
        filename,
        fileSizeBytes: 0,
        mimeType: 'application/octet-stream',
        pageCount: 0,
        checksumSha256: '',
        isDuplicate: false,
        error: `Failed to access uploaded file: ${statErr instanceof Error ? statErr.message : String(statErr)}`
      };
    }

    const fileSizeBytes = stats.size;

    if (fileSizeBytes === 0) {
      return {
        valid: false,
        filename,
        fileSizeBytes: 0,
        mimeType: 'application/octet-stream',
        pageCount: 0,
        checksumSha256: '',
        isDuplicate: false,
        error: 'File is empty (0 bytes). Archival ingestion requires a non-empty document.'
      };
    }

    if (fileSizeBytes > maxSizeBytes) {
      return {
        valid: false,
        filename,
        fileSizeBytes,
        mimeType: 'application/pdf',
        pageCount: 0,
        checksumSha256: '',
        isDuplicate: false,
        error: `File size (${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 120 MB (120 MiB).`
      };
    }

    if (ext !== '.pdf') {
      return {
        valid: false,
        filename,
        fileSizeBytes,
        mimeType: 'application/octet-stream',
        pageCount: 0,
        checksumSha256: '',
        isDuplicate: false,
        error: `Invalid file extension "${ext}". Primary document ingestion format must be PDF (.pdf).`
      };
    }

    // Verify PDF magic bytes (%PDF-) by reading the first 5 bytes directly
    let headerBuf = Buffer.alloc(5);
    let handle: fs.promises.FileHandle | null = null;
    try {
      handle = await fs.promises.open(filePath, 'r');
      await handle.read(headerBuf, 0, 5, 0);
    } catch (readErr) {
      return {
        valid: false,
        filename,
        fileSizeBytes,
        mimeType: 'application/pdf',
        pageCount: 0,
        checksumSha256: '',
        isDuplicate: false,
        error: `Could not read file header: ${readErr instanceof Error ? readErr.message : String(readErr)}`
      };
    } finally {
      if (handle) {
        await handle.close();
      }
    }

    const header = headerBuf.toString('ascii');
    if (!header.startsWith('%PDF-')) {
      return {
        valid: false,
        filename,
        fileSizeBytes,
        mimeType: 'application/pdf',
        pageCount: 0,
        checksumSha256: '',
        isDuplicate: false,
        error: 'Invalid PDF format: File header does not begin with "%PDF-". The file may be corrupted.'
      };
    }

    // Compute cryptographic SHA-256 via streaming (minimal memory footprint)
    let sha256 = '';
    try {
      sha256 = await DocumentStorageService.computeSha256File(filePath);
    } catch (hashErr) {
      return {
        valid: false,
        filename,
        fileSizeBytes,
        mimeType: 'application/pdf',
        pageCount: 0,
        checksumSha256: '',
        isDuplicate: false,
        error: `Failed to compute SHA-256 checksum: ${hashErr instanceof Error ? hashErr.message : String(hashErr)}`
      };
    }

    // Parse with pdf-lib to ensure valid readable PDF structure & extract page count
    let pageCount = 0;
    try {
      const fileData = await fs.promises.readFile(filePath);
      const pdfDoc = await PDFDocument.load(fileData, { ignoreEncryption: false });
      pageCount = pdfDoc.getPageCount();
      if (pageCount < 1) {
        return {
          valid: false,
          filename,
          fileSizeBytes,
          mimeType: 'application/pdf',
          pageCount: 0,
          checksumSha256: sha256,
          isDuplicate: false,
          error: 'PDF document contains 0 readable pages.'
        };
      }
    } catch (pdfErr: unknown) {
      const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
      return {
        valid: false,
        filename,
        fileSizeBytes,
        mimeType: 'application/pdf',
        pageCount: 0,
        checksumSha256: sha256,
        isDuplicate: false,
        error: `Corrupted or unreadable PDF structure: ${msg}`
      };
    }

    // Check for duplicate checksum in PostgreSQL if database is connected
    let isDuplicate = false;
    let existingDocument: FileValidationResult['existingDocument'] | undefined;

    if (pool) {
      try {
        const dupRes = await pool.query(
          `SELECT d.id, d.archive_item_id, d.title, d.status
           FROM documents d
           WHERE (d.metadata->>'checksumSha256' = $1 OR d.metadata->>'checksumSha256' = $2)
             AND d.status != 'METADATA_ONLY'
           LIMIT 1;`,
          [sha256, `SHA256:${sha256}`]
        );
        if (dupRes.rows.length > 0) {
          isDuplicate = true;
          existingDocument = {
            id: dupRes.rows[0].id,
            archiveItemId: dupRes.rows[0].archive_item_id,
            title: dupRes.rows[0].title,
            status: dupRes.rows[0].status
          };
        }
      } catch (dbErr) {
        console.warn('[DocumentService] Duplicate check DB warning:', dbErr);
      }
    }

    return {
      valid: !isDuplicate,
      filename,
      fileSizeBytes,
      mimeType: 'application/pdf',
      pageCount,
      checksumSha256: sha256,
      isDuplicate,
      existingDocument,
      error: isDuplicate
        ? `Duplicate document asset detected. An asset with this identical SHA-256 checksum (${sha256.substring(0, 12)}...) is already registered for document "${existingDocument?.title}". Accidental duplicate ingestion is prohibited.`
        : undefined
    };
  }

  /**
   * STEP 4: Real Document Asset Ingestion Workflow
   */
  public static async ingestDocumentAsset(
    input: IngestDocumentAssetInput
  ): Promise<IngestDocumentAssetResult> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable for document ingestion.');

    // 1. Pre-validation of input file
    const validation = await this.validateDocumentFile(input.fileBuffer, input.filename);
    if (!validation.valid && validation.isDuplicate && validation.existingDocument) {
      const requestedDocumentId = input.documentId || `doc-${input.archiveItemId}`;
      if (validation.existingDocument.id === requestedDocumentId &&
          validation.existingDocument.archiveItemId === input.archiveItemId) {
        const existingRes = await pool.query(
          `SELECT d.*, ai.archive_id
           FROM documents d JOIN archive_items ai ON ai.id = d.archive_item_id
           WHERE d.id = $1 AND d.archive_item_id = $2 LIMIT 1;`,
          [requestedDocumentId, input.archiveItemId]
        );
        const row = existingRes.rows[0];
        const storedMaster = await DocumentStorageService.getMasterAsset(requestedDocumentId);
        const storedChecksum = String(row?.metadata?.checksumSha256 || '').replace(/^SHA256:/i, '').toLowerCase();
        const pagesRes = await pool.query(
          `SELECT id, document_id, page_number, original_asset_reference, svg_scan_type,
                  page_metadata, created_at, updated_at
           FROM document_pages WHERE document_id = $1 ORDER BY page_number ASC;`,
          [requestedDocumentId]
        );
        const completePageSet = pagesRes.rows.length === validation.pageCount &&
          pagesRes.rows.every((page, index) => Number(page.page_number) === index + 1 &&
            DocumentStorageService.hasPageAsset(requestedDocumentId, Number(page.page_number)));
        const completeExistingAsset = row?.status === 'DOCUMENT_READY' &&
          row.page_count === validation.pageCount &&
          storedChecksum === validation.checksumSha256 &&
          storedMaster !== null &&
          DocumentStorageService.computeSha256(storedMaster.buffer) === validation.checksumSha256 &&
          completePageSet;

        if (completeExistingAsset) {
          const pages: DocumentPageRecordDto[] = pagesRes.rows.map(page => ({
            id: page.id,
            documentId: page.document_id,
            pageNumber: Number(page.page_number),
            originalAssetReference: page.original_asset_reference,
            svgScanType: page.svg_scan_type,
            pageMetadata: page.page_metadata || {},
            createdAt: page.created_at,
            updatedAt: page.updated_at,
          }));
          return {
            success: true,
            document: {
              id: row.id,
              archiveItemId: row.archive_item_id,
              archiveId: row.archive_id,
              title: row.title,
              documentType: row.document_type,
              language: row.language || 'en',
              pageCount: row.page_count,
              source: row.source,
              originalIdentifier: row.original_identifier,
              assetReference: row.asset_reference,
              metadata: row.metadata || {},
              status: row.status as DocumentAssetStatus,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            },
            pages,
            pagesExtracted: pages.length,
            checksumSha256: validation.checksumSha256,
            fileSizeBytes: input.fileBuffer.length,
            storagePath: row.asset_reference || '',
          };
        }
      }
    }
    if (!validation.valid) {
      throw new Error(`Document Validation Failed: ${validation.error}`);
    }

    const client = await pool.connect();
    let savedStorageDocId: string | null = null;

    try {
      // 2. Provenance Chain Verification (archive_items -> source_records -> source_collections)
      const provCheck = await client.query(
        `SELECT
           ai.id as archive_item_id,
           ai.archive_id,
           ai.title,
           ai.category,
           ai.language,
           ai.download_url,
           sr.id as source_record_id,
           sr.original_source_identifier,
           sc.id as source_collection_id,
           sc.name as source_collection_name
         FROM archive_items ai
         JOIN source_records sr ON ai.source_record_id = sr.id
         JOIN source_collections sc ON sr.source_collection_id = sc.id
         WHERE ai.id = $1 OR ai.archive_id = $1
         LIMIT 1;`,
        [input.archiveItemId]
      );

      if (provCheck.rows.length === 0) {
        throw new Error(
          `Provenance Verification Failed: ArchiveItem "${input.archiveItemId}" could not be verified along the archival provenance chain (archive_items -> source_records -> source_collections). Ingestion aborted.`
        );
      }

      const prov = provCheck.rows[0];
      const docId = input.documentId || `doc-${prov.archive_item_id}`;

      const existingAssetDocRes = await client.query(
        `SELECT archive_item_id, status, metadata FROM documents WHERE id = $1 LIMIT 1;`,
        [docId]
      );
      const existingDoc = existingAssetDocRes.rows[0];
      if (existingDoc && existingDoc.archive_item_id !== prov.archive_item_id) {
        throw new Error(`Document ID "${docId}" is already attached to a different archive item.`);
      }
      if (existingDoc && (existingDoc.status !== 'METADATA_ONLY' || existingDoc.metadata?.hasLocalBinary)) {
        throw new Error(`Document "${docId}" already has an asset. Refusing to overwrite stored archival files.`);
      }

      // 3. Extract real pages from the supplied PDF using pdf-lib
      const pdfDoc = await PDFDocument.load(input.fileBuffer, { ignoreEncryption: false });
      const realPageCount = pdfDoc.getPageCount();
      if (realPageCount < 1) {
        throw new Error('PDF contains 0 pages. Ingestion aborted.');
      }

      // 4. Save master asset in server storage
      savedStorageDocId = docId;
      const masterAsset = await DocumentStorageService.saveMasterAsset(
        docId,
        input.filename,
        input.fileBuffer,
        input.mimeType || 'application/pdf'
      );

      // 5. Extract each individual page PDF slice and save in storage
      const extractedPagesMetadata: Array<{
        pageNumber: number;
        width: number;
        height: number;
        storagePath: string;
        checksumSha256: string;
      }> = [];

      for (let i = 0; i < realPageCount; i++) {
        const pageNum = i + 1;
        const page = pdfDoc.getPage(i);
        const { width, height } = page.getSize();

        // Create standalone single-page PDF document
        const singlePageDoc = await PDFDocument.create();
        const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
        singlePageDoc.addPage(copiedPage);
        const singlePdfBytes = await singlePageDoc.save();
        const singlePdfBuffer = Buffer.from(singlePdfBytes);

        const pageAsset = await DocumentStorageService.savePageAsset(
          docId,
          pageNum,
          singlePdfBuffer,
          'application/pdf'
        );

        extractedPagesMetadata.push({
          pageNumber: pageNum,
          width: Math.round(width),
          height: Math.round(height),
          storagePath: pageAsset.storagePath,
          checksumSha256: DocumentStorageService.computeSha256(singlePdfBuffer)
        });
      }

      // 6. Begin ACID database commit
      await client.query('BEGIN');

      // Check existing document metadata to preserve previous external catalog pointers
      const existingDocRes = await client.query(
        `SELECT metadata FROM documents WHERE id = $1 LIMIT 1;`,
        [docId]
      );
      const prevMetadata = existingDocRes.rows[0]?.metadata || {};

      const updatedMetadata = {
        ...prevMetadata,
        assetStatus: 'DOCUMENT_READY' as DocumentAssetStatus,
        availabilityStatus: 'DOCUMENT_AVAILABLE',
        hasLocalBinary: true,
        masterStoragePath: masterAsset.storagePath,
        originalFilename: input.filename,
        checksumSha256: validation.checksumSha256,
        mimeType: input.mimeType || 'application/pdf',
        fileSizeBytes: input.fileBuffer.length,
        pageCount: realPageCount,
        acquisitionMethod: input.acquisitionMethod,
        acquiredAt: new Date().toISOString(),
        acquiredBy: input.reviewerName || input.reviewerId || 'admin-archivist',
        rightsInformation: input.rightsInfo || 'Institutional Preservation Asset',
        provenanceNotes: input.provenanceNotes || `Verified institutional asset ingested from ${input.filename}.`,
        sourceProvenanceChain: {
          archiveItemId: prov.archive_item_id,
          archiveId: prov.archive_id,
          sourceRecordId: prov.source_record_id,
          sourceCollectionId: prov.source_collection_id,
          sourceCollectionName: prov.source_collection_name
        }
      };

      const assetReference = `/api/documents/${docId}/master-asset`;

      // Upsert document record
      const docRes = await client.query(
        `INSERT INTO documents (
          id, archive_item_id, title, document_type, language, page_count,
          source, original_identifier, asset_reference, metadata, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'DOCUMENT_READY', NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          page_count = EXCLUDED.page_count,
          asset_reference = EXCLUDED.asset_reference,
          metadata = EXCLUDED.metadata,
          status = 'DOCUMENT_READY',
          updated_at = NOW()
        RETURNING *;`,
        [
          docId,
          prov.archive_item_id,
          prov.title,
          'PRINTED_MONOGRAPH',
          prov.language || 'en',
          realPageCount,
          prov.source_collection_name,
          prov.original_source_identifier || prov.archive_id,
          assetReference,
          JSON.stringify(updatedMetadata)
        ]
      );

      const docRow = docRes.rows[0];

      // Clean up any old page records for this document (e.g. if re-ingesting)
      await client.query(`DELETE FROM document_pages WHERE document_id = $1;`, [docId]);

      // Insert real document_pages records (ONLY for actually extracted pages)
      const createdPages: DocumentPageRecordDto[] = [];
      for (const pageMeta of extractedPagesMetadata) {
        const pageId = `page-${docId}-${pageMeta.pageNumber}`;
        const pageAssetRef = `/api/documents/${docId}/pages/${pageMeta.pageNumber}/asset`;

        const pageJsonMetadata = {
          pageStatus: 'AVAILABLE' as PageStatus,
          ocrStatus: 'PENDING',
          verificationStatus: 'UNVERIFIED',
          pageDimensions: { width: pageMeta.width, height: pageMeta.height },
          checksumSha256: pageMeta.checksumSha256,
          masterChecksumSha256: validation.checksumSha256,
          originalFilename: input.filename,
          provenance: `Extracted from master asset ${input.filename} (page ${pageMeta.pageNumber} of ${realPageCount})`
        };

        const pageRes = await client.query(
          `INSERT INTO document_pages (
            id, document_id, page_number, original_asset_reference, page_metadata, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, NOW(), NOW()
          )
          RETURNING *;`,
          [
            pageId,
            docId,
            pageMeta.pageNumber,
            pageAssetRef,
            JSON.stringify(pageJsonMetadata)
          ]
        );

        const pRow = pageRes.rows[0];
        createdPages.push({
          id: pRow.id,
          documentId: pRow.document_id,
          pageNumber: pRow.page_number,
          originalAssetReference: pRow.original_asset_reference,
          svgScanType: pRow.svg_scan_type,
          pageMetadata: pRow.page_metadata,
          createdAt: pRow.created_at,
          updatedAt: pRow.updated_at
        });
      }

      // Record audit log
      const auditLogId = `audit-ingest-${Date.now()}`;
      await client.query(
        `INSERT INTO audit_logs (
          id, timestamp, action, performed_by, user_role, document_id, document_title, details
        ) VALUES (
          $1, NOW(), 'DOCUMENT_ASSET_INGESTED', $2, 'ADMINISTRATOR', $3, $4, $5
        );`,
        [
          auditLogId,
          input.reviewerName || input.reviewerId || 'admin-archivist',
          docId,
          prov.title,
          `Ingested real document asset "${input.filename}" (${realPageCount} pages, ${input.fileBuffer.length} bytes, SHA-256: ${validation.checksumSha256}) via method ${input.acquisitionMethod}. All ${realPageCount} pages extracted and eligible for OCR.`
        ]
      );

      await client.query('COMMIT');

      const docDto: DocumentRecordDto = {
        id: docRow.id,
        archiveItemId: docRow.archive_item_id,
        archiveId: prov.archive_id,
        title: docRow.title,
        documentType: docRow.document_type,
        language: docRow.language,
        pageCount: docRow.page_count,
        source: docRow.source,
        originalIdentifier: docRow.original_identifier,
        assetReference: docRow.asset_reference,
        metadata: docRow.metadata,
        status: docRow.status as DocumentAssetStatus,
        createdAt: docRow.created_at,
        updatedAt: docRow.updated_at
      };

      return {
        success: true,
        document: docDto,
        pages: createdPages,
        pagesExtracted: createdPages.length,
        checksumSha256: validation.checksumSha256,
        fileSizeBytes: input.fileBuffer.length,
        storagePath: masterAsset.storagePath,
        auditLogId
      };
    } catch (err) {
      await client.query('ROLLBACK');
      if (savedStorageDocId) {
        await DocumentStorageService.deleteDocumentAssets(savedStorageDocId).catch(() => {});
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves master asset binary for download or viewing.
   */
  public static async getMasterAssetBinary(
    documentId: string
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
    return DocumentStorageService.getMasterAsset(documentId);
  }

  /**
   * Retrieves single extracted page asset binary for viewing.
   */
  public static async getPageAssetBinary(
    documentId: string,
    pageNumber: number
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    return DocumentStorageService.getPageAsset(documentId, pageNumber);
  }

  /**
   * Returns storage asset metadata for a document.
   */
  public static async getDocumentAssetSummary(documentId: string): Promise<{
    hasMasterAsset: boolean;
    storagePath?: string;
    filename?: string;
    checksumSha256?: string;
    fileSizeBytes?: number;
    mimeType?: string;
    pageCount: number;
    pagesInStorage: number;
  }> {
    const hasMaster = DocumentStorageService.hasMasterAsset(documentId);
    if (!hasMaster) {
      return { hasMasterAsset: false, pageCount: 0, pagesInStorage: 0 };
    }

    const master = await DocumentStorageService.getMasterAsset(documentId);
    let pagesInStorage = 0;
    if (master) {
      const docPages = await this.getDocumentPages(documentId);
      pagesInStorage = docPages.length;
      return {
        hasMasterAsset: true,
        filename: master.filename,
        mimeType: master.mimeType,
        fileSizeBytes: master.buffer.length,
        checksumSha256: DocumentStorageService.computeSha256(master.buffer),
        pageCount: docPages.length,
        pagesInStorage
      };
    }

    return { hasMasterAsset: false, pageCount: 0, pagesInStorage: 0 };
  }
}
