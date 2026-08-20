// ai-companion.js
// Updated to use server-side LLM proxy when available; falls back to local assistant.

(function(){
  'use strict';
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  const STORAGE_KEY = 'toxi_ai_chat_v1';
  function loadHistory(){ try{ return JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'[]'); }catch(e){return[];} }
  function saveHistory(h){ sessionStorage.setItem(STORAGE_KEY, JSON.stringify(h||[])); }
  function pushHistory(role, text){ const h = loadHistory(); h.push({role, text, ts: new Date().toISOString()}); saveHistory(h); }

  // local helpers (keep previous local behavior)
  const catalogueLocal = (window.catalogue && Array.isArray(window.catalogue)) ? window.catalogue : [];
  function computePRR(hlt,cow){ hlt=Number(hlt)||1; cow=Number(cow)||1; return Math.round((Math.min(10,10/hlt)+Math.min(10,10/(cow/5)))/2); }
  function bestMatch(list,q){ if(!q) return null; q=q.toLowerCase().trim(); for(const it of list) if(it.name.toLowerCase()===q) return it; for(const it of list) if(it.name.toLowerCase().includes(q)) return it; const tokens=q.split(/\s+/).filter(Boolean); let best=null, score=0; for(const it of list){ let s=0; for(const t of tokens) if(it.name.toLowerCase().includes(t)) s++; if(s>score){score=s;best=it;} } return score?best:null; }

  // DOM helpers
  function createBubble(role, html){ const d=document.createElement('div'); d.className='bubble '+(role==='user'?'user':'bot'); d.innerHTML=html; return d; }
  async function typeInto(el, html, opts){ opts=opts||{}; const chunk=opts.chunk||6; const delay=opts.delay||18; el.innerHTML=''; for(let i=0;i<html.length;i+=chunk){ el.innerHTML += esc(html.slice(i,i+chunk)).replace(/\n/g,'<br>'); el.scrollIntoView({behavior:'smooth', block:'nearest'}); await new Promise(r=>setTimeout(r, delay)); } }

  function detectUrgency(text){ if(!text) return 'normal'; const t=text.toLowerCase(); const emergency=['not breathing','loss of consciousness','unconscious','severe bleeding','cardiac arrest','stop breathing']; for(const e of emergency) if(t.includes(e)) return 'emergency'; const urgent=['difficulty breathing','trouble breathing','severe swelling','rapid heart','collapse','seizure']; for(const u of urgent) if(t.includes(u)) return 'urgent'; return 'normal'; }

  function localReply(text){ const q=(text||'').trim(); const urgency = detectUrgency(q); if(urgency==='emergency') return {html:'<strong>EMERGENCY — CALL LOCAL EMERGENCY SERVICES NOW</strong><br><br>If breathing or consciousness is affected, call emergency services immediately. Start first aid while help arrives.', emergency:true}; const sp = bestMatch(catalogueLocal, q); if(sp){ const prr=computePRR(sp.hlt, sp.cow); const html=[`<strong>${esc(sp.name)}</strong>`,`HLT: <strong>${esc(sp.hlt)}</strong> — COW: <strong>${esc(sp.cow)} minutes</strong>`,`Estimated Poison Risk Rating: <strong>${prr}/10</strong>`,`Advice: This is educational information only. If bitten or stung, immobilize the affected area if appropriate and seek medical attention. Call emergency services if breathing or consciousness is affected.`,`<div style="margin-top:8px"><button class="ai-action" data-action="use-spec" data-name="${esc(sp.name)}">Use these HLT/COW</button> <button class="ai-action" data-action="more-info" data-name="${esc(sp.name)}">More info</button></div>`].join('<br><br>'); return {html, emergency:false}; }
    const l=q.toLowerCase(); if(l.includes('hlt')) return {html:'<strong>HLT</strong> — Human Lethality Threshold: estimated number of envenomations likely to be fatal in an average healthy adult. Lower = more dangerous.', emergency:false}; if(l.includes('cow')) return {html:'<strong>COW</strong> — Critical Onset Window: estimated minutes before likely fatality after envenomation. Shorter windows imply more urgent care.', emergency:false}; if(l.includes('prr')||l.includes('vrr')||l.includes('risk')) return {html:'PRR/VRR is a 0–10 combined danger score derived from HLT and COW. Lower HLT and shorter COW raise the score.', emergency:false}; if(l.match(/bite|sting|symptom|numb|swelling|bleed|vomit|breath|dizzy|collapse|shock|seizure/)) return {html:'If someone is bitten or stung: keep them calm, immobilize the affected limb if appropriate, remove tight clothing/jewelry, monitor breathing and circulation. Do NOT cut or try to suck out venom. Seek medical care. Call emergency services for severe symptoms.', emergency: urgency==='urgent'}; return {html:'I can look up species from the catalogue (try "Box Jellyfish"), explain HLT/COW/PRR, or give basic first-aid guidance. Ask about a species or type "help".', emergency:false}; }

  // Server call
  async function callServer(prompt){
    try{
      const hist = loadHistory();
      const resp = await fetch('/api/ai', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt, history: hist }) });
      if(!resp.ok) throw new Error('Server error: ' + await resp.text());
      const j = await resp.json();
      return j.reply || j; 
    }catch(e){ console.warn('Server call failed:', e.message); throw e; }
  }

  // Main wiring
  function init(){
    const input = document.getElementById('aiInput');
    const chat = document.getElementById('chatHistory');
    const aiOutput = document.getElementById('aiOutput');
    if(!input||!chat) return;

    // restore history
    const hist = loadHistory(); if(hist.length){ chat.innerHTML=''; for(const m of hist){ chat.appendChild(createBubble(m.role, esc(m.text))); } }

    async function handle(text){ if(!text||!text.trim()) return; const userB=createBubble('user', esc(text)); chat.appendChild(userB); pushHistory('user', text); chat.scrollTop = chat.scrollHeight; const thinking=createBubble('bot','<em>Thinking…</em>'); chat.appendChild(thinking); chat.scrollTop = chat.scrollHeight;

      // try server first
      let replyObj=null; try{ const serverReply = await callServer(text); // server returns plain text reply (may contain markdown/html)
          replyObj = { html: serverReply, emergency: detectUrgency(text) === 'emergency' };
      }catch(e){ // fallback local
          replyObj = localReply(text);
      }

      thinking.remove(); if(replyObj.emergency){ const banner=document.createElement('div'); banner.style.background='#b71c1c'; banner.style.color='white'; banner.style.padding='8px'; banner.style.borderRadius='6px'; banner.style.margin='6px 0'; banner.innerHTML='<strong>CALL EMERGENCY SERVICES NOW</strong> — while help is on the way, perform first aid.'; chat.prepend(banner); }

      const botB=createBubble('bot',''); chat.appendChild(botB); chat.scrollTop = chat.scrollHeight; try{ await typeInto(botB, replyObj.html, {delay:12, chunk:6}); }catch(e){ botB.innerHTML = esc(typeof replyObj.html === 'string' ? replyObj.html : String(replyObj.html)); }
      pushHistory('bot', (replyObj.html||'').replace(/<[^>]+>/g,'')); chat.scrollTop = chat.scrollHeight;

      // bind actions
      botB.querySelectorAll('.ai-action').forEach(btn=>{ btn.addEventListener('click', ()=>{ const action=btn.getAttribute('data-action'); const name=btn.getAttribute('data-name'); if(action==='use-spec'){ const sp = catalogueLocal.find(s=>s.name===name); if(sp){ document.getElementById('hlt').value=sp.hlt; document.getElementById('cow').value=sp.cow; document.getElementById('output').innerText=''; calculatePRR(); } } if(action==='more-info'){ const sp=catalogueLocal.find(s=>s.name===name); if(sp){ alert(`Species: ${sp.name}\nHLT: ${sp.hlt}\nCOW: ${sp.cow} minutes\nPRR: ${computePRR(sp.hlt,sp.cow)}/10`); } } }); }); }

    window.askToxiAI = function(){ const t=input.value.trim(); if(!t) return input.focus(); handle(t); input.value=''; input.focus(); };
    input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); window.askToxiAI(); } });
    const clearBtn = document.getElementById('clearChat'); if(clearBtn){ clearBtn.addEventListener('click', ()=>{ chat.innerHTML=''; sessionStorage.removeItem(STORAGE_KEY); }) }
    if(aiOutput) aiOutput.innerText = 'AI companion ready (server-backed if available).';
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
