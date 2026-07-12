require('dotenv').config();
const express = require("express");
const path = require("path");
const session = require('express-session');
const { connectDB, getDB } = require('./db');
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3000;

const DEFAULT_BUDGETS = {
  Food: 6000,
  Rent: 15000,
  Transport: 3000,
  Entertainment: 2000,
  Utilities: 2500,
  Shopping: 4000,
  Health: 2000,
  Other: 1500
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------------- Middleware ----------------

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
}));

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in." });
  }
  next();
}

app.use('/api/auth', authRoutes);
app.use(express.static(path.join(__dirname, "public")));
app.use('/api/ai', requireLogin, aiRoutes);

// ---------------- Transactions ----------------

app.get("/api/transactions", requireLogin, async (req, res) => {
  const db = getDB();
  const transactions = await db.collection('transactions')
    .find({ userId: req.session.userId })
    .toArray();
  res.json(transactions);
});

app.post("/api/transactions", requireLogin, async (req, res) => {
  const body = req.body || {};
  if (typeof body.amount !== "number" || body.amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  if (["income", "expense", "transfer"].indexOf(body.type) === -1) {
    return res.status(400).json({ error: "type must be income, expense, or transfer" });
  }
  if (!body.date) {
    return res.status(400).json({ error: "date is required" });
  }

  const tx = {
    id: generateId(),
    userId: req.session.userId,
    type: body.type,
    amount: body.amount,
    date: body.date,
    account: body.account || null,
    toAccount: body.toAccount || null,
    category: body.category || null,
    note: body.note || ""
  };
  const db = getDB();
  await db.collection('transactions').insertOne(tx);
  res.status(201).json(tx);
});

app.put("/api/transactions/:id", requireLogin, async (req, res) => {
  const db = getDB();
  const existing = await db.collection('transactions').findOne({ id: req.params.id, userId: req.session.userId });
  if (!existing) return res.status(404).json({ error: "transaction not found" });

  const body = req.body || {};
  if (typeof body.amount !== "number" || body.amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  const updated = {
    type: body.type,
    amount: body.amount,
    date: body.date,
    account: body.account || null,
    toAccount: body.toAccount || null,
    category: body.category || null,
    note: body.note || ""
  };
  await db.collection('transactions').updateOne(
    { id: req.params.id, userId: req.session.userId },
    { $set: updated }
  );
  res.json({ id: req.params.id, userId: req.session.userId, ...updated });
});

app.delete("/api/transactions/:id", requireLogin, async (req, res) => {
  const db = getDB();
  const result = await db.collection('transactions').deleteOne({ id: req.params.id, userId: req.session.userId });
  if (result.deletedCount === 0) return res.status(404).json({ error: "transaction not found" });
  res.status(204).send();
});

// ---------------- Budgets ----------------

app.get("/api/budgets", requireLogin, async (req, res) => {
  const db = getDB();
  const doc = await db.collection('budgets').findOne({ userId: req.session.userId });
  res.json(doc ? doc.budgets : DEFAULT_BUDGETS);
});

app.put("/api/budgets/:category", requireLogin, async (req, res) => {
  const limit = req.body ? req.body.limit : undefined;
  if (typeof limit !== "number" || limit < 0) {
    return res.status(400).json({ error: "limit must be a number >= 0" });
  }
  const db = getDB();
  const doc = await db.collection('budgets').findOne({ userId: req.session.userId });
  const budgets = doc ? doc.budgets : { ...DEFAULT_BUDGETS };
  budgets[req.params.category] = limit;

  await db.collection('budgets').updateOne(
    { userId: req.session.userId },
    { $set: { userId: req.session.userId, budgets } },
    { upsert: true }
  );
  res.json(budgets);
});

// ---------------- Goals ----------------

app.get("/api/goals", requireLogin, async (req, res) => {
  const db = getDB();
  const goals = await db.collection('goals').find({ userId: req.session.userId }).toArray();
  res.json(goals);
});

app.post("/api/goals", requireLogin, async (req, res) => {
  const body = req.body || {};
  if (!body.title || typeof body.targetAmount !== "number" || body.targetAmount <= 0 || !body.targetDate) {
    return res.status(400).json({ error: "title, targetAmount (>0), and targetDate are required" });
  }
  const goal = {
    id: generateId(),
    userId: req.session.userId,
    title: body.title,
    targetAmount: body.targetAmount,
    targetDate: body.targetDate,
    savedAmount: 0
  };
  const db = getDB();
  await db.collection('goals').insertOne(goal);
  res.status(201).json(goal);
});

app.put("/api/goals/:id", requireLogin, async (req, res) => {
  const db = getDB();
  const existing = await db.collection('goals').findOne({ id: req.params.id, userId: req.session.userId });
  if (!existing) return res.status(404).json({ error: "goal not found" });

  const body = req.body || {};
  if (!body.title || typeof body.targetAmount !== "number" || body.targetAmount <= 0 || !body.targetDate) {
    return res.status(400).json({ error: "title, targetAmount (>0), and targetDate are required" });
  }
  await db.collection('goals').updateOne(
    { id: req.params.id, userId: req.session.userId },
    { $set: { title: body.title, targetAmount: body.targetAmount, targetDate: body.targetDate } }
  );
  const updated = await db.collection('goals').findOne({ id: req.params.id, userId: req.session.userId });
  res.json(updated);
});

app.delete("/api/goals/:id", requireLogin, async (req, res) => {
  const db = getDB();
  const result = await db.collection('goals').deleteOne({ id: req.params.id, userId: req.session.userId });
  if (result.deletedCount === 0) return res.status(404).json({ error: "goal not found" });
  res.status(204).send();
});

app.post("/api/goals/:id/contribute", requireLogin, async (req, res) => {
  const body = req.body || {};
  const amount = body.amount;
  const account = body.account;

  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  if (!account) {
    return res.status(400).json({ error: "account is required" });
  }

  const db = getDB();
  const goal = await db.collection('goals').findOne({ id: req.params.id, userId: req.session.userId });
  if (!goal) return res.status(404).json({ error: "goal not found" });

  const newSavedAmount = goal.savedAmount + amount;
  await db.collection('goals').updateOne(
    { id: req.params.id, userId: req.session.userId },
    { $set: { savedAmount: newSavedAmount } }
  );

  const tx = {
    id: generateId(),
    userId: req.session.userId,
    type: "transfer",
    amount: amount,
    date: new Date().toISOString(),
    account: account,
    toAccount: "Goal: " + goal.title,
    category: null,
    note: "Contribution to goal: " + goal.title
  };
  await db.collection('transactions').insertOne(tx);

  const updatedGoal = await db.collection('goals').findOne({ id: req.params.id, userId: req.session.userId });
  res.json({ goal: updatedGoal, transaction: tx });
});

// ---------------- Backup / Restore ----------------

app.get("/api/backup", requireLogin, async (req, res) => {
  const db = getDB();
  const transactions = await db.collection('transactions').find({ userId: req.session.userId }).toArray();
  const budgetsDoc = await db.collection('budgets').findOne({ userId: req.session.userId });
  const goals = await db.collection('goals').find({ userId: req.session.userId }).toArray();
  res.json({
    exportedAt: new Date().toISOString(),
    transactions,
    budgets: budgetsDoc ? budgetsDoc.budgets : DEFAULT_BUDGETS,
    goals
  });
});

app.post("/api/backup/restore", requireLogin, async (req, res) => {
  const body = req.body || {};
  if (!Array.isArray(body.transactions) || typeof body.budgets !== "object" || body.budgets === null || !Array.isArray(body.goals)) {
    return res.status(400).json({ error: "backup file must include transactions (array), budgets (object), and goals (array)" });
  }
  const db = getDB();
  const userId = req.session.userId;

  await db.collection('transactions').deleteMany({ userId });
  const txWithUser = body.transactions.map(t => ({ ...t, userId }));
  if (txWithUser.length > 0) await db.collection('transactions').insertMany(txWithUser);

  await db.collection('budgets').updateOne(
    { userId },
    { $set: { userId, budgets: body.budgets } },
    { upsert: true }
  );

  await db.collection('goals').deleteMany({ userId });
  const goalsWithUser = body.goals.map(g => ({ ...g, userId }));
  if (goalsWithUser.length > 0) await db.collection('goals').insertMany(goalsWithUser);

  res.json({ success: true });
});

app.delete("/api/backup", requireLogin, async (req, res) => {
  const db = getDB();
  const userId = req.session.userId;
  await db.collection('transactions').deleteMany({ userId });
  await db.collection('budgets').updateOne({ userId }, { $set: { userId, budgets: DEFAULT_BUDGETS } }, { upsert: true });
  await db.collection('goals').deleteMany({ userId });
  res.json({ success: true });
});

// ---------------- Start server (connect DB first) ----------------

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log("FinanceAI backend running at http://localhost:" + PORT);
  });
}

start();