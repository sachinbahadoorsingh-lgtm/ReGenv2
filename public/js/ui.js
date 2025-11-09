export function setStatus(el, text, cls='') {
  el.textContent = text;
  el.className = 'msg ' + (cls || '');
}

export function renderTable(tableEl, headers, rows) {
  const thead = tableEl.querySelector('thead');
  const tbody = tableEl.querySelector('tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const tr = document.createElement('tr');
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  rows.forEach(r => {
    const trb = document.createElement('tr');
    r.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      trb.appendChild(td);
    });
    tbody.appendChild(trb);
  });
}

export function copyTableToClipboard(tableEl) {
  const rows = [];
  tableEl.querySelectorAll('tr').forEach(tr => {
    const cells = Array.from(tr.children).map(td => td.textContent.replace(/\t/g, ' '));
    rows.push(cells.join('\t'));
  });
  const text = rows.join('\n');
  navigator.clipboard.writeText(text);
}
