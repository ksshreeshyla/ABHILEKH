/**
 * VERIFIED NDLI CONSTITUENT ASSEMBLY DEBATES METADATA PACKAGE
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Source of Truth: National Digital Library of India (NDLI)
 * Discovery Starting Point: https://www.ndl.iitkgp.ac.in/ch_search?key=constituents%20assembly%20debates%20archive
 *
 * Ingestion Target:
 * - source_collection_id: "source-cad-archive"
 * - is_demo_record = false
 * - No fake binary downloads or scraped PDFs (metadata only)
 * - Complete provenance mapped to Digital Library of India / South Asia Archive and NDLI
 */

export interface NdliCadArchivalEntry {
  recordType: 'volume' | 'dated_official_report';
  ndliHandle: string;
  sourceRecord: {
    id: string;
    sourceCollectionId: string;
    originalSourceIdentifier: string;
    originalTitle: string;
    originalUrl: string;
    repository: string;
    sourceMetadata: Record<string, unknown>;
    ingestionMethod: string;
    provenanceNotes: string;
    isDemoRecord: boolean;
  };
  archiveItem: {
    id: string;
    archiveId: string;
    sourceRecordId: string;
    title: string;
    titleHi?: string;
    category: 'Constituent Assembly Debates';
    date: string;
    year: number;
    author: string;
    collection: string;
    sourceInstitution: string;
    sourceProvenance: string;
    language: string;
    originalHolding: string;
    description: string;
    fullText: string;
    aiSummary: string;
    keyConcepts: string[];
    publishingStatus: 'Published';
    isFeatured: boolean;
    isDemoRecord: boolean;
    downloadUrl: string;
  };
  dublinCore: {
    id: string;
    archiveItemId: string;
    title: string;
    creator: string;
    subject: string[];
    description: string;
    publisher: string;
    contributor: string;
    date: string;
    type: 'Constituent Assembly Debates';
    format: string;
    identifier: string;
    source: string;
    language: string;
    relation: string[];
    coverage: string;
    rights: string;
  };
}

export const NDLI_CAD_SEARCH_URL = 'https://www.ndl.iitkgp.ac.in/ch_search?key=constituents%20assembly%20debates%20archive';

// ============================================================================
// 1. VOLUME-LEVEL CAD RECORDS (DIGITAL LIBRARY OF INDIA) - 4 VERIFIED RECORDS
// ============================================================================

export const DLI_CAD_VOLUMES: Array<{
  handle: string;
  title: string;
  volRoman: string;
  debatesDateSpan: string;
  publisher: string;
  organization?: string;
  pubDate: string;
  pageCount: number;
  url: string;
}> = [
  {
    handle: '211189',
    title: 'Constituent Assembly Debates Vol-i',
    volRoman: 'Vol. I',
    debatesDateSpan: '9 December to 23 December, 1946',
    publisher: 'Saraswati Offset New Delhi',
    pubDate: '1989-01-01',
    pageCount: 1388,
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/dli/dli_ndli/211189?e=8|constituents%20assembly%20debates%20archive'
  },
  {
    handle: '211187',
    title: 'Constituent Assembly Debates Vol-vii',
    volRoman: 'Vol. VII',
    debatesDateSpan: '4 November, 1948 to 8 January, 1949',
    publisher: 'Saraswati/Sarsawati Offset New Delhi',
    pubDate: '1989-01-01',
    pageCount: 1408,
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/dli/dli_ndli/211187?e=10|constituents%20assembly%20debates%20archive'
  },
  {
    handle: '211201',
    title: 'Constituent Assembly Debates Vol-viii',
    volRoman: 'Vol. VIII',
    debatesDateSpan: '16 May to 16 June, 1949',
    publisher: 'Saraswati Offset New Delhi',
    pubDate: '1989-01-01',
    pageCount: 942,
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/dli/dli_ndli/211201?e=7|constituents%20assembly%20debates%20archive'
  },
  {
    handle: '211188',
    title: 'Constituent Assembly Debates Vol-x',
    volRoman: 'Vol. X',
    debatesDateSpan: '6 October to 17 October, 1949',
    organization: 'Lok Sabha Secretariat',
    publisher: 'Lok Sabha Secretariat, New Delhi',
    pubDate: '1989-01-01',
    pageCount: 1192,
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/dli/dli_ndli/211188?e=9|constituents%20assembly%20debates%20archive'
  }
];

