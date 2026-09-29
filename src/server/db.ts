/**
 * SERVER-SIDE POSTGRESQL DATABASE POOL & CLIENT
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * CRITICAL SECURITY & ARCHITECTURAL RULES:
 * - This file executes EXCLUSIVELY on the server (Node.js / Express).
 * - NEVER import this file into client-side React code.
 * - Credentials (DATABASE_URL, DB_PASSWORD) remain strictly server-side.
 * - All logging sanitizes connection strings to prevent credential exposure.
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Sanitizes a database URL or host to mask credentials in logs.
 */
export function sanitizeDatabaseUrl(url?: string): string {
  if (!url) return 'NOT_CONFIGURED';
  try {
    const parsed = new URL(url);
    const maskedUser = parsed.username ? parsed.username.substring(0, 4) + '***' : '';
    return `${parsed.protocol}//${maskedUser}:****@${parsed.host}${parsed.pathname}`;
  } catch {
    return 'CONFIGURED_HOST';
  }
}

/**
 * Checks whether valid database credentials are provided in the environment.
 */
export function hasDbConfig(): boolean {
  const connectionString = process.env.DATABASE_URL;
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (host && user && password) return true;
  if (connectionString && connectionString.trim().length > 0) return true;
  return false;
}

/**
 * Builds the pool configuration prioritizing Supabase pooler parameters.
 */
function buildPoolConfig(): pg.PoolConfig | null {
  if (!hasDbConfig()) {
    return null;
  }

  const connectionString = process.env.DATABASE_URL;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'postgres';

  // If granular environment variables are provided (especially Supabase pooler user like postgres.[project-ref])
  if (host && user && password) {
    return {
      host,
      port,
      user,
      password,
      database,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }

  // Otherwise fallback to connectionString with Supabase user fix if DB_USER is provided
  if (connectionString) {
    try {
      const parsed = new URL(connectionString);
      if (user && parsed.username !== user) {
        parsed.username = user;
      }
      if (password && !parsed.password) {
        parsed.password = password;
      }
      return {
        connectionString: parsed.toString(),
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      };
    } catch {
      return {
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      };
    }
  }

  return null;
}

/**
 * Creates or retrieves the singleton PostgreSQL connection pool.
 */
export function getDbPool(): pg.Pool | null {
  if (pool) return pool;
  if (!hasDbConfig()) {
    return null;
  }

  try {
    const config = buildPoolConfig();
    if (!config) return null;
    pool = new Pool(config);

    pool.on('error', (err) => {
      console.error('[Server DB Pool Error] Unexpected idle client error:', err.message);
    });

    const targetDesc = process.env.DB_HOST || (process.env.DATABASE_URL ? sanitizeDatabaseUrl(process.env.DATABASE_URL) : 'configured database');
    console.log(`[Server DB] Initialized PostgreSQL connection pool targeting ${targetDesc}`);
    return pool;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[Server DB] Notice: Could not construct PostgreSQL pool:', msg);
    return null;
  }
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  database?: string;
  version?: string;
  latencyMs?: number;
}

/**
 * Performs a safe SELECT 1 and version test against PostgreSQL.
 * NEVER returns credentials or secrets.
 */
export async function testConnection(): Promise<ConnectionTestResult> {
  if (!hasDbConfig()) {
    return {
      ok: false,
      message: 'Standalone mode: PostgreSQL database is not configured. Running with in-memory seeded relational repository.',
    };
  }

  const p = getDbPool();
  if (!p) {
    return {
      ok: false,
      message: 'Database pool could not be initialized.',
    };
  }

  const startTime = Date.now();
  let client: pg.PoolClient | null = null;
  try {
    client = await p.connect();
    const res = await client.query('SELECT 1 as connected, current_database() as db_name, version() as version;');
    const latency = Date.now() - startTime;
    const row = res.rows[0];

    return {
      ok: true,
      message: 'PostgreSQL connection verified successfully via SELECT 1.',
      database: row.db_name,
      version: row.version ? row.version.split(' on ')[0] : 'PostgreSQL',
      latencyMs: latency,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `Database connection test failed: ${msg}`,
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Checks the baseline schema plus required OCR/share/heritage feature tables.
 * Does NOT execute any migrations.
 */
export async function checkSchemaStatus(): Promise<{
  migrated: boolean;
  tablesFound: string[];
  missingTables: string[];
  extraTables: string[];
  actualTableCount: number;
}> {
  if (!hasDbConfig()) {
    return { migrated: false, tablesFound: [], missingTables: [], extraTables: [], actualTableCount: 0 };
  }

  const p = getDbPool();
  if (!p) {
    return { migrated: false, tablesFound: [], missingTables: [], extraTables: [], actualTableCount: 0 };
  }

  const expectedTables = [
    'source_collections',
    'source_records',
    'archive_items',
    'archive_item_people',
    'archive_item_events',
    'archive_item_topics',
    'dublin_core_metadata',
    'documents',
    'document_pages',
    'ocr_records',
    'people',
    'events',
    'topics',
    'media_records',
    'transcripts',
    'translations',
    'citations',
    'knowledge_nodes',
    'knowledge_links',
    'timeline_event_documents',
    'rag_chunk_embeddings',
    'audit_logs',
    'share_sessions',
    'heritage_locations',
    'heritage_viewpoints',
    'heritage_hotspots',
  ];

  let client: pg.PoolClient | null = null;
  try {
    client = await p.connect();
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE';
    `);

    const existing = new Set(res.rows.map((r: { table_name: string }) => r.table_name));
    const found = expectedTables.filter((t) => existing.has(t));
    const missing = expectedTables.filter((t) => !existing.has(t));
    const extra = [...existing].filter((t) => !expectedTables.includes(t)).sort();

    return {
      migrated: missing.length === 0,
      tablesFound: found,
      missingTables: missing,
      extraTables: extra,
      actualTableCount: existing.size,
    };
  } catch (err: unknown) {
    console.error('[Server DB] Error checking schema status:', err);
    return { migrated: false, tablesFound: [], missingTables: expectedTables, extraTables: [], actualTableCount: 0 };
  } finally {
    if (client) {
      client.release();
    }
  }
}
