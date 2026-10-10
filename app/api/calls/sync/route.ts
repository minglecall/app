import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';

export const runtime = 'nodejs';
export const maxDuration = 30;

const require = createRequire(import.meta.url);

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { handleCore } = require('../../../../api/_lib/cjs/coreRoutes');
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const nodeReq: any = { method: 'POST', headers, url: '/api/calls/sync', body };
  let responseBody = '';
  const nodeRes: any = {
    statusCode: 200,
    setHeader() {},
    end(data: string) {
      responseBody = typeof data === 'string' ? data : String(data || '');
    },
  };

  await handleCore('calls/sync', nodeReq, nodeRes);
  try {
    return NextResponse.json(responseBody ? JSON.parse(responseBody) : { success: false }, {
      status: nodeRes.statusCode || 200,
    });
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid sync response' } }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
