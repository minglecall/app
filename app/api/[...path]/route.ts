/**
 * Catch-all: bridge remaining /api/* traffic to the existing CJS Vercel router
 * so Next.js can host the app without rewriting every Express route at once.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';

export const runtime = 'nodejs';
export const maxDuration = 30;

const require = createRequire(import.meta.url);

async function bridge(req: NextRequest, pathParts: string[]) {
  const path = pathParts.join('/');
  // Standalone / Next-native routes are handled by more specific files
  const reserved = new Set([
    'presence',
    'presence/heartbeat',
    'messages',
    'calls/burn',
    'calls/sync',
    'calls/incoming',
    'livekit/token',
  ]);
  if (reserved.has(path)) {
    return NextResponse.json(
      { success: false, error: { message: 'Route should use dedicated handler', code: 'RESERVED' } },
      { status: 501 }
    );
  }

  let body: any = {};
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  const router = require('../../../api/router.js');
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const nodeReq: any = {
    method: req.method,
    headers,
    url: `/api/${path}${req.nextUrl.search}`,
    query: { path },
    body,
  };

  let responseBody = '';
  const nodeRes: any = {
    statusCode: 200,
    setHeader() {},
    end(data: string) {
      responseBody = typeof data === 'string' ? data : String(data || '');
    },
  };

  await router(nodeReq, nodeRes);

  try {
    const parsed = responseBody ? JSON.parse(responseBody) : { success: true };
    return NextResponse.json(parsed, { status: nodeRes.statusCode || 200 });
  } catch {
    return new NextResponse(responseBody || '', {
      status: nodeRes.statusCode || 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return bridge(req, path || []);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return bridge(req, path || []);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return bridge(req, path || []);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return bridge(req, path || []);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return bridge(req, path || []);
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
