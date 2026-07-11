require('dotenv').config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require('express-session');
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const USERS_DATA_DIR = path.join(DATA_DIR, "user-data");

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

// ---------------- Per-user data file helpers ----------------

function userDir(userId) {
  return path.join(USERS_DATA_DIR, userId);
}
function userFiles(userId) {
  const dir = userDir(userId);
  return {
    tx: path.join(dir, "transactions.json"),
    budgets: path.join(dir, "budgets.json"),
    goals: path.join(dir, "goals.json")
  };
}
function ensureUserDataFiles(userId) {
  const dir = userDir(userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const files = userFiles(userId);
  if (!fs.existsSync(files.tx)) fs.writeFileSync(files.tx, "[]");
  if (!fs.existsSync(files.budgets)) fs.writeFileSync(files.budgets, JSON.stringify(DEFAULT_BUDGETS, null, 2));
  if (!fs.existsSync(files.goals)) fs.writeFileSync(files.goals, "[]");
  return files;
}

function ensureBaseDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_DATA_DIR)) fs.mkdirSync(USERS_DATA_DIR, { recursive: true });
}
ensureBaseDirs();

function readJSON(file, fallback) {
  try {
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to read " + file, e);
    return fallback;
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
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
  // make sure this user's data files exist, and attach paths to the request
  req.userFiles = ensureUserDataFiles(req.session.userId);
  next();
}

app.use('/api/auth', authRoutes);
app.use(express.static(path.join(__dirname, "public")));
app.use('/api/ai', requireLogin, aiRoutes);

// ---------------- Transactions ----------------

app.get("/api/transactions", requireLogin, (req, res) => {
  res.json(readJSON(req.userFiles.tx, []));
});

app.post("/api/transactions", requireLogin, (req, res) => {
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

  const transactions = readJSON(req.userFiles.tx, []);
  const tx = {
    id: generateId(),
    type: body.type,
    amount: body.amount,
    date: body.date,
    account: body.account || null,
    toAccount: body.toAccount || null,
    category: body.category || null,
    note: body.note || ""
  };
  transactions.push(tx);
  writeJSON(req.userFiles.tx, transactions);
  res.status(201).json(tx);
});

app.put("/api/transactions/:id", requireLogin, (req, res) => {
  const transactions = readJSON(req.userFiles.tx, []);
  const idx = transactions.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "transaction not found" });

  const body = req.body || {};
  if (typeof body.amount !== "number" || body.amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  transactions[idx] = {
    id: transactions[idx].id,
    type: body.type,
    amount: body.amount,
    date: body.date,
    account: body.account || null,
    toAccount: body.toAccount || null,
    category: body.category || null,
    note: body.note || ""
  };
  writeJSON(req.userFiles.tx, transactions);
  res.json(transactions[idx]);
});

app.delete("/api/transactions/:id", requireLogin, (req, res) => {
  let transactions = readJSON(req.userFiles.tx, []);
  const exists = transactions.some((t) => t.id === req.params.id);
  if (!exists) return res.status(404).json({ error: "transaction not found" });
  transactions = transactions.filter((t) => t.id !== req.params.id);
  writeJSON(req.userFiles.tx, transactions);
  res.status(204).send();
});

// ---------------- Budgets ----------------

app.get("/api/budgets", requireLogin, (req, res) => {
  res.json(readJSON(req.userFiles.budgets, DEFAULT_BUDGETS));
});

app.put("/api/budgets/:category", requireLogin, (req, res) => {
  const budgets = readJSON(req.userFiles.budgets, {});
  const limit = req.body ? req.body.limit : undefined;
  if (typeof limit !== "number" || limit < 0) {
    return res.status(400).json({ error: "limit must be a number >= 0" });
  }
  budgets[req.params.category] = limit;
  writeJSON(req.userFiles.budgets, budgets);
  res.json(budgets);
});

// ---------------- Goals ----------------

