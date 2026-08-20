// server.js
// Secure server-side proxy + simple RAG for ToxiRate AI companion.
// Usage: set OPENAI_KEY env var to your OpenAI API key, then `node server.js`.
// Endpoints:
// POST /api/ai { prompt, history } -> { reply }

const express = require('express');
const fetch = require('node-fetch');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const OPENAI_KEY = process.env.OPENAI_KEY;
if(!OPENAI_KEY){
  console.warn('Warning: OPENAI_KEY not set. Requests to /api/ai will fail until you set it in the environment.');
}

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50kb' }));

// rate limit
app.use('/api/', rateLimit({ windowMs: 60*1000, max: 30 }));

// Load catalogue for RAG
const cataloguePath = path.join(__dirname, 'data', 'catalogue.json');
let catalogue = [];
try{
  const raw = fs.readFileSync(cataloguePath, 'utf8');
  catalogue = JSON.parse(raw);
  console.log('Loaded catalogue entries:', catalogue.length);
}catch(e){
  console.warn('Could not load catalogue.json for RAG:', e.message);
}

// In-memory embedding store
let embeddingsIndex = null;

async function openaiEmbed(text){
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text })
  });
  if(!res.ok) throw new Error('Embedding API error: ' + await res.text());
  const j = await res.json();
  return j.data[0].embedding;
}

function cosine(a,b){
  let s=0, na=0, nb=0;
  for(let i=0;i<a.length;i++){ s += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return s/ (Math.sqrt(na)*Math.sqrt(nb) + 1e-16);
}

async function buildEmbeddingsIndex(){
  if(!catalogue || !catalogue.length) return;
  embeddingsIndex = [];
  for(const item of catalogue){
    try{
      const text = `${item.name} | HLT: ${item.hlt} | COW: ${item.cow}`;
      const emb = await openaiEmbed(text);
      embeddingsIndex.push({ id: item.name, embedding: emb, text });
    }catch(e){
      console.warn('Embedding failed for', item.name, e.message);
    }
  }
  console.log('Built embeddings index for', embeddingsIndex.length, 'items');
}

// Build embeddings on startup (best-effort)
(async ()=>{ try{ await buildEmbeddingsIndex(); }catch(e){ console.warn('Could not build embeddings index:', e.message); } })();

app.post('/api/ai', async (req,res)=>{
  try{
    const prompt = req.body.prompt;
    const history = req.body.history || [];
    if(!prompt) return res.status(400).json({ error: 'missing prompt' });
    // If embeddings available, perform semantic search to find top-k relevant species
    let contextSnippet = '';
    if(embeddingsIndex && embeddingsIndex.length){
      try{
        const qemb = await openaiEmbed(prompt);
        const scored = embeddingsIndex.map(e => ({ id: e.id, score: cosine(qemb, e.embedding), text: e.text }));
        scored.sort((a,b)=>b.score-a.score);
        const top = scored.slice(0,3).filter(s=>s.score > 0.1); // threshold
        if(top.length){
          contextSnippet = top.map(t=>`${t.text}`).join('\n');
        }
      }catch(e){ console.warn('Semantic search failed:', e.message); }
    }

    const systemPromptParts = [
      'You are ToxiRate assistant – provide concise, safety-first medical-adjacent guidance about envenomation, HLT, COW, and PRR. Always include a medical disclaimer: not a substitute for professional medical care. If user describes life-threatening symptoms, instruct them to call emergency services immediately.'
    ];
    if(contextSnippet) systemPromptParts.push('Relevant catalogue excerpts:\n' + contextSnippet);
    const systemPrompt = systemPromptParts.join('\n\n');

    // Build messages, include a compact history if provided
    const messages = [ { role:'system', content: systemPrompt } ];
    // include last few user/assistant turns
    const recent = history.slice(-6);
    for(const turn of recent){
      const role = turn.role === 'user' ? 'user' : 'assistant';
      messages.push({ role, content: turn.text });
    }
    messages.push({ role: 'user', content: prompt });

    // call OpenAI ChatCompletions
    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: 'gpt-3.5-turbo', messages, temperature: 0.2, max_tokens: 700 })
    });
    if(!chatRes.ok){ const t = await chatRes.text(); return res.status(502).json({ error:'openai_error', detail: t }); }
    const chatJson = await chatRes.json();
    const assistant = (chatJson.choices && chatJson.choices[0] && chatJson.choices[0].message && chatJson.choices[0].message.content) ? chatJson.choices[0].message.content : JSON.stringify(chatJson);

    return res.json({ reply: assistant });
  }catch(err){ console.error(err); return res.status(500).json({ error: err.message }); }
});

const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log('ToxiRate AI proxy listening on', port));
