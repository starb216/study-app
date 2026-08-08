const express = require('express');
const { all } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

const SYSTEM_PROMPTS = {
  review: 'You are a study assistant. Create a concise review sheet from these notes. Use Markdown with ## headings, bullet points, and end with a Key terms section.',
  quiz: 'You are a study assistant. Create a quiz from these notes. Respond with STRICT JSON only: { "questions": [ { "question": string, "options": [4 strings], "answer": 0-based index } ] }. Exactly 5 questions.',
  flashcards: 'You are a study assistant. Create flashcards from these notes. Respond with STRICT JSON only: { "cards": [ { "front": string, "back": string } ] }. 8-12 cards.'
};

router.post('/generate', auth, async (req, res) => {
  try {
    if (!process.env.AI_API_KEY) {
      return res.status(503).json({ error: 'AI is not configured yet. Add AI_API_KEY in Vercel environment variables.' });
    }

    const { type, noteIds } = req.body;
    if (!SYSTEM_PROMPTS[type]) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const ids = (Array.isArray(noteIds) ? noteIds : [])
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) {
      return res.status(400).json({ error: 'No notes found' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const notes = await all(
      `SELECT id, title, content FROM notes WHERE user_id = ? AND id IN (${placeholders})`,
      [req.userId, ...ids]
    );
    if (notes.length === 0) {
      return res.status(400).json({ error: 'No notes found' });
    }

    let combined = '';
    for (const note of notes) {
      const chunk = `TITLE: ${note.title}\nCONTENT: ${note.content}\n\n`;
      if (combined.length + chunk.length > 12000) break;
      combined += chunk;
    }

    let aiRes;
    try {
      aiRes = await fetch(`${process.env.AI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.AI_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'gpt-4o-mini',
          temperature: 0.3,
          ...(type !== 'review' ? { response_format: { type: 'json_object' } } : {}),
          messages: [
            { role: 'system', content: SYSTEM_PROMPTS[type] },
            { role: 'user', content: combined }
          ]
        })
      });
    } catch (err) {
      return res.status(502).json({ error: 'AI request failed', detail: err.message });
    }

    if (!aiRes.ok) {
      const detail = await aiRes.text().catch(() => '');
      return res.status(502).json({ error: 'AI request failed', detail: detail.slice(0, 300) });
    }

    const data = await aiRes.json();
    const message = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

    if (type === 'review') {
      return res.json({ type: 'review', content: message || '' });
    }

    let parsed;
    try {
      const cleaned = String(message || '').replace(/```(?:json)?/gi, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      return res.status(502).json({ error: 'AI request failed', detail: err.message });
    }

    if (type === 'quiz') {
      if (!parsed || !Array.isArray(parsed.questions)) {
        return res.status(502).json({ error: 'AI request failed', detail: 'Invalid quiz format from AI' });
      }
      return res.json({ type: 'quiz', quiz: { questions: parsed.questions } });
    }

    if (!parsed || !Array.isArray(parsed.cards)) {
      return res.status(502).json({ error: 'AI request failed', detail: 'Invalid flashcards format from AI' });
    }
    res.json({ type: 'flashcards', cards: parsed.cards });
  } catch (err) {
    console.error('AI generate error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
