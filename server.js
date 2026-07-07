const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const TX_FILE = path.join(DATA_DIR, "transactions.json");
const BUDGETS_FILE = path.join(DATA_DIR, "budgets.json");
const GOALS_FILE = path.join(DATA_DIR, "goals.json");

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

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(TX_FILE)) fs.writeFileSync(TX_FILE, "[]");
  if (!fs.existsSync(BUDGETS_FILE)) fs.writeFileSync(BUDGETS_FILE, JSON.stringify(DEFAULT_BUDGETS, null, 2));
  if (!fs.existsSync(GOALS_FILE)) fs.writeFileSync(GOALS_FILE, "[]");
}
ensureDataFiles();

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

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------- Transactions ----------------

app.get("/api/transactions", (req, res) => {
  res.json(readJSON(TX_FILE, []));
});

app.post("/api/transactions", (req, res) => {
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

  const transactions = readJSON(TX_FILE, []);
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
  writeJSON(TX_FILE, transactions);
  res.status(201).json(tx);
});

app.put("/api/transactions/:id", (req, res) => {
  const transactions = readJSON(TX_FILE, []);
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
  writeJSON(TX_FILE, transactions);
  res.json(transactions[idx]);
});

app.delete("/api/transactions/:id", (req, res) => {
  let transactions = readJSON(TX_FILE, []);
  const exists = transactions.some((t) => t.id === req.params.id);
  if (!exists) return res.status(404).json({ error: "transaction not found" });
  transactions = transactions.filter((t) => t.id !== req.params.id);
  writeJSON(TX_FILE, transactions);
  res.status(204).send();
});

// ---------------- Budgets ----------------

app.get("/api/budgets", (req, res) => {
  res.json(readJSON(BUDGETS_FILE, DEFAULT_BUDGETS));
});

app.put("/api/budgets/:category", (req, res) => {
  const budgets = readJSON(BUDGETS_FILE, {});
  const limit = req.body ? req.body.limit : undefined;
  if (typeof limit !== "number" || limit < 0) {
    return res.status(400).json({ error: "limit must be a number >= 0" });
  }
  budgets[req.params.category] = limit;
  writeJSON(BUDGETS_FILE, budgets);
  res.json(budgets);
});

// ---------------- Goals ----------------

app.get("/api/goals", (req, res) => {
  res.json(readJSON(GOALS_FILE, []));
});

app.post("/api/goals", (req, res) => {
  const body = req.body || {};
  if (!body.title || typeof body.targetAmount !== "number" || body.targetAmount <= 0 || !body.targetDate) {
    return res.status(400).json({ error: "title, targetAmount (>0), and targetDate are required" });
  }
  const goals = readJSON(GOALS_FILE, []);
  const goal = {
    id: generateId(),
    title: body.title,
    targetAmount: body.targetAmount,
    targetDate: body.targetDate,
    savedAmount: 0
  };
  goals.push(goal);
  writeJSON(GOALS_FILE, goals);
  res.status(201).json(goal);
});

app.put("/api/goals/:id", (req, res) => {
  const goals = readJSON(GOALS_FILE, []);
  const idx = goals.findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "goal not found" });

  const body = req.body || {};
  if (!body.title || typeof body.targetAmount !== "number" || body.targetAmount <= 0 || !body.targetDate) {
    return res.status(400).json({ error: "title, targetAmount (>0), and targetDate are required" });
  }
  goals[idx].title = body.title;
  goals[idx].targetAmount = body.targetAmount;
  goals[idx].targetDate = body.targetDate;
  writeJSON(GOALS_FILE, goals);
  res.json(goals[idx]);
});

app.delete("/api/goals/:id", (req, res) => {
  let goals = readJSON(GOALS_FILE, []);
  const exists = goals.some((g) => g.id === req.params.id);
  if (!exists) return res.status(404).json({ error: "goal not found" });
  goals = goals.filter((g) => g.id !== req.params.id);
  writeJSON(GOALS_FILE, goals);
  res.status(204).send();
});

// Atomic: add money to a goal AND log a transfer transaction in one request
app.post("/api/goals/:id/contribute", (req, res) => {
  const body = req.body || {};
  const amount = body.amount;
  const account = body.account;

  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  if (!account) {
    return res.status(400).json({ error: "account is required" });
  }

  const goals = readJSON(GOALS_FILE, []);
  const idx = goals.findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "goal not found" });

  goals[idx].savedAmount += amount;
  writeJSON(GOALS_FILE, goals);

  const transactions = readJSON(TX_FILE, []);
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
  writeJSON(TX_FILE, transactions);

  res.json({ goal: goals[idx], transaction: tx });
});

app.listen(PORT, () => {
  console.log("FinanceAI backend running at http://localhost:" + PORT);
});
