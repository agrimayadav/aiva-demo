// Shared lead store (localStorage) for both screens.
window.Store = (function () {
  const KEY = 'aiva_leads';
  const all = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const save = list => localStorage.setItem(KEY, JSON.stringify(list));
  function upsert(lead) { const l = all(); const i = l.findIndex(x => x.id === lead.id); if (i >= 0) l[i] = Object.assign(l[i], lead); else l.unshift(lead); save(l); }
  function patch(id, p) { const l = all(); const x = l.find(y => y.id === id); if (x) { Object.assign(x, p); save(l); } }
  function clear() { localStorage.removeItem(KEY); }
  return { all, upsert, patch, clear };
})();
