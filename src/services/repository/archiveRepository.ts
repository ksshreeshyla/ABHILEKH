/**
 * ARCHIVAL DATA REPOSITORY & SERVICE LAYER
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Implements a clean repository pattern:
 * COMPONENT -> SERVICE / REPOSITORY -> DATABASE / DATA LAYER
 *
 * Provides a unified abstraction for all UI components while:
 * - Querying relational entities (Source Collections, Archive Items, Dublin Core, Pages, OCR, Graph)
 * - Supporting seamless fallback to seeded relational models
 * - Ingesting and storing newly imported external archival records
 * - Auditing changes and publishing state workflows
 */

import {
  ArchiveItem,
  DocumentCategory,
  PublishingStatus,
  TimelineEvent,
  KnowledgeNode,
  KnowledgeLink,
  AudioVideoRecord,
  AuditLogEntry,
  DublinCoreMetadata
} from '../../types/archive';

import {
  SourceCollectionEntity,
  SourceRecordEntity,
  DocumentEntity,
  DocumentPageEntity,
  OcrRecordEntity
} from '../../db/schema';

import { buildSeededRelationalDatabase, SeededRelationalDatabase } from '../../db/seedMapper';
import { NormalizedArchivalPackage } from '../ingestion/types';

export interface SearchFilterParams {
  query?: string;
  category?: DocumentCategory | 'All';
  yearRange?: [number, number];
  sourceCollectionId?: string;
  isDemoOnly?: boolean;
  status?: PublishingStatus | 'All';
}

export interface IArchiveRepository {
  // Archive Items
  getAllItems(): Promise<ArchiveItem[]>;
  getItemById(id: string): Promise<ArchiveItem | null>;
  getPublishedItems(): Promise<ArchiveItem[]>;
  searchItems(params: SearchFilterParams): Promise<ArchiveItem[]>;

  // Source Collections & Provenance
  getSourceCollections(): Promise<SourceCollectionEntity[]>;
  getSourceRecords(): Promise<SourceRecordEntity[]>;
  getDublinCoreMetadata(archiveItemId: string): Promise<DublinCoreMetadata | null>;

  // Documents & OCR
  getDocuments(archiveItemId: string): Promise<DocumentEntity[]>;
  getDocumentPages(documentId: string): Promise<DocumentPageEntity[]>;
  getOcrRecord(pageId: string): Promise<OcrRecordEntity | null>;
  getDocumentStatus(archiveItemId: string): Promise<any>;
  registerExternalDocument(input: any): Promise<any>;
  registerDocumentAsset(input: any): Promise<any>;
  updateDocumentStatus(documentId: string, status: string, notes?: string): Promise<any>;
  getOcrStatus(pageId: string): Promise<any>;
  getOcrHistory(pageId: string): Promise<any>;
  correctOcr(pageId: string, correctedText: string, reviewerId: string, reviewerName?: string, notes?: string): Promise<any>;
  verifyOcr(pageId: string, reviewerId: string, reviewerName?: string, notes?: string): Promise<any>;
  getCitationProvenance(pageId: string): Promise<any>;
  getOcrProviders(): Promise<any>;

  // Timeline, Graph & Multimedia
  getTimelineEvents(): Promise<TimelineEvent[]>;
  getKnowledgeGraph(): Promise<{ nodes: KnowledgeNode[]; links: KnowledgeLink[] }>;
  getAudioVideoRecords(): Promise<AudioVideoRecord[]>;

  // Auditing & Lifecycle Mutations
  getAuditLogs(): Promise<AuditLogEntry[]>;
  updatePublishingStatus(docId: string, status: PublishingStatus, performedBy?: string): Promise<boolean>;
  updateItemMetadata(docId: string, updates: Partial<ArchiveItem>, performedBy?: string): Promise<boolean>;
  ingestArchivalPackage(pkg: NormalizedArchivalPackage, performedBy?: string): Promise<ArchiveItem>;
  addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry>;
}

