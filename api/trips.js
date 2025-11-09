export const config = { runtime: 'edge' };
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

async function rpc(baseUrl, body) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/apiv1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) return new Response(await res.text(), { status: res.status });
  const data = await res.json();
  if (data.error) return new Response(`RPC Error ${data.error.code}: ${data.error.message}`, { status: 400 });
  return data.result;
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const { ctx, fromDate, toDate, limit = 100000 } = await req.json();
  if (!ctx?.baseUrl || !ctx?.sessionId || !ctx?.database || !ctx?.userName) {
    return new Response('Missing ctx', { status: 400 });
  }
  if (!fromDate || !toDate) return new Response('Missing fromDate/toDate', { status: 400 });

  const result = await rpc(ctx.baseUrl, {
    jsonrpc: '2.0',
    method: 'Get',
    params: {
      typeName: 'Trip',
      search: { fromDate, toDate },
      resultsLimit: limit
    },
    credentials: { userName: ctx.userName, sessionId: ctx.sessionId, database: ctx.database },
    id: 5
  });
  if (result instanceof Response) return result;
  return json(result);
}