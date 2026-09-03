import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../supabaseAdmin';

/**
 * Extract Bearer token from the Authorization header.
 * Accepts: "Bearer <token>" (case-insensitive scheme).
 */
function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return null;

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

function sendUnauthorized(res: Response, message: string) {
  return res.status(401).json({
    success: false,
    error: {
      message,
      code: 'UNAUTHORIZED',
    },
  });
}

function sendForbidden(res: Response, message: string) {
  return res.status(403).json({
    success: false,
    error: {
      message,
      code: 'FORBIDDEN',
    },
  });
}

type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
};

/**
 * Validate Bearer JWT via Supabase Admin and attach Auth user to the request.
 * Returns the user on success, or null after sending a 401 response.
 */
async function authenticateRequest(req: Request, res: Response): Promise<AuthUser | null> {
  const existing = (req as any).user as AuthUser | undefined;
  if (existing?.id) return existing;

  const token = extractBearerToken(req);
  if (!token) {
    sendUnauthorized(res, 'Missing or invalid Authorization Bearer token.');
    return null;
  }

  if (!isSupabaseAdminConfigured()) {
    sendUnauthorized(res, 'Authentication service is not configured.');
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    sendUnauthorized(res, 'Authentication service is unavailable.');
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    sendUnauthorized(res, error?.message || 'Invalid or expired authentication token.');
    return null;
  }

  (req as any).user = data.user;
  (req as any).accessToken = token;
  return data.user as AuthUser;
}

/**
 * Require a valid Supabase Auth session (Bearer JWT).
 * On success, attaches the Auth user to `(req as any).user` and calls next().
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authenticateRequest(req, res);
    if (!user) return;
    return next();
  } catch (err: any) {
    console.error('[Auth Middleware] requireAuth error:', err);
    return sendUnauthorized(res, 'Authentication failed.');
  }
}

/**
 * Optional admin gate. Verifies the Bearer token (if not already attached),
 * then checks Auth metadata and/or the profiles table for an admin role/id.
 *
 * Usage:
 *   app.get('/api/admin/...', requireAuth, requireAdmin, handler)
 *   // or standalone:
 *   app.get('/api/admin/...', requireAdmin, handler)
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = await authenticateRequest(req, res);
    if (!authUser) return;

    const metaRole =
      authUser.user_metadata?.role ||
      authUser.app_metadata?.role ||
      authUser.user_metadata?.user_role;

    if (metaRole === 'admin') {
      (req as any).isAdmin = true;
      return next();
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return sendForbidden(res, 'Admin verification unavailable.');
    }

    let profile: { id?: string; role?: string; email?: string } | null = null;

    const { data: byAuthId } = await supabaseAdmin
      .from('profiles')
      .select('id, role, email')
      .eq('auth_id', authUser.id)
      .maybeSingle();

    if (byAuthId) {
      profile = byAuthId;
    } else {
      const { data: byId } = await supabaseAdmin
        .from('profiles')
        .select('id, role, email')
        .eq('id', authUser.id)
        .maybeSingle();

      if (byId) {
        profile = byId;
      } else if (authUser.email) {
        const { data: byEmail } = await supabaseAdmin
          .from('profiles')
          .select('id, role, email')
          .ilike('email', authUser.email.trim().toLowerCase())
          .maybeSingle();
        profile = byEmail;
      }
    }

    const isAdminProfile =
      profile?.role === 'admin' ||
      profile?.id === 'admin_user' ||
      (profile?.email && profile.email.toLowerCase() === 'admin@livecall.com') ||
      (authUser.email && authUser.email.toLowerCase() === 'admin@livecall.com');

    if (!isAdminProfile) {
      return sendForbidden(res, 'Admin privileges required.');
    }

    (req as any).isAdmin = true;
    (req as any).adminProfile = profile;
    return next();
  } catch (err: any) {
    console.error('[Auth Middleware] requireAdmin error:', err);
    return sendForbidden(res, 'Admin verification failed.');
  }
}
