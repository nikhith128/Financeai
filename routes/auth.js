const express = require('express');
const bcrypt = require('bcryptjs');
const { getDB } = require('../db');
const router = express.Router();

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required.' });
    }

    const db = getDB();
    const users = db.collection('users');

    const existing = await users.findOne({
      username: { $regex: `^${username}$`, $options: 'i' }
    });
    if (existing) {
      return res.status(400).json({ error: 'That username is already taken.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const newUser = { id: generateId(), username, password: hashed };
    await users.insertOne(newUser);

    req.session.userId = newUser.id;
    req.session.username = newUser.username;
    res.json({ success: true, username: newUser.username });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Something went wrong during signup.' });
  }
});

// Log in
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = getDB();
    const users = db.collection('users');

    const user = await users.findOne({
      username: { $regex: `^${username || ''}$`, $options: 'i' }
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong during login.' });
  }
});

// Log out
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Check current session
router.get('/me', (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, username: req.session.username });
  } else {
    res.json({ loggedIn: false });
  }
});

module.exports = router;