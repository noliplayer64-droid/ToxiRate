// ai-companion.js
// ToxiRate AI companion: improved local rule-based assistant with optional OpenAI integration via sessionStorage.
// Replaces previous simple triage-only script with a catalogue-aware assistant, settings UI, and safe fallback.

(function(){
  // Utility: escape HTML
  function esc(s){ return String(s||"").replace(/&/g,'&amp;').replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // Try to use catalogue from index.html
  const catalogueData = (window.catalogue && Array.isArray(window.catalogue)) ? window.catalogue : [];

  // Compute PRR using the site's formula
  function computePRR(hlt, cow){
    hlt = Number(hlt) || 1;
    cow = Number(cow) || 1;
    return Math.round((Math.min(10, 10 / hlt) + Math.min(10, 10 / (cow / 5))) / 2);
  }

  function findSpecies(query){
    if (!query) return null;
    const q = query.toLowerCase().trim();
    let match = catalogueData.find(s => s.name.toLowerCase() === q);
    if (match) return match;
    match = catalogueData.find(s => s.name.toLowerCase().includes(q));
    if (match) return match;
    const tokens = q.split(/\s+/).filter(Boolean);
    for (const t of tokens){
      match = catalogueData.find(s => s.name.toLowerCase().includes(t));
      if (match) return match;
    }
    return null;
  }

  // Local answer generator
  function localAnswer(input){
    const out = [];
    const lowered = input.toLowerCase();

    // species lookup
    const species = findSpecies(input);
    if (species){
      const prr = computePRR(species.hlt, species.cow);
      out.push(`${species.name} — HLT: ${species.hlt}, COW: ${species.cow} minutes.`);
      out.push(`Estimated Poison Risk Rating: ${prr}/10.`);
      out.push('Advice: This is educational only. If bitten or stung, seek medical attention. Call emergency services if breathing, consciousness, or severe symptoms occur.');
      return out.join('\n\n');
    }

    // term explanations
    if (lowered.includes('hlt')){
      out.push('HLT (Human Lethality Threshold): estimated number of envenomations likely to be fatal in an average healthy adult. Lower is more dangerous.');
    }
    if (lowered.includes('cow')){
      out.push('COW (Critical Onset Window): estimated minutes before likely fatality after envenomation. Shorter windows indicate more urgent treatment.');
    }
    if (lowered.includes('vrr') || lowered.includes('prr') || lowered.includes('risk')){
      out.push('VRR/PRR is a 0–10 danger score calculated from HLT and COW. Lower HLT and shorter COW raise the rating.');
    }

    if (lowered.match(/bite|sting|symptom|numb|breath|swelling|shock|collapse/)){
      out.push('If you or someone else is bitten or stung: keep calm; immobilize the affected area if appropriate; avoid cutting or sucking the wound; seek medical care. Call emergency services if breathing, consciousness, or rapid deterioration occurs.');
    }

    if (out.length === 0){
      out.push('I can lookup species from the catalogue (try "Box Jellyfish") and explain HLT, COW, VRR. Ask about a species or a term like "what is HLT".');
    }

    return out.join('\n\n');
  }

  // OpenAI call (optional) — WARNING: exposing keys in client is a risk
  async function callOpenAI(key, userInput){
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    const systemPrompt = `You are the ToxiRate assistant. Use the provided catalogue to answer questions about species HLT, COW, and VRR. Calculate PRR when possible using PRR = round((min(10,10/hlt) + min(10,10/(cow/5)))/2). Always include a medical-safety disclaimer and encourage professional care.`;
    const catalogueSnippet = JSON.stringify(catalogueData || [], null, 0);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Catalogue: ${catalogueSnippet}` },
      { role: 'user', content: userInput }
    ];

    const body = { model: 'gpt-3.5-turbo', messages, temperature: 0.3, max_tokens: 700 };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(body)
    });

    if (!res.ok){
      const text = await res.text();
      throw new Error('OpenAI API error: ' + res.status + ' ' + text);
    }

    const data = await res.json();
    if (data && data.choices && data.choices[0] && data.choices[0].message) return data.choices[0].message.content;
    throw new Error('Unexpected OpenAI response');
  }

  // create settings UI within .ai-box
  function createSettings(){
    const aiBox = document.querySelector('.ai-box');
    if (!aiBox) return;
    // avoid duplicating
    if (document.getElementById('tox-settings')) return;

    const settings = document.createElement('div');
    settings.id = 'tox-settings';
    settings.style.marginTop = '10px';
    settings.style.fontSize = '0.9em';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.alignItems = 'center';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'openaiEnable';
    checkbox.checked = sessionStorage.getItem('openaiEnabled') === 'true';

    const lbl = document.createElement('label');
    lbl.htmlFor = 'openaiEnable';
    lbl.innerText = 'Enable OpenAI (not recommended on public sites)';

    row.appendChild(checkbox);
    row.appendChild(lbl);

    const keyInput = document.createElement('input');
    keyInput.type = 'password';
    keyInput.id = 'openaiKey';
    keyInput.placeholder = 'OpenAI API key (session only)';
    keyInput.style.width = '100%';
    keyInput.style.marginTop = '6px';
    keyInput.value = sessionStorage.getItem('openaiKey') || '';

    const saveBtn = document.createElement('button');
    saveBtn.innerText = 'Save session settings';
    saveBtn.style.marginTop = '6px';
    saveBtn.onclick = function(){
      sessionStorage.setItem('openaiEnabled', checkbox.checked ? 'true' : 'false');
      sessionStorage.setItem('openaiKey', keyInput.value || '');
      const out = document.getElementById('aiOutput');
      if (out) out.innerText = 'Settings saved for this browser session.';
    };

    const note = document.createElement('div');
    note.style.color = '#bbb';
    note.style.marginTop = '6px';
    note.innerText = 'If enabled, your question and the catalogue will be sent to OpenAI from your browser. Do NOT paste a key on public or shared machines.';

    settings.appendChild(row);
    settings.appendChild(keyInput);
    settings.appendChild(saveBtn);
    settings.appendChild(note);

    aiBox.appendChild(settings);
  }

  // global handler used by index.html
  window.askToxiAI = async function(){
    const inputEl = document.getElementById('aiInput');
    const outputEl = document.getElementById('aiOutput');
    if (!inputEl || !outputEl){
      alert('AI UI not found');
      return;
    }
    const text = inputEl.value.trim();
    if (!text){ outputEl.innerText = 'Type a question first.'; return; }

    outputEl.style.fontStyle = 'normal';
    outputEl.innerText = 'Thinking...';

    const enabled = sessionStorage.getItem('openaiEnabled') === 'true';
    const key = sessionStorage.getItem('openaiKey') || '';

    try{
      if (enabled && key){
        const reply = await callOpenAI(key, text);
        outputEl.innerText = reply;
      } else {
        const reply = localAnswer(text);
        outputEl.innerText = reply;
      }
    } catch(err){
      console.error(err);
      outputEl.innerText = 'Error: ' + err.message + '\n\nFalling back to local assistant.';
      try{ outputEl.innerText += '\n\n' + localAnswer(text); } catch(e){}
    }

    inputEl.value = '';
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createSettings); else createSettings();

})();
