// Screen 1: one "Call HappySmile" button. Hands-free browser voice call.
// - Speech out: Edge "Natural" neural voices when available (most human); waits for them to load.
// - Speech in: starts in en-IN (English + romanised Hinglish), switches to hi-IN once the caller speaks Hindi.
// - Barge-in: the mic stays open while AIVA talks; caller speech (not AIVA's own echo) stops AIVA mid-sentence.
(function () {
  const $ = id => document.getElementById(id);
  const TEST = /[?&]test\b/.test(location.search);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasTTS = 'speechSynthesis' in window;
  let sess = null, t0 = 0, tick = null, typedMode = false;
  let rec = null, recToken = 0, silenceTimer = null, nudges = 0;
  let ttsToken = 0, speakingText = null, speakStart = 0, aivaWords = new Set();
  const keep = []; // keep utterances referenced (Chrome drops onend for GC'd utterances)

  // ---------- voice out ----------
  let voices = [];
  const loadVoices = () => { voices = hasTTS ? speechSynthesis.getVoices() : []; showVoice(); };
  if (hasTTS) { loadVoices(); speechSynthesis.addEventListener('voiceschanged', loadVoices); }
  const hasNatural = () => voices.some(v => /Natural/i.test(v.name));
  // Edge loads offline (robotic) voices first and the online Natural ones a moment later; wait for those.
  const voicesReady = () => new Promise(r => {
    if (!hasTTS || TEST || hasNatural()) return r();
    const start = Date.now();
    const iv = setInterval(() => { loadVoices(); if (hasNatural() || Date.now() - start > 3000) { clearInterval(iv); r(); } }, 150);
  });
  function pickVoice(lang) {
    const L = lang === 'hi' ? 'hi-IN' : 'en-IN';
    const prefs = lang === 'hi'
      ? [v => /Swara/i.test(v.name) && /Natural/i.test(v.name), v => v.lang === L && /Natural/i.test(v.name), v => /Google/i.test(v.name) && v.lang === L, v => v.lang === L]
      : [v => /Neerja/i.test(v.name) && /Natural/i.test(v.name) && !/Expressive/i.test(v.name), v => v.lang === L && /Natural/i.test(v.name),
         v => /Natural/i.test(v.name) && /^en/.test(v.lang) && /Ava|Emma|Jenny|Aria|Sonia|Natasha/i.test(v.name),
         v => v.name === 'Google UK English Female', v => v.lang === L, v => /^en/.test(v.lang)];
    for (const p of prefs) { const v = voices.find(p); if (v) return v; }
    return null;
  }
  function showVoice() {
    const el = $('voiceName'); if (!el) return;
    const v = pickVoice('en');
    el.textContent = v ? 'Voice: ' + v.name.replace(/^Microsoft /, '').replace(/ - .*/, '') : '';
    el.style.color = v && /Natural/i.test(v.name) ? '' : '#d92d20';
    if (v && !/Natural/i.test(v.name)) el.textContent += ' (robotic: natural online voices not available here; use Microsoft Edge, online)';
  }
  // Make text sound spoken, not read: "₹6,000–12,000" -> "6,000 to 12,000 rupees".
  function spoken(text, lang) {
    let t = text.replace(/HappySmile/g, 'Happy Smile').replace(/\s*\(RCT\)/g, '');
    t = t.replace(/₹([\d,]+)\s*[–-]\s*([\d,]+)/g, (m, a, b) => lang === 'hi' ? `${a} से ${b} रुपये` : `${a} to ${b} rupees`);
    t = t.replace(/₹([\d,]+)/g, (m, a) => lang === 'hi' ? `${a} रुपये` : `${a} rupees`);
    if (lang === 'hi') t = t.replace(/per tooth/g, 'प्रति दाँत');
    return t.replace(/\s*\(([^)]*)\)/g, ', $1,').replace(/\s+/g, ' ').trim();
  }
  function speak(text, onDone) {
    const my = ++ttsToken;
    let done = false;
    const fin = () => { if (done) return; done = true; clearTimeout(guard); if (my !== ttsToken) return; speakingText = null; onDone && onDone(); };
    if (TEST || !hasTTS || !text) { var guard = setTimeout(fin, 0); return; }
    const lang = /[\u0900-\u097F]/.test(text) ? 'hi' : 'en';
    const v = pickVoice(lang), natural = v && /Natural|Online/i.test(v.name);
    const say = spoken(text, lang);
    // Neural voices read a whole reply smoothly in one go; local voices cut out on long text, so queue sentences back-to-back.
    const chunks = natural ? [say] : say.split(/(?<=[.!?।])\s+/).filter(Boolean);
    guard = setTimeout(fin, 6000 + say.length * 120);
    keep.length = 0;
    chunks.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c);
      if (v) u.voice = v; u.lang = v ? v.lang : (lang === 'hi' ? 'hi-IN' : 'en-IN'); u.rate = natural ? 1.04 : 1; u.pitch = 1;
      if (i === chunks.length - 1) u.onend = fin;
      u.onerror = fin; keep.push(u); speechSynthesis.speak(u);
    });
  }
  function stopSpeaking() { ttsToken++; speakingText = null; if (hasTTS) speechSynthesis.cancel(); }

  // AIVA says something. The mic stays open so the caller can interrupt.
  function aivaSays(text) {
    persist();
    speakingText = text; speakStart = Date.now();
    aivaWords = new Set(words(spoken(text, /[\u0900-\u097F]/.test(text) ? 'hi' : 'en')));
    mode('speaking');
    if (!sess.ended) startRec();
    speak(text, () => {
      if (!sess || sess.ended) return finish();
      startRec(); // fresh recogniser so AIVA's own echo isn't part of the caller's next turn
      mode('listening'); armSilence();
    });
  }

  // ---------- voice in ----------
  const words = t => String(t).toLowerCase().replace(/[.,!?।:;"'“”‘’]/g, ' ').split(/\s+/).filter(Boolean);
  const INTERRUPT = new Set(['stop', 'wait', 'sorry', 'hello', 'excuse', 'hold', 'ruko', 'ruk', 'रुको', 'रुकिए', 'suno', 'सुनो', 'no', 'nahi', 'नहीं', 'yes', 'haan', 'हाँ', 'हां', 'actually', 'arey', 'अरे']);
  // Is this recognised text the caller talking, or AIVA's own voice leaking from the speakers?
  function isCaller(t) {
    const w = words(t); if (!w.length) return false;
    const fresh = w.filter(x => !aivaWords.has(x));
    if (fresh.some(x => INTERRUPT.has(x))) return true;
    return fresh.length >= 2 && fresh.length / w.length >= 0.6;
  }
  function startRec() {
    if (!SR || typedMode || !sess || sess.ended) return;
    if (rec) { recToken++; try { rec.abort(); } catch (e) {} }
    const my = ++recToken, r = new SR(); rec = r;
    r.lang = sess.lang === 'hi' ? 'hi-IN' : 'en-IN'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    let from = 0, text = '', endT = null, heard = false;
    const commit = () => {
      if (my !== recToken) return; clearTimeout(endT);
      recToken++; try { r.abort(); } catch (e) {} rec = null;
      let w = words(text);
      if (from > 0) while (w.length && aivaWords.has(w[0])) w.shift(); // drop echo just before the interruption
      const t = w.join(' ');
      if (t) onCaller(t); else startRec();
    };
    r.onresult = e => {
      if (my !== recToken) return;
      if (speakingText) {
        if (sess.ended || Date.now() - speakStart < 700) return;
        const last = e.results[e.results.length - 1][0].transcript;
        if (!isCaller(last)) return;
        from = e.results.length - 1; stopSpeaking(); mode('listening'); // barge-in
      }
      text = ''; for (let i = from; i < e.results.length; i++) text += e.results[i][0].transcript + ' ';
      text = text.trim(); if (!text) return;
      heard = true; clearTimeout(silenceTimer); clearTimeout(endT);
      status('“' + text + '”');
      endT = setTimeout(commit, 1000); // caller paused ~1s: their sentence is finished
    };
    r.onerror = e => {
      if (my !== recToken) return;
      if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(e.error)) { recToken++; useTyping('Microphone or speech service unavailable. Type your reply instead.'); }
    };
    r.onend = () => { if (my !== recToken) return; if (heard && !speakingText) commit(); else setTimeout(() => { if (my === recToken) startRec(); }, 150); };
    try { r.start(); } catch (e) {}
  }
  function stopRec() { recToken++; clearTimeout(silenceTimer); if (rec) { try { rec.abort(); } catch (e) {} rec = null; } }

  function armSilence() { clearTimeout(silenceTimer); if (!typedMode) silenceTimer = setTimeout(onSilence, 9000); }
  function onSilence() {
    if (!sess || sess.ended || speakingText) return;
    nudges++;
    const hi = sess.lang === 'hi';
    let q;
    if (nudges === 1) q = hi ? 'हेलो? क्या आप लाइन पर हैं?' : 'Hello? Are you still there?';
    else { q = hi ? 'लगता है कॉल कट गई है। हमारी फ्रंट डेस्क टीम जल्द ही आपसे संपर्क करेगी।' : 'Looks like we got disconnected. Our front desk will get back in touch with you soon.'; sess.hangup(); }
    sess.transcript.push({ who: 'AIVA', text: q });
    aivaSays(q);
  }

  function onCaller(text) {
    if (!sess || sess.ended || !text) return;
    stopRec(); stopSpeaking(); nudges = 0;
    status('“' + text + '”');
    aivaSays(sess.handle(text));
  }

  // ---------- call control ----------
  async function startCall() {
    status('Connecting…');
    if (!TEST && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try { const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); s.getTracks().forEach(t => t.stop()); } catch (e) { /* recognition will report it */ }
    }
    if (TEST || !SR) useTyping(TEST ? '' : 'Voice input needs Edge or Chrome. Type your reply instead.');
    await voicesReady();
    sess = AIVA.createSession({ source: 'Phone call' });
    t0 = Date.now(); nudges = 0;
    $('call').classList.add('live');
    clearInterval(tick); tick = setInterval(updateLabel, 500); updateLabel();
    status('');
    aivaSays(sess.start());
  }
  function hangUp() {
    if (!sess || sess.ended) return;
    stopRec(); stopSpeaking(); sess.hangup(); finish();
  }
  function finish() {
    stopRec(); clearInterval(tick); clearTimeout(silenceTimer);
    $('call').classList.remove('live', 'speaking', 'listening'); $('label').textContent = 'Call HappySmile';
    $('typed').hidden = true;
    if (!sess) return;
    const L = sess.toLead(); L.live = false; Store.upsert(L);
    const what = L.booked ? `Booked: ${L.treatment}, ${L.clinic}, ${L.slot}` : L.priority ? 'Front desk will call back' : '';
    status('Call ended · ' + fmt(L.durationSec) + (what ? ' · ' + what : ''));
  }
  const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  function updateLabel() { $('label').textContent = 'End call · ' + fmt(Math.round((Date.now() - t0) / 1000)); }
  function persist() { if (sess) { const l = sess.toLead(); l.live = !sess.ended; Store.upsert(l); } }
  function mode(m) {
    $('call').classList.toggle('speaking', m === 'speaking');
    $('call').classList.toggle('listening', m === 'listening');
  }
  function status(t) { $('status').textContent = t; }
  function useTyping(msg) { typedMode = true; $('typed').hidden = false; if (msg) status(msg); $('txt').focus(); }

  $('call').onclick = () => { if (sess && !sess.ended) hangUp(); else { typedMode = false; startCall(); } };
  $('send').onclick = () => { const v = $('txt').value.trim(); $('txt').value = ''; if (v) onCaller(v); };
  $('txt').onkeydown = e => { if (e.key === 'Enter') $('send').onclick(); };
  window.addEventListener('load', showVoice);
})();
