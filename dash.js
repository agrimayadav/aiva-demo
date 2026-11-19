// Screen 2: front-desk view. Reads leads from localStorage (Store) + fictional sample leads.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BASELINE = 30;
  const now = Date.now(), m = n => now - n * 60000;

  const T = (...pairs) => pairs.map(([who, text]) => ({ who, text }));
  const SAMPLE = [
    { id: 's1', time: m(3), lang: 'Hindi', source: 'Instagram ad', treatment: 'root canal', clinic: null, slot: null, name: null, outcome: 'handoff', priority: 'P0', reason: 'Urgent symptom reported', next: 'Call within 15 minutes; dentist to assess urgency.', summary: 'Urgent symptom reported. Interested in root canal. Caller said: "दांत में बहुत दर्द है, गाल सूज गया है". Spoke Hindi.', durationSec: 41, transcript: T(['AIVA', 'नमस्ते! मैं AIVA हूँ, HappySmile Dental की AI असिस्टेंट…'], ['Caller', 'हाँ'], ['Caller', 'दांत में बहुत दर्द है, गाल सूज गया है'], ['AIVA', 'मैंने इसे अर्जेंट मार्क कर दिया है, हमारी टीम 15 मिनट में आपको कॉल करेगी…']) },
    { id: 's2', time: m(9), lang: 'English', source: 'Website enquiry', treatment: 'braces', clinic: 'Koramangala', slot: 'Friday 6 PM', name: 'Neha S.', outcome: 'booked', confidence: 100, booked: true, summary: 'Booked braces consultation at Koramangala, Friday 6 PM, for Neha S. Spoke English.', durationSec: 74 },
    { id: 's3', time: m(14), lang: 'English', source: 'Google ad', treatment: 'braces', clinic: 'Indiranagar', slot: null, name: null, outcome: 'handoff', priority: 'P1', reason: 'Price / EMI / insurance discussion', next: 'Explain EMI and payment options, then offer a slot.', summary: 'Price / EMI / insurance discussion. Interested in braces at Indiranagar. Caller said: "can I pay in EMI for my son\'s braces". Spoke English.', durationSec: 52 },
    { id: 's4', time: m(22), lang: 'English', source: 'Listing site', treatment: 'teeth whitening', clinic: 'Indiranagar', slot: 'Saturday 11 AM', name: 'Karan', outcome: 'booked', confidence: 65, booked: true, summary: 'Booked teeth whitening consultation at Indiranagar, Saturday 11 AM, for Karan. Spoke English. Slot choice was ambiguous ("saturday").', durationSec: 63 },
    { id: 's5', time: m(31), lang: 'English', source: 'Website enquiry', treatment: 'dental implant', clinic: null, slot: null, name: null, outcome: 'dropped', earlyDrop: true, summary: 'Hung up after 6s, before agreeing to the AI call.', durationSec: 6 },
    { id: 's6', time: m(38), lang: 'Hindi', source: 'Instagram ad', treatment: 'cleaning', clinic: 'Whitefield', slot: null, name: null, outcome: 'dropped', endedAfterSlots: true, summary: 'Hung up after hearing slot options at Whitefield (cleaning).', next: 'Optional follow-up: showed interest but did not book.', durationSec: 48 },
    { id: 's7', time: m(46), lang: 'English', source: 'Website enquiry', treatment: 'not stated', clinic: null, slot: null, name: null, outcome: 'handoff', priority: 'P2', reason: 'Declined the AI call / recording', next: 'Human callback; do not route this lead to AIVA.', summary: 'Declined the AI call / recording. Caller said: "no, I want to talk to someone from the clinic". Spoke English.', durationSec: 14 },
    { id: 's8', time: m(55), lang: 'English', source: 'Google ad', treatment: 'dental implant', clinic: null, slot: null, name: null, outcome: 'info', summary: 'Asked for information only (dental implant price, Whitefield timings); did not book. Spoke English.', next: 'Optional follow-up: showed interest but did not book.', durationSec: 58 },
    { id: 's9', time: m(63), lang: 'Hindi', source: 'Website enquiry', treatment: 'braces', clinic: 'Koramangala', slot: 'Saturday 10 AM', name: 'राहुल', outcome: 'booked', confidence: 100, booked: true, summary: 'Booked braces consultation at Koramangala, Saturday 10 AM, for राहुल. Spoke Hindi.', durationSec: 81 },
    { id: 's10', time: m(70), lang: 'English', source: 'Website enquiry', treatment: 'root canal', clinic: null, slot: null, name: null, outcome: 'handoff', priority: 'P1', reason: 'Clinical question (AIVA gives no medical advice)', next: 'Dentist or senior staff to answer, then offer a consultation.', summary: 'Clinical question (AIVA gives no medical advice). Interested in root canal. Caller said: "is root canal safe during pregnancy". Spoke English.', durationSec: 37 },
    { id: 's11', time: m(84), lang: 'English', source: 'Website enquiry', treatment: 'not stated', clinic: null, slot: null, name: 'Sunita Rao', outcome: 'cancelled', summary: 'Cancelled the booking under Sunita Rao; did not rebook. Spoke English.', durationSec: 33 },
    { id: 's12', time: m(95), lang: 'English', source: 'Instagram ad', treatment: 'cleaning', clinic: 'Whitefield', slot: 'Thursday 5 PM', name: 'Arjun', outcome: 'booked', confidence: 100, booked: true, summary: 'Booked cleaning consultation at Whitefield, Thursday 5 PM, for Arjun. Spoke English.', durationSec: 69 }
  ].map(x => Object.assign({ sample: true, transcript: [], confidence: null, booked: false, earlyDrop: false, endedAfterSlots: false }, x));

  const SKEY = 'aiva_sample_state';
  const sampleState = () => { try { return JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch (e) { return {}; } };
  function patchLead(L, p) {
    if (L.sample) { const st = sampleState(); st[L.id] = Object.assign(st[L.id] || {}, p); localStorage.setItem(SKEY, JSON.stringify(st)); }
    else Store.patch(L.id, p);
    render();
  }
  function leads() {
    const st = sampleState();
    const mine = Store.all();
    const sample = $('showSample').checked ? SAMPLE.map(s => Object.assign({}, s, st[s.id] || {})) : [];
    return mine.concat(sample).sort((a, b) => b.time - a.time);
  }

  const TABS = [
    ['callback', 'Needs callback', L => L.outcome === 'handoff' || (L.booked && L.confidence !== null && L.confidence < 70)],
    ['booked', 'Booked by AIVA', L => L.booked],
    ['dropped', 'Dropped / info only', L => L.outcome === 'dropped' || L.outcome === 'info'],
    ['cancelled', 'Cancelled', L => L.outcome === 'cancelled'],
    ['all', 'All', () => true]
  ];
  let tab = 'callback';
  const pRank = { P0: 0, P1: 1, P2: 2 };

  function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }
  function ago(t) { const s = Math.round((Date.now() - t) / 60000); return s < 1 ? 'just now' : s < 60 ? s + ' min ago' : Math.floor(s / 60) + ' h ' + (s % 60) + ' min ago'; }

  function kpis(all) {
    const n = all.length, booked = all.filter(L => L.booked).length;
    const calls = all.filter(L => !L.skippedAiva);
    const early = calls.filter(L => L.earlyDrop).length, afterSlots = all.filter(L => L.endedAfterSlots).length;
    const open = all.filter(L => L.outcome === 'handoff' && !L.done);
    const c = p => open.filter(L => L.priority === p).length;
    const oldP0 = open.filter(L => L.priority === 'P0').reduce((mn, L) => Math.min(mn, L.time), Infinity);
    const conv = pct(booked, n), earlyP = pct(early, calls.length), slotsP = pct(afterSlots, calls.length);
    const p0late = oldP0 !== Infinity && Date.now() - oldP0 > 15 * 60000;
    $('kpis').innerHTML =
      `<div class="kpi"><div class="l">★ Success metric: enquiries → booked appointment</div><div class="v">${conv}%</div>
        <div class="d" style="color:${conv >= BASELINE ? 'var(--ok)' : 'var(--p0)'}">${conv >= BASELINE ? '▲' : '▼'} vs ${BASELINE}% pre-AIVA baseline · ${booked} of ${n} enquiries</div>
        <div class="d" style="color:var(--mute)">Includes bookings made by staff after a handoff, once marked.</div></div>
      <div class="kpi ${earlyP >= 40 ? 'alert' : ''}"><div class="l">Early drop-off (hung up within 30s, before booking)</div><div class="v">${earlyP}%</div>
        <div class="d" style="color:${earlyP >= 40 ? 'var(--p0)' : 'var(--mute)'}">${earlyP >= 40 ? '⚠ Over 40% tripwire: staff call these leads and ask why' : 'Tripwire at 40% (pilot week 1)'} · ${early} of ${calls.length} calls</div></div>
      <div class="kpi"><div class="l">Hung up after hearing slots</div><div class="v">${slotsP}%</div>
        <div class="d" style="color:var(--mute)">${afterSlots} calls · decides whether SMS/WhatsApp follow-up is worth building (not in v1)</div></div>
      <div class="kpi ${p0late ? 'alert' : ''}"><div class="l">Callbacks waiting</div><div class="v">${open.length}</div>
        <div class="d"><span class="pill p0">P0 ${c('P0')}</span> <span class="pill p1">P1 ${c('P1')}</span> <span class="pill p2">P2 ${c('P2')}</span></div>
        <div class="d" style="color:${p0late ? 'var(--p0)' : 'var(--mute)'}">${oldP0 === Infinity ? 'No urgent calls waiting' : 'Oldest P0: ' + ago(oldP0) + (p0late ? ' ⚠ past the 15-min promise' : '')}</div></div>`;
  }

  function card(L) {
    const pill = L.booked && !L.priority ? '<span class="pill okp">Booked by AIVA</span>' : L.priority ? `<span class="pill ${L.priority.toLowerCase()}">${L.priority}</span>` : `<span class="pill mutep">${esc(L.outcome)}</span>`;
    const lowConf = L.booked && L.confidence !== null && L.confidence < 70;
    const conf = L.confidence !== null && L.confidence !== undefined ? `<div class="conf">Booking confidence <span class="bar"><i style="width:${L.confidence}%;background:${L.confidence >= 70 ? 'var(--ok)' : 'var(--p1)'}"></i></span> ${L.confidence}%${lowConf ? ' · <b style="color:var(--p1)">staff to double-check</b>' : ''}</div>` : '';
    const tx = (L.transcript || []).length ? `<button class="btn ghost sm" data-act="tx">Transcript</button>` : '';
    const live = L.live ? ' <span class="pill okp">● live call</span>' : '';
    const fb = `<span class="fb">Was AIVA right? <button data-act="up" class="${L.fb === 'up' ? 'on' : ''}">👍</button> <button data-act="down" class="${L.fb === 'down' ? 'on' : ''}">👎</button></span>`;
    const actions = L.outcome === 'handoff' || lowConf || L.outcome === 'dropped' || L.outcome === 'info'
      ? `<button class="btn sm" data-act="call">📞 Call ${L.name ? esc(L.name) : 'lead'}</button>` + (L.done ? '' : `<button class="btn ghost sm" data-act="done">Mark done</button>` + (L.booked ? '' : `<button class="btn ghost sm" data-act="bookedByStaff">Booked by staff</button>`)) : '';
    return `<div class="lead ${L.live ? 'live' : ''} ${L.done ? 'done' : ''}" data-id="${esc(L.id)}">
      <div class="lh"><div>${pill} <span class="ln">${esc(L.name || 'Unknown caller')}</span>${live}${L.sample ? ' <span class="pill mutep">sample</span>' : ''}${L.done ? ' <span class="pill mutep">done</span>' : ''}</div><div class="fine" style="margin:0">${ago(L.time)}</div></div>
      <div class="lm">${esc(L.source)} · ${esc(L.treatment)}${L.clinic ? ' · ' + esc(L.clinic) : ''}${L.slot ? ' · ' + esc(L.slot) : ''} · ${esc(L.lang)} · ${L.durationSec}s call</div>
      <div class="ls">${esc(L.summary)}</div>
      ${L.reason ? `<div class="lx"><b>Why handed over:</b> ${esc(L.reason)}</div>` : ''}
      ${L.next ? `<div class="lx"><b>Next step:</b> ${esc(L.next)}</div>` : ''}
      ${conf}
      <div class="la">${actions}${tx}${fb}</div>
      <div class="tx">${(L.transcript || []).map(x => `<p><b>${x.who === 'AIVA' ? 'AIVA' : 'Caller'}:</b> ${esc(x.text)}</p>`).join('')}</div>
    </div>`;
  }

  function render() {
    const all = leads();
    kpis(all);
    $('tabs').innerHTML = TABS.map(([k, label, f]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${label} (${all.filter(f).filter(L => !(k === 'callback' && L.done)).length})</button>`).join('');
    let rows = all.filter(TABS.find(x => x[0] === tab)[2]);
    if (tab === 'callback') rows = rows.filter(L => !L.done).sort((a, b) => (pRank[a.priority] ?? 3) - (pRank[b.priority] ?? 3) || a.time - b.time);
    $('list').innerHTML = rows.length ? rows.map(card).join('') : '<div class="empty card">Nothing here. Make a call on Screen 1.</div>';
    const rated = all.filter(L => L.fb), up = rated.filter(L => L.fb === 'up').length;
    $('fbStats').innerHTML = rated.length ? `<b>${pct(up, rated.length)}%</b> of ${rated.length} reviewed calls handled correctly (${rated.length - up} 👎 to review)` : 'No reviews yet. Rate a call with 👍/👎.';
  }

  $('tabs').onclick = e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.t; render(); } };
  $('list').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const el = b.closest('.lead'), id = el.dataset.id, L = leads().find(x => x.id === id); if (!L) return;
    const a = b.dataset.act;
    if (a === 'tx') el.querySelector('.tx').classList.toggle('show');
    else if (a === 'up' || a === 'down') patchLead(L, { fb: L.fb === a ? null : a });
    else if (a === 'done') patchLead(L, { done: true });
    else if (a === 'bookedByStaff') patchLead(L, { done: true, booked: true });
    else if (a === 'call') alert('Demo: this would dial the caller from the clinic phone, with the summary above on screen so staff do not re-ask questions.');
  };
  $('showSample').onchange = render;
  $('reset').onclick = () => { if (confirm('Clear calls you made in this browser (sample data stays)?')) { Store.clear(); localStorage.removeItem(SKEY); render(); } };

  const rules = (() => { try { return JSON.parse(localStorage.getItem('aiva_rules') || '{}'); } catch (e) { return {}; } })();
  $('urgentExtra').value = rules.urgentExtra || '';
  $('saveRules').onclick = () => { rules.urgentExtra = $('urgentExtra').value; localStorage.setItem('aiva_rules', JSON.stringify(rules)); $('ruleMsg').textContent = 'Saved. Applies to the next AIVA call.'; };

  window.addEventListener('storage', render);
  setInterval(() => { if (!document.querySelector('.tx.show')) render(); }, 5000);
  render();
})();
