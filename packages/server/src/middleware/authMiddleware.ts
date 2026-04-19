import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AdminTokenPayload {
  username: string;
  role: 'admin';
  iat: number;
  exp: number;
}

/** Protect admin routes with JWT auth */
export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.adminJwtSecret) as AdminTokenPayload;
    (req as Request & { admin: AdminTokenPayload }).admin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Generate admin JWT token */
export function generateAdminToken(username: string): string {
  return jwt.sign(
    { username, role: 'admin' },
    env.adminJwtSecret,
    { expiresIn: env.adminSessionExpiry } as jwt.SignOptions
  );
}
