export type DocumentCategory = 
  | 'Books & Writings'
  | 'Speeches'
  | 'Constituent Assembly Debates'
  | 'Rare Manuscripts'
  | 'Photographs'
  | 'Historical Records'
  | 'Documentaries'
  | 'Lectures & Interviews';

export type PublishingStatus = 'Draft' | 'Review' | 'Approved' | 'Published';

export type LanguageCode = 'en' | 'hi' | 'mr' | 'kn';

export type ThemeMode = 'light' | 'dark' | 'contrast';

export interface DublinCoreMetadata {
  title: string;
  creator: string;
  subject: string[];
  description: string;
  publisher: string;
  contributor?: string;
  date: string;
  type: DocumentCategory;
  format: string;
  identifier: string; // e.g. DAIC-ARCH-1949-002
  source: string;
  language: string;
  relation?: string[];
  coverage: string;
  rights: string;
}

export interface DocumentPage {
  pageNumber: number;
  scanImageUrl?: string;
  svgScanType?: 'draft_constitution' | 'cad_speech' | 'annihilation_manuscript' | 'rupee_book' | 'mahad_declaration';
  ocrText: string;
  ocrTextHi?: string;
  ocrTextMr?: string;
  ocrTextKn?: string;
  ocrConfidence?: number; // Present only when returned by a real OCR provider
  boundingHighlights?: Array<{
    text: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
}

export interface ArchiveItem {
  id: string;
  title: string;
  titleHi?: string;
  titleMr?: string;
  titleKn?: string;
  category: DocumentCategory;
  date: string;
  year: number;
  author: string;
  collection: string;
  sourceInstitution: string;
  sourceProvenance?: string;
  language?: string;
  archiveId: string;
  originalHolding?: string;
  citationChicago?: string;
  citationApa?: string;
  citationMla?: string;
  description: string;
  descriptionHi?: string;
  descriptionMr?: string;
  descriptionKn?: string;
  fullText: string;
  pages: DocumentPage[];
  aiSummary: string;
  aiSummaryHi?: string;
  aiSummaryMr?: string;
  aiSummaryKn?: string;
  keyConcepts: string[];
  relatedPeople: string[];
  relatedEvents: string[];
  relatedDocumentIds: string[];
  publishingStatus: PublishingStatus;
  isFeatured?: boolean;
  citationBibtex: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  callNumber?: string;
  sourceRecordId?: string;
  originalSourceIdentifier?: string;
  sourceCollectionId?: string;
  sourceCollectionName?: string;
  isDemoRecord?: boolean;
}

export interface AudioVideoRecord {
  id: string;
  title: string;
  titleHi?: string;
  titleMr?: string;
  titleKn?: string;
  category: 'Speeches' | 'Lectures & Interviews' | 'Documentaries';
  date: string;
  duration: string; // e.g. "08:42"
  language: string;
  speaker: string;
  speakerHi?: string;
  speakerMr?: string;
  speakerKn?: string;
  source: string;
  archiveCitation: string;
  originalHolding: string;
  description: string;
  descriptionHi?: string;
  descriptionMr?: string;
  descriptionKn?: string;
  mediaType: 'audio' | 'video';
  transcripts: Array<{
    timestamp: string; // e.g. "00:15"
    seconds: number;
    speaker: string;
    speakerHi?: string;
    speakerMr?: string;
    speakerKn?: string;
    text: string;
    textHi?: string;
    textMr?: string;
    textKn?: string;
  }>;
}

export interface TimelineEvent {
  id: string;
  year: number;
  dateFormatted: string;
  title: string;
  titleHi?: string;
  titleMr?: string;
  titleKn?: string;
  theme: 'Constitutional' | 'Social Reform' | 'Academic & Economics' | 'Spiritual & Dhamma';
  description: string;
  descriptionHi?: string;
  descriptionMr?: string;
  descriptionKn?: string;
  detailedDescription?: string;
  detailedDescriptionHi?: string;
  detailedDescriptionMr?: string;
  detailedDescriptionKn?: string;
  location: string;
  keyQuote?: string;
  relatedDocumentIds: string[];
  relatedPeople: string[];
  relatedTopics?: string[];
  photoPlaceholder?: string;
  photoCaption?: string;
  photoProvenance?: string;
  relatedMediaId?: string;
  relatedMediaTitle?: string;
  archiveSource?: string;
  sourceProvenance?: string;
  relatedKnowledgeNodeId?: string;
}

export interface KnowledgeNode {
  id: string;
  label: string;
  labelHi?: string;
  labelMr?: string;
  labelKn?: string;
  category: 'Person' | 'Work' | 'Constitutional Idea' | 'Historical Event' | 'Document';
  description: string;
  descriptionHi?: string;
  descriptionMr?: string;
  descriptionKn?: string;
  x?: number;
  y?: number;
  connections: string[];
  relatedDocId?: string;
}

export interface KnowledgeLink {
  source: string;
  target: string;
  relationship: string;
}

export interface ResearchBookmark {
  id: string;
  docId: string;
  title: string;
  category: string;
  dateAdded: string;
  researcherNotes: string;
  tags: string[];
  selectedQuote?: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: Array<{
    documentId: string;
    documentTitle: string;
    archiveId: string;
    pageNumber: number;
    relevantExcerpt: string;
    sourceUrl?: string;
  }>;
  suggestedFollowUps?: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  userRole: string;
  documentId?: string;
  documentTitle?: string;
  details: string;
}
