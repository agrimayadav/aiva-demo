// Happy Smile desk dashboard: front-desk view of calls AIVA has handled or handed off.
(function () {
  const $ = id => document.getElementById(id);
  const KEY = 'hs_desk_v1';
  const TAG = {
    P0: 'P0 · Urgent', P1: 'P1', P2: 'P2',
    booked: 'Booked by AIVA', cancelled: 'Cancelled by AIVA', closed: 'Closed by AIVA'
  };
  const PRI_HINT = { P0: 'call within 15 min', P1: 'call within 1 hr', P2: 'call today' };

  const A = t => ({ who: 'AIVA', t }), C = t => ({ who: 'Caller', t });
  const SEED_CALLS = [
    { id: 1, name: null, phone: '+91 98104 62217', tag: 'P0', ago: '3 min ago', dur: 55,
      summary: 'Urgent: swelling and severe pain in the lower jaw since last night.',
      reason: 'Urgent symptom reported',
      transcript: [A("Welcome to Happy Smile's AI assistant. This call is being recorded. How can I help you today?"), C('Mere jaw mein bahut swelling hai, kal raat se dard ho raha hai.'), A("I'm sorry to hear that. Since this sounds urgent, I've flagged it for our clinic team. They'll call you within 15 minutes. If you have trouble breathing or swallowing, please go to the nearest emergency room."), C('Okay, thank you.')] },
    { id: 2, name: 'Rohit Verma', phone: '+91 99580 11834', tag: 'P0', ago: '18 min ago', dur: 48,
      summary: 'Bleeding that has not stopped since an extraction at Dwarka yesterday.',
      reason: 'Urgent symptom reported',
      transcript: [A("Welcome to Happy Smile's AI assistant. This call is being recorded. How can I help you today?"), C('I had a tooth removed at your Dwarka clinic yesterday and it is still bleeding.'), A("Thanks for telling me, Rohit. I've flagged this as urgent and our Dwarka team will call you within 15 minutes.")] },
    { id: 3, name: 'Neha Gupta', phone: '+91 98731 50492', tag: 'P1', ago: '26 min ago', dur: 95,
      summary: 'Wants an implant consultation at Saket. None of the offered slots worked; prefers a weekday evening.',
      reason: 'Preferred slot not available',
      transcript: [A('How can I help you today?'), C('I want to get an implant consultation at Saket.'), A('At Saket, I can do Saturday at 11 AM or Sunday at 4 PM. Which works better?'), C('Neither, I need a weekday evening.'), A("No problem. I'll ask our Saket front desk to call you with weekday evening options.")] },
    { id: 4, name: 'Sana Khan', phone: '+91 97119 27705', tag: 'P1', ago: '41 min ago', dur: 70,
      summary: 'Asked to speak to a person about her ongoing root canal treatment at Lajpat Nagar.',
      reason: 'Caller asked for a human',
      transcript: [A('How can I help you today?'), C('Mujhe kisi insaan se baat karni hai, mera root canal chal raha hai.'), A('Bilkul. Hamari Lajpat Nagar front desk aapko jaldi call karegi.')] },
    { id: 5, name: null, phone: '+91 98183 74409', tag: 'P2', ago: '1 hr ago', dur: 120,
      summary: 'Asked about the price of braces and whether EMI is available.',
      reason: 'Payment method enquiry',
      transcript: [A('How can I help you today?'), C('Braces ka kitna kharcha hota hai?'), A('Braces usually cost ₹35,000 to ₹90,000. The dentist confirms the exact price after a check-up. The consultation is ₹300.'), C('EMI milega kya? Monthly kitna padega?'), A("Good question. Our front desk can explain the payment plans, so I'll ask them to call you today."), C('Theek hai.')] },
    { id: 6, name: 'Arjun Singh', phone: '+91 99996 03128', tag: 'P2', ago: '1 hr ago', dur: 64,
      summary: 'Noisy line. AIVA could not understand the request after 3 tries.',
      reason: 'AI did not understand 3 times',
      transcript: [A('How can I help you today?'), C('[inaudible] … appointment … [inaudible]'), A("Sorry, I didn't quite get that. What would you like to come in for?"), C('[inaudible]'), A("I'm sorry, I'm having trouble understanding you. Our front desk will get back in touch with you soon.")] },
    { id: 7, name: 'Meera Iyer', phone: '+91 98990 45561', tag: 'P2', ago: '2 hr ago', dur: 25,
      summary: 'Asked about teeth cleaning at Rohini and hung up after hearing the slots.',
      reason: 'Call ended before booking',
      transcript: [A('How can I help you today?'), C('Teeth cleaning, Rohini.'), A('At Rohini, I can do Friday at 6 PM or Saturday at 10 AM. Which one works better for you?'), C('[call ended]')] },
    { id: 8, name: 'Karan Mehta', phone: '+91 98111 23456', tag: 'booked', ago: '5 min ago', dur: 40, conf: 85,
      summary: 'Booked teeth whitening at Saket, Sunday 11 AM.',
      transcript: [A("Welcome to Happy Smile's AI assistant. This call is being recorded. How can I help you today?"), C('Hi, I want teeth whitening.'), A('Okay, teeth whitening. Which clinic is easiest for you? We have Saket, Dwarka, Rohini and Lajpat Nagar.'), C('Saket.'), A('At Saket, I can do Sunday at 11 AM or Sunday at 3 PM.'), C('11 is good.'), A('And what name should I put the booking under?'), C('Karan.'), A("All done, Karan! You're booked for Sunday at 11 AM at Saket. Anything else?"), C('No, thanks.')] },
    { id: 9, name: 'Ananya Rao', phone: '+91 97170 88213', tag: 'booked', ago: '34 min ago', dur: 55, conf: 92,
      summary: 'Booked a braces consultation at Dwarka, Saturday 4 PM.',
      transcript: [A('How can I help you today?'), C('Braces consultation, Dwarka.'), A('At Dwarka, I can do Saturday at 11 AM or 4 PM.'), C('4 PM.'), A("All done, Ananya! You're booked for Saturday at 4 PM at Dwarka.")] },
    { id: 10, name: 'Vikram Malhotra', phone: '+91 98100 67721', tag: 'cancelled', ago: '52 min ago', dur: 35,
      summary: 'Cancelled his cleaning at Rohini, Friday 6 PM. Did not want to reschedule.',
      transcript: [A('How can I help you today?'), C('I need to cancel my cleaning on Friday.'), A("I've cancelled your Friday 6 PM cleaning at Rohini. Would you like to pick another time?"), C('Not now, thanks.')] },
    { id: 11, name: 'Pooja Bansal', phone: '+91 99712 30984', tag: 'closed', ago: '1 hr ago', dur: 30,
      summary: 'Asked for Lajpat Nagar timings and location. Answered; no booking needed.',
      transcript: [A('How can I help you today?'), C('Lajpat Nagar clinic kab khulta hai?'), A('Hamara Lajpat Nagar clinic Monday to Saturday, 10 AM se 8 PM tak khula hai, Ring Road par, metro station ke paas.'), C('Okay thanks.')] }
  ];
  const SEED_RULES = [
    { id: 1, text: 'Urgent symptom reported (pain, swelling, bleeding, broken tooth)', pri: 'P0', status: 'active' },
    { id: 2, text: 'Caller asked for a human', pri: 'P1', status: 'active' },
    { id: 3, text: 'Preferred slot not available', pri: 'P1', status: 'active' },
    { id: 4, text: 'Payment method enquiry (EMI, insurance, discounts)', pri: 'P2', status: 'active' },
    { id: 5, text: 'AI did not understand 3 times', pri: 'P2', status: 'active' },
    { id: 6, text: 'Call ended before booking', pri: 'P2', status: 'active' }
  ];

  const clone = o => JSON.parse(JSON.stringify(o));
  let st = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.calls && s.rules) return s; } catch (e) {}
    return { calls: clone(SEED_CALLS), rules: clone(SEED_RULES) };
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const open = new Set(); // calls with transcript expanded
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const first = c => c.name ? c.name.split(' ')[0] : null;
  const dur = s => s < 60 ? s + 's call' : Math.floor(s / 60) + ' min' + (s % 60 ? ' ' + (s % 60) + 's' : '') + ' call';
  const isCallback = c => /^P[012]$/.test(c.tag);
  const rank = { P0: 0, P1: 1, P2: 2 };

  function card(c) {
    const fn = first(c), tel = c.phone.replace(/\s/g, '');
    const meta = [c.conf != null ? 'Booking confidence ' + c.conf + '%' : null, dur(c.dur)].filter(Boolean).join(' · ');
    const cb = isCallback(c);
    return `<article class="card" data-id="${c.id}">
      <div class="top">
        <span class="name">${esc(c.name || 'Unknown caller')}</span>
        <span class="tag t-${c.tag}">${TAG[c.tag]}</span>
        <span class="phone">${esc(c.phone)}</span>
        <span class="ago">${esc(c.ago)}</span>
      </div>
      <p class="summary">${esc(c.summary)}</p>
      <p class="meta">${meta}</p>
      ${cb ? `<p class="reason">Handed off: <b>${esc(c.reason)}</b> · ${PRI_HINT[c.tag]}</p>` : ''}
      <div class="actions">
        <a class="btn ${cb ? 'primary' : 'soft'}" href="tel:${tel}">Call ${esc(fn || 'back')}</a>
        <a class="btn soft" href="sms:${tel}">SMS ${esc(fn || '')}</a>
        ${cb ? `<button class="btn soft" data-act="staff">Booked by staff</button>` : ''}
        <button class="btn soft" data-act="done">Mark complete</button>
        <button class="btn link" data-act="tx">${open.has(c.id) ? 'Hide transcript' : 'Transcript'}</button>
        <span class="fb">
          <button data-act="up" class="${c.fb === 'up' ? 'on' : ''}" title="AIVA handled this well" aria-label="Thumbs up">👍</button>
          <button data-act="down" class="${c.fb === 'down' ? 'on' : ''}" title="AIVA got this wrong" aria-label="Thumbs down">👎</button>
        </span>
      </div>
      ${open.has(c.id) ? `<div class="transcript">${c.transcript.map(l => `<p><span class="who ${l.who === 'AIVA' ? 'ai' : ''}">${l.who}</span>${esc(l.t)}</p>`).join('')}</div>` : ''}
    </article>`;
  }

  function render() {
    const live = st.calls.filter(c => !c.resolved);
    const q = live.filter(isCallback).sort((a, b) => rank[a.tag] - rank[b.tag]);
    const h = live.filter(c => !isCallback(c));
    const n = k => q.filter(c => c.tag === k).length;
    $('headline').textContent = q.length ? `${q.length} callback${q.length === 1 ? '' : 's'} waiting` : 'All caught up';
    $('split').innerHTML = q.length ? [['P0', 'var(--red)'], ['P1', 'var(--orange)'], ['P2', 'var(--yellow)']]
      .map(([k, col]) => `<span><i class="dot" style="background:${col}"></i><b>${n(k)}</b> ${k}</span>`).join('') : 'No one is waiting for a call.';
    $('queue').innerHTML = q.map(card).join('') || '<div class="card empty">No callbacks waiting.</div>';
    $('handled').innerHTML = h.map(card).join('') || '<div class="card empty">Nothing to review.</div>';
  }

  let undoFn = null, toastT = null;
  function toast(msg, undo) {
    undoFn = undo; $('toastMsg').textContent = msg; $('undo').hidden = !undo; $('toast').hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { $('toast').hidden = true; undoFn = null; }, 5000);
  }
  $('undo').onclick = () => { if (undoFn) undoFn(); $('toast').hidden = true; };

  function resolve(c, how, el) {
    el.classList.add('leaving');
    setTimeout(() => {
      c.resolved = how; save(); render();
      toast(`${c.name || 'Unknown caller'} · ${how === 'staff' ? 'booked by staff' : 'marked complete'}`, () => { delete c.resolved; save(); render(); });
    }, 250);
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const el = b.closest('.card'), c = st.calls.find(x => x.id === +el.dataset.id); if (!c) return;
    const a = b.dataset.act;
    if (a === 'tx') { open.has(c.id) ? open.delete(c.id) : open.add(c.id); render(); }
    else if (a === 'up' || a === 'down') { c.fb = c.fb === a ? null : a; save(); render(); }
    else resolve(c, a, el);
  });

  // ---------- handoff rules ----------
  function renderRules() {
    $('ruleList').innerHTML = st.rules.map(r => `<li class="${r.status}">
      <span class="tag t-${r.pri}">${r.pri}</span>
      <span class="txt">${esc(r.text)}</span>
      <span class="state">${r.status === 'active' ? 'Active' : 'Pending approval'}</span></li>`).join('');
  }
  const showRules = on => { $('rules').hidden = $('scrim').hidden = !on; if (on) { $('guide').hidden = true; renderRules(); $('ruleText').focus(); } };
  const showGuide = on => { $('guide').hidden = $('scrim').hidden = !on; if (on) $('rules').hidden = true; else localStorage.setItem('hs_guide_seen', '1'); };
  $('openGuide').onclick = () => showGuide(true);
  document.querySelectorAll('#guide [data-close]').forEach(b => b.onclick = () => showGuide(false));
  $('openRules').onclick = () => showRules(true);
  $('closeRules').onclick = () => showRules(false);
  $('scrim').onclick = () => { showRules(false); showGuide(false); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { showRules(false); showGuide(false); } });
  $('ruleForm').onsubmit = e => {
    e.preventDefault();
    const text = $('ruleText').value.trim(); if (!text) return;
    st.rules.push({ id: Date.now(), text, pri: $('rulePri').value, status: 'pending' });
    save(); renderRules(); $('ruleText').value = '';
    toast('Rule saved · waiting for front-desk lead approval', null);
  };

  $('reset').onclick = e => { e.preventDefault(); localStorage.removeItem(KEY); st = load(); open.clear(); render(); };
  render();
  if (!localStorage.getItem('hs_guide_seen')) showGuide(true);
})();
