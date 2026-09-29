/**
 * FULL-STACK SERVER ENTRY POINT
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Runs Express backend with Vite middleware in development.
 * Strictly isolates database credentials to the server-side runtime.
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { apiRouter } from './src/server/api.ts';
import { testConnection, checkSchemaStatus, hasDbConfig } from './src/server/db.ts';

dotenv.config();

// Ensure container nginx reverse proxy permits archival multipart uploads up to 130 MiB
try {
  const fs = await import('fs');
  const { execSync } = await import('child_process');
  let changed = false;
  const filesToPatch = ['/etc/nginx/nginx.conf.template', '/etc/nginx/nginx.conf'];
  for (const f of filesToPatch) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      if (content.includes('client_max_body_size') && !content.includes('client_max_body_size 130M;')) {
        const updated = content.replace(/client_max_body_size\s+[0-9]+[MKG]?\s*;/g, 'client_max_body_size 130M;');
        try {
          fs.writeFileSync(f, updated, 'utf8');
          changed = true;
        } catch {}
      }
    }
  }
  if (changed) {
    try {
      execSync('nginx -s reload', { stdio: 'ignore' });
    } catch {}
  }
} catch {}

const portArgIndex = process.argv.indexOf('--port');
const portFromArg = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : undefined;
const PORT = portFromArg || parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();

  // Support genuine archival PDF assets up to 120 MiB (120 * 1024 * 1024 bytes = 125,829,120 bytes).
  // Base64 encoding expands binary payloads by ~33.3% (~168 MB for a 120 MiB PDF), so limit is set to 200mb.
  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ extended: true, limit: '200mb' }));

  // Mount backend API routes
  app.use('/api', apiRouter);

  // Catch-all for undefined /api routes so they NEVER fall through to the SPA HTML fallback
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      ok: false,
      error: 'Not Found',
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
  });

  // Ensure /api error handling ALWAYS returns JSON, never HTML
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[API Error]', err);
    res.status(err.status || err.statusCode || 500).json({
      ok: false,
      error: err.name || 'InternalServerError',
      message: err.message || 'An unexpected error occurred during API processing'
    });
  });

  // Connection startup check (server-side only, sanitized output)
  if (hasDbConfig()) {
    testConnection().then(async (result) => {
      if (result.ok) {
        console.log(`[PostgreSQL] Connection verified to database "${result.database}" (${result.version}) in ${result.latencyMs}ms.`);
        const schema = await checkSchemaStatus();
        if (schema.migrated) {
          console.log('[PostgreSQL] Database schema verified: All expected tables exist.');
        } else {
          console.log(`[PostgreSQL] Schema status: ${schema.missingTables.length} tables pending migration (0001_initial_schema.sql not yet executed).`);
        }
      } else {
        console.warn(`[PostgreSQL] Connection test notice: ${result.message}`);
      }
    });
  } else {
    console.log('[PostgreSQL] Standalone mode: Running with in-memory seeded relational repository.');
  }

  if (!isProd) {
    // Development mode: Mount Vite dev server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built static files
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT} (API on /api/*)`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
