import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';

function showBootError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err || 'Unknown boot error');
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;padding:24px;text-align:center">
        <div style="max-width:420px">
          <h1 style="font-size:1.25rem;font-weight:800;margin:0 0 8px">App failed to start</h1>
          <p style="opacity:.8;font-size:.875rem;margin:0 0 16px">${message.replace(/</g, '&lt;')}</p>
          <p style="opacity:.6;font-size:.75rem;margin:0 0 16px">
            Clear site data for minglecall.com (or remove localStorage key
            <code>minglecall_supabase_client_override</code>), then reload.
            Confirm Vercel env has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then Redeploy.
          </p>
          <button onclick="location.reload()" style="padding:10px 16px;border-radius:12px;border:0;background:#ec4899;color:#fff;font-weight:700;cursor:pointer">
            Reload
          </button>
        </div>
      </div>
    `;
  }
  console.error('[boot]', err);
}

async function boot() {
  try {
    const [{ default: App }, { registerSW }] = await Promise.all([
      import('./App.tsx'),
      import('virtual:pwa-register'),
    ]);

    registerSW({
      onNeedRefresh() {
        console.log('[PWA] New content available, reloading...');
      },
      onOfflineReady() {
        console.log('[PWA] App is ready to work offline');
      },
    });

    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (err) {
    showBootError(err);
  }
}

boot();
