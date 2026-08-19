// server.js
// Example secure proxy to call OpenAI from a server rather than the browser.
// Usage: set OPENAI_KEY in environment. Run `node server.js` and POST to /api/ai

const express = require('express');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

if (!process.env.OPENAI_KEY) {
  console.warn('Warning: OPENAI_KEY not set. Proxy will return 500 until a key is provided.');
}

const app = express();
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());

// basic rate limit to avoid abuse
const limiter = rateLimit({ windowMs: 60*1000, max: 30 });
app.use('/api/', limiter);

app.post('/api/ai', async (req, res) => {
  try{
    const prompt = req.body.prompt;
    if (!prompt) return res.status(400).json({error:'missing prompt'});

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are ToxiRate assistant. Provide succinct, safety-first answers about HLT, COW, and PRR. Always include a clear medical disclaimer.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 700
      })
    });

    if (!response.ok){
      const txt = await response.text();
      return res.status(502).json({error:'OpenAI error', detail:txt});
    }

    const data = await response.json();
    return res.json(data);
  } catch(err){
    console.error(err);
    res.status(500).json({error:'server_error', message:err.message});
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('ToxiRate AI proxy listening on', port));
