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

  try {
    const { handleAuth } = require('../../../../api/_lib/cjs/authRoutes');
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const nodeReq: any = {
      method: 'POST',
      headers,
      url: '/api/auth/login-password',
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

    const handled = await handleAuth('auth/login-password', nodeReq, nodeRes);
    if (handled === null && !responseBody) {
      return NextResponse.json(
        { success: false, error: 'Auth handler unavailable', code: 'NO_AUTH_HANDLER' },
        { status: 503 }
      );
    }

    const parsed = responseBody ? JSON.parse(responseBody) : { success: false };
    return NextResponse.json(parsed, { status: nodeRes.statusCode || 200 });
  } catch (err: any) {
    console.error('[next/api/auth/login-password]', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Unable to connect to authentication server.',
        code: 'AUTH_BRIDGE_FAILED',
      },
      { status: 503 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
