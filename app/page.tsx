'use client';

import dynamic from 'next/dynamic';

/** Port existing Vite SPA shell into Next App Router (no UI redesign). */
const App = dynamic(() => import('../src/App'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      Loading LiveCall…
    </div>
  ),
});

export default function HomePage() {
  return <App />;
}
