// ai-companion.js
// Improved local AI-like assistant for ToxiRate (local-only, no OpenAI).
// Changes: richer responses, fuzzy species matching, session chat history, emergency detection, quick actions.

(function(){
  'use strict';

  // Utilities
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function now(){ return new Date().toLocaleString(); }

  // Simple fuzzy match (case-insensitive substring + partial token match)
  function bestMatch(list, q){
    if(!q) return null;
    q = q.toLowerCase().trim();
    // exact
    for(const it of list) if(it.name.toLowerCase() === q) return it;
    // contains
    for(const it of list) if(it.name.toLowerCase().includes(q)) return it;
    // token intersection
    const tokens = q.split(/\s+/).filter(Boolean);
    let best = null; let bestScore = 0;
    for(const it of list){
      const name = it.name.toLowerCase();
      let score = 0; for(const t of tokens) if(name.includes(t)) score += 1;
      if(score > bestScore){ bestScore = score; best = it; }
    }
    return bestScore ? best : null;
  }

  // Catalogue (reads from global catalogue if present)
  const catalogue = (window.catalogue && Array.isArray(window.catalogue)) ? window.catalogue : [];

  // PRR calculation (same formula as site)
  function computePRR(hlt, cow){
    hlt = Number(hlt) || 1; cow = Number(cow) || 1;
    return Math.round((Math.min(10, 10 / hlt) + Math.min(10, 10 / (cow / 5))) / 2);
  }

  // Urgency detection
  const EMERGENCY_PATTERNS = [/not breathing/i, /loss of consciousness/i, /unconscious/i, /severe bleeding/i, /cardiac arrest/i, /stop breathing/i];
  const URGENT_PATTERNS = [/difficulty breathing/i, /trouble breathing/i, /severe swelling/i, /rapid heart/i, /collapse/i, /seizure/i];

  function detectUrgency(text){
    if(!text) return 'normal';
    for(const r of EMERGENCY_PATTERNS) if(r.test(text)) return 'emergency';
    for(const r of URGENT_PATTERNS) if(r.test(text)) return 'urgent';
    return 'normal';
  }

  // Conversation history (sessionStorage)
  const STORAGE_KEY = 'toxi_ai_chat_v1';
  function loadHistory(){ try{ return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'); }catch(e){return[];} }
  function saveHistory(h){ sessionStorage.setItem(STORAGE_KEY, JSON.stringify(h||[])); }
  function pushHistory(role, text){ const h = loadHistory(); h.push({role, text, ts: new Date().toISOString()}); saveHistory(h); }

  // DOM helpers
  function createBubble(role, html){ const d = document.createElement('div'); d.className = 'bubble ' + (role==='user'?'user':'bot'); d.innerHTML = html; return d; }

  async function typeInto(el, html, opts){
    opts = opts||{}; const speed = opts.speed || 8; // characters per chunk
    el.innerHTML = '';
    const raw = html;
    for(let i=0;i<raw.length;i+=speed){
      el.innerHTML += esc(raw.slice(i, i+speed)).replace(/\n/g,'<br>');
      el.scrollIntoView({behavior:'smooth', block:'nearest'});
      await new Promise(r=>setTimeout(r, opts.delay || 20));
    }
  }

  // Core reply generator
  function generateReply(input){
    const q = (input||'').trim();
    const urgency = detectUrgency(q);
    if(urgency === 'emergency'){
      return { html: '<strong>EMERGENCY — CALL LOCAL EMERGENCY SERVICES NOW</strong><br><br>If breathing or consciousness is affected, call emergency services immediately. Start first aid while help arrives.', emergency:true };
    }
    // species lookup
    const sp = bestMatch(catalogue, q);
    if(sp){
      const prr = computePRR(sp.hlt, sp.cow);
      const html = [`<strong>${esc(sp.name)}</strong>`,
                    `HLT: <strong>${esc(sp.hlt)}</strong> — COW: <strong>${esc(sp.cow)} minutes</strong>`,
                    `Estimated Poison Risk Rating: <strong>${prr}/10</strong>`,
                    `Advice: This is educational information only. If bitten or stung, immobilize the affected area if appropriate and seek medical attention. Call emergency services if breathing or consciousness is affected.`,
                    `<div style="margin-top:8px"><button class="ai-action" data-action="use-spec" data-name="${esc(sp.name)}">Use these HLT/COW</button> <button class="ai-action" data-action="more-info" data-name="${esc(sp.name)}">More info</button></div>`
                   ].join('<br><br>');
      return { html, emergency:false };
    }
    // term help
    const l = q.toLowerCase();
    if(l.includes('hlt')) return { html: '<strong>HLT</strong> — Human Lethality Threshold: estimated number of envenomations likely to be fatal in an average healthy adult. Lower = more dangerous.', emergency:false };
    if(l.includes('cow')) return { html: '<strong>COW</strong> — Critical Onset Window: estimated minutes before likely fatality after envenomation. Shorter windows imply more urgent care.', emergency:false };
    if(l.includes('prr') || l.includes('vrr') || l.includes('risk')) return { html: 'PRR/VRR is a 0–10 combined danger score derived from HLT and COW. Lower HLT and shorter COW raise the score.', emergency:false };

    // first-aid patterns
    if(l.match(/bite|sting|symptom|numb|swelling|bleed|vomit|breath|dizzy|collapse|shock|seizure/)){
      return { html: 'If someone is bitten or stung: keep them calm, immobilize the affected limb if appropriate, remove tight clothing/jewelry, monitor breathing and circulation. Do NOT cut or try to suck out venom. Seek medical care. Call emergency services for severe symptoms.', emergency: urgency === 'urgent' };
    }

    // fallback
    return { html: 'I can look up species from the catalogue (try "Box Jellyfish"), explain HLT/COW/PRR, or give basic first-aid guidance. Ask about a species or type "help".', emergency:false };
  }

  // Wire up UI
  function init(){
    const input = document.getElementById('aiInput');
    const chat = document.getElementById('chatHistory');
    const aiOutput = document.getElementById('aiOutput');
    if(!input || !chat) return; // nothing to do

    // restore history
    const hist = loadHistory();
    if(hist.length){
      chat.innerHTML = '';
      for(const m of hist){
        const b = createBubble(m.role, esc(m.text));
        chat.appendChild(b);
      }
    }

    async function handle(text){
      if(!text || !text.trim()) return;
      // user bubble
      const userB = createBubble('user', esc(text)); chat.appendChild(userB); pushHistory('user', text);
      chat.scrollTop = chat.scrollHeight;

      // thinking indicator
      const thinking = createBubble('bot', '<em>Thinking…</em>'); chat.appendChild(thinking); chat.scrollTop = chat.scrollHeight;

      const reply = generateReply(text);
      // remove thinking
      thinking.remove();

      if(reply.emergency){
        // prominent banner
        const banner = document.createElement('div'); banner.style.background = '#b71c1c'; banner.style.color = 'white'; banner.style.padding='8px'; banner.style.borderRadius='6px'; banner.style.margin='6px 0'; banner.innerHTML = '<strong>CALL EMERGENCY SERVICES NOW</strong> — while help is on the way, perform first aid.'; chat.prepend(banner);
      }

      const botB = createBubble('bot', ''); chat.appendChild(botB); chat.scrollTop = chat.scrollHeight;
      await typeInto(botB, reply.html, {delay:12, speed:6});
      pushHistory('bot', reply.html.replace(/<[^>]+>/g,''));
      chat.scrollTop = chat.scrollHeight;

      // action buttons
      botB.querySelectorAll('.ai-action').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          const action = btn.getAttribute('data-action');
          const name = btn.getAttribute('data-name');
          if(action === 'use-spec'){
            // fill hlt/cow and calculate
            const sp = catalogue.find(s => s.name === name);
            if(sp){ document.getElementById('hlt').value = sp.hlt; document.getElementById('cow').value = sp.cow; document.getElementById('output').innerText = ''; calculatePRR(); }
          }
          if(action === 'more-info'){
            const sp = catalogue.find(s => s.name === name);
            if(sp){
              const details = `Species: ${sp.name}\nHLT: ${sp.hlt}\nCOW: ${sp.cow} minutes\nPRR: ${computePRR(sp.hlt, sp.cow)}/10`;
              alert(details);
            }
          }
        });
      });
    }

    // expose function used by page
    window.askToxiAI = function(){ const t = input.value.trim(); if(!t) return input.focus(); handle(t); input.value=''; input.focus(); };

    // allow Enter key from input (some pages had inline handler but ensure it)
    input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); window.askToxiAI(); } });

    // clear button: keep behavior (only clears chat UI now)
    const clearBtn = document.getElementById('clearChat'); if(clearBtn){ clearBtn.addEventListener('click', ()=>{ chat.innerHTML=''; sessionStorage.removeItem(STORAGE_KEY); }) }

    // small accessibility tweak: announce readiness
    if(aiOutput) aiOutput.innerText = 'AI companion ready.';
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
