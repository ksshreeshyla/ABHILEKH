/**
 * DATABASE CONFIGURATION & CONNECTION STATUS MANAGER
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * SECURE CLIENT-SAFE ARCHITECTURE:
 * - Database credentials NEVER exist in client-side code or bundles.
 * - Live connection status is queried securely from the backend (/api/database/status).
 * - Distinguishes between PostgreSQL connection, schema migration state, and repository fallback.
 */

export interface DatabaseStatus {
  engine: 'PostgreSQL (Supabase)' | 'Prepared-Repository-Adapter';
  isLiveConnection: boolean;
  connected: boolean;
  hostName: string;
  databaseName: string;
  version?: string;
  latencyMs?: number;
  migrated: boolean;
  tablesFound?: string[];
  missingTables?: string[];
  statusMessage: string;
  featuresSupported: string[];
  preparedFeaturesForLiveDb: string[];
}

/**
 * Static baseline status for client-side initial render before API response.
 */
export const getDatabaseStatus = (): DatabaseStatus => {
  return {
    engine: 'Prepared-Repository-Adapter',
    isLiveConnection: false,
    connected: false,
    hostName: 'Local Seeded Relational Adapter',
    databaseName: 'ambedkar_heritage_archive (in-memory)',
    version: 'In-Memory Relational Engine',
    migrated: false,
    statusMessage: 'In-memory relational repository active. Ready for live PostgreSQL configuration.',
    featuresSupported: [
      'Seeded Relational Data Repository',
      'Dublin Core Metadata Management',
      'Page-level OCR Transcription',
      'Knowledge Graph Nodes & Links',
      'Interactive Timeline Milestone Records',
      'Audio/Video Timestamped Transcripts',
      'Source Collection Provenance Tracking',
      'JSON & CSV Ingestion Engine',
      'Demo Data vs Real Data Flagging',
      'Audit Logging'
    ],
    preparedFeaturesForLiveDb: [
      'Configure DATABASE_URL in environment to connect to external PostgreSQL',
      'Execute 0001_initial_schema.sql to provision public schema tables',
      'PostgreSQL tsvector GIN Full-Text Indexing',
      'pgvector 768-dim Semantic Search'
    ]
  };
};

/**
 * Fetches real-time connection and migration status from the server-side API.
 * Safely handles network errors and fallback.
 */
export async function fetchLiveDatabaseStatus(): Promise<DatabaseStatus> {
  try {
    const res = await fetch('/api/database/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const isLive = Boolean(data.connected);

    return {
      engine: isLive ? (data.engine || 'PostgreSQL (Supabase)') : 'Prepared-Repository-Adapter',
      isLiveConnection: isLive,
      connected: isLive,
      hostName: isLive ? (data.database ? `${data.database} (via Supabase Pooler)` : 'aws-0-ap-south-1.pooler.supabase.com') : 'Local Relational Store',
      databaseName: data.database || 'ambedkar_heritage_archive',
      version: data.version || 'In-Memory Relational Engine',
      latencyMs: data.latencyMs,
      migrated: Boolean(data.migrated),
      tablesFound: data.tablesFound || [],
      missingTables: data.missingTables || [],
      statusMessage: data.message || (isLive
        ? (data.migrated
            ? 'Live PostgreSQL connection active. All public schema tables verified.'
            : `Server-side PostgreSQL connection verified (SELECT 1 succeeded in ${data.latencyMs || 0}ms). Schema migration pending (${data.missingTables?.length || 17} tables).`)
        : 'In-memory relational repository active. Operating with high performance.'),
      featuresSupported: [
        'Secure Server-side Connection Pooling',
        'SELECT 1 Health Probes',
        'Dublin Core Metadata Standard',
        'Document & OCR Multi-Script Storage',
        'Timeline Milestones & Knowledge Graph',
        'Provenance & Ingestion Pipelines',
        'Hybrid Fallback Store'
      ],
      preparedFeaturesForLiveDb: data.preparedFeaturesForLiveDb || (data.migrated
        ? []
        : ['Execute 0001_initial_schema.sql to create public schema tables'])
    };
  } catch {
    // If backend endpoint is temporarily unreachable
    return getDatabaseStatus();
  }
}
