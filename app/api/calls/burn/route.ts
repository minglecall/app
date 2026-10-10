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

  if (
    body.coinsBurned != null ||
    body.hostCoinsEarned != null ||
    body.tlCoinsEarned != null ||
    body.coins != null ||
    body.amount != null
  ) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Client must not supply coin amounts; rates are server-derived.',
          code: 'CLIENT_AMOUNTS_FORBIDDEN',
        },
      },
      { status: 400 }
    );
  }

  const { handleCore } = require('../../../../api/_lib/cjs/coreRoutes');

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const nodeReq: any = {
    method: 'POST',
    headers,
    url: '/api/calls/burn',
    body,
  };

  let statusCode = 200;
  let responseBody = '';
  const nodeRes: any = {
    statusCode: 200,
    setHeader() {},
    end(data: string) {
      responseBody = typeof data === 'string' ? data : String(data || '');
    },
  };

  await handleCore('calls/burn', nodeReq, nodeRes);
  statusCode = nodeRes.statusCode || 200;

  try {
    const parsed = responseBody ? JSON.parse(responseBody) : { success: false };
    return NextResponse.json(parsed, { status: statusCode });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Invalid burn response' } },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
