import serverless from 'serverless-http';
import { createApiApp } from '../../src/server/createApiApp.ts';

// Keep the existing Express router and /api paths intact behind Netlify's
// rewrite. Explicit binary handling preserves PDF and image response bodies.
const app = createApiApp();

export const handler = serverless(app, {
  binary: ['application/pdf', 'image/*', 'application/octet-stream'],
});
