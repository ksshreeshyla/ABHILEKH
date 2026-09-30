import express from 'express';
import { apiRouter } from './api.ts';

/**
 * Creates the shared API-only Express application used by local development
 * and the Netlify Function adapter. Static/Vite hosting remains in server.ts.
 */
export function createApiApp() {
  const app = express();

  // Preserve the existing local request limits and route behavior.
  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ extended: true, limit: '200mb' }));

  app.use('/api', apiRouter);

  // Keep unknown API paths JSON-only; they must never fall through to the SPA.
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      ok: false,
      error: 'Not Found',
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
  });

  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[API Error]', err);
    res.status(err.status || err.statusCode || 500).json({
      ok: false,
      error: err.name || 'InternalServerError',
      message: err.message || 'An unexpected error occurred during API processing'
    });
  });

  return app;
}
