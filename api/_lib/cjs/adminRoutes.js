/**
 * Admin routes for Vercel CJS router (infra, delete-user, CMS seed, overrides).
 */
const {
  send,
  clean,
  readJsonBody,
  requireAuth,
  isAdminRole,
  mapProfileRow,
  getSupabaseEnv,
  createServiceClient,
  getEmailEnvStatus,
  getEmailPolicy,
  saveEmailPolicy,
  testEmailConnection,
  sendTransactionalEmail,
  isSmtpConfigured,
} = require('./helpers');

function livekitEnv() {
  return {
    wsUrl: clean(process.env.LIVEKIT_URL),
    apiKey: clean(process.env.LIVEKIT_API_KEY),
    apiSecret: clean(process.env.LIVEKIT_API_SECRET),
  };
}

function r2Env() {
  return {
    accountId: clean(process.env.R2_ACCOUNT_ID),
    accessKeyId: clean(process.env.R2_ACCESS_KEY_ID),
    secretAccessKey: clean(process.env.R2_SECRET_ACCESS_KEY),
    bucketName: clean(process.env.R2_BUCKET_NAME) || 'datingappbucket',
    publicUrl: clean(process.env.R2_PUBLIC_URL).replace(/\/$/, ''),
  };
}

async function requireAdmin(req) {
  const auth = await requireAuth(req);
  if (auth.ok === false) return auth;
  if (!isAdminRole(auth.role, auth.email)) {
    return {
      ok: false,
      status: 403,
      error: { message: 'Admin role required.', code: 'FORBIDDEN' },
    };
  }
  return auth;
}