class HybridArchiveRepository implements IArchiveRepository {
  private inMemoryDb: SeededRelationalDatabase;
  private runtimeArchiveItems: ArchiveItem[] = [];
  private runtimeAuditLogs: AuditLogEntry[] = [];
  private isInitialized = false;

  constructor() {
    this.inMemoryDb = buildSeededRelationalDatabase();
    this.initializeState();
  }

  private initializeState() {
    if (this.isInitialized) return;

    // Load items from database seed
    let items = this.inMemoryDb.archiveItems.map(entity => this.mapEntityToItem(entity));

    // Check localStorage in browser context to merge user modifications & imports
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedItems = window.localStorage.getItem('daic_archive_items');
        if (savedItems) {
          const parsed = JSON.parse(savedItems) as ArchiveItem[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Keep items, ensuring imported items are preserved
            items = parsed;
          }
        }
      } catch (err) {
        console.warn('Could not read saved items from localStorage', err);
      }
    }

    this.runtimeArchiveItems = items;
    this.runtimeAuditLogs = this.inMemoryDb.auditLogs.map(l => ({
      id: l.id,
      timestamp: l.timestamp,
      action: l.action,
      performedBy: l.performedBy,
      userRole: l.userRole,
      documentId: l.documentId,
      documentTitle: l.documentTitle,
      details: l.details
    }));

    this.isInitialized = true;
  }

  private persistState() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('daic_archive_items', JSON.stringify(this.runtimeArchiveItems));
        window.localStorage.setItem('daic_audit_logs', JSON.stringify(this.runtimeAuditLogs));
      } catch (err) {
        console.warn('Could not persist archive repository state', err);
      }
    }
  }

  private mapEntityToItem(entity: SeededRelationalDatabase['archiveItems'][0]): ArchiveItem {
    // Find associated pages from database
    const matchingPages = this.inMemoryDb.documentPages
      .filter(p => p.documentId === `doc-ent-${entity.id}`)
      .map(p => {
        const ocr = this.inMemoryDb.ocrRecords.find(o => o.pageId === p.id);
        return {
          pageNumber: p.pageNumber,
          scanImageUrl: p.originalAssetReference,
          svgScanType: p.svgScanType,
          ocrText: ocr?.rawText || '',
          ocrTextHi: ocr?.textHi,
          ocrTextMr: ocr?.textMr,
          ocrTextKn: ocr?.textKn,
          ...(ocr ? { ocrConfidence: Number(ocr.confidence) } : {}),
          boundingHighlights: ocr?.boundingHighlights
        };
      });

    return {
      id: entity.id,
      title: entity.title,
      titleHi: entity.titleHi,
      titleMr: entity.titleMr,
      titleKn: entity.titleKn,
      category: entity.category as DocumentCategory,
      date: entity.date,
      year: entity.year,
      author: entity.author,
      collection: entity.collection,
      sourceInstitution: entity.sourceInstitution,
      sourceProvenance: entity.sourceProvenance,
      language: entity.language,
      archiveId: entity.archiveId,
      originalHolding: entity.originalHolding,
      description: entity.description,
      descriptionHi: entity.descriptionHi,
      descriptionMr: entity.descriptionMr,
      descriptionKn: entity.descriptionKn,
      fullText: entity.fullText,
      pages: matchingPages,
      aiSummary: entity.aiSummary,
      aiSummaryHi: entity.aiSummaryHi,
      aiSummaryMr: entity.aiSummaryMr,
      aiSummaryKn: entity.aiSummaryKn,
      keyConcepts: entity.keyConcepts,
      relatedPeople: ['Dr. B. R. Ambedkar'],
      relatedEvents: [],
      relatedDocumentIds: [],
      publishingStatus: entity.publishingStatus as PublishingStatus,
      isFeatured: entity.isFeatured,
      isDemoRecord: entity.isDemoRecord,
      citationBibtex: `@article{ambedkar${entity.year},\n  author = {${entity.author}},\n  title = {${entity.title}},\n  year = {${entity.year}}\n}`,
      citationChicago: `${entity.author}. "${entity.title}." ${entity.sourceInstitution}, ${entity.year}.`,
      citationApa: `${entity.author} (${entity.year}). ${entity.title}. ${entity.sourceInstitution}.`,
      citationMla: `${entity.author}. "${entity.title}." ${entity.sourceInstitution}, ${entity.year}.`
    };
  }

  // --- QUERY METHODS ---

  private async ensureLiveItemsLoaded() {
    this.initializeState();
    if (typeof window !== 'undefined' && this.runtimeArchiveItems.length <= 8) {
      try {
        const res = await fetch('/api/archive/items');
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json) ? json : (json.data || []);
          if (Array.isArray(items) && items.length > 8) {
            this.runtimeArchiveItems = items;
            this.persistState();
          }
        }
      } catch {
        // Fallback silently
      }
    }
  }

  public async getAllItems(): Promise<ArchiveItem[]> {
    await this.ensureLiveItemsLoaded();
    return [...this.runtimeArchiveItems];
  }

  public async getItemById(id: string): Promise<ArchiveItem | null> {
    await this.ensureLiveItemsLoaded();
    const found = this.runtimeArchiveItems.find(i => i.id === id || i.archiveId === id);
    return found ? { ...found } : null;
  }

  public async getPublishedItems(): Promise<ArchiveItem[]> {
    await this.ensureLiveItemsLoaded();
    return this.runtimeArchiveItems.filter(i => i.publishingStatus === 'Published');
  }

  public async searchItems(params: SearchFilterParams): Promise<ArchiveItem[]> {
    await this.ensureLiveItemsLoaded();
    let results = [...this.runtimeArchiveItems];

    if (params.category && params.category !== 'All') {
      results = results.filter(i => i.category === params.category);
    }

    if (params.status && params.status !== 'All') {
      results = results.filter(i => i.publishingStatus === params.status);
    }

    if (params.yearRange) {
      results = results.filter(i => i.year >= params.yearRange![0] && i.year <= params.yearRange![1]);
    }

    if (params.query && params.query.trim()) {
      const q = params.query.toLowerCase().trim();
      results = results.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.author.toLowerCase().includes(q) ||
        i.archiveId.toLowerCase().includes(q) ||
        i.collection.toLowerCase().includes(q) ||
        i.keyConcepts.some(c => c.toLowerCase().includes(q)) ||
        i.fullText.toLowerCase().includes(q)
      );
    }

    return results;
  }

  public async getSourceCollections(): Promise<SourceCollectionEntity[]> {
    return this.inMemoryDb.sourceCollections;
  }

  public async getSourceRecords(): Promise<SourceRecordEntity[]> {
    return this.inMemoryDb.sourceRecords;
  }

  public async getDublinCoreMetadata(archiveItemId: string): Promise<DublinCoreMetadata | null> {
    const dc = this.inMemoryDb.dublinCoreMetadata.find(d => d.archiveItemId === archiveItemId);
    if (!dc) return null;
    return {
      title: dc.title,
      creator: dc.creator,
      subject: dc.subject,
      description: dc.description,
      publisher: dc.publisher,
      contributor: dc.contributor,
      date: dc.date,
      type: dc.type,
      format: dc.format,
      identifier: dc.identifier,
      source: dc.source,
      language: dc.language,
      relation: dc.relation,
      coverage: dc.coverage,
      rights: dc.rights
    };
  }

  public async getDocuments(archiveItemId: string): Promise<DocumentEntity[]> {
    return this.inMemoryDb.documents.filter(d => d.archiveItemId === archiveItemId);
  }

  public async getDocumentPages(documentId: string): Promise<DocumentPageEntity[]> {
    return this.inMemoryDb.documentPages.filter(p => p.documentId === documentId);
  }

  public async getOcrRecord(pageId: string): Promise<OcrRecordEntity | null> {
    const ocr = this.inMemoryDb.ocrRecords.find(o => o.pageId === pageId);
    return ocr ? { ...ocr } : null;
  }

  public async getDocumentStatus(archiveItemId: string): Promise<any> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/archive/items/${encodeURIComponent(archiveItemId)}/document`);
        if (res.ok) {
          const json = await res.json();
          if (json.ok) return json.data;
        }
      } catch {
        // Fall through to in-memory check
      }
    }

    const item = await this.getItemById(archiveItemId);
    if (!item) return null;
    const doc = this.inMemoryDb.documents.find(d => d.archiveItemId === item.id);
    if (doc) {
      const pages = this.inMemoryDb.documentPages.filter(p => p.documentId === doc.id);
      return {
        hasDocumentRecord: true,
        document: doc,
        archiveItemId: item.id,
        archiveId: item.archiveId,
        title: doc.title,
        assetStatus: doc.status,
        message: `Document asset registered with status: ${doc.status}`,
        externalSourceUrl: doc.assetReference || item.downloadUrl,
        sourceInstitution: item.sourceInstitution,
        sourceProvenance: item.sourceProvenance,
        pageCount: doc.pageCount,
        pages
      };
    }

    return {
      hasDocumentRecord: false,
      document: null,
      archiveItemId: item.id,
      archiveId: item.archiveId,
      title: item.title,
      assetStatus: 'METADATA_ONLY',
      message: 'Metadata available — document asset not currently available.',
      externalSourceUrl: item.downloadUrl,
      sourceInstitution: item.sourceInstitution,
      sourceProvenance: item.sourceProvenance,
      pageCount: 0,
      pages: []
    };
  }

  public async registerExternalDocument(input: any): Promise<any> {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/documents/register-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      const err = await res.json().catch(() => ({ message: 'Failed to register external document' }));
      throw new Error(err.message || 'Failed to register external document');
    }
    return null;
  }

  public async registerDocumentAsset(input: any): Promise<any> {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/documents/register-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      const err = await res.json().catch(() => ({ message: 'Failed to register document asset' }));
      throw new Error(err.message || 'Failed to register document asset');
    }
    return null;
  }

  public async updateDocumentStatus(documentId: string, status: string, notes?: string): Promise<any> {
    if (typeof window !== 'undefined') {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes })
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      const err = await res.json().catch(() => ({ message: 'Failed to update document status' }));
      throw new Error(err.message || 'Failed to update document status');
    }
    return null;
  }

  public async getOcrStatus(pageId: string): Promise<any> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/ocr/pages/${encodeURIComponent(pageId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.ok) return json.data;
        }
      } catch {
        // Fall through to in-memory check
      }
    }

    const page = this.inMemoryDb.documentPages.find(p => p.id === pageId);
    if (!page) {
      return {
        hasPageRecord: false,
        hasOcrRecord: false,
        pageId,
        pageNumber: 0,
        hasAsset: false,
        processingStatus: 'NOT_PROCESSED',
        verificationStatus: 'UNVERIFIED',
        confidence: null,
        confidenceLabel: 'Confidence unavailable',
        message: 'Page record does not exist.',
        ocr: null
      };
    }

    const ocr = this.inMemoryDb.ocrRecords.find(o => o.pageId === pageId);
    if (!ocr) {
      return {
        hasPageRecord: true,
        hasOcrRecord: false,
        pageId: page.id,
        pageNumber: page.pageNumber,
        hasAsset: Boolean(page.originalAssetReference),
        processingStatus: 'NOT_PROCESSED',
        verificationStatus: 'UNVERIFIED',
        confidence: null,
        confidenceLabel: 'Confidence unavailable',
        message: 'No OCR transcript available.',
        ocr: null
      };
    }

    return {
      hasPageRecord: true,
      hasOcrRecord: true,
      pageId: page.id,
      pageNumber: page.pageNumber,
      hasAsset: Boolean(page.originalAssetReference),
      processingStatus: ocr.processingStatus,
      verificationStatus: 'UNVERIFIED',
      confidence: Number(ocr.confidence) || null,
      confidenceLabel: `${((Number(ocr.confidence) || 0.985) * 100).toFixed(1)}%`,
      message: 'OCR record available.',
      ocr: {
        id: ocr.id,
        pageId: ocr.pageId,
        rawText: ocr.rawText,
        processedText: ocr.processedText,
        confidence: Number(ocr.confidence),
        language: ocr.language,
        processingStatus: ocr.processingStatus,
        ocrEngine: ocr.ocrEngine
      }
    };
  }

  public async getOcrHistory(pageId: string): Promise<any> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/ocr/pages/${encodeURIComponent(pageId)}/history`);
        if (res.ok) {
          const json = await res.json();
          if (json.ok) return json.data;
        }
      } catch {
        // Fallback
      }
    }
    return { pageId, hasOcrRecord: false, history: [] };
  }

  public async correctOcr(
    pageId: string,
    correctedText: string,
    reviewerId: string,
    reviewerName?: string,
    notes?: string
  ): Promise<any> {
    if (typeof window !== 'undefined') {
      const res = await fetch(`/api/ocr/pages/${encodeURIComponent(pageId)}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correctedText,
          reviewerId,
          reviewerName,
          correctionNotes: notes
        })
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      const err = await res.json().catch(() => ({ message: 'Failed to submit OCR correction' }));
      throw new Error(err.message || 'Failed to submit OCR correction');
    }
    return null;
  }

  public async verifyOcr(
    pageId: string,
    reviewerId: string,
    reviewerName?: string,
    notes?: string
  ): Promise<any> {
    if (typeof window !== 'undefined') {
      const res = await fetch(`/api/ocr/pages/${encodeURIComponent(pageId)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId,
          reviewerName,
          notes
        })
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      const err = await res.json().catch(() => ({ message: 'Failed to verify OCR' }));
      throw new Error(err.message || 'Failed to verify OCR');
    }
    return null;
  }

  public async getCitationProvenance(pageId: string): Promise<any> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/ocr/pages/${encodeURIComponent(pageId)}/citation`);
        if (res.ok) {
          const json = await res.json();
          if (json.ok) return json.data;
        }
      } catch {
        // Fallback
      }
    }
    return null;
  }

  public async getOcrProviders(): Promise<any> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/ocr/providers');
        if (res.ok) {
          const json = await res.json();
          if (json.ok) return json.data;
        }
      } catch {
        // Fallback
      }
    }
    return [];
  }

  public async getTimelineEvents(): Promise<TimelineEvent[]> {
    return this.inMemoryDb.events.map(e => ({
      id: e.id,
      year: e.year,
      dateFormatted: e.dateFormatted,
      title: e.title,
      titleHi: e.titleHi,
      titleMr: e.titleMr,
      titleKn: e.titleKn,
      theme: e.theme,
      description: e.description,
      descriptionHi: e.descriptionHi,
      descriptionMr: e.descriptionMr,
      descriptionKn: e.descriptionKn,
      detailedDescription: e.detailedDescription,
      location: e.location,
      keyQuote: e.keyQuote,
      relatedDocumentIds: [],
      relatedPeople: ['Dr. B. R. Ambedkar'],
      photoCaption: e.photoCaption,
      photoProvenance: e.photoProvenance,
      photoPlaceholder: e.photoPlaceholder,
      sourceProvenance: e.sourceProvenance
    }));
  }

  public async getKnowledgeGraph(): Promise<{ nodes: KnowledgeNode[]; links: KnowledgeLink[] }> {
    const nodes: KnowledgeNode[] = this.inMemoryDb.knowledgeNodes.map(n => ({
      id: n.id,
      label: n.label,
      labelHi: n.labelHi,
      labelMr: n.labelMr,
      labelKn: n.labelKn,
      category: n.category,
      description: n.description,
      descriptionHi: n.descriptionHi,
      descriptionMr: n.descriptionMr,
      descriptionKn: n.descriptionKn,
      x: n.x ? Number(n.x) : undefined,
      y: n.y ? Number(n.y) : undefined,
      connections: [],
      relatedDocId: n.relatedDocId
    }));

    const links: KnowledgeLink[] = this.inMemoryDb.knowledgeLinks.map(l => ({
      source: l.sourceNodeId,
      target: l.targetNodeId,
      relationship: l.relationship
    }));

    // Populate node connections list
    links.forEach(l => {
      const srcNode = nodes.find(n => n.id === l.source);
      if (srcNode && !srcNode.connections.includes(l.target)) {
        srcNode.connections.push(l.target);
      }
      const tgtNode = nodes.find(n => n.id === l.target);
      if (tgtNode && !tgtNode.connections.includes(l.source)) {
        tgtNode.connections.push(l.source);
      }
    });

    return { nodes, links };
  }

  public async getAudioVideoRecords(): Promise<AudioVideoRecord[]> {
    return this.inMemoryDb.mediaRecords.map(m => {
      const matchingTranscripts = this.inMemoryDb.transcripts
        .filter(t => t.mediaId === m.id)
        .map(t => ({
          timestamp: t.timestamp,
          seconds: t.seconds,
          speaker: t.speaker,
          speakerHi: t.speakerHi,
          speakerMr: t.speakerMr,
          speakerKn: t.speakerKn,
          text: t.text,
          textHi: t.textHi,
          textMr: t.textMr,
          textKn: t.textKn
        }));

      return {
        id: m.id,
        title: m.title,
        titleHi: m.titleHi,
        titleMr: m.titleMr,
        titleKn: m.titleKn,
        category: m.category,
        date: m.date,
        duration: m.duration,
        language: m.language,
        speaker: m.speaker,
        speakerHi: m.speakerHi,
        speakerMr: m.speakerMr,
        speakerKn: m.speakerKn,
        source: m.source,
        archiveCitation: m.archiveCitation,
        originalHolding: m.originalHolding,
        description: m.description,
        descriptionHi: m.descriptionHi,
        descriptionMr: m.descriptionMr,
        descriptionKn: m.descriptionKn,
        mediaType: m.mediaType,
        transcripts: matchingTranscripts
      };
    });
  }

  public async getAuditLogs(): Promise<AuditLogEntry[]> {
    this.initializeState();
    return [...this.runtimeAuditLogs];
  }

  // --- MUTATION METHODS ---

  public async updatePublishingStatus(
    docId: string,
    status: PublishingStatus,
    performedBy: string = 'Chief Archivist'
  ): Promise<boolean> {
    this.initializeState();
    const itemIndex = this.runtimeArchiveItems.findIndex(i => i.id === docId);
    if (itemIndex === -1) return false;

    const oldStatus = this.runtimeArchiveItems[itemIndex].publishingStatus;
    this.runtimeArchiveItems[itemIndex].publishingStatus = status;

    await this.addAuditLog({
      action: 'STATUS_CHANGE',
      performedBy,
      userRole: 'Chief Archivist',
      documentId: docId,
      documentTitle: this.runtimeArchiveItems[itemIndex].title,
      details: `Changed publication status from "${oldStatus}" to "${status}".`
    });

    this.persistState();
    return true;
  }

  public async updateItemMetadata(
    docId: string,
    updates: Partial<ArchiveItem>,
    performedBy: string = 'Curator'
  ): Promise<boolean> {
    this.initializeState();
    const itemIndex = this.runtimeArchiveItems.findIndex(i => i.id === docId);
    if (itemIndex === -1) return false;

    this.runtimeArchiveItems[itemIndex] = {
      ...this.runtimeArchiveItems[itemIndex],
      ...updates
    };

    await this.addAuditLog({
      action: 'METADATA_UPDATE',
      performedBy,
      userRole: 'Archivist',
      documentId: docId,
      documentTitle: this.runtimeArchiveItems[itemIndex].title,
      details: `Updated metadata fields: ${Object.keys(updates).join(', ')}.`
    });

    this.persistState();
    return true;
  }

  public async ingestArchivalPackage(
    pkg: NormalizedArchivalPackage,
    performedBy: string = 'Archival Ingestion Pipeline'
  ): Promise<ArchiveItem> {
    this.initializeState();

    // Check if ID already exists
    const existingIndex = this.runtimeArchiveItems.findIndex(
      i => i.id === pkg.archiveItem.id || i.archiveId === pkg.archiveItem.archiveId
    );

    if (existingIndex >= 0) {
      // Replace existing
      this.runtimeArchiveItems[existingIndex] = pkg.archiveItem;
    } else {
      // Append new
      this.runtimeArchiveItems.unshift(pkg.archiveItem);
    }

    // Add source record to in-memory provenance
    const srcRecId = `src-rec-${pkg.archiveItem.id}`;
    this.inMemoryDb.sourceRecords.unshift({
      id: srcRecId,
      sourceCollectionId: pkg.sourceRecord.sourceCollectionId,
      originalSourceIdentifier: pkg.sourceRecord.originalSourceIdentifier,
      originalTitle: pkg.sourceRecord.originalTitle,
      originalUrl: pkg.sourceRecord.originalUrl,
      repository: pkg.sourceRecord.repository,
      sourceMetadata: {
        category: pkg.archiveItem.category,
        year: pkg.archiveItem.year,
        pageCount: pkg.pages.length
      },
      ingestionDate: new Date().toISOString(),
      ingestionMethod: pkg.sourceRecord.ingestionMethod,
      provenanceNotes: pkg.sourceRecord.provenanceNotes,
      isDemoRecord: false, // REAL INGESTED RECORD
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Add Dublin Core
    this.inMemoryDb.dublinCoreMetadata.unshift({
      id: `dc-${pkg.archiveItem.id}`,
      archiveItemId: pkg.archiveItem.id,
      title: pkg.dublinCore.title,
      creator: pkg.dublinCore.creator,
      subject: pkg.dublinCore.subject,
      description: pkg.dublinCore.description,
      publisher: pkg.dublinCore.publisher,
      date: pkg.dublinCore.date,
      type: pkg.dublinCore.type,
      format: pkg.dublinCore.format,
      identifier: pkg.dublinCore.identifier,
      source: pkg.dublinCore.source,
      language: pkg.dublinCore.language,
      coverage: pkg.dublinCore.coverage,
      rights: pkg.dublinCore.rights,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Register metadata only. CSV/JSON imports cannot verify physical page assets or OCR.
    const docEntityId = `doc-ent-${pkg.archiveItem.id}`;
    this.inMemoryDb.documents.unshift({
      id: docEntityId,
      archiveItemId: pkg.archiveItem.id,
      title: pkg.archiveItem.title,
      documentType: 'PRINTED_MONOGRAPH',
      language: pkg.archiveItem.language || 'en',
      pageCount: 0,
      source: pkg.archiveItem.sourceInstitution,
      originalIdentifier: pkg.archiveItem.archiveId,
      status: 'DRAFT',
      metadata: { year: pkg.archiveItem.year },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Update Source Collection record count
    const col = this.inMemoryDb.sourceCollections.find(c => c.id === pkg.sourceRecord.sourceCollectionId);
    if (col) {
      col.totalRecordsCount = (col.totalRecordsCount || 0) + 1;
    }

    // Add audit log
    await this.addAuditLog({
      action: 'INGEST_PACKAGE',
      performedBy,
      userRole: 'Digitization Officer',
      documentId: pkg.archiveItem.id,
      documentTitle: pkg.archiveItem.title,
      details: `Ingested ${pkg.pages.length} page(s) from "${pkg.sourceRecord.sourceCollectionId}" (${pkg.sourceRecord.ingestionMethod}).`
    });

    this.persistState();
    return pkg.archiveItem;
  }

  public async addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
    this.initializeState();
    const newLog: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ...entry
    };

    this.runtimeAuditLogs.unshift(newLog);
    this.persistState();
    return newLog;
  }
}

// Global Singleton Export
export const archiveRepository = new HybridArchiveRepository();
