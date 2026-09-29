/**
 * SEED DATA RELATIONAL MAPPER
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Maps existing demonstration records into the relational database schema.
 * - Explicitly tags demo records with `isDemoRecord: true`
 * - Links records to official Source Collections (DAF, CAD Archive, NDLI)
 * - Generates Dublin Core metadata and graph records; pages/OCR are created only by real ingestion
 */

import {
  INITIAL_ARCHIVE_ITEMS,
  INITIAL_TIMELINE_EVENTS,
  INITIAL_KNOWLEDGE_NODES,
  INITIAL_KNOWLEDGE_LINKS,
  INITIAL_AUDIO_VIDEO_RECORDS,
  INITIAL_AUDIT_LOGS
} from '../data/archiveData.ts';

import type {
  SourceCollectionEntity,
  SourceRecordEntity,
  ArchiveItemEntity,
  DublinCoreMetadataEntity,
  DocumentEntity,
  DocumentPageEntity,
  OcrRecordEntity,
  EventEntity,
  KnowledgeNodeEntity,
  KnowledgeLinkEntity,
  MediaRecordEntity,
  TranscriptSegmentEntity,
  AuditLogEntity
} from './schema.ts';

import { OFFICIAL_SOURCE_COLLECTIONS } from '../services/ingestion/types.ts';

export interface SeededRelationalDatabase {
  sourceCollections: SourceCollectionEntity[];
  sourceRecords: SourceRecordEntity[];
  archiveItems: ArchiveItemEntity[];
  dublinCoreMetadata: DublinCoreMetadataEntity[];
  documents: DocumentEntity[];
  documentPages: DocumentPageEntity[];
  ocrRecords: OcrRecordEntity[];
  events: EventEntity[];
  knowledgeNodes: KnowledgeNodeEntity[];
  knowledgeLinks: KnowledgeLinkEntity[];
  mediaRecords: MediaRecordEntity[];
  transcripts: TranscriptSegmentEntity[];
  auditLogs: AuditLogEntity[];
}

