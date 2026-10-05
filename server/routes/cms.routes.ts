import { Router } from 'express';
import type { ServerRuntime } from '../runtimeTypes';
import { requireAdmin } from '../middleware/auth';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../supabaseAdmin';

const CMS_ACTION_TYPES = new Set(['tab', 'modal', 'external', 'policy']);
const POLICY_CATEGORIES = new Set(['safety', 'privacy', 'terms', 'coins', 'creators', 'moderation']);

function safeError(err: unknown, fallback: string): string {
  const message = typeof err === 'string' ? err : (err as any)?.message;
  if (typeof message !== 'string' || !message.trim() || message.length > 180) return fallback;
  const lower = message.toLowerCase();
  if (lower.includes('service_role') || lower.includes('smtp') || lower.includes('stack')) return fallback;
  return message;
}

function isSafeHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function requireConfigured(res: any): boolean {
  if (!isSupabaseAdminConfigured()) {
    res.status(503).json({ success: false, error: 'Database admin client is not configured.' });
    return false;
  }
  return true;
}

function mapBannerRow(row: any) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || '',
    tagText: row.badge || 'FEATURED',
    tagColor: row.tag_color || 'bg-indigo-600 text-white',
    imageUrl: row.image_url || '',
    ctaText: row.cta_text || 'Explore Now',
    actionType: row.action_type || 'tab',
    actionTarget: row.action_target || 'coins',
    active: row.active ?? true,
    order: row.order_num ?? 0,
    bgGradient: row.bg_gradient || 'from-indigo-950/90 via-purple-950/70 to-slate-900/90',
  };
}

function mapPolicyRow(row: any) {
  return {
    id: row.id || row.slug,
    slug: row.slug,
    title: row.title,
    category: row.category || 'safety',
    icon: row.icon || 'ShieldCheck',
    summary: row.summary || '',
    content: row.content || '',
    lastUpdated: row.effective_date || row.updated_at || new Date().toISOString(),
    order: row.order_num ?? 0,
    isFeaturedOnHome: row.is_featured ?? true,
    externalUrl: row.external_url || undefined,
  };
}

function mapQuickLinkRow(row: any) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || '',
    icon: row.icon || 'Zap',
    badge: row.badge || undefined,
    actionType: row.action_type || 'tab',
    actionTarget: row.action_target || 'discovery',
    colorGradient: row.color_gradient || 'from-indigo-500 to-purple-600',
    order: row.order_num ?? 0,
    active: row.active ?? true,
  };
}

function validateAction(actionType: unknown, actionTarget: unknown): string | null {
  const type = String(actionType || 'tab');
  if (!CMS_ACTION_TYPES.has(type)) {
    return 'actionType must be one of: tab, modal, external, policy';
  }
  const target = String(actionTarget || '').trim();
  if (!target) return 'actionTarget is required';
  if (type === 'external' && !isSafeHttpUrl(target)) {
    return 'External actionTarget must be a valid http(s) URL';
  }
  return null;
}

