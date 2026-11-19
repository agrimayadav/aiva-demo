// AIVA conversation engine: deterministic, rule-based prototype.
// Production would swap keyword matching for an LLM + Indic speech models,
// keeping the same guardrails (disclosure, consent, DB-only answers, escalation).
(function (root) {
  const DB = {
    clinics: {
      indiranagar: { en: 'Indiranagar', hi: 'इंदिरानगर', address: '100 Feet Road, Indiranagar',
        slots: [
          { en: 'Saturday at 11 AM', hi: 'शनिवार सुबह 11 बजे', h: '11', w: ['eleven', 'ग्यारह', 'gyarah'], d: 'sat' },
          { en: 'Saturday at 4 PM', hi: 'शनिवार शाम 4 बजे', h: '4', w: ['four', 'चार', 'char'], d: 'sat' }] },
      koramangala: { en: 'Koramangala', hi: 'कोरमंगला', address: '80 Feet Road, Koramangala 4th Block',
        slots: [
          { en: 'Friday at 6 PM', hi: 'शुक्रवार शाम 6 बजे', h: '6', w: ['six', 'छह', 'छः', 'chhe', 'chhah'], d: 'fri' },
          { en: 'Saturday at 10 AM', hi: 'शनिवार सुबह 10 बजे', h: '10', w: ['ten', 'दस', 'das'], d: 'sat' }] },
      whitefield: { en: 'Whitefield', hi: 'व्हाइटफ़ील्ड', address: 'ITPL Main Road, Whitefield',
        slots: [
          { en: 'Thursday at 5 PM', hi: 'गुरुवार शाम 5 बजे', h: '5', w: ['five', 'पांच', 'पाँच', 'paanch', 'panch'], d: 'thu' },
          { en: 'Saturday at 12 noon', hi: 'शनिवार दोपहर 12 बजे', h: '12', w: ['twelve', 'noon', 'बारह', 'barah', 'दोपहर'], d: 'sat' }] }
    },
    treatments: {
      braces: { en: 'braces', hi: 'ब्रेसेस', price: '₹35,000–90,000' },
      whitening: { en: 'teeth whitening', hi: 'दाँतों की व्हाइटनिंग', price: '₹6,000–12,000' },
      implant: { en: 'dental implant', hi: 'इम्प्लांट', price: '₹25,000–45,000 per tooth' },
      cleaning: { en: 'cleaning', hi: 'सफ़ाई', price: '₹1,000–1,500' },
      rct: { en: 'root canal (RCT)', hi: 'रूट कैनाल', price: '₹5,000–9,000' },
      checkup: { en: 'general check-up', hi: 'जनरल चेक-अप', price: '₹300 consultation' }
    }
  };

  const KW = {
    clinic: {
      indiranagar: ['indiranagar', 'indira nagar', 'indira', 'इंदिरा', 'इंदिरानगर', 'इंद्रानगर'],
      koramangala: ['koramangala', 'kormangala', 'kora', 'कोरमंगला', 'कोरमंगल', 'कोरामंगला'],
      whitefield: ['whitefield', 'white field', 'itpl', 'व्हाइटफ़ील्ड', 'व्हाइटफील्ड', 'वाइटफील्ड', 'व्हाइट फील्ड']
    },
    treatment: {
      braces: ['brace', 'aligner', 'crooked', 'straighten', 'ब्रेस', 'ब्रेसेस', 'ब्रेसिस', 'ब्रेसेज़', 'टेढ़े', 'tedhe', 'clip', 'क्लिप', 'अलाइनर'],
      whitening: ['whiten', 'white', 'yellow', 'safed', 'सफ़ेद', 'सफेद', 'पीले', 'peele', 'व्हाइटनिंग', 'वाइटनिंग', 'व्हाइट'],
      implant: ['implant', 'missing tooth', 'missing teeth', 'इम्प्लांट', 'इंप्लांट', 'नकली दाँत', 'nakli'],
      cleaning: ['clean', 'scaling', 'सफ़ाई', 'सफाई', 'safai', 'क्लीनिंग', 'स्केलिंग'],
      rct: ['root canal', 'rct', 'रूट कैनाल', 'रूट', 'आरसीटी'],
      checkup: ['check', 'consult', 'चेक', 'जाँच', 'जांच', 'janch', 'कंसल्ट']
    },
    book: ['book', 'appointment', 'बुक', 'अपॉइंटमेंट', 'अपॉइंटमेंट', 'slot', 'स्लॉट', 'dentist', 'डेंटिस्ट', 'dikhana', 'दिखाना', 'help', 'मदद'],
    hello: ['hello', 'hi', 'hey', 'namaste', 'नमस्ते', 'हेलो', 'हैलो', 'good morning', 'good evening'],
    urgentStrong: ['swell', 'swollen', 'bleed', 'blood', 'fever', 'abscess', 'pus', 'broken tooth', 'tooth broke', 'accident', 'emergency',
      'sujan', 'soojan', 'सूजन', 'khoon', 'खून', 'bukhar', 'बुखार', 'टूट', 'इमरजेंसी', 'मवाद', 'स्वेलिंग', 'ब्लीडिंग'],
    painWords: ['pain', 'hurt', 'ache', 'dard', 'दर्द', 'पेन'],
    questionWords: ['will ', 'does ', 'is it', 'is the', 'would ', '?', 'hoga', 'होगा', 'होता', 'kya ', 'क्या '],
    medical: ['medicine', 'tablet', 'dawai', 'दवा', 'दवाई', 'eat', 'khana', 'खाना', 'safe', 'side effect', 'should i', 'infection',
      'antibiotic', 'x-ray', 'xray', 'pregnan', 'diabet', 'sugar', 'normal hai', 'नॉर्मल', 'painful', 'dard hoga', 'दर्द होगा'],
    negotiate: ['discount', 'cheaper', 'sasta', 'सस्ता', 'kam kar', 'कम कर', 'emi', 'ईएमआई', 'insurance', 'बीमा', 'offer', 'negotiat',
      'installment', 'kist', 'किस्त'],
    human: ['human', 'real person', 'a person', 'staff', 'receptionist', 'insaan', 'इंसान', 'kisi se baat', 'किसी से बात', 'manager',
      'call me back', 'callback', 'असली', 'पर्सन', 'स्टाफ'],
    cancel: ['cancel', 'रद्द', 'radd', 'कैंसल', 'कैंसिल'],
    price: ['price', 'cost', 'charge', 'fee', 'kitna', 'कितना', 'kitne', 'कितने', 'rate', 'paise', 'पैसे', 'kharcha', 'खर्च', 'कीमत', 'keemat',
      'प्राइस', 'कॉस्ट', 'चार्ज', 'फीस'],
    hours: ['timing', 'open', 'hours', 'kab khul', 'कब खुल', 'khula', 'खुला', 'sunday', 'ravivar', 'रविवार', 'टाइमिंग'],
    location: ['where', 'address', 'location', 'kahan', 'कहाँ', 'कहां', 'direction', 'पता', 'लोकेशन', 'एड्रेस'],
    no: ["don't", 'dont', 'not ok', 'nope', 'nahi', 'nahin', 'नहीं', 'नही', 'mat ', 'मत', 'no', 'नो'],
    yes: ['yes', 'yeah', 'yup', 'sure', 'okay', 'ok', 'fine', 'haan', 'han', 'हाँ', 'हां', 'ठीक', 'theek', 'thik', 'bilkul', 'बिल्कुल',
      'go ahead', 'chalega', 'चलेगा', 'ji', 'जी', 'यस', 'ओके', 'श्योर'],
    first: ['first', 'one', 'pehla', 'pehle', 'पहला', 'पहले', 'एक', ' ek ', 'फर्स्ट'],
    second: ['second', 'two', 'doosra', 'dusra', 'दूसरा', 'दूसरे', ' do ', 'सेकंड', 'सेकेंड'],
    otherSlot: ['none', 'neither', 'other', 'another', 'koi aur', 'कोई और', 'different', 'kuch aur', 'कुछ और'],
    days: { sat: ['saturday', 'sat ', 'shani', 'शनि', 'सैटरडे'], fri: ['friday', 'fri ', 'shukr', 'शुक्र', 'फ्राइडे'], thu: ['thursday', 'thu ', 'guru', 'गुरु', 'थर्सडे'] }
  };

  // Short latin keywords match whole words only (so "ok" doesn't match "book").
  const has = (t, list) => list.some(k => {
    if (/^[a-z]+$/.test(k) && k.length <= 3) return new RegExp('(^|[^a-z])' + k + '([^a-z]|$)').test(t);
    if (/^[\u0900-\u097F]+$/.test(k) && k.length <= 2) return t.includes(' ' + k + ' ');
    return t.includes(k);
  });

  // Per-turn language detection: reply in the language the caller is using (Hinglish -> Hindi replies).
  const HI_MARK = ['है', 'हैं', 'मुझे', 'मेरा', 'मेरे', 'मेरी', 'नहीं', 'हाँ', 'हां', 'क्या', 'कितना', 'कितने', 'कब', 'कहाँ', 'कहां', 'चाहिए',
    'करना', 'करवाना', 'करवानी', 'लगवाने', 'जी', 'ठीक', 'बजे', 'में', 'का', 'की', 'के', 'और', 'दीजिए', 'बताइए', 'बताओ', 'धन्यवाद', 'शुक्रिया', 'वाला', 'वाले',
    'hai', 'hain', 'mujhe', 'mera', 'meri', 'mere', 'nahi', 'nahin', 'haan', 'kya', 'kitna', 'kitne', 'kab', 'kahan', 'chahiye', 'karna',
    'karwana', 'karwani', 'lagwane', 'lagwana', 'baje', 'ji', 'theek', 'thik', 'aur', 'wala', 'batao', 'bataiye', 'dijiye', 'kaise', 'accha', 'achha', 'ka', 'ki', 'ke', 'mein'];
  const EN_MARK = ['i', "i'm", 'want', 'the', 'is', 'my', 'what', 'how', 'much', 'can', 'please', 'yes', 'no', 'okay', 'thanks', 'thank',
    'where', 'when', 'need', 'would', 'like', 'you', 'for', 'to', 'a', 'it', 'does', 'get', 'book', 'appointment',
    'यस', 'ओके', 'प्लीज', 'थैंक', 'थैंक्यू', 'आई', 'वांट', 'माय', 'व्हाट', 'हाउ'];
  function detectLang(raw) {
    const words = String(raw).toLowerCase().replace(/[.,!?।]/g, ' ').split(/\s+/).filter(Boolean);
    const hi = words.filter(w => HI_MARK.includes(w)).length, en = words.filter(w => EN_MARK.includes(w)).length;
    return hi > en ? 'hi' : en > hi ? 'en' : null;
  }
  const findKey = (t, map) => Object.keys(map).find(k => has(t, map[k]));
  const stripClinics = t => Object.values(KW.clinic).flat().reduce((s, k) => s.split(k).join(' '), t);
  const cap = x => x.charAt(0).toUpperCase() + x.slice(1);

  function loadRules() {
    try { return JSON.parse((root.localStorage && root.localStorage.getItem('aiva_rules')) || '{}'); } catch (e) { return {}; }
  }

  const T = {
    greet: {
      en: "Welcome to HappySmile's AI assistant. This call is being recorded. You can talk to me in English or Hindi. How can I help you today?",
      hi: 'HappySmile की AI असिस्टेंट में आपका स्वागत है। यह कॉल रिकॉर्ड हो रही है। आप मुझसे हिंदी या इंग्लिश में बात कर सकते हैं। बताइए, मैं आपकी क्या मदद करूँ?'
    },
    openHelp: {
      en: "Sure, happy to help! What's it for? Braces, whitening, an implant, a cleaning, a root canal, or just a check-up?",
      hi: 'ज़रूर। ब्रेसेस, व्हाइटनिंग, इम्प्लांट, सफ़ाई, रूट कैनाल, या जनरल चेक-अप, किसके लिए?'
    },
    askTreatment: {
      en: "What would you like to come in for? Braces, whitening, an implant, a cleaning, a root canal, or just a check-up?",
      hi: 'आप किस ट्रीटमेंट के बारे में जानना चाहते हैं: ब्रेसेस, व्हाइटनिंग, इम्प्लांट, सफ़ाई, रूट कैनाल, या जनरल चेक-अप?'
    },
    gotTreatment: { en: tr => `Okay, ${tr}.`, hi: tr => `ठीक है, ${tr}।` },
    askClinic: {
      en: "Which clinic is easiest for you? We're in Indiranagar, Koramangala and Whitefield.",
      hi: 'आपके लिए कौन सा क्लिनिक ठीक रहेगा: इंदिरानगर, कोरमंगला या व्हाइटफ़ील्ड?'
    },
    offerSlots: {
      en: (c, a, b) => `At ${c}, I can do ${a}, or ${b}. Which one works better for you?`,
      hi: (c, a, b) => `${c} में ${a} या ${b} का स्लॉट खाली है। आपके लिए कौन सा ठीक है?`
    },
    askName: { en: 'Perfect. And what name should I put the booking under?', hi: 'बढ़िया। बुकिंग के लिए आपका नाम बता दीजिए?' },
    booked: {
      en: (n, tr, c, s) => `All done, ${n}! You're booked for a ${tr} consultation at our ${c} clinic, on ${s}. The consultation is ₹300, and that's adjusted against your treatment.`,
      hi: (n, tr, c, s) => `हो गया, ${n} जी। आपका ${tr} कंसल्टेशन HappySmile ${c} में ${s} बुक हो गया है। कंसल्टेशन फ़ीस ₹300 है, जो ट्रीटमेंट में एडजस्ट हो जाती है।`
    },
    lowConf: {
      en: ' Someone from our team will give you a quick call to confirm the details.',
      hi: ' हमारी टीम डिटेल्स कन्फ़र्म करने के लिए आपको एक छोटी सी कॉल भी करेगी।'
    },
    anythingElse: { en: 'Is there anything else I can help you with?', hi: 'और कुछ मदद कर सकती हूँ?' },
    bye: { en: 'Thanks for calling HappySmile. Take care!', hi: 'HappySmile को कॉल करने के लिए धन्यवाद। अपना ख़्याल रखिए!' },
    sorry: { en: "Sorry, I didn't quite get that. ", hi: 'माफ़ कीजिए, मैं समझ नहीं पाई। ' },
    cancelAsk: { en: 'Sure. What name is the booking under?', hi: 'ज़रूर। बुकिंग किस नाम से है?' },
    cancelled: {
      en: n => `Done. I've cancelled the booking under ${n}. Would you like to pick a new slot instead?`,
      hi: n => `हो गया। ${n} के नाम की बुकिंग कैंसल कर दी है। क्या आप नया स्लॉट बुक करना चाहेंगे?`
    },
    hours: { en: "All our clinics are open from 9 in the morning to 8 at night, Monday to Saturday.", hi: 'हमारे सभी क्लिनिक सोमवार से शनिवार, सुबह 9 से रात 8 बजे तक खुले रहते हैं।' },
    priceOne: {
      en: (tr, p) => `For ${tr.toLowerCase()}, it's usually ${p}. The dentist will confirm the exact price after a check-up, and the consultation itself is just ₹300.`,
      hi: (tr, p) => `${tr} का खर्च आमतौर पर ${p} होता है। सही कीमत डॉक्टर की जाँच के बाद तय होती है। कंसल्टेशन ₹300 है, जो ट्रीटमेंट में एडजस्ट हो जाता है।`
    },
    priceAll: {
      en: "It depends on the treatment. For example, cleaning is ₹1,000–1,500, whitening ₹6,000–12,000 and braces ₹35,000–90,000. The final price is decided after the dentist's check-up.",
      hi: 'यह ट्रीटमेंट पर निर्भर करता है। जैसे सफ़ाई ₹1,000–1,500, व्हाइटनिंग ₹6,000–12,000 और ब्रेसेस ₹35,000–90,000। सही कीमत डॉक्टर की जाँच के बाद तय होती है।'
    },
    locOne: { en: (c, a) => `Our ${c} clinic is on ${a}.`, hi: (c, a) => `हमारा ${c} क्लिनिक ${a} पर है।` },
    locAll: {
      en: 'We have clinics in Indiranagar on 100 Feet Road, Koramangala on 80 Feet Road, and Whitefield on ITPL Main Road.',
      hi: 'हमारे क्लिनिक इंदिरानगर (100 फ़ीट रोड), कोरमंगला (80 फ़ीट रोड) और व्हाइटफ़ील्ड (ITPL मेन रोड) में हैं।'
    },
    bookNudge: { en: 'Would you like me to book a consultation? ', hi: 'क्या मैं आपके लिए कंसल्टेशन बुक कर दूँ? ' },
    handoff: {
      P0: {
        en: "Oh, I'm sorry to hear that. Since this sounds urgent, I've flagged it for our clinic team, and they'll call you within 15 minutes. If the swelling gets severe, or you have trouble breathing or swallowing, please go to the nearest emergency room right away.",
        hi: 'यह जल्दी देखने वाली बात लगती है, इसलिए मैं सिर्फ़ स्लॉट बुक नहीं करूँगी। मैंने इसे अर्जेंट मार्क कर दिया है, हमारी टीम 15 मिनट में आपको कॉल करेगी। अगर सूजन बहुत ज़्यादा है या साँस लेने या निगलने में दिक्कत है, तो तुरंत नज़दीकी इमरजेंसी में जाएँ।'
      },
      medical: {
        en: "That's a really good question, but it's one for our dentist, since I can't give medical advice. I've passed it on, and someone from our team will call you back today.",
        hi: 'यह सवाल हमारे डॉक्टर के लिए है, मैं मेडिकल सलाह नहीं दे सकती। मैंने आपकी डिटेल्स टीम को भेज दी हैं, आज ही कोई आपको कॉल करेगा।'
      },
      negotiate: {
        en: "Our team can walk you through EMI and payment options properly. I've passed on your request, and they'll call you back today.",
        hi: 'EMI और पेमेंट के विकल्प हमारी टीम अच्छे से समझा पाएगी। मैंने आपकी रिक्वेस्ट भेज दी है, आज ही कोई आपको कॉल करेगा।'
      },
      human: {
        en: "Of course. I've asked our front desk to call you back shortly, and I've shared our conversation, so you won't have to repeat yourself.",
        hi: 'ज़रूर। मैंने टीम से कहा है कि आपको जल्दी कॉल करें, और हमारी बातचीत भी शेयर कर दी है ताकि आपको दोबारा बताना न पड़े।'
      },
      confused: {
        en: "I'm sorry, I'm having trouble understanding you. Our front desk will get back in touch with you soon.",
        hi: 'माफ़ कीजिए, मुझे समझने में दिक्कत हो रही है। हमारी फ्रंट डेस्क टीम जल्द ही आपसे संपर्क करेगी।'
      },
      noConsent: {
        en: "No problem at all. I'll stop here, and our front desk will call you back shortly.",
        hi: 'कोई बात नहीं, मैं यह कॉल आगे नहीं बढ़ाऊँगी। हमारी टीम का कोई सदस्य आपको जल्दी कॉल करेगा।'
      },
      otherSlot: {
        en: "Got it. I'll ask our front desk to call you with more options at that clinic.",
        hi: 'समझ गई। मैं टीम से कहूँगी कि उस क्लिनिक के और स्लॉट के लिए आपको कॉल करें।'
      }
    }
  };

  const HANDOFF_META = {
    P0: { priority: 'P0', reason: 'Urgent symptom reported', next: 'Call within 15 minutes; dentist to assess urgency.' },
    medical: { priority: 'P1', reason: 'Clinical question (AIVA gives no medical advice)', next: 'Dentist or senior staff to answer, then offer a consultation.' },
    negotiate: { priority: 'P1', reason: 'Price / EMI / insurance discussion', next: 'Explain EMI and payment options, then offer a slot.' },
    human: { priority: 'P2', reason: 'Asked to speak to a person', next: 'Call back today; context below, no need to re-ask.' },
    confused: { priority: 'P2', reason: 'AIVA could not understand the caller', next: 'Call back; check language preference.' },
    noConsent: { priority: 'P2', reason: 'Declined the AI call / recording', next: 'Human callback; do not route this lead to AIVA.' },
    otherSlot: { priority: 'P2', reason: 'Wanted a slot AIVA could not offer', next: 'Offer more slots at the preferred clinic.' }
  };

  function createSession(opts) {
    opts = opts || {};
    let lang = opts.lang === 'hi' ? 'hi' : 'en';
    const rules = loadRules();
    const extraUrgent = (rules.urgentExtra || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
    const s = {
      id: 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      lang, source: opts.source || 'Website enquiry', state: 'treatment', consent: true, langsUsed: {},
      treatment: opts.treatment || null, enquiredTreatment: opts.treatment || null,
      clinic: null, slot: null, name: null, cancelledName: null, misses: 0, confidence: 1, slotsOffered: false,
      outcome: null, handoff: null, transcript: [], startedAt: Date.now(), endedAt: null, lastUserQuote: '', ended: false
    };
    const say = txt => { s.transcript.push({ who: 'AIVA', text: txt }); return txt; };
    const t = (key, ...a) => { const v = T[key][lang]; return typeof v === 'function' ? v(...a) : v; };
    const trName = k => DB.treatments[k][lang];
    const clName = k => DB.clinics[k][lang];

    function promptFor(state) {
      if (state === 'treatment') return t('askTreatment');
      if (state === 'clinic') return t('askClinic');
      if (state === 'slot') { const c = DB.clinics[s.clinic]; return t('offerSlots', clName(s.clinic), c.slots[0][lang], c.slots[1][lang]); }
      if (state === 'name') return t('askName');
      if (state === 'anything') return t('anythingElse');
      return '';
    }
    function goto(state) { s.state = state; if (state === 'slot') s.slotsOffered = true; return promptFor(state); }
    function end(outcome) { if (s.outcome !== 'booked') s.outcome = outcome; s.ended = true; s.endedAt = Date.now(); }
    function handoff(kind) {
      s.handoff = Object.assign({ kind }, HANDOFF_META[kind]);
      end('handoff');
      return say(T.handoff[kind][lang] + ' ' + t('bye'));
    }
    function miss(retryPrompt) {
      s.misses++; s.streak = (s.streak || 0) + 1; s.confidence = Math.max(0, s.confidence - 0.2);
      if (s.streak >= 2 || s.misses >= 3) return handoff('confused');
      return say(t('sorry') + retryPrompt);
    }

    // Safety and info intents are checked at every step, before the booking flow.
    function globalIntents(x) {
      const isQuestion = has(x, KW.questionWords) || /\?/.test(s.lastUserQuote);
      if (has(x, ['record', 'रिकॉर्ड', 'रिकॉर्डिंग']) && has(x, KW.no)) return handoff('noConsent');
      if (has(x, KW.urgentStrong) || extraUrgent.some(k => x.includes(k)) || (has(x, KW.painWords) && !isQuestion)) return handoff('P0');
      if (has(x, KW.medical) || (has(x, KW.painWords) && isQuestion)) return handoff('medical');
      if (has(x, KW.negotiate)) return handoff('negotiate');
      if (has(x, KW.human)) return handoff('human');
      if (has(x, KW.cancel)) { s.state = 'cancelName'; return say(t('cancelAsk')); }
      const info = [];
      if (has(x, KW.price)) {
        const tk = findKey(stripClinics(x), KW.treatment) || s.treatment;
        if (tk) { s.treatment = s.treatment || tk; info.push(t('priceOne', cap(trName(tk)), DB.treatments[tk].price)); } else info.push(t('priceAll'));
      }
      if (has(x, KW.hours) && s.state !== 'slot') info.push(t('hours'));
      if (has(x, KW.location)) {
        const ck = findKey(x, KW.clinic) || s.clinic;
        info.push(ck ? t('locOne', clName(ck), DB.clinics[ck].address) : t('locAll'));
      }
      if (info.length) {
        if (!s.outcome) s.outcome = 'info';
        let next = s.state;
        if (next === 'anything' || next === 'consent') {
          if (s.outcome === 'booked') return say(info.join(' ') + ' ' + goto('anything'));
          next = s.treatment ? 'clinic' : 'treatment';
        }
        if (next === 'treatment' && s.treatment) next = s.clinic ? 'slot' : 'clinic';
        const nudge = (next === 'treatment' || next === 'clinic') ? t('bookNudge') : '';
        return say(info.join(' ') + ' ' + nudge + goto(next));
      }
      return null;
    }

    function extractName(raw) {
      let n = String(raw)
        .replace(/\b(my name is|name is|i am|i'm|this is|it's|it is|mera naam|naam|hai|ji)\b/gi, ' ')
        .replace(/मेरा नाम|नाम|है|जी|[.,!?।]/g, ' ')
        .trim().replace(/\s+/g, ' ');
      n = n.split(' ').slice(0, 3).join(' ');
      return n ? n.split(' ').map(cap).join(' ') : '';
    }

    s.start = function () { return say(t('greet')); };

    s.handle = function (raw) {
      const before = s.misses, r = handleTurn(raw);
      if (s.misses === before) s.streak = 0;
      return r;
    };
    function handleTurn(raw) {
      if (s.ended) return '';
      const x = ' ' + String(raw || '').toLowerCase().replace(/[.,!?।]/g, ' ').trim() + ' ';
      const dl = detectLang(raw); if (dl) { lang = dl; s.lang = dl; }
      s.langsUsed[s.lang] = true;
      s.transcript.push({ who: 'Caller', text: String(raw) });
      s.lastUserQuote = String(raw);

      if (s.state === 'consent') {
        if (has(x, KW.no) && !x.includes('no problem')) return handoff('noConsent');
        if (has(x, KW.yes)) {
          s.consent = true;
          const g = globalIntents(x); if (g) return g;
          if (s.treatment) return say(t('gotTreatment', trName(s.treatment)) + ' ' + goto('clinic'));
          return say(goto('treatment'));
        }
        const g = globalIntents(x); if (g) { s.consent = true; return g; }
        return miss(t('greet'));
      }

      if (s.state === 'cancelName') {
        const n = extractName(raw);
        if (!n) return miss(t('cancelAsk'));
        s.cancelledName = n; if (s.outcome !== 'booked') s.outcome = 'cancelled'; s.state = 'rebook';
        return say(t('cancelled', n));
      }
      if (s.state === 'rebook') {
        if (has(x, KW.yes) && !has(x, KW.no)) return say(s.treatment ? goto('clinic') : goto('treatment'));
        end('cancelled'); return say(t('bye'));
      }

      if (s.state === 'name') {
        if (has(x, KW.urgentStrong) || has(x, KW.human)) return globalIntents(x);
        const n = extractName(raw);
        if (!n || n.length < 2) return miss(t('askName'));
        s.name = n; s.outcome = 'booked'; s.state = 'anything';
        const slot = DB.clinics[s.clinic].slots[s.slot];
        let reply = t('booked', n, trName(s.treatment || 'checkup'), clName(s.clinic), slot[lang]);
        if (s.confidence < 0.7) reply += t('lowConf');
        return say(reply + ' ' + t('anythingElse'));
      }

      if (s.state === 'anything') {
        const g = globalIntents(x); if (g) return g;
        if (has(x, KW.no) || has(x, ['thank', 'dhanyavad', 'धन्यवाद', 'shukriya', 'शुक्रिया', 'bas', 'बस', "that's all"])) {
          end(s.outcome || 'info'); return say(t('bye'));
        }
        const tk = findKey(stripClinics(x), KW.treatment);
        if (tk || has(x, ['book', 'appointment', 'बुक', 'अपॉइंटमेंट'])) { if (tk) s.treatment = tk; return say(s.treatment ? goto('clinic') : goto('treatment')); }
        return miss(t('anythingElse'));
      }

      const g = globalIntents(x); if (g) return g;

      if (s.state === 'treatment') {
        const tk = findKey(stripClinics(x), KW.treatment);
        const ck = findKey(x, KW.clinic);
        if (!tk) {
          if (ck) s.clinic = ck;
          if (!s.openHelped && (ck || has(x, KW.book) || has(x, KW.yes) || has(x, KW.hello))) { s.openHelped = true; return say(t('openHelp')); }
          return miss(t('askTreatment'));
        }
        s.treatment = tk;
        if (ck || s.clinic) { s.clinic = ck || s.clinic; return say(t('gotTreatment', trName(tk)) + ' ' + goto('slot')); }
        return say(t('gotTreatment', trName(tk)) + ' ' + goto('clinic'));
      }

      if (s.state === 'clinic') {
        const ck = findKey(x, KW.clinic);
        if (!ck) {
          const tk = findKey(stripClinics(x), KW.treatment);
          if (tk) { s.treatment = tk; return say(t('gotTreatment', trName(tk)) + ' ' + t('askClinic')); }
          if (!s.clinicNudged && (has(x, KW.book) || has(x, KW.yes))) { s.clinicNudged = true; return say(t('askClinic')); }
          return miss(t('askClinic'));
        }
        s.clinic = ck; return say(goto('slot'));
      }

      if (s.state === 'slot') {
        if (has(x, KW.otherSlot)) return handoff('otherSlot');
        const slots = DB.clinics[s.clinic].slots;
        let pick = null;
        slots.forEach((sl, i) => { if (new RegExp('(^|[^0-9])' + sl.h + '([^0-9]|$)').test(x) || has(x, sl.w)) pick = i; });
        if (pick === null && has(x, KW.second)) pick = 1;
        if (pick === null && has(x, KW.first)) pick = 0;
        if (pick === null) {
          const byDay = slots.map((sl, i) => has(x, KW.days[sl.d]) ? i : -1).filter(i => i >= 0);
          if (byDay.length === 1) pick = byDay[0];
          else if (byDay.length > 1 || (has(x, KW.yes) && !has(x, KW.no))) { pick = 0; s.confidence -= 0.35; } // ambiguous: guess, flag for staff
        }
        if (pick === null) return miss(promptFor('slot'));
        s.slot = pick; return say(goto('name'));
      }
      return miss('');
    };

    s.hangup = function () {
      if (s.ended) return;
      s.ended = true; s.endedAt = Date.now();
      if (!s.outcome) s.outcome = 'dropped';
    };

    s.toLead = function () {
      const dur = Math.round(((s.endedAt || Date.now()) - s.startedAt) / 1000);
      const tk = s.treatment || s.enquiredTreatment;
      const tr = tk ? DB.treatments[tk].en : 'not stated';
      const cl = s.clinic ? DB.clinics[s.clinic].en : null;
      const sl = s.clinic && s.slot !== null ? DB.clinics[s.clinic].slots[s.slot].en : null;
      const langName = Object.keys(s.langsUsed).length > 1 ? 'Hinglish (Hindi + English)' : (s.lang === 'hi' ? 'Hindi' : 'English');
      let summary;
      if (s.outcome === 'booked') summary = `Booked ${tr} consultation at ${cl}, ${sl}, for ${s.name}. Spoke ${langName}.` + (s.handoff ? ` Later flagged: ${s.handoff.reason}.` : '');
      else if (s.outcome === 'handoff') summary = `${s.handoff.reason}. Interested in ${tr}${cl ? ' at ' + cl : ''}. Caller said: "${s.lastUserQuote}". Spoke ${langName}.`;
      else if (s.outcome === 'cancelled') summary = `Cancelled the booking under ${s.cancelledName}; did not rebook. Spoke ${langName}.`;
      else if (s.outcome === 'info') summary = `Asked for information only (${tr}); did not book. Spoke ${langName}.`;
      else summary = s.slotsOffered ? `Hung up after hearing slot options${cl ? ' at ' + cl : ''} (${tr}).` : (s.transcript.some(x => x.who === 'Caller') ? `Hung up after ${dur}s, before booking.` : `Hung up after ${dur}s without saying anything.`);
      const priority = s.handoff ? s.handoff.priority : null;
      return {
        id: s.id, time: s.startedAt, lang: langName, source: s.source, treatment: tr, clinic: cl, slot: sl, name: s.name || s.cancelledName || null,
        outcome: s.handoff && s.outcome === 'booked' ? 'handoff' : s.outcome, priority, reason: s.handoff ? s.handoff.reason : null,
        next: s.handoff ? s.handoff.next : (s.outcome === 'dropped' || s.outcome === 'info' ? 'Optional follow-up: showed interest but did not book.' : null),
        confidence: s.outcome === 'booked' ? Math.round(Math.max(0, s.confidence) * 100) : null,
        booked: s.outcome === 'booked',
        durationSec: dur, earlyDrop: s.outcome === 'dropped' && !s.slotsOffered && (dur < 30 || !s.consent),
        endedAfterSlots: s.slotsOffered && s.outcome !== 'booked', summary, transcript: s.transcript, live: true
      };
    };
    return s;
  }

  const api = { createSession, DB, HANDOFF_META };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AIVA = api;
})(typeof window !== 'undefined' ? window : globalThis);