app.get("/api/goals", requireLogin, (req, res) => {
  res.json(readJSON(req.userFiles.goals, []));
});

app.post("/api/goals", requireLogin, (req, res) => {
  const body = req.body || {};
  if (!body.title || typeof body.targetAmount !== "number" || body.targetAmount <= 0 || !body.targetDate) {
    return res.status(400).json({ error: "title, targetAmount (>0), and targetDate are required" });
  }
  const goals = readJSON(req.userFiles.goals, []);
  const goal = {
    id: generateId(),
    title: body.title,
    targetAmount: body.targetAmount,
    targetDate: body.targetDate,
    savedAmount: 0
  };
  goals.push(goal);
  writeJSON(req.userFiles.goals, goals);
  res.status(201).json(goal);
});

app.put("/api/goals/:id", requireLogin, (req, res) => {
  const goals = readJSON(req.userFiles.goals, []);
  const idx = goals.findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "goal not found" });

  const body = req.body || {};
  if (!body.title || typeof body.targetAmount !== "number" || body.targetAmount <= 0 || !body.targetDate) {
    return res.status(400).json({ error: "title, targetAmount (>0), and targetDate are required" });
  }
  goals[idx].title = body.title;
  goals[idx].targetAmount = body.targetAmount;
  goals[idx].targetDate = body.targetDate;
  writeJSON(req.userFiles.goals, goals);
  res.json(goals[idx]);
});

app.delete("/api/goals/:id", requireLogin, (req, res) => {
  let goals = readJSON(req.userFiles.goals, []);
  const exists = goals.some((g) => g.id === req.params.id);
  if (!exists) return res.status(404).json({ error: "goal not found" });
  goals = goals.filter((g) => g.id !== req.params.id);
  writeJSON(req.userFiles.goals, goals);
  res.status(204).send();
});

app.post("/api/goals/:id/contribute", requireLogin, (req, res) => {
  const body = req.body || {};
  const amount = body.amount;
  const account = body.account;

  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  if (!account) {
    return res.status(400).json({ error: "account is required" });
  }

  const goals = readJSON(req.userFiles.goals, []);
  const idx = goals.findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "goal not found" });

  goals[idx].savedAmount += amount;
  writeJSON(req.userFiles.goals, goals);

  const transactions = readJSON(req.userFiles.tx, []);
  const tx = {
    id: generateId(),
    type: "transfer",
    amount: amount,
    date: new Date().toISOString(),
    account: account,
    toAccount: "Goal: " + goals[idx].title,
    category: null,
    note: "Contribution to goal: " + goals[idx].title
  };
  transactions.push(tx);
  writeJSON(req.userFiles.tx, transactions);

  res.json({ goal: goals[idx], transaction: tx });
});

// ---------------- Backup / Restore ----------------

app.get("/api/backup", requireLogin, (req, res) => {
  res.json({
    exportedAt: new Date().toISOString(),
    transactions: readJSON(req.userFiles.tx, []),
    budgets: readJSON(req.userFiles.budgets, DEFAULT_BUDGETS),
    goals: readJSON(req.userFiles.goals, [])
  });
});

app.post("/api/backup/restore", requireLogin, (req, res) => {
  const body = req.body || {};
  if (!Array.isArray(body.transactions) || typeof body.budgets !== "object" || body.budgets === null || !Array.isArray(body.goals)) {
    return res.status(400).json({ error: "backup file must include transactions (array), budgets (object), and goals (array)" });
  }
  writeJSON(req.userFiles.tx, body.transactions);
  writeJSON(req.userFiles.budgets, body.budgets);
  writeJSON(req.userFiles.goals, body.goals);
  res.json({ success: true });
});

app.delete("/api/backup", requireLogin, (req, res) => {
  writeJSON(req.userFiles.tx, []);
  writeJSON(req.userFiles.budgets, DEFAULT_BUDGETS);
  writeJSON(req.userFiles.goals, []);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log("FinanceAI backend running at http://localhost:" + PORT);
});