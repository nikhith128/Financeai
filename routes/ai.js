
const express = require('express');
const router = express.Router();

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';
async function askGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini request failed (${res.status}): ${data?.error?.message || 'unknown error'}`);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
}

router.post('/insights', async (req, res) => {
  try {
    const { transactions } = req.body || {};
    if (!Array.isArray(transactions)) return res.status(400).json({ error: 'transactions must be an array' });
    const prompt = `You are a financial analyst. Given this transaction data (JSON), write a short, plain-English summary: spending leaks, unusual transactions, and one actionable tip. Data: ${JSON.stringify(transactions).slice(0, 6000)}`;
    const text = await askGemini(prompt);
    res.json({ insight: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate insights.' });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { message, transactions } = req.body || {};
    if (typeof message !== 'string' || !message.trim() || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'message and transactions are required' });
    }
    const prompt = `You are FinanceAI's assistant. Answer the user's question using this transaction data as context: ${JSON.stringify(transactions).slice(0, 6000)}. User question: ${message}`;
    const text = await askGemini(prompt);
    res.json({ reply: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get a reply.' });
  }
});

module.exports = router;