export function buildSeededRelationalDatabase(): SeededRelationalDatabase {
  // 1. Source Collections
  const sourceCollections: SourceCollectionEntity[] = OFFICIAL_SOURCE_COLLECTIONS.map(col => ({
    id: col.id,
    name: col.name,
    organization: col.organization,
    description: col.description,
    sourceUrl: col.sourceUrl,
    sourceType: col.sourceType as SourceCollectionEntity['sourceType'],
    accessInformation: col.accessInformation,
    totalRecordsCount: 0,
    createdAt: '2026-09-26T00:00:00.000Z',
    updatedAt: '2026-09-26T00:00:00.000Z'
  }));

  const sourceRecords: SourceRecordEntity[] = [];
  const archiveItems: ArchiveItemEntity[] = [];
  const dublinCoreMetadata: DublinCoreMetadataEntity[] = [];
  const documents: DocumentEntity[] = [];
  const documentPages: DocumentPageEntity[] = [];
  const ocrRecords: OcrRecordEntity[] = [];

  // Map Archive Items & Children
  INITIAL_ARCHIVE_ITEMS.forEach(item => {
    // Determine appropriate historical source collection
    let sourceColId = 'source-ambedkar-foundation';
    if (item.category === 'Constituent Assembly Debates' || item.collection.includes('Constituent Assembly')) {
      sourceColId = 'source-cad-archive';
    } else if (item.id === 'problem-of-the-rupee-1923' || item.id === 'castes-in-india-1916') {
      sourceColId = 'source-ndli';
    }

    const sourceRecordId = `src-rec-${item.id}`;

    // Source Record (Provenance)
    sourceRecords.push({
      id: sourceRecordId,
      sourceCollectionId: sourceColId,
      originalSourceIdentifier: item.archiveId,
      originalTitle: item.title,
      originalUrl: item.downloadUrl,
      repository: item.sourceInstitution,
      sourceMetadata: {
        originalHolding: item.originalHolding,
        year: item.year,
        category: item.category
      },
      ingestionDate: '2026-09-26T00:00:00.000Z',
      ingestionMethod: 'DEMO_SEED',
      provenanceNotes: `Archival record from ${item.sourceInstitution}. Seeded as foundational demo holdings.`,
      isDemoRecord: true,
      createdAt: '2026-09-26T00:00:00.000Z',
      updatedAt: '2026-09-26T00:00:00.000Z'
    });

    // Archive Item Entity
    archiveItems.push({
      id: item.id,
      archiveId: item.archiveId,
      sourceRecordId,
      title: item.title,
      titleHi: item.titleHi,
      titleMr: item.titleMr,
      titleKn: item.titleKn,
      category: item.category,
      date: item.date,
      year: item.year,
      author: item.author,
      collection: item.collection,
      sourceInstitution: item.sourceInstitution,
      sourceProvenance: item.sourceProvenance,
      language: item.language || 'English',
      originalHolding: item.originalHolding,
      description: item.description,
      descriptionHi: item.descriptionHi,
      descriptionMr: item.descriptionMr,
      descriptionKn: item.descriptionKn,
      fullText: item.fullText,
      aiSummary: item.aiSummary,
      aiSummaryHi: item.aiSummaryHi,
      aiSummaryMr: item.aiSummaryMr,
      aiSummaryKn: item.aiSummaryKn,
      keyConcepts: item.keyConcepts,
      publishingStatus: item.publishingStatus,
      isFeatured: Boolean(item.isFeatured),
      isDemoRecord: true,
      thumbnailUrl: item.thumbnailUrl,
      downloadUrl: item.downloadUrl,
      createdAt: '2026-09-26T00:00:00.000Z',
      updatedAt: '2026-09-26T00:00:00.000Z'
    });

    // Dublin Core Metadata Entity
    dublinCoreMetadata.push({
      id: `dc-${item.id}`,
      archiveItemId: item.id,
      title: item.title,
      creator: item.author,
      subject: item.keyConcepts,
      description: item.description,
      publisher: item.sourceInstitution,
      contributor: 'Dr. Ambedkar International Centre',
      date: item.date,
      type: item.category,
      format: 'application/pdf; archival-ocr',
      identifier: item.archiveId,
      source: item.sourceInstitution,
      language: item.language || 'en',
      relation: item.relatedDocumentIds,
      coverage: `India, ${item.year}`,
      rights: 'Public Domain / Institutional Archival Access',
      createdAt: '2026-09-26T00:00:00.000Z',
      updatedAt: '2026-09-26T00:00:00.000Z'
    });

    // Document Entity
    const docEntityId = `doc-ent-${item.id}`;
    documents.push({
      id: docEntityId,
      archiveItemId: item.id,
      title: item.title,
      documentType: item.category === 'Rare Manuscripts' ? 'MANUSCRIPT' : 'PRINTED_MONOGRAPH',
      language: item.language || 'en',
      // These bundled records are demo metadata only. No physical pages have been ingested.
      pageCount: 0,
      source: item.sourceInstitution,
      originalIdentifier: item.archiveId,
      status: 'DRAFT',
      metadata: { year: item.year },
      createdAt: '2026-09-26T00:00:00.000Z',
      updatedAt: '2026-09-26T00:00:00.000Z'
    });

    // No document_pages or ocr_records are seeded from illustrative frontend samples.
  });

  // Map Events
  const events: EventEntity[] = INITIAL_TIMELINE_EVENTS.map(evt => ({
    id: evt.id,
    title: evt.title,
    titleHi: evt.titleHi,
    titleMr: evt.titleMr,
    titleKn: evt.titleKn,
    year: evt.year,
    dateFormatted: evt.dateFormatted,
    theme: evt.theme,
    description: evt.description,
    descriptionHi: evt.descriptionHi,
    descriptionMr: evt.descriptionMr,
    descriptionKn: evt.descriptionKn,
    detailedDescription: evt.detailedDescription,
    location: evt.location,
    keyQuote: evt.keyQuote,
    sourceProvenance: evt.sourceProvenance,
    photoCaption: evt.photoCaption,
    photoProvenance: evt.photoProvenance,
    photoPlaceholder: evt.photoPlaceholder,
    isDemoRecord: true,
    createdAt: '2026-09-26T00:00:00.000Z',
    updatedAt: '2026-09-26T00:00:00.000Z'
  }));

  // Map Knowledge Nodes
  const knowledgeNodes: KnowledgeNodeEntity[] = INITIAL_KNOWLEDGE_NODES.map(node => ({
    id: node.id,
    label: node.label,
    labelHi: node.labelHi,
    labelMr: node.labelMr,
    labelKn: node.labelKn,
    category: node.category,
    description: node.description,
    descriptionHi: node.descriptionHi,
    descriptionMr: node.descriptionMr,
    descriptionKn: node.descriptionKn,
    x: node.x,
    y: node.y,
    relatedDocId: node.relatedDocId,
    isDemoRecord: true,
    createdAt: '2026-09-26T00:00:00.000Z',
    updatedAt: '2026-09-26T00:00:00.000Z'
  }));

  // Map Knowledge Links
  const knowledgeLinks: KnowledgeLinkEntity[] = INITIAL_KNOWLEDGE_LINKS.map(link => ({
    id: `link-${link.source}-${link.target}`,
    sourceNodeId: link.source,
    targetNodeId: link.target,
    relationship: link.relationship,
    weight: 1.0,
    createdAt: '2026-09-26T00:00:00.000Z',
    updatedAt: '2026-09-26T00:00:00.000Z'
  }));

  // Map Multimedia & Transcripts
  const mediaRecords: MediaRecordEntity[] = [];
  const transcripts: TranscriptSegmentEntity[] = [];

  INITIAL_AUDIO_VIDEO_RECORDS.forEach(rec => {
    mediaRecords.push({
      id: rec.id,
      mediaType: rec.mediaType,
      title: rec.title,
      titleHi: rec.titleHi,
      titleMr: rec.titleMr,
      titleKn: rec.titleKn,
      category: rec.category,
      date: rec.date,
      duration: rec.duration,
      language: rec.language,
      speaker: rec.speaker,
      speakerHi: rec.speakerHi,
      speakerMr: rec.speakerMr,
      speakerKn: rec.speakerKn,
      source: rec.source,
      archiveCitation: rec.archiveCitation,
      originalHolding: rec.originalHolding,
      description: rec.description,
      descriptionHi: rec.descriptionHi,
      descriptionMr: rec.descriptionMr,
      descriptionKn: rec.descriptionKn,
      isDemoRecord: true,
      createdAt: '2026-09-26T00:00:00.000Z',
      updatedAt: '2026-09-26T00:00:00.000Z'
    });

    rec.transcripts.forEach((t, idx) => {
      transcripts.push({
        id: `tr-${rec.id}-${idx}`,
        mediaId: rec.id,
        timestamp: t.timestamp,
        seconds: t.seconds,
        speaker: t.speaker,
        speakerHi: t.speakerHi,
        speakerMr: t.speakerMr,
        speakerKn: t.speakerKn,
        text: t.text,
        textHi: t.textHi,
        textMr: t.textMr,
        textKn: t.textKn,
        language: rec.language,
        sequenceOrder: idx + 1,
        createdAt: '2026-09-26T00:00:00.000Z',
        updatedAt: '2026-09-26T00:00:00.000Z'
      });
    });
  });

  // Map Audit Logs
  const auditLogs: AuditLogEntity[] = INITIAL_AUDIT_LOGS.map(l => ({
    id: l.id,
    timestamp: l.timestamp,
    action: l.action,
    performedBy: l.performedBy,
    userRole: l.userRole,
    documentId: l.documentId,
    documentTitle: l.documentTitle,
    details: l.details,
    ipAddress: '10.0.12.4'
  }));

  // Update counts on Source Collections
  sourceCollections.forEach(col => {
    col.totalRecordsCount = sourceRecords.filter(r => r.sourceCollectionId === col.id).length;
  });

  return {
    sourceCollections,
    sourceRecords,
    archiveItems,
    dublinCoreMetadata,
    documents,
    documentPages,
    ocrRecords,
    events,
    knowledgeNodes,
    knowledgeLinks,
    mediaRecords,
    transcripts,
    auditLogs
  };
}
