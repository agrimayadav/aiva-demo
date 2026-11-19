// Screen 1: enquiry moment + AIVA call (browser voice via Web Speech API, typing fallback).
(function () {
  const $ = id => document.getElementById(id);
  let lang = 'en', sess = null, timer = null, rec = null, listening = false, handsFree = false;

  document.querySelectorAll('#langSeg button').forEach(b => b.onclick = () => {
    if (sess && !sess.ended) return;
    document.querySelectorAll('#langSeg button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); lang = b.dataset.l;
  });

  // ---- speech out
  let voices = [];
  const loadVoices = () => { voices = speechSynthesis ? speechSynthesis.getVoices() : []; };
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  function pickVoice() {
    const want = lang === 'hi' ? ['hi-IN'] : ['en-IN', 'en-GB', 'en-US'];
    for (const w of want) {
      const female = voices.find(v => v.lang === w && /female|swara|neerja|heera|kalpana|zira|aria|google/i.test(v.name));
      const any = voices.find(v => v.lang === w);
      if (female || any) return female || any;
    }
    return null;
  }
  function speak(text, then) {
    if (!$('voiceOn').checked || !('speechSynthesis' in window) || !text) { then && then(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/₹/g, lang === 'hi' ? 'रुपये ' : 'rupees ').replace(/–/g, lang === 'hi' ? ' से ' : ' to '));
    const v = pickVoice(); if (v) u.voice = v;
    u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; u.rate = 1.02; u.pitch = 1.05;
    u.onend = () => then && then(); u.onerror = () => then && then();
    status('AIVA is speaking…'); speechSynthesis.speak(u);
  }

  // ---- speech in
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function listen() {
    if (!SR || !sess || sess.ended) return;
    rec = new SR(); rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; rec.interimResults = true; rec.maxAlternatives = 1;
    let final = '';
    rec.onresult = e => { let interim = ''; for (const r of e.results) { if (r.isFinal) final = r[0].transcript; else interim += r[0].transcript; } status('🎤 ' + (final || interim)); };
    rec.onerror = e => { status(e.error === 'not-allowed' ? 'Mic blocked: allow microphone access, or type instead.' : 'Didn\'t hear that; tap 🎤 or type.'); if (e.error === 'not-allowed') setHandsFree(false); };
    rec.onend = () => { listening = false; $('mic').classList.toggle('on', handsFree); if (final.trim()) reply(final.trim()); else if (handsFree && sess && !sess.ended) setTimeout(listen, 300); };
    try { rec.start(); listening = true; status('🎤 Listening… speak now'); } catch (e) { /* already started */ }
  }
  function setHandsFree(on) { handsFree = on; $('mic').classList.toggle('on', on); if (!on && rec) { try { rec.abort(); } catch (e) {} status(''); } }
  $('mic').onclick = () => {
    if (!SR) { status('Voice input needs Chrome or Edge. Typing works everywhere.'); return; }
    setHandsFree(!handsFree); if (handsFree) { speechSynthesis && speechSynthesis.cancel(); listen(); }
  };

  // ---- UI
  const status = t => { $('status').textContent = t; };
  function bubble(who, text) {
    const d = document.createElement('div'); d.className = 'msg ' + (who === 'AIVA' ? 'aiva' : 'caller');
    d.innerHTML = '<span class="who">' + (who === 'AIVA' ? 'AIVA (AI)' : 'You') + '</span>';
    d.appendChild(document.createTextNode(text)); $('chat').appendChild(d); $('chat').scrollTop = 1e6;
  }
  function persist() { if (sess) { const l = sess.toLead(); l.live = !sess.ended; Store.upsert(l); } }
  function afterAiva(text) {
    bubble('AIVA', text); persist();
    if (sess.ended) { speak(text); finish(); return; }
    speak(text, () => { status(handsFree ? '' : 'Tap 🎤 to speak, or type.'); if (handsFree) listen(); });
  }
  function reply(text) {
    if (!sess || sess.ended || !text) return;
    bubble('caller', text); afterAiva(sess.handle(text));
  }

  $('talkBtn').onclick = () => {
    if (sess && !sess.ended) return;
    sess = AIVA.createSession({ lang, treatment: $('treatment').value || null, source: $('source').value });
    $('idle').hidden = true; $('chat').hidden = false; $('ctrl').hidden = false; $('chat').innerHTML = ''; $('altMsg').innerHTML = '';
    const t0 = Date.now(); clearInterval(timer);
    timer = setInterval(() => { const s = Math.round((Date.now() - t0) / 1000); $('phMeta').innerHTML = 'AI assistant · <span class="rec">● Recording</span> · ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 500);
    afterAiva(sess.start());
    $('txt').focus();
  };
  $('send').onclick = () => { const v = $('txt').value.trim(); $('txt').value = ''; reply(v); };
  $('txt').onkeydown = e => { if (e.key === 'Enter') $('send').onclick(); };
  $('endBtn').onclick = () => { if (!sess || sess.ended) return; sess.hangup(); bubble('AIVA', '(Caller hung up)'); persist(); speechSynthesis && speechSynthesis.cancel(); finish(); };

  function finish() {
    clearInterval(timer); setHandsFree(false); $('ctrl').hidden = true;
    const L = sess.toLead(); L.live = false; Store.upsert(L);
    $('phMeta').textContent = 'Call ended · ' + L.durationSec + 's';
    const pill = L.outcome === 'booked' ? '<span class="pill okp">Booked</span>' : L.priority ? '<span class="pill ' + L.priority.toLowerCase() + '">' + L.priority + ' handoff</span>' : '<span class="pill mutep">' + L.outcome + '</span>';
    const c = document.createElement('div'); c.className = 'endcard';
    c.innerHTML = '<div style="margin-bottom:6px">' + pill + (L.confidence !== null ? ' <span class="pill mutep">confidence ' + L.confidence + '%</span>' : '') + '</div>' +
      '<div style="color:#d0d5dd"></div><div style="margin-top:8px"><a href="dashboard.html" style="color:#5fe9d0">→ See what the front desk sees</a> · <a href="#" id="again" style="color:#5fe9d0">New call</a></div>';
    c.children[1].textContent = L.summary; $('chat').appendChild(c); $('chat').scrollTop = 1e6;
    $('again').onclick = e => { e.preventDefault(); sess = null; $('chat').hidden = true; $('idle').hidden = false; $('phMeta').textContent = 'Not connected'; status(''); };
    status('');
  }

  function quickLead(kind, msg) {
    const tk = $('treatment').value || null;
    const m = AIVA.HANDOFF_META[kind === 'pain' ? 'P0' : 'human'];
    Store.upsert({ id: 'L' + Date.now().toString(36), time: Date.now(), lang: lang === 'hi' ? 'Hindi' : 'English', source: $('source').value,
      treatment: tk ? AIVA.DB.treatments[tk].en : 'not stated', clinic: null, slot: null, name: null, outcome: 'handoff',
      priority: m.priority, reason: kind === 'pain' ? 'Self-reported pain/swelling at enquiry (skipped AIVA)' : 'Chose a human callback at enquiry (skipped AIVA)',
      next: m.next, confidence: null, booked: false, durationSec: 0, earlyDrop: false, endedAfterSlots: false, skippedAiva: true,
      summary: (kind === 'pain' ? 'Tapped "In pain or swelling" on the enquiry page.' : 'Prefers to speak to a person.') + ' No AI call made.', transcript: [], live: false });
    $('altMsg').innerHTML = '<div class="okmsg">' + msg + ' <a href="dashboard.html">See it on the front-desk screen →</a></div>';
  }
  $('painBtn').onclick = () => quickLead('pain', 'Flagged urgent. A HappySmile team member will call you within 15 minutes.');
  $('humanBtn').onclick = () => quickLead('human', 'Done. A team member will call you today (9 AM–8 PM).');
})();
