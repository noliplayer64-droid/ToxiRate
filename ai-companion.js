// ai-companion.js
// Fully local AI-like assistant for ToxiRate — OpenAI integration removed.
// Features:
// - Fuzzy species matching and synonyms
// - Conversation history (sessionStorage)
// - Quick actions (Calculate PRR, Show species details, Emergency escalation)
// - Safety-first rules and prominent emergency banner when high-risk symptoms detected
// - Typing animation for bot replies and structured, copyable advice
// - Accessible and keyboard-friendly interactions

(function(){
  // --- Utilities -----------------------------------------------------------
  function esc(s){ return String(s||"").replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function nowISO(){ return new Date().toISOString(); }

  // Simple Levenshtein distance for fuzzy matching
  function levenshtein(a, b){
    if(a === b) return 0;
    const al = a.length, bl = b.length;
    if(al === 0) return bl;
    if(bl === 0) return al;
    const matrix = Array.from({length: al+1}, () => Array(bl+1).fill(0));
    for(let i=0;i<=al;i++) matrix[i][0] = i;
    for(let j=0;j<=bl;j++) matrix[0][j] = j;
    for(let i=1;i<=al;i++){
      for(let j=1;j<=bl;j++){
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i-1][j] + 1,
          matrix[i][j-1] + 1,
          matrix[i-1][j-1] + cost
        );
      }
    }
    return matrix[al][bl];
  }

  function fuzzyFind(list, getter, q, maxDistance=4){
    q = String(q||"").toLowerCase().trim();
    if(!q) return null;
    // exact
    for(const item of list){ if(getter(item).toLowerCase() === q) return {item,score:0}; }
    // contains
    for(const item of list){ if(getter(item).toLowerCase().includes(q)) return {item,score:1}; }
    // best levensthein
    let best = null;
    for(const item of list){
      const s = levenshtein(getter(item).toLowerCase(), q);
      if(best === null || s < best.score){ best = {item,score:s}; }
    }
    if(best && best.score <= maxDistance) return best;
    return null;
  }

  // Typing effect: reveals text in element with small delay between chunks
  async function typeTo(el, text, opts){
    opts = opts||{}; const delay = opts.delay||12; const chunk = opts.chunk||4;
    el.innerHTML = '';
    for(let i=0;i<text.length;i+=chunk){
      el.innerHTML += esc(text.slice(i, i+chunk));
      el.scrollIntoView({behavior:'smooth', block:'nearest'});
      await new Promise(r=>setTimeout(r, delay));
    }
  }

  // --- Catalogue binding ---------------------------------------------------
  const catalogue = (window.catalogue && Array.isArray(window.catalogue)) ? window.catalogue : [];
  // build small synonyms map (could be expanded)
  const synonyms = {
    'box jelly': 'Box Jellyfish', 'box jellyfish': 'Box Jellyfish',
    'blue ringed': 'Blue Ringed Octopus', 'blue-ringed': 'Blue Ringed Octopus',
    'cone': 'Cone Snail', 'deathstalker': 'Deathstalker Scorpion'
  };

  function findSpecies(q){
    if(!q) return null;
    const s = synonyms[q.toLowerCase().trim()];
    if(s){
      const exact = catalogue.find(x => x.name === s); if(exact) return exact;
    }
    const f = fuzzyFind(catalogue, o => o.name, q, 5);
    return f ? f.item : null;
  }

  // --- PRR calculation and safety rules -----------------------------------
  function computePRR(hlt, cow){
    hlt = Number(hlt) || 1; cow = Number(cow) || 1;
    return Math.round((Math.min(10, 10 / hlt) + Math.min(10, 10 / (cow / 5))) / 2);
  }

  const emergencyTriggers = [ 'difficulty breathing', 'not breathing', 'loss of consciousness', 'unconscious', 'collapse', 'severe bleed', 'severe bleeding', 'shock', 'cardiac arrest' ];
  const urgentKeywords = [ 'breath', 'difficulty', 'collapse', 'unconscious', 'severe', 'seizure', 'convulsion', 'bleed', 'breathing' ];

  function assessUrgency(text){
    const t = (text||'').toLowerCase();
    for(const phrase of emergencyTriggers) if(t.includes(phrase)) return 'emergency';
    for(const k of urgentKeywords) if(t.includes(k)) return 'urgent';
    return 'normal';
  }

  // --- Conversation history (sessionStorage) ------------------------------
  const STORAGE_KEY = 'toxi_chat_history_v1';
  function loadHistory(){ try{ return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'); } catch(e){ return []; } }
  function saveHistory(hist){ sessionStorage.setItem(STORAGE_KEY, JSON.stringify(hist||[])); }

  function appendMessage(role, content){
    const hist = loadHistory();
    hist.push({ role, content, ts: nowISO() });
    saveHistory(hist);
  }

  // --- UI helpers ---------------------------------------------------------
  function createBubble(role, text){
    const div = document.createElement('div');
    div.className = 'bubble ' + (role === 'user' ? 'user' : 'bot');
    div.setAttribute('data-role', role);
    div.innerHTML = text.replace(/\n/g,'<br>');
    return div;
  }

  function showEmergencyBanner(level){
    removeEmergencyBanner();
    const chatBox = document.getElementById('chatHistory');
    if(!chatBox) return;
    const banner = document.createElement('div');
    banner.id = 'emBanner';
    banner.style.background = 'linear-gradient(90deg, #b71c1c, #ff5722)';
    banner.style.color = '#fff';
    banner.style.padding = '10px';
    banner.style.borderRadius = '8px';
    banner.style.margin = '8px 0';
    banner.innerHTML = `<strong style="font-size:1.05rem">${level === 'emergency' ? 'CALL EMERGENCY NOW' : 'URGENT — SEEK MEDICAL HELP'}</strong><div style="font-size:0.95rem;margin-top:6px">If breathing or consciousness is affected, call your local emergency number immediately. Provide first aid and do not delay.</div>`;
    chatBox.prepend(banner);
  }

  function removeEmergencyBanner(){ const b = document.getElementById('emBanner'); if(b) b.remove(); }

  // --- Main assistant logic -----------------------------------------------
  function generateLocalReply(input){
    const trimmed = (input||'').trim();
    const urgency = assessUrgency(trimmed);
    if(urgency === 'emergency') return { text: 'EMERGENCY: Symptoms you described require immediate medical attention. CALL EMERGENCY SERVICES NOW. Do not wait. While help comes, ensure airway, breathing, and circulation are supported. Avoid giving anything by mouth if unconscious.', emergency:true };
    // species lookup
    const species = findSpecies(trimmed);
    if(species){
      const prr = computePRR(species.hlt, species.cow);
      const lines = [];
      lines.push(`<strong>${esc(species.name)}</strong>`);
      lines.push(`HLT: <strong>${esc(species.hlt)}</strong> — COW: <strong>${esc(species.cow)} minutes</strong>`);
      lines.push(`Estimated Poison Risk Rating: <strong>${prr}/10</strong>`);
      lines.push('Advice: This tool provides educational information only. If bitten or stung, immobilize the affected area (if appropriate), avoid harmful folk remedies, and seek medical care. Call emergency services if breathing, consciousness, or rapid deterioration occurs.');
      lines.push('<div style="margin-top:8px"><button data-action="calc-prr" class="tiny-btn">Calculate with these values</button> <button data-action="more-info" class="tiny-btn">More species info</button></div>');
      return { text: lines.join('<br><br>'), emergency: false };
    }

    // term explanations
    const low = trimmed.toLowerCase();
    if(low.includes('hlt')) return { text: 'HLT (Human Lethality Threshold) — estimated number of envenomations required to be fatal in an average healthy adult. Lower HLT → higher danger.', emergency:false };
    if(low.includes('cow')) return { text: 'COW (Critical Onset Window) — minutes before likely fatality after envenomation. Shorter COW → more urgent treatment required.', emergency:false };
    if(low.includes('vrr') || low.includes('prr') || low.includes('risk')) return { text: 'VRR/PRR is a 0–10 danger score derived from HLT and COW where lower HLT and shorter COW increase the score.', emergency:false };

    // general triage guidance
    if(low.match(/bite|sting|symptom|numb|swelling|bleed|vomit|breath|dizzy|collapse|shock|seizure/)){
      return { text: 'If someone is bitten or stung: keep them calm, immobilize the affected limb if appropriate, remove tight clothing/jewelry, monitor breathing. Do NOT cut or attempt to suck out venom. Seek medical attention. Call emergency services if breathing or consciousness is affected.', emergency: urgency === 'urgent' };
    }

    // fallback help
    return { text: 'I can look up species from the catalogue (try typing a species name like "Box Jellyfish"), explain terms (HLT, COW, PRR), or offer first-aid guidance. Ask me a question or say "help".', emergency:false };
  }

  // --- Wire to DOM --------------------------------------------------------
  function initWidget(){
    const input = document.getElementById('aiInput');
    const output = document.getElementById('aiOutput'); // hidden offscreen, used by old code; we'll use chatHistory
    const chat = document.getElementById('chatHistory');
    if(!input || !chat) return;

    // render history
    const hist = loadHistory();
    if(hist && hist.length){
      chat.innerHTML = '';
      for(const msg of hist){
        const bubble = createBubble(msg.role, esc(msg.content));
        chat.appendChild(bubble);
      }
    }

    // handler
    async function handleQuery(text){
      if(!text || !text.trim()) return;
      const userBubble = createBubble('user', esc(text));
      chat.appendChild(userBubble);
      appendMessage('user', text);
      chat.scrollTop = chat.scrollHeight;

      // quick local thinking animation
      const thinking = createBubble('bot', '...'); thinking.style.opacity = '0.6'; chat.appendChild(thinking); chat.scrollTop = chat.scrollHeight;

      // generate reply
      const reply = generateLocalReply(text);
      // remove thinking
      thinking.remove(); removeEmergencyBanner();

      if(reply.emergency) showEmergencyBanner('emergency');
      else if(reply.text && assessUrgency(text) === 'urgent') showEmergencyBanner('urgent');

      const botBubble = createBubble('bot', '');
      chat.appendChild(botBubble);
      chat.scrollTop = chat.scrollHeight;

      // type the reply
      await typeTo(botBubble, reply.text, {delay:10, chunk:6});
      appendMessage('bot', reply.text);
      chat.scrollTop = chat.scrollHeight;

      // wire quick buttons inside botBubble
      const calcBtn = botBubble.querySelector('button[data-action="calc-prr"]');
      if(calcBtn) calcBtn.addEventListener('click', () => {
        // find numbers in bubble and calculate
        const sp = text; // if species was the query, use findSpecies
        const spec = findSpecies(sp);
        if(spec){ document.getElementById('hlt').value = spec.hlt; document.getElementById('cow').value = spec.cow; calculatePRR(); }
      });
      const infoBtn = botBubble.querySelector('button[data-action="more-info"]');
      if(infoBtn) infoBtn.addEventListener('click', () => {
        const spec = findSpecies(text);
        if(spec){
          const details = `Species: ${spec.name}\nHLT: ${spec.hlt}\nCOW: ${spec.cow} minutes\nPRR: ${computePRR(spec.hlt, spec.cow)}/10`;
          alert(details);
        }
      });
    }

    window.askToxiAI = function(){
      const text = input.value.trim();
      if(!text){ input.focus(); return; }
      handleQuery(text);
      input.value = '';
      input.focus();
    };

    // keyboard accessibility: Enter key handled on input by inline onkeydown in index.html

    // clear history UI button
    const clearBtn = document.getElementById('clearChat');
    if(clearBtn){ clearBtn.addEventListener('click', () => { sessionStorage.removeItem(STORAGE_KEY); chat.innerHTML=''; removeEmergencyBanner(); }); }

    // small helper: suggest species on focus
    input.addEventListener('focus', ()=>{
      // show top 5 species suggestions as placeholder (non-intrusive)
      const top = catalogue.slice(0,6).map(s=>s.name).join(', ');
      input.setAttribute('placeholder', 'Try: ' + top);
    });
  }

  // initialize on DOM ready
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initWidget); else initWidget();

})();
