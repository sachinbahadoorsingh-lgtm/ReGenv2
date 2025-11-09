async function postJSON(url, payload) {
  const res = await fetch(url, {
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

const form = document.getElementById('loginForm');
const msg = document.getElementById('loginMsg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = 'Authenticating…';
  msg.className = 'msg';

  const userName = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const database = document.getElementById('database').value.trim();

  try {
    const result = await postJSON('/api/authenticate', { userName, password, database });
    localStorage.setItem('geotab_ctx', JSON.stringify({
      baseUrl: result.baseUrl,
      database: result.database,
      sessionId: result.sessionId,
      userName
    }));
    msg.textContent = 'Success! Redirecting…';
    msg.className = 'msg ok';
    setTimeout(() => location.href = '/dashboard.html', 400);
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'msg err';
  }
});