// ============================================================================
// 2. INDIVIDUAL DATED OFFICIAL REPORT CAD RECORDS (SOUTH ASIA ARCHIVE) - 32 RECORDS
// ============================================================================

export const SAA_CAD_REPORTS: Array<{
  handle: string;
  title: string;
  exactDate: string;
  year: number;
  pubDate: string;
  url: string;
}> = [
  {
    handle: '14604',
    title: 'Constituent Assembly Debates, Thursday, 31st July, 1947, Official Report',
    exactDate: '31st July, 1947',
    year: 1947,
    pubDate: '1947-07-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14604'
  },
  {
    handle: '14597',
    title: 'Constituent Assembly Debates, Tuesday, 22nd July, 1947, Official Report',
    exactDate: '22nd July, 1947',
    year: 1947,
    pubDate: '1947-07-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14597'
  },
  {
    handle: '14596',
    title: 'Constituent Assembly Debates, Monday, 21st July, 1947, Official Report',
    exactDate: '21st July, 1947',
    year: 1947,
    pubDate: '1947-07-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14596'
  },
  {
    handle: '14406',
    title: 'Constituent Assembly Debates. Official Report, Friday, 27th May, 1949',
    exactDate: '27th May, 1949',
    year: 1949,
    pubDate: '1949-05-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14406'
  },
  {
    handle: '14387',
    title: 'Constituent Assembly Debates. Official Report, Tuesday, 28th December, 1948',
    exactDate: '28th December, 1948',
    year: 1948,
    pubDate: '1948-12-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14387'
  },
  {
    handle: '14401',
    title: 'Constituent Assembly Debates. Official Report, Friday, 20th May, 1949',
    exactDate: '20th May, 1949',
    year: 1949,
    pubDate: '1949-05-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14401'
  },
  {
    handle: '14414',
    title: 'Constituent Assembly Debates. Official Report, Wednesday, 8th June, 1949',
    exactDate: '8th June, 1949',
    year: 1949,
    pubDate: '1949-06-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14414'
  },
  {
    handle: '14417',
    title: 'Constituent Assembly Debates. Official Report, Tuesday, 14th June, 1949',
    exactDate: '14th June, 1949',
    year: 1949,
    pubDate: '1949-06-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14417'
  },
  {
    handle: '14412',
    title: 'Constituent Assembly Debates. Official Report, Monday, 6th June, 1949',
    exactDate: '6th June, 1949',
    year: 1949,
    pubDate: '1949-06-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14412'
  },
  {
    handle: '14405',
    title: 'Constituent Assembly Debates. Official Report, Thursday, 26th May, 1949',
    exactDate: '26th May, 1949',
    year: 1949,
    pubDate: '1949-05-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14405'
  },
  {
    handle: '14413',
    title: 'Constituent Assembly Debates. Official Report, Tuesday, 7th June, 1949',
    exactDate: '7th June, 1949',
    year: 1949,
    pubDate: '1949-06-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14413'
  },
  {
    handle: '14600',
    title: 'Constituent Assembly Debates, Friday, 25th July, 1947, Official Report',
    exactDate: '25th July, 1947',
    year: 1947,
    pubDate: '1947-07-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14600'
  },
  {
    handle: '14400',
    title: 'Constituent Assembly Debates. Official Report, Thursday, 19th May, 1949',
    exactDate: '19th May, 1949',
    year: 1949,
    pubDate: '1949-05-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14400'
  },
  {
    handle: '14402',
    title: 'Constituent Assembly Debates. Official Report, Monday, 23rd May, 1949',
    exactDate: '23rd May, 1949',
    year: 1949,
    pubDate: '1949-05-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14402'
  },
  {
    handle: '14390',
    title: 'Constituent Assembly Debates. Official Report, Friday, 31st December, 1948',
    exactDate: '31st December, 1948',
    year: 1948,
    pubDate: '1948-12-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14390'
  },
  {
    handle: '14398',
    title: 'Constituent Assembly Debates. Official Report, Tuesday, 17th May, 1949',
    exactDate: '17th May, 1949',
    year: 1949,
    pubDate: '1949-05-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14398'
  },
  {
    handle: '14391',
    title: 'Constituent Assembly Debates. Official Report, Monday, 3rd january, 1949',
    exactDate: '3rd January, 1949',
    year: 1949,
    pubDate: '1949-01-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14391'
  },
  {
    handle: '14598',
    title: 'Constituent Assembly Debates, Wednesday, 23rd July, 1947, Official Report',
    exactDate: '23rd July, 1947',
    year: 1947,
    pubDate: '1947-07-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14598'
  },
  {
    handle: '14602',
    title: 'Constituent Assembly Debates, Tuesday, 29th July, 1947, Official Report',
    exactDate: '29th July, 1947',
    year: 1947,
    pubDate: '1947-07-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14602'
  },
  {
    handle: '14601',
    title: 'Constituent Assembly Debates, Monday, 28th July, 1947, Official Report',
    exactDate: '28th July, 1947',
    year: 1947,
    pubDate: '1947-07-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14601'
  },
  {
    handle: '14416',
    title: 'Constituent Assembly Debates. Official Report, Monday, 13th June, 1949',
    exactDate: '13th June, 1949',
    year: 1949,
    pubDate: '1949-06-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14416'
  },
  {
    handle: '14410',
    title: 'Constituent Assembly Debates. Official Report, Thursday, 2nd June, 1949',
    exactDate: '2nd June, 1949',
    year: 1949,
    pubDate: '1949-06-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14410'
  },
  {
    handle: '14418',
    title: 'Constituent Assembly Debates. Official Report, Wednesday, 15th June, 1949',
    exactDate: '15th June, 1949',
    year: 1949,
    pubDate: '1949-06-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14418'
  },
  {
    handle: '14407',
    title: 'Constituent Assembly Debates. Official Report, Monday, 30th May, 1949',
    exactDate: '30th May, 1949',
    year: 1949,
    pubDate: '1949-05-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14407'
  },
  {
    handle: '14603',
    title: 'Constituent Assembly Debates, Wednesday, 30th July, 1947, Official Report',
    exactDate: '30th July, 1947',
    year: 1947,
    pubDate: '1947-07-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14603'
  },
  {
    handle: '14415',
    title: 'Constituent Assembly Debates. Official Report, Friday, 10th June, 1949',
    exactDate: '10th June, 1949',
    year: 1949,
    pubDate: '1949-06-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14415'
  },
  {
    handle: '14599',
    title: 'Constituent Assembly Debates, Thursday, 24th July, 1947, Official Report',
    exactDate: '24th July, 1947',
    year: 1947,
    pubDate: '1947-07-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14599'
  },
  {
    handle: '14399',
    title: 'Constituent Assembly Debates. Official Report, Wednesday, 18th May, 1949',
    exactDate: '18th May, 1949',
    year: 1949,
    pubDate: '1949-05-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14399'
  },
  {
    handle: '14411',
    title: 'Constituent Assembly Debates. Official Report, Friday, 3rd June, 1949',
    exactDate: '3rd June, 1949',
    year: 1949,
    pubDate: '1949-06-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14411'
  },
  {
    handle: '14389',
    title: 'Constituent Assembly Debates. Official Report, Thursday, 30th December, 1948',
    exactDate: '30th December, 1948',
    year: 1948,
    pubDate: '1948-12-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14389'
  },
  {
    handle: '14388',
    title: 'Constituent Assembly Debates. Official Report, Wednesday, 29th December, 1948',
    exactDate: '29th December, 1948',
    year: 1948,
    pubDate: '1948-12-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14388'
  },
  {
    handle: '14404',
    title: 'Constituent Assembly Debates. Official Report, Wednesday, 25th May, 1949',
    exactDate: '25th May, 1949',
    year: 1949,
    pubDate: '1949-05-01',
    url: 'https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/14404'
  }
];

