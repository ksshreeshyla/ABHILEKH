import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const COOKIE = 'abhilekh_admin_session';
const liveSessions = new Map<string, number>();
const loginAttempts = new Map<string, number[]>();

function sessionTtlMs(): number {
  const minutes = Number(process.env.ADMIN_SESSION_TTL_MINUTES || 480);
  return Math.max(5, Math.min(Number.isFinite(minutes) ? minutes : 480, 720)) * 60_000;
}

function cookieToken(req: Request): string | null {
  const raw = req.headers.cookie || '';
  const value = raw.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`));
  return value ? decodeURIComponent(value.slice(COOKIE.length + 1)) : null;
}

function clientKey(req: Request): string {
  return String(req.ip || req.socket.remoteAddress || 'unknown').slice(0, 100);
}

export function createAdminSession(req: Request, res: Response, passcode: unknown): { ok: boolean; message?: string } {
  const configured = process.env.ADMIN_ACCESS_PASSCODE || '';
  if (!configured) return { ok: false, message: 'Admin API access is not configured. Set ADMIN_ACCESS_PASSCODE on the server.' };
  const key = clientKey(req);
  const now = Date.now();
  const attempts = (loginAttempts.get(key) || []).filter(timestamp => now - timestamp < 10 * 60_000);
  if (attempts.length >= 10) return { ok: false, message: 'Too many login attempts. Try again later.' };
  attempts.push(now);
  loginAttempts.set(key, attempts);

  const supplied = typeof passcode === 'string' ? passcode : '';
  const expectedHash = crypto.createHash('sha256').update(configured).digest();
  const suppliedHash = crypto.createHash('sha256').update(supplied).digest();
  if (!crypto.timingSafeEqual(expectedHash, suppliedHash)) return { ok: false, message: 'The staff passcode was not accepted.' };

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = now + sessionTtlMs();
  liveSessions.set(crypto.createHash('sha256').update(token).digest('hex'), expiresAt);
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(sessionTtlMs() / 1000)}${secure}`);
  return { ok: true };
}

export function clearAdminSession(req: Request, res: Response): void {
  const token = cookieToken(req);
  if (token) liveSessions.delete(crypto.createHash('sha256').update(token).digest('hex'));
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${req.secure ? '; Secure' : ''}`);
}

export function hasAdminSession(req: Request): boolean {
  const token = cookieToken(req);
  if (!token) return false;
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expires = liveSessions.get(hash);
  if (!expires || expires <= Date.now()) {
    liveSessions.delete(hash);
    return false;
  }
  return true;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!hasAdminSession(req)) {
    res.status(401).json({ ok: false, message: 'An authenticated archivist session is required.' });
    return;
  }
  next();
}