export function createCmsAdminRouter(_ctx: ServerRuntime): Router {
  const router = Router();

  // GET all CMS collections (admin refresh)
  router.get('/cms', requireAdmin, async (_req, res) => {
    try {
      if (!requireConfigured(res)) return;
      const client = getSupabaseAdmin()!;
      const [banners, policies, links] = await Promise.all([
        client.from('home_banners').select('*').order('order_num', { ascending: true }),
        client.from('cms_policies').select('*').order('order_num', { ascending: true }),
        client.from('home_quick_links').select('*').order('order_num', { ascending: true }),
      ]);
      if (banners.error || policies.error || links.error) {
        return res.status(500).json({
          success: false,
          error: safeError(
            banners.error || policies.error || links.error,
            'Failed to load CMS content'
          ),
        });
      }
      return res.json({
        success: true,
        data: {
          banners: (banners.data || []).map(mapBannerRow),
          policies: (policies.data || []).map(mapPolicyRow),
          quickLinks: (links.data || []).map(mapQuickLinkRow),
        },
      });
    } catch (err: any) {
      console.error('GET /api/admin/cms error:', err);
      return res.status(500).json({ success: false, error: safeError(err, 'Failed to load CMS content') });
    }
  });

  // PUT upsert banner
  router.put('/cms/banners', requireAdmin, async (req, res) => {
    try {
      if (!requireConfigured(res)) return;
      const b = req.body || {};
      if (!b.id || !String(b.title || '').trim()) {
        return res.status(400).json({ success: false, error: 'Banner id and title are required' });
      }
      const actionErr = validateAction(b.actionType || b.action_type, b.actionTarget || b.action_target);
      if (actionErr) return res.status(400).json({ success: false, error: actionErr });

      const payload = {
        id: String(b.id),
        title: String(b.title).trim(),
        subtitle: String(b.subtitle || ''),
        badge: String(b.tagText || b.badge || 'FEATURED'),
        cta_text: String(b.ctaText || b.cta_text || 'Explore Now'),
        tag_color: String(b.tagColor || b.tag_color || 'bg-indigo-600 text-white'),
        image_url: String(b.imageUrl || b.image_url || ''),
        action_type: String(b.actionType || b.action_type || 'tab'),
        action_target: String(b.actionTarget || b.action_target || 'discovery'),
        bg_gradient:
          String(b.bgGradient || b.bg_gradient || 'from-indigo-950/90 via-purple-950/70 to-slate-900/90'),
        order_num: Number(b.order ?? b.order_num ?? 0),
        active: b.active ?? true,
        updated_at: new Date().toISOString(),
      };

      const client = getSupabaseAdmin()!;
      const { data, error } = await client
        .from('home_banners')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .maybeSingle();
      if (error) {
        return res.status(500).json({ success: false, error: safeError(error.message, 'Failed to save banner') });
      }
      return res.json({ success: true, data: mapBannerRow(data || payload) });
    } catch (err: any) {
      console.error('PUT /api/admin/cms/banners error:', err);
      return res.status(500).json({ success: false, error: safeError(err, 'Failed to save banner') });
    }
  });

  router.patch('/cms/banners/:id/active', requireAdmin, async (req, res) => {
    try {
      if (!requireConfigured(res)) return;
      const id = String(req.params.id || '');
      if (!id) return res.status(400).json({ success: false, error: 'Banner id is required' });
      if (typeof req.body?.active !== 'boolean') {
        return res.status(400).json({ success: false, error: 'active boolean is required' });
      }
      const client = getSupabaseAdmin()!;
      const { data, error } = await client
        .from('home_banners')
        .update({ active: req.body.active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) {
        return res.status(500).json({ success: false, error: safeError(error.message, 'Failed to update banner') });
      }
      if (!data) return res.status(404).json({ success: false, error: 'Banner not found' });
      return res.json({ success: true, data: mapBannerRow(data) });
    } catch (err: any) {
      console.error('PATCH /api/admin/cms/banners/:id/active error:', err);
      return res.status(500).json({ success: false, error: safeError(err, 'Failed to update banner') });
    }
  });

  router.delete('/cms/banners/:id', requireAdmin, async (req, res) => {
    try {
      if (!requireConfigured(res)) return;
      const id = String(req.params.id || '');
      if (!id) return res.status(400).json({ success: false, error: 'Banner id is required' });
      const client = getSupabaseAdmin()!;
      const { error } = await client.from('home_banners').delete().eq('id', id);
      if (error) {
        return res.status(500).json({ success: false, error: safeError(error.message, 'Failed to delete banner') });
      }
      return res.json({ success: true });
    } catch (err: any) {
      console.error('DELETE /api/admin/cms/banners/:id error:', err);
      return res.status(500).json({ success: false, error: safeError(err, 'Failed to delete banner') });
    }
  });

  router.put('/cms/policies', requireAdmin, async (req, res) => {
    try {
      if (!requireConfigured(res)) return;
      const p = req.body || {};
      if (!p.id || !String(p.title || '').trim() || !String(p.content || '').trim()) {
        return res.status(400).json({ success: false, error: 'Policy id, title, and content are required' });
      }
      const category = String(p.category || 'safety');
      if (!POLICY_CATEGORIES.has(category)) {
        return res.status(400).json({ success: false, error: 'Invalid policy category' });
      }
      if (p.externalUrl || p.external_url) {
        if (!isSafeHttpUrl(p.externalUrl || p.external_url)) {
          return res.status(400).json({ success: false, error: 'externalUrl must be a valid http(s) URL' });
        }
      }

      const slug =
        String(p.slug || p.title || 'policy')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || `policy-${Date.now()}`;

      const payload = {
        id: String(p.id),
        slug,
        title: String(p.title).trim(),
        category,
        icon: String(p.icon || 'ShieldCheck'),
        summary: String(p.summary || ''),
        content: String(p.content),
        order_num: Number(p.order ?? p.order_num ?? 0),
        is_featured: p.isFeaturedOnHome ?? p.is_featured ?? true,
        external_url: p.externalUrl || p.external_url || null,
        effective_date: p.lastUpdated || p.effective_date || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const client = getSupabaseAdmin()!;
      const { data, error } = await client
        .from('cms_policies')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .maybeSingle();
      if (error) {
        return res.status(500).json({ success: false, error: safeError(error.message, 'Failed to save policy') });
      }
      return res.json({ success: true, data: mapPolicyRow(data || payload) });
    } catch (err: any) {
      console.error('PUT /api/admin/cms/policies error:', err);
      return res.status(500).json({ success: false, error: safeError(err, 'Failed to save policy') });
    }
  });

  router.delete('/cms/policies/:id', requireAdmin, async (req, res) => {
    try {
      if (!requireConfigured(res)) return;
      const id = String(req.params.id || '');
      if (!id) return res.status(400).json({ success: false, error: 'Policy id is required' });
      const client = getSupabaseAdmin()!;
      const { error } = await client.from('cms_policies').delete().eq('id', id);
      if (error) {
        return res.status(500).json({ success: false, error: safeError(error.message, 'Failed to delete policy') });
      }
      return res.json({ success: true });
    } catch (err: any) {
      console.error('DELETE /api/admin/cms/policies/:id error:', err);
      return res.status(500).json({ success: false, error: safeError(err, 'Failed to delete policy') });
    }
  });

  router.put('/cms/quick-links', requireAdmin, async (req, res) => {
    try {
      if (!requireConfigured(res)) return;
      const link = req.body || {};
      if (!link.id || !String(link.title || '').trim()) {
        return res.status(400).json({ success: false, error: 'Quick link id and title are required' });
      }
      const actionErr = validateAction(link.actionType || link.action_type, link.actionTarget || link.action_target);
      if (actionErr) return res.status(400).json({ success: false, error: actionErr });

      const payload = {
        id: String(link.id),
        title: String(link.title).trim(),
        subtitle: String(link.subtitle || ''),
        icon: String(link.icon || 'Zap'),
        badge: link.badge ? String(link.badge) : null,
        action_type: String(link.actionType || link.action_type || 'tab'),
        action_target: String(link.actionTarget || link.action_target || 'discovery'),
        color_gradient: String(link.colorGradient || link.color_gradient || 'from-indigo-500 to-purple-600'),
        order_num: Number(link.order ?? link.order_num ?? 0),
        active: link.active ?? true,
      };

      const client = getSupabaseAdmin()!;
      const { data, error } = await client
        .from('home_quick_links')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .maybeSingle();
      if (error) {
        return res.status(500).json({ success: false, error: safeError(error.message, 'Failed to save quick link') });
      }
      return res.json({ success: true, data: mapQuickLinkRow(data || payload) });
    } catch (err: any) {
      console.error('PUT /api/admin/cms/quick-links error:', err);
      return res.status(500).json({ success: false, error: safeError(err, 'Failed to save quick link') });
    }
  });

  router.patch('/cms/quick-links/:id/active', requireAdmin, async (req, res) => {
    try {
      if (!requireConfigured(res)) return;
      const id = String(req.params.id || '');
      if (!id) return res.status(400).json({ success: false, error: 'Quick link id is required' });
      if (typeof req.body?.active !== 'boolean') {
        return res.status(400).json({ success: false, error: 'active boolean is required' });
      }
      const client = getSupabaseAdmin()!;
      const { data, error } = await client
        .from('home_quick_links')
        .update({ active: req.body.active })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) {
        return res.status(500).json({ success: false, error: safeError(error.message, 'Failed to update quick link') });
      }
      if (!data) return res.status(404).json({ success: false, error: 'Quick link not found' });
      return res.json({ success: true, data: mapQuickLinkRow(data) });
    } catch (err: any) {
      console.error('PATCH /api/admin/cms/quick-links/:id/active error:', err);
      return res.status(500).json({ success: false, error: safeError(err, 'Failed to update quick link') });
    }
  });

  router.delete('/cms/quick-links/:id', requireAdmin, async (req, res) => {
    try {
      if (!requireConfigured(res)) return;
      const id = String(req.params.id || '');
      if (!id) return res.status(400).json({ success: false, error: 'Quick link id is required' });
      const client = getSupabaseAdmin()!;
      const { error } = await client.from('home_quick_links').delete().eq('id', id);
      if (error) {
        return res.status(500).json({ success: false, error: safeError(error.message, 'Failed to delete quick link') });
      }
      return res.json({ success: true });
    } catch (err: any) {
      console.error('DELETE /api/admin/cms/quick-links/:id error:', err);
      return res.status(500).json({ success: false, error: safeError(err, 'Failed to delete quick link') });
    }
  });

  // Seed honest starter CMS content into Supabase (admin only)
  router.post('/cms/seed-defaults', requireAdmin, async (req, res) => {
    try {
      if (!requireConfigured(res)) return;
      const { banners, policies, quickLinks } = req.body || {};
      if (
        (banners !== undefined && !Array.isArray(banners)) ||
        (policies !== undefined && !Array.isArray(policies)) ||
        (quickLinks !== undefined && !Array.isArray(quickLinks))
      ) {
        return res.status(400).json({
          success: false,
          error: 'banners, policies, and quickLinks must be arrays when provided',
        });
      }
      if (!banners && !policies && !quickLinks) {
        return res.status(400).json({
          success: false,
          error: 'Provide at least one of banners, policies, or quickLinks',
        });
      }

      const client = getSupabaseAdmin()!;
      const out: { banners?: any[]; policies?: any[]; quickLinks?: any[] } = {};

      if (Array.isArray(banners)) {
        const bannerRows = banners.map((b: any) => ({
          id: String(b.id),
          title: String(b.title || '').trim(),
          subtitle: String(b.subtitle || ''),
          badge: String(b.tagText || b.badge || 'FEATURED'),
          cta_text: String(b.ctaText || 'Explore Now'),
          tag_color: String(b.tagColor || 'bg-indigo-600 text-white'),
          image_url: String(b.imageUrl || ''),
          action_type: String(b.actionType || 'tab'),
          action_target: String(b.actionTarget || 'discovery'),
          bg_gradient: String(b.bgGradient || 'from-indigo-950/90 via-purple-950/70 to-slate-900/90'),
          order_num: Number(b.order ?? 0),
          active: b.active ?? true,
          updated_at: new Date().toISOString(),
        }));
        const bRes = await client.from('home_banners').upsert(bannerRows, { onConflict: 'id' }).select('*');
        if (bRes.error) {
          return res.status(500).json({
            success: false,
            error: safeError(bRes.error.message, 'Failed to seed banners'),
          });
        }
        out.banners = (bRes.data || []).map(mapBannerRow);
      }

      if (Array.isArray(policies)) {
        const policyRows = policies.map((p: any) => ({
          id: String(p.id),
          slug: String(p.slug || p.id),
          title: String(p.title || '').trim(),
          category: String(p.category || 'safety'),
          icon: String(p.icon || 'ShieldCheck'),
          summary: String(p.summary || ''),
          content: String(p.content || ''),
          order_num: Number(p.order ?? 0),
          is_featured: p.isFeaturedOnHome ?? true,
          external_url: p.externalUrl || null,
          effective_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        const pRes = await client.from('cms_policies').upsert(policyRows, { onConflict: 'id' }).select('*');
        if (pRes.error) {
          return res.status(500).json({
            success: false,
            error: safeError(pRes.error.message, 'Failed to seed policies'),
          });
        }
        out.policies = (pRes.data || []).map(mapPolicyRow);
      }

      if (Array.isArray(quickLinks)) {
        const linkRows = quickLinks.map((l: any) => ({
          id: String(l.id),
          title: String(l.title || '').trim(),
          subtitle: String(l.subtitle || ''),
          icon: String(l.icon || 'Zap'),
          badge: l.badge ? String(l.badge) : null,
          action_type: String(l.actionType || 'tab'),
          action_target: String(l.actionTarget || 'discovery'),
          color_gradient: String(l.colorGradient || 'from-indigo-500 to-purple-600'),
          order_num: Number(l.order ?? 0),
          active: l.active ?? true,
        }));
        const lRes = await client.from('home_quick_links').upsert(linkRows, { onConflict: 'id' }).select('*');
        if (lRes.error) {
          return res.status(500).json({
            success: false,
            error: safeError(lRes.error.message, 'Failed to seed quick links'),
          });
        }
        out.quickLinks = (lRes.data || []).map(mapQuickLinkRow);
      }

      return res.json({ success: true, data: out });
    } catch (err: any) {
      console.error('POST /api/admin/cms/seed-defaults error:', err);
      return res.status(500).json({ success: false, error: safeError(err, 'Failed to seed CMS defaults') });
    }
  });

  return router;
}
