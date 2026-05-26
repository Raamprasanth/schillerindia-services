(function(){
  let activeBox = null;
  let activeTarget = null;

  function esc(s){
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function readValue(row, key){
    if (!row) return '';
    if (typeof key === 'function') return key(row);
    return row[key];
  }

  function recentValues(data, keys){
    const out = [];
    const seen = new Set();
    (Array.isArray(data) ? data : []).forEach(row => {
      (Array.isArray(keys) ? keys : [keys]).forEach(key => {
        const value = String(readValue(row, key) ?? '').trim();
        const norm = value.toLowerCase();
        if (value && !seen.has(norm)) {
          seen.add(norm);
          out.push(value);
        }
      });
    });
    return out.slice(0, 3);
  }

  function close(){
    if (activeBox) activeBox.remove();
    activeBox = null;
    activeTarget = null;
  }

  function show(target, values){
    close();
    if (!target || !values.length || target.disabled || target.readOnly) return;
    const rect = target.getBoundingClientRect();
    const box = document.createElement('div');
    box.className = 'repair-suggestion-box';
    box.style.left = (rect.left + window.scrollX) + 'px';
    box.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    box.style.width = Math.max(rect.width, 180) + 'px';
    box.innerHTML = values.map(v => `<button type="button" class="repair-suggestion-item">${esc(v)}</button>`).join('');
    box.addEventListener('mousedown', e => {
      const btn = e.target.closest('.repair-suggestion-item');
      if (!btn) return;
      e.preventDefault();
      target.value = btn.textContent;
      target.dispatchEvent(new Event('input', { bubbles:true }));
      close();
    });
    document.body.appendChild(box);
    activeBox = box;
    activeTarget = target;
  }

  function ensureStyle(){
    if (document.getElementById('repair-suggestion-style')) return;
    const style = document.createElement('style');
    style.id = 'repair-suggestion-style';
    style.textContent = `
      .repair-suggestion-box{position:absolute;z-index:1000;background:var(--surface,#fff);border:1px solid var(--border,#d0d7de);border-radius:8px;box-shadow:0 10px 28px rgba(15,34,54,0.16);overflow:hidden;padding:4px;font-family:Calibri,Arial,sans-serif;}
      .repair-suggestion-item{display:block;width:100%;border:0;background:transparent;color:var(--text,#111827);font:700 14px Calibri,Arial,sans-serif;text-align:left;padding:8px 10px;border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .repair-suggestion-item:hover{background:var(--surface2,#eef2f7);color:var(--accent,#059669);}
    `;
    document.head.appendChild(style);
  }

  function bind(map, getData){
    ensureStyle();
    Object.entries(map || {}).forEach(([id, keys]) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.repairSuggestBound === '1') return;
      el.dataset.repairSuggestBound = '1';
      const open = () => show(el, recentValues(getData ? getData() : [], keys));
      el.addEventListener('focus', open);
      el.addEventListener('click', open);
      el.addEventListener('keydown', e => {
        if (e.key === 'Escape') close();
      });
    });
  }

  document.addEventListener('mousedown', e => {
    if (!activeBox) return;
    if (e.target === activeTarget || activeBox.contains(e.target)) return;
    close();
  });
  window.addEventListener('scroll', close, true);
  window.addEventListener('resize', close);

  window.RepairSuggestions = { bind };
})();