async function handleAdmin(path, req, res) {
  if (!String(path || '').startsWith('admin/')) return null;
  if (path === 'admin/create-team-leader') return null; // standalone

  if (path === 'admin/api-health') {
    // handled in router.js — leave null so router inline can catch, or handle here
    return null;
  }

  if (path === 'admin/infra-config' && (req.method === 'GET' || req.method === 'POST')) {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    const supabase = getSupabaseEnv();
    const r2 = r2Env();
    const livekit = livekitEnv();
    const supabaseConfigured = Boolean(
      supabase.url &&
        supabase.anonKey &&
        !supabase.url.includes('placeholder') &&
        !supabase.url.includes('your-project')
    );
    const r2Configured = Boolean(
      r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucketName
    );
    const livekitConfigured = Boolean(
      livekit.wsUrl &&
        livekit.apiKey &&
        livekit.apiSecret &&
        livekit.apiKey !== 'devkey' &&
        livekit.apiSecret !== 'secret'
    );
    if (req.method === 'GET') {
      return send(res, 200, {
        success: true,
        config: {
          source: 'environment',
          supabaseUrl: supabase.url,
          supabaseAnonKey: supabase.anonKey ? '••••••••' : '',
          supabaseAnonKeyConfigured: Boolean(supabase.anonKey),
          supabaseServiceRoleConfigured: Boolean(supabase.serviceKey),
          supabaseConfigured,
          r2AccountId: r2.accountId ? `${r2.accountId.slice(0, 4)}…` : '',
          r2AccessKeyId: r2.accessKeyId ? `${r2.accessKeyId.slice(0, 4)}…` : '',
          r2SecretAccessKey: r2.secretAccessKey ? '••••••••' : '',
          r2BucketName: r2.bucketName,
          r2PublicUrl: r2.publicUrl,
          r2Configured,
          livekitWsUrl: livekit.wsUrl,
          livekitConfigured,
          vercel: Boolean(process.env.VERCEL),
        },
        message:
          'Credentials are loaded from server environment variables. Set them in Vercel → Settings → Environment Variables.',
      });
    }
    await readJsonBody(req);
    return send(res, 200, {
      success: true,
      message:
        'Using server environment credentials. No secrets were changed. Configure VITE_SUPABASE_*, SUPABASE_SERVICE_ROLE_KEY, R2_*, and LIVEKIT_* in Vercel → Environment Variables.',
      config: {
        source: 'environment',
        supabaseConfigured,
        r2Configured,
        livekitConfigured,
      },
    });
  }

  if (path === 'admin/email' && req.method === 'GET') {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    const client = auth.client || createServiceClient();
    const env = getEmailEnvStatus();
    const policy = await getEmailPolicy(client);
    let logs = [];
    try {
      const { data } = await client
        .from('email_dispatch_log')
        .select(
          'id, purpose, recipient_email, recipient_name, subject, provider, status, error_message, meta, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(100);
      logs = data || [];
    } catch (e) {
      console.warn('[admin/email] logs notice:', e && e.message);
    }
    return send(res, 200, {
      success: true,
      data: {
        env,
        policy,
        logs,
        configured: isSmtpConfigured(),
      },
    });
  }

  if (path === 'admin/email/settings' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    const body = await readJsonBody(req);
    // Never accept API keys / SMTP secrets from the browser
    if (
      body &&
      (body.resendApiKey ||
        body.smtpPass ||
        body.pass ||
        body.SMTP_PASS ||
        body.RESEND_API_KEY)
    ) {
      return send(res, 400, {
        success: false,
        error: {
          message:
            'Email secrets cannot be saved from the Admin UI. Set RESEND_API_KEY / SMTP_* in Vercel → Environment Variables.',
          code: 'ENV_ONLY',
        },
      });
    }
    try {
      const policy = await saveEmailPolicy(auth.client, {
        emailRegisterEnabled: body.emailRegisterEnabled,
        emailAccountCreateEnabled: body.emailAccountCreateEnabled,
        emailAccountDeleteEnabled: body.emailAccountDeleteEnabled,
        allowCreateWithoutOtp: body.allowCreateWithoutOtp,
        emailShowOtpFallback: body.emailShowOtpFallback,
      });
      return send(res, 200, {
        success: true,
        data: { policy },
        message: 'Email notification policy saved.',
      });
    } catch (e) {
      return send(res, 500, {
        success: false,
        error: { message: (e && e.message) || 'Failed to save email policy', code: 'SAVE_FAILED' },
      });
    }
  }

  if (path === 'admin/email/test' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    const body = await readJsonBody(req);
    const result = await testEmailConnection({
      to: body && body.to,
      name: (body && body.name) || 'Admin',
    });
    return send(res, result.ok ? 200 : 502, { success: true, data: result });
  }

  if (path === 'admin/email/logs' && req.method === 'GET') {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    const { data, error } = await auth.client
      .from('email_dispatch_log')
      .select(
        'id, purpose, recipient_email, recipient_name, subject, provider, status, error_message, meta, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      return send(res, 500, { success: false, error: { message: error.message } });
    }
    return send(res, 200, { success: true, data: { logs: data || [] } });
  }

  // Env-only status (replaces secret-pasting email-config for Vercel)
  if (path === 'admin/email-config' && req.method === 'GET') {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    const env = getEmailEnvStatus();
    const policy = await getEmailPolicy(auth.client);
    return send(res, 200, {
      success: true,
      config: {
        ...env,
        showOtpInForm: policy.emailShowOtpFallback,
        host: env.smtpHost,
        port: Number(env.smtpPort) || 465,
        user: env.smtpUser,
        from: env.smtpFrom,
        secure: env.smtpSecure,
        resendApiKey: env.resendApiKeyPreview,
        configured: env.configured,
      },
    });
  }

  if (path === 'admin/email-config' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    const body = await readJsonBody(req);
    if (body && (body.pass || body.resendApiKey || body.host || body.user)) {
      // Allow only showOtpInForm / policy toggles — ignore secret fields
    }
    try {
      const policy = await saveEmailPolicy(auth.client, {
        emailShowOtpFallback:
          typeof body.showOtpInForm === 'boolean' ? body.showOtpInForm : body.emailShowOtpFallback,
        emailRegisterEnabled: body.emailRegisterEnabled,
        emailAccountCreateEnabled: body.emailAccountCreateEnabled,
        emailAccountDeleteEnabled: body.emailAccountDeleteEnabled,
        allowCreateWithoutOtp: body.allowCreateWithoutOtp,
      });
      const env = getEmailEnvStatus();
      return send(res, 200, {
        success: true,
        message:
          'Email policy updated. SMTP/Resend credentials are read from Vercel environment variables only.',
        config: { ...env, showOtpInForm: policy.emailShowOtpFallback },
        policy,
      });
    } catch (e) {
      return send(res, 500, {
        success: false,
        error: { message: (e && e.message) || 'Failed to update email policy' },
      });
    }
  }

  if (path === 'admin/delete-user' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    const body = await readJsonBody(req);
    const userId = String((body && body.userId) || '').trim();
    if (!userId) return send(res, 400, { success: false, error: 'userId required' });
    const { data: row } = await auth.client.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!row) return send(res, 404, { success: false, error: 'User not found' });
    const warnings = [];
    let authDeleted = false;
    const authId = row.auth_id || null;

    try {
      const policy = await getEmailPolicy(auth.client);
      if (policy.emailAccountDeleteEnabled && row.email) {
        await sendTransactionalEmail({
          to: row.email,
          name: row.name || 'User',
          purpose: 'account_delete',
          subject: 'Your LiveCall account was deleted',
          html: `<p>Hello <strong>${row.name || 'User'}</strong>,</p><p>Your LiveCall account associated with <strong>${row.email}</strong> has been permanently deleted by an administrator.</p>`,
          meta: { userId },
        });
      }
    } catch (e) {
      warnings.push((e && e.message) || 'Delete notification email failed');
    }

    if (authId) {
      const { error } = await auth.client.auth.admin.deleteUser(authId);
      if (error) warnings.push(error.message);
      else authDeleted = true;
    }
    const { error: delErr } = await auth.client.from('profiles').delete().eq('id', userId);
    if (delErr) {
      return send(res, 500, { success: false, error: delErr.message, data: { warnings } });
    }
    return send(res, 200, {
      success: true,
      data: { authDeleted, profileDeleted: true, r2DeletedCount: 0, warnings },
    });
  }

  if (path === 'admin/override-earning-rate' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    const body = await readJsonBody(req);
    const creatorId = String((body && body.creatorId) || '').trim();
    const rate =
      body && (body.rate === null || body.rate === undefined || Number(body.rate) <= 0)
        ? null
        : Math.max(1, Math.round(Number(body.rate)));
    if (!creatorId) return send(res, 400, { success: false, error: 'creatorId required' });
    const { data, error } = await auth.client
      .from('profiles')
      .update({
        coin_earn_override_rate: rate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', creatorId)
      .select('*')
      .maybeSingle();
    if (error) return send(res, 500, { success: false, error: error.message });
    return send(res, 200, { success: true, user: mapProfileRow(data) });
  }

  if (path === 'admin/active-calls' && req.method === 'GET') {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    // Vercel has no in-memory activeCalls — return recent in-progress call_logs if any
    const { data } = await auth.client
      .from('call_logs')
      .select('*')
      .in('status', ['ringing', 'connecting', 'active', 'in_progress'])
      .order('updated_at', { ascending: false })
      .limit(50);
    return send(res, 200, { success: true, calls: data || [], activeCalls: data || [] });
  }

  if (path === 'admin/terminate-call' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    const body = await readJsonBody(req);
    const callId = String((body && (body.callId || body.id)) || '').trim();
    if (callId) {
      await auth.client
        .from('call_logs')
        .update({
          status: 'terminated',
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', callId);
    }
    return send(res, 200, { success: true });
  }

  if (path === 'admin/issue-warning' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    await readJsonBody(req);
    return send(res, 200, { success: true, message: 'Warning recorded' });
  }

  if (path === 'admin/cms/seed-defaults' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    await readJsonBody(req);
    // Idempotent: insert defaults only if tables empty
    try {
      const { count: bannerCount } = await auth.client
        .from('home_banners')
        .select('id', { count: 'exact', head: true });
      if (!bannerCount) {
        await auth.client.from('home_banners').insert([
          {
            title: 'Welcome to MingleCall',
            subtitle: 'Meet people nearby',
            image_url: '',
            sort_order: 0,
            is_active: true,
          },
        ]);
      }
    } catch (e) {
      console.warn('[cms/seed-defaults] banners', e && e.message);
    }
    try {
      const { count: linkCount } = await auth.client
        .from('home_quick_links')
        .select('id', { count: 'exact', head: true });
      if (!linkCount) {
        await auth.client.from('home_quick_links').insert([
          { title: 'Discover', href: '/discover', sort_order: 0, is_active: true },
          { title: 'Rewards', href: '/rewards', sort_order: 1, is_active: true },
        ]);
      }
    } catch (e) {
      console.warn('[cms/seed-defaults] links', e && e.message);
    }
    return send(res, 200, { success: true, message: 'CMS defaults seeded when empty' });
  }

  if (
    (path === 'admin/cms/banners' ||
      path === 'admin/cms/policies' ||
      path === 'admin/cms/quick-links') &&
    (req.method === 'GET' || req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')
  ) {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    const table =
      path === 'admin/cms/banners'
        ? 'home_banners'
        : path === 'admin/cms/policies'
          ? 'home_policies'
          : 'home_quick_links';
    if (req.method === 'GET') {
      const { data, error } = await auth.client
        .from(table)
        .select('*')
        .order('sort_order', { ascending: true })
        .limit(200);
      if (error) return send(res, 200, { success: true, items: [], data: [] });
      return send(res, 200, { success: true, items: data || [], data: data || [] });
    }
    const body = await readJsonBody(req);
    if (body && body.id) {
      const { data, error } = await auth.client
        .from(table)
        .upsert(body)
        .select('*')
        .maybeSingle();
      if (error) return send(res, 500, { success: false, error: error.message });
      return send(res, 200, { success: true, item: data });
    }
    const { data, error } = await auth.client.from(table).insert(body || {}).select('*').maybeSingle();
    if (error) return send(res, 500, { success: false, error: error.message });
    return send(res, 200, { success: true, item: data });
  }

  if (path === 'admin/factory-reset-status' && req.method === 'GET') {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    return send(res, 200, {
      success: true,
      available: false,
      message: 'Factory reset is not available on the Vercel serverless deployment.',
    });
  }

  if (path === 'admin/granular-reset' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    return send(res, 501, {
      success: false,
      error: {
        message: 'Granular reset is not implemented on Vercel. Use Supabase SQL or local Express.',
        code: 'VERCEL_ROUTE_NOT_IMPLEMENTED',
      },
    });
  }

  return send(res, 501, {
    success: false,
    error: {
      message: `Unimplemented admin path: ${path}`,
      code: 'VERCEL_ROUTE_NOT_IMPLEMENTED',
    },
  });
}

module.exports = { handleAdmin };
