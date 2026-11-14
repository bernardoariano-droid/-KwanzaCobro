import healthHandler from '../../api/health.js';
import authMeHandler from '../../api/auth/me.js';
import authRegisterHandler from '../../api/auth/register.js';
import adminUsersHandler from '../../api/admin/users.js';
import adminCompaniesHandler from '../../api/admin/companies.js';
import resetSuperAdminPasswordHandler from '../../api/admin/reset-super-admin-password.js';
import supabaseStatusHandler from '../../api/supabase/status.js';
import supabasePullHandler from '../../api/supabase/pull.js';
import supabaseSyncHandler from '../../api/supabase/sync.js';
import supabaseSchemaHandler from '../../api/supabase/schema.js';
import dataIndexHandler from '../../api/data/index.js';
import dataSyncHandler from '../../api/data/sync.js';
import smsSendHandler from '../../api/sms/send-verification.js';
import smsVerifyHandler from '../../api/sms/verify-code.js';
import smsReceiptHandler from '../../api/sms/verify-receipt.js';

interface NetlifyEvent {
  path?: string;
  rawUrl?: string;
  httpMethod?: string;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
}

interface NetlifyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function createVercelAdapter(event: NetlifyEvent, extraQuery: Record<string, string> = {}) {
  let parsedBody: any = {};
  if (event.body) {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = rawBody;
    }
  }

  const req: any = {
    method: (event.httpMethod || 'GET').toUpperCase(),
    headers: event.headers || {},
    query: {
      ...(event.queryStringParameters || {}),
      ...extraQuery,
    },
    body: parsedBody,
  };

  let statusCode = 200;
  const responseHeaders: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
  };
  let responseBody = '';

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    setHeader(name: string, value: string) {
      responseHeaders[name] = value;
      return res;
    },
    json(data: any) {
      responseHeaders['Content-Type'] = 'application/json; charset=utf-8';
      responseBody = JSON.stringify(data);
      return res;
    },
    send(data: any) {
      responseBody = typeof data === 'string' ? data : JSON.stringify(data);
      return res;
    },
    end(data?: any) {
      if (data !== undefined) {
        responseBody = typeof data === 'string' ? data : JSON.stringify(data);
      }
      return res;
    },
  };

  return {
    req,
    res,
    toNetlifyResponse(): NetlifyResponse {
      return {
        statusCode,
        headers: responseHeaders,
        body: responseBody,
      };
    },
  };
}

function normalizeApiPath(rawPath?: string): string {
  const pathStr = String(rawPath || '/').split('?')[0];
  return pathStr
    .replace(/^\/\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    .replace(/\/+$/, '') || '/';
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Super-Admin-Reset-Token',
      },
      body: '',
    };
  }

  const route = normalizeApiPath(event.path || event.rawUrl);
  let extraQuery: Record<string, string> = {};
  let targetHandler: ((req: any, res: any) => Promise<any>) | null = null;

  if (route === '/health') targetHandler = healthHandler;
  else if (route === '/auth/me') targetHandler = authMeHandler;
  else if (route === '/auth/register') targetHandler = authRegisterHandler;
  else if (route === '/admin/users') targetHandler = adminUsersHandler;
  else if (route === '/admin/companies') targetHandler = adminCompaniesHandler;
  else if (route === '/admin/reset-super-admin-password') targetHandler = resetSuperAdminPasswordHandler;
  else if (route === '/supabase/status') targetHandler = supabaseStatusHandler;
  else if (route === '/supabase/pull') targetHandler = supabasePullHandler;
  else if (route === '/supabase/sync') targetHandler = supabaseSyncHandler;
  else if (route === '/supabase/schema') targetHandler = supabaseSchemaHandler;
  else if (route === '/data') targetHandler = dataIndexHandler;
  else if (route === '/data/sync') targetHandler = dataSyncHandler;
  else if (route === '/sms/send-verification') targetHandler = smsSendHandler;
  else if (route === '/sms/verify-code') targetHandler = smsVerifyHandler;
  else if (route === '/sms/verify-receipt') targetHandler = smsReceiptHandler;
  else if (route.startsWith('/sms/verify-receipt/')) {
    targetHandler = smsReceiptHandler;
    extraQuery = { transactionId: decodeURIComponent(route.replace('/sms/verify-receipt/', '')) };
  }

  if (!targetHandler) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ success: false, error: `Endpoint não encontrado: /api${route}` }),
    };
  }

  const adapter = createVercelAdapter(event, extraQuery);
  await targetHandler(adapter.req, adapter.res);
  return adapter.toNetlifyResponse();
};
