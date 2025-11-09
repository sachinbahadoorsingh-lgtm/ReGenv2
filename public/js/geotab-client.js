export async function apiPost(path, payload) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

export function getCtx() {
  const raw = localStorage.getItem('geotab_ctx');
  if (!raw) return null;
  return JSON.parse(raw);
}

export function ensureCtxOrRedirect() {
  const ctx = getCtx();
  if (!ctx) location.href = '/index.html';
  return ctx;
}