// ============================================================================
// PACKAGE BUILDER
// ============================================================================

export function buildNdliCadArchivalPackages(): NdliCadArchivalEntry[] {
  const entries: NdliCadArchivalEntry[] = [];

  // 1. Process 4 DLI Volume records
  for (const vol of DLI_CAD_VOLUMES) {
    const srId = `sr-cad-dli-${vol.handle}`;
    const itemId = `item-cad-dli-${vol.handle}`;
    const dcId = `dc-cad-dli-${vol.handle}`;
    const archiveId = `DAIC-CAD-DLI-${vol.handle}`;
    const permalink = `https://www.ndl.iitkgp.ac.in/ch_document/dli/dli_ndli/${vol.handle}`;

    const desc = `Official parliamentary report of the Constituent Assembly of India (${vol.volRoman}, covering debates from ${vol.debatesDateSpan}). Sourced through the National Digital Library of India (NDLI) from Content Provider Digital Library of India. Published by ${vol.publisher}${vol.organization ? ` / ${vol.organization}` : ''}.`;

    entries.push({
      recordType: 'volume',
      ndliHandle: vol.handle,
      sourceRecord: {
        id: srId,
        sourceCollectionId: 'source-cad-archive',
        originalSourceIdentifier: `NDLI-DLI-${vol.handle}`,
        originalTitle: vol.title,
        originalUrl: permalink,
        repository: 'National Digital Library of India (NDLI) / Digital Library of India',
        sourceMetadata: {
          ndliHandle: vol.handle,
          discoveryUrl: vol.url,
          permalink,
          contentProvider: 'Digital Library of India',
          aggregator: 'National Digital Library of India (NDLI)',
          organization: vol.organization || null,
          publisher: vol.publisher,
          publicationDate: vol.pubDate,
          pageCount: vol.pageCount,
          language: 'English',
          fileFormat: 'PDF',
          accessRestriction: 'NDLI',
          subjectKeyword: 'Political Science',
          contentType: 'Text',
          resourceType: 'Book',
          recordClassification: 'Volume-level Constituent Assembly Debates'
        },
        ingestionMethod: 'API_CONNECTOR',
        provenanceNotes: `Cataloged via NDLI search query "constituents assembly debates archive". Content provider Digital Library of India. Publisher: ${vol.publisher}. Permanent handle: ${vol.handle}.`,
        isDemoRecord: false
      },
      archiveItem: {
        id: itemId,
        archiveId,
        sourceRecordId: srId,
        title: vol.title,
        category: 'Constituent Assembly Debates',
        date: vol.debatesDateSpan,
        year: 1949, // Canonical drafting period year
        author: 'Constituent Assembly of India',
        collection: 'Constituent Assembly Debates Archive',
        sourceInstitution: 'National Digital Library of India / Digital Library of India',
        sourceProvenance: `NDLI Handle ${vol.handle} | Digital Library of India | Published: ${vol.publisher} (${vol.pubDate})`,
        language: 'English',
        originalHolding: 'National Digital Library of India',
        description: desc,
        fullText: '', // Strictly no fabricated OCR
        aiSummary: `Constituent Assembly Debates ${vol.volRoman} proceedings (${vol.debatesDateSpan}) preserved in NDLI digital repository.`,
        keyConcepts: [
          'Constituent Assembly',
          'Constitution of India',
          'Parliamentary Debates',
          'Draft Constitution',
          vol.volRoman
        ],
        publishingStatus: 'Published',
        isFeatured: false,
        isDemoRecord: false,
        downloadUrl: permalink
      },
      dublinCore: {
        id: dcId,
        archiveItemId: itemId,
        title: vol.title,
        creator: 'Constituent Assembly of India',
        subject: [
          'Constituent Assembly of India',
          'Constitution of India',
          'Parliamentary Debates',
          'Political Science',
          vol.volRoman
        ],
        description: desc,
        publisher: vol.publisher,
        contributor: 'National Digital Library of India (NDLI)',
        date: vol.pubDate,
        type: 'Constituent Assembly Debates',
        format: 'application/pdf',
        identifier: `NDLI-DLI-${vol.handle}`,
        source: permalink,
        language: 'English',
        relation: [NDLI_CAD_SEARCH_URL],
        coverage: 'New Delhi, India; 1946-1950',
        rights: 'NDLI Access / Historical Official Parliamentary Records'
      }
    });
  }

  // 2. Process 32 South Asia Archive individual dated records
  for (const rep of SAA_CAD_REPORTS) {
    const srId = `sr-cad-saa-${rep.handle}`;
    const itemId = `item-cad-saa-${rep.handle}`;
    const dcId = `dc-cad-saa-${rep.handle}`;
    const archiveId = `DAIC-CAD-SAA-${rep.handle}`;
    const permalink = `https://www.ndl.iitkgp.ac.in/ch_document/saa/1234567_saa/${rep.handle}`;

    const desc = `Official verbatim debate report of the Constituent Assembly of India for sitting on ${rep.exactDate}. Sourced through National Digital Library of India (NDLI) from Content Provider South Asia Archive.`;

    entries.push({
      recordType: 'dated_official_report',
      ndliHandle: rep.handle,
      sourceRecord: {
        id: srId,
        sourceCollectionId: 'source-cad-archive',
        originalSourceIdentifier: `NDLI-SAA-${rep.handle}`,
        originalTitle: rep.title,
        originalUrl: permalink,
        repository: 'National Digital Library of India (NDLI) / South Asia Archive',
        sourceMetadata: {
          ndliHandle: rep.handle,
          discoveryUrl: rep.url,
          permalink,
          contentProvider: 'South Asia Archive',
          aggregator: 'National Digital Library of India (NDLI)',
          publicationDate: rep.pubDate,
          sittingDate: rep.exactDate,
          sittingYear: rep.year,
          language: 'English',
          fileFormat: 'PDF',
          accessRestriction: 'NDLI',
          contentType: 'Text',
          resourceType: 'Book / Official Report',
          recordClassification: 'Individual Dated Official Report'
        },
        ingestionMethod: 'API_CONNECTOR',
        provenanceNotes: `Cataloged via NDLI search query "constituents assembly debates archive". Content provider South Asia Archive. Permanent handle: ${rep.handle}.`,
        isDemoRecord: false
      },
      archiveItem: {
        id: itemId,
        archiveId,
        sourceRecordId: srId,
        title: rep.title,
        category: 'Constituent Assembly Debates',
        date: rep.exactDate,
        year: rep.year,
        author: 'Constituent Assembly of India',
        collection: 'Constituent Assembly Debates Archive',
        sourceInstitution: 'National Digital Library of India / South Asia Archive',
        sourceProvenance: `NDLI Handle ${rep.handle} | South Asia Archive | Sitting: ${rep.exactDate}`,
        language: 'English',
        originalHolding: 'National Digital Library of India',
        description: desc,
        fullText: '', // Strictly no fabricated OCR
        aiSummary: `Constituent Assembly Official Report for sitting conducted on ${rep.exactDate}.`,
        keyConcepts: [
          'Constituent Assembly',
          'Constitution of India',
          'Official Report',
          'Parliamentary Proceedings',
          rep.exactDate
        ],
        publishingStatus: 'Published',
        isFeatured: false,
        isDemoRecord: false,
        downloadUrl: permalink
      },
      dublinCore: {
        id: dcId,
        archiveItemId: itemId,
        title: rep.title,
        creator: 'Constituent Assembly of India',
        subject: [
          'Constituent Assembly of India',
          'Constitution of India',
          'Official Report',
          'Parliamentary Debates'
        ],
        description: desc,
        publisher: 'South Asia Archive',
        contributor: 'National Digital Library of India (NDLI)',
        date: rep.pubDate,
        type: 'Constituent Assembly Debates',
        format: 'application/pdf',
        identifier: `NDLI-SAA-${rep.handle}`,
        source: permalink,
        language: 'English',
        relation: [NDLI_CAD_SEARCH_URL],
        coverage: 'Constitution Hall, New Delhi; 1946-1950',
        rights: 'NDLI Access / Historical Official Parliamentary Records'
      }
    });
  }

  return entries;
}
