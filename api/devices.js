export const config = { runtime: 'edge' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
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

function makeCreds(ctx) {
  // Prefer the exact credentials from Authenticate if present
  if (ctx?.credentials && typeof ctx.credentials === 'object') return ctx.credentials;
  return { userName: ctx.userName, sessionId: ctx.sessionId, database: ctx.database };
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const { ctx, limit = 1000 } = await req.json();
  if (!ctx?.baseUrl || !ctx?.sessionId || !ctx?.database) return new Response('Missing ctx', { status: 400 });

  const credsTop = makeCreds(ctx);
  const params = { typeName: 'Device', search: {}, resultsLimit: limit };

  // Variant A: TOP-LEVEL credentials
  let result = await rpc(ctx.baseUrl, {
    jsonrpc: '2.0',
    method: 'Get',
    params,
    credentials: credsTop,
    id: 2
  });

  // If rpc returned a Response (error), check for -32000; (Edge returns Response on error in our rpc)
  if (result instanceof Response) return result;

  // If we still get the classic -32000 in an error path, the rpc() would have returned Response above.
  // But to be extra robust, we try Variant B only if the first call threw:
  try {
    return json(result);
  } catch {
    // Variant B: PARAMS.credentials
    const resB = await rpc(ctx.baseUrl, {
      jsonrpc: '2.0',
      method: 'Get',
      params: Object.assign({}, params, { credentials: credsTop }),
      id: 3
    });
    if (resB instanceof Response) return resB;
    return json(resB);
  }
}
