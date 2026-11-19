// Screen 1: one "Call HappySmile" button. Hands-free voice call in the browser.
// Speech out: best available neural voice (Edge "Natural" voices sound most human).
// Speech in: hi-IN recognition (handles Hindi, English and Hinglish code-mixing); engine picks reply language per turn.
(function () {
  const $ = id => document.getElementById(id);
  const TEST = /[?&]test\b/.test(location.search);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasTTS = 'speechSynthesis' in window;
  let sess = null, t0 = 0, tick = null, rec = null, recToken = 0, silenceTimer = null, nudges = 0, typedMode = false;
  const keep = []; // keep utterances referenced (Chrome drops onend for GC'd utterances)

  // ---------- voice out ----------
  let voices = [];
  const loadVoices = () => { voices = hasTTS ? speechSynthesis.getVoices() : []; };
  if (hasTTS) { loadVoices(); speechSynthesis.addEventListener('voiceschanged', loadVoices); }
  const voicesReady = () => voices.length || !hasTTS ? Promise.resolve() : new Promise(r => {
    const t = setTimeout(r, 1500); speechSynthesis.addEventListener('voiceschanged', () => { clearTimeout(t); loadVoices(); r(); }, { once: true });
  });
  function pickVoice(lang) {
    const L = lang === 'hi' ? 'hi-IN' : 'en-IN';
    const prefs = lang === 'hi'
      ? [v => /Swara/i.test(v.name) && /Natural/i.test(v.name), v => v.lang === L && /Natural/i.test(v.name), v => /Google/i.test(v.name) && v.lang === L, v => v.lang === L]
      : [v => /Neerja/i.test(v.name) && /Natural/i.test(v.name), v => v.lang === L && /Natural/i.test(v.name), v => /Natural/i.test(v.name) && /^en/.test(v.lang) && /Female|Aria|Jenny|Sonia|Natasha/i.test(v.name),
         v => v.name === 'Google UK English Female', v => v.lang === L, v => /^en/.test(v.lang)];
    for (const p of prefs) { const v = voices.find(p); if (v) return v; }
    return null;
  }
  // Make text sound spoken, not read: "₹6,000–12,000" -> "6,000 to 12,000 rupees".
  function spoken(text, lang) {
    let t = text.replace(/HappySmile/g, 'Happy Smile').replace(/\s*\(RCT\)/g, '');
    t = t.replace(/₹([\d,]+)\s*[–-]\s*([\d,]+)/g, (m, a, b) => lang === 'hi' ? `${a} से ${b} रुपये` : `${a} to ${b} rupees`);
    t = t.replace(/₹([\d,]+)/g, (m, a) => lang === 'hi' ? `${a} रुपये` : `${a} rupees`);
    if (lang === 'hi') t = t.replace(/per tooth/g, 'प्रति दाँत');
    return t.replace(/\s*\(([^)]*)\)/g, ', $1,').replace(/\s+/g, ' ').trim();
  }
  function speak(text) {
    return new Promise(res => {
      if (TEST || !hasTTS || !text) return res();
      const lang = /[\u0900-\u097F]/.test(text) ? 'hi' : 'en';
      const v = pickVoice(lang), natural = v && /Natural|Online/i.test(v.name);
      const say = spoken(text, lang);
      // Neural voices read a whole reply smoothly in one go; local voices cut out on long text, so queue sentences back-to-back.
      const chunks = natural ? [say] : say.split(/(?<=[.!?।])\s+/).filter(Boolean);
      let done = false;
      const fin = () => { if (done) return; done = true; clearTimeout(guard); mode(''); res(); };
      const guard = setTimeout(fin, 5000 + say.length * 120);
      keep.length = 0; mode('speaking');
      chunks.forEach((c, i) => {
        const u = new SpeechSynthesisUtterance(c);
        if (v) u.voice = v; u.lang = v ? v.lang : (lang === 'hi' ? 'hi-IN' : 'en-IN'); u.rate = 1; u.pitch = 1;
        if (i === chunks.length - 1) u.onend = fin;
        u.onerror = fin; keep.push(u); speechSynthesis.speak(u);
      });
    });
  }

  // ---------- voice in ----------
  function listen() {
    if (!sess || sess.ended || typedMode) return;
    const my = ++recToken; let fin = '', interim = '', endT = null, committed = false;
    const r = new SR(); rec = r;
    r.lang = 'hi-IN'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    const commit = () => {
      if (committed || my !== recToken) return; committed = true; clearTimeout(endT);
      try { r.stop(); } catch (e) {}
      const t = (fin + ' ' + interim).trim();
      if (t) onCaller(t); else setTimeout(() => { if (my === recToken) listen(); }, 250);
    };
    r.onresult = e => {
      if (my !== recToken) return;
      fin = ''; interim = '';
      for (let i = 0; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) fin += x[0].transcript + ' '; else interim += x[0].transcript; }
      clearTimeout(silenceTimer); clearTimeout(endT);
      endT = setTimeout(commit, 1000); // caller paused ~1s: treat the sentence as finished
      status('“' + (fin + interim).trim() + '”', true);
    };
    r.onerror = e => {
      if (my !== recToken) return;
      if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(e.error)) { committed = true; useTyping('Microphone or speech service unavailable. Type your reply instead.'); }
    };
    r.onend = () => { if (my === recToken && !committed) commit(); };
    try { r.start(); mode('listening'); } catch (e) {}
  }
  function stopListening() { recToken++; clearTimeout(silenceTimer); if (rec) { try { rec.abort(); } catch (e) {} rec = null; } }

  function startTurn() {
    if (!sess) return;
    if (sess.ended) return finish();
    if (typedMode) { mode(''); $('txt').focus(); return; }
    listen();
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(onSilence, 9000);
  }
  async function onSilence() {
    if (!sess || sess.ended) return;
    stopListening(); nudges++;
    const hi = sess.lang === 'hi';
    if (nudges === 1) {
      const q = hi ? 'हेलो? क्या आप लाइन पर हैं?' : 'Hello? Are you still there?';
      sess.transcript.push({ who: 'AIVA', text: q }); await speak(q); startTurn();
    } else {
      const q = hi ? 'लगता है कॉल कट गई है। HappySmile को कॉल करने के लिए धन्यवाद।' : "Looks like we got disconnected. Thank you for calling HappySmile.";
      sess.transcript.push({ who: 'AIVA', text: q }); sess.hangup(); await speak(q); finish();
    }
  }

  async function onCaller(text) {
    if (!sess || sess.ended || !text) return;
    stopListening(); nudges = 0;
    status('“' + text + '”', true);
    const reply = sess.handle(text);
    persist();
    await speak(reply);
    startTurn();
  }

  // ---------- call control ----------
  async function startCall() {
    status('Connecting…');
    if (!TEST && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); } catch (e) { /* recognition will report it */ }
    }
    if (TEST || !SR) useTyping(TEST ? '' : 'Voice input needs Edge or Chrome. Type your reply instead.');
    await voicesReady();
    sess = AIVA.createSession({ source: 'Phone call' });
    t0 = Date.now(); nudges = 0;
    $('call').classList.add('live');
    clearInterval(tick); tick = setInterval(updateLabel, 500); updateLabel();
    const greet = sess.start(); persist(); status('');
    await speak(greet);
    startTurn();
  }
  function hangUp() {
    if (!sess || sess.ended) return;
    stopListening(); if (hasTTS) speechSynthesis.cancel();
    sess.hangup(); finish();
  }
  function finish() {
    stopListening(); clearInterval(tick);
    $('call').classList.remove('live', 'speaking', 'listening'); $('label').textContent = 'Call HappySmile';
    $('typed').hidden = true;
    if (!sess) return;
    const L = sess.toLead(); L.live = false; Store.upsert(L);
    const dur = fmt(L.durationSec);
    const what = L.booked ? `Booked: ${L.treatment}, ${L.clinic}, ${L.slot}` : L.priority ? 'Our team will call you back' : '';
    status('Call ended · ' + dur + (what ? ' · ' + what : ''));
  }
  const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  function updateLabel() { $('label').textContent = 'End call · ' + fmt(Math.round((Date.now() - t0) / 1000)); }
  function persist() { if (sess) { const l = sess.toLead(); l.live = !sess.ended; Store.upsert(l); } }
  function mode(m) {
    $('call').classList.toggle('speaking', m === 'speaking');
    $('call').classList.toggle('listening', m === 'listening');
    if (m === 'listening') status('Listening…');
  }
  function status(t) { $('status').textContent = t; }
  function useTyping(msg) { typedMode = true; $('typed').hidden = false; if (msg) status(msg); $('txt').focus(); }

  $('call').onclick = () => { if (sess && !sess.ended) hangUp(); else { typedMode = false; startCall(); } };
  $('send').onclick = () => { const v = $('txt').value.trim(); $('txt').value = ''; if (v) onCaller(v); };
  $('txt').onkeydown = e => { if (e.key === 'Enter') $('send').onclick(); };
})();
