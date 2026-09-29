/**
 * DATABASE MIGRATION RUNNER
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Provides functions to inspect and execute /src/db/migrations/0001_initial_schema.sql.
 *
 * CRITICAL SAFETY RULES:
 * - This runner is NOT invoked automatically.
 * - Migrations are only executed upon explicit manual user command or confirmation.
 */

import fs from 'fs';
import path from 'path';
import { getDbPool, checkSchemaStatus, hasDbConfig } from './db.ts';

const MIGRATION_FILE_PATH = path.resolve(process.cwd(), 'src/db/migrations/0001_initial_schema.sql');
const EXPERIENCE_MIGRATION_FILE_PATH = path.resolve(process.cwd(), 'src/db/migrations/0002_ocr_share_heritage.sql');

export interface MigrationPlan {
  migrationFile: string;
  fileExists: boolean;
  fileSizeBytes: number;
  migrated: boolean;
  tablesFound: string[];
  missingTables: string[];
  extraTables: string[];
  actualTableCount: number;
}

/**
 * Checks the status of the migration without executing it.
 */
export async function getMigrationPlan(): Promise<MigrationPlan> {
  const fileExists = fs.existsSync(MIGRATION_FILE_PATH);
  const fileSizeBytes = fileExists ? fs.statSync(MIGRATION_FILE_PATH).size : 0;
  const status = await checkSchemaStatus();

  return {
    migrationFile: '0001_initial_schema.sql',
    fileExists,
    fileSizeBytes,
    migrated: status.migrated,
    tablesFound: status.tablesFound,
    missingTables: status.missingTables,
    extraTables: status.extraTables,
    actualTableCount: status.actualTableCount,
  };
}

/**
 * Executes 0001_initial_schema.sql against the database.
 * ONLY call this when explicitly instructed by the user!
 */
export async function executeMigration(): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  if (!hasDbConfig()) {
    return {
      success: false,
      message: 'No PostgreSQL database configured in environment variables. Operating with in-memory seeded relational repository.',
    };
  }

  const pool = getDbPool();
  if (!pool) {
    return {
      success: false,
      message: 'Database pool unavailable. Cannot execute migration.',
    };
  }

  if (!fs.existsSync(MIGRATION_FILE_PATH)) {
    return {
      success: false,
      message: `Migration file not found at ${MIGRATION_FILE_PATH}`,
    };
  }

  const sql = fs.readFileSync(MIGRATION_FILE_PATH, 'utf-8');
  const client = await pool.connect();

  try {
    console.log('[Migration Runner] Starting execution of 0001_initial_schema.sql...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[Migration Runner] 0001_initial_schema.sql executed successfully.');

    return {
      success: true,
      message: '0001_initial_schema.sql successfully executed against PostgreSQL database.',
    };
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Migration Runner] Migration execution failed:', msg);
    return {
      success: false,
      message: 'Migration failed and transaction was rolled back.',
      error: msg,
    };
  } finally {
    client.release();
  }
}

/** Executes the additive, idempotent OCR/share/heritage migration only. */
export async function executeExperienceMigration(): Promise<{ success: boolean; message: string; error?: string }> {
  if (!hasDbConfig()) return { success: false, message: 'PostgreSQL is not configured.' };
  const pool = getDbPool();
  if (!pool) return { success: false, message: 'Database pool unavailable.' };
  if (!fs.existsSync(EXPERIENCE_MIGRATION_FILE_PATH)) {
    return { success: false, message: '0002_ocr_share_heritage.sql is missing.' };
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(EXPERIENCE_MIGRATION_FILE_PATH, 'utf8'));
    await client.query('COMMIT');
    return { success: true, message: '0002_ocr_share_heritage.sql applied successfully.' };
  } catch (error) {
    await client.query('ROLLBACK');
    return { success: false, message: 'Feature migration failed and was rolled back.', error: error instanceof Error ? error.message : String(error) };
  } finally {
    client.release();
  }
}
