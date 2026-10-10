import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';

export const runtime = 'nodejs';
export const maxDuration = 15;

const require = createRequire(import.meta.url);

export async function GET(req: NextRequest) {
  const { handleCore } = require('../../../../api/_lib/cjs/coreRoutes');
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const nodeReq: any = { method: 'GET', headers, url: '/api/calls/incoming', body: {} };
  let responseBody = '';
  const nodeRes: any = {
    statusCode: 200,
    setHeader() {},
    end(data: string) {
      responseBody = typeof data === 'string' ? data : String(data || '');
    },
  };

  await handleCore('calls/incoming', nodeReq, nodeRes);
  try {
    return NextResponse.json(responseBody ? JSON.parse(responseBody) : { success: false }, {
      status: nodeRes.statusCode || 200,
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
