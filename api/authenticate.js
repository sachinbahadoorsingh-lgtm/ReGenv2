export const config = { runtime: 'edge' };
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

const DEFAULT_BASE = 'https://my.geotab.com';

function normalizeBaseUrl(pathFromAuth) {
  if (!pathFromAuth || pathFromAuth === 'ThisServer') return DEFAULT_BASE;
  let url = String(pathFromAuth).trim();
  if (url.startsWith('//')) url = 'https:' + url;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url.replace(/\/+$/, '');
}

async function rpc(baseUrl, body) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/apiv1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    return new Response(await res.text(), { status: res.status });
  }
  const data = await res.json();
  if (data.error) {
    return new Response(`RPC Error ${data.error.code}: ${data.error.message}`, { status: 400 });
  }
  return data.result;
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const { userName, password, database } = await req.json();

  if (!userName || !password || !database) {
    return new Response('Missing userName/password/database', { status: 400 });
  }

  const result = await rpc(DEFAULT_BASE, {
    jsonrpc: '2.0',
    method: 'Authenticate',
    params: { userName, password, database },
    id: 1
  });

  if (result instanceof Response) return result;

  const sessionId = result?.credentials?.sessionId;
  const db = result?.credentials?.database || database;
  const baseUrl = normalizeBaseUrl(result?.path);

  if (!sessionId) {
    return new Response('Authenticate returned no sessionId', { status: 400 });
  }

  return json({ baseUrl, database: db, sessionId });
}