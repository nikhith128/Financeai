const { MongoClient } = require('mongodb');
const session = require('express-session');

const uri = process.env.MONGODB_URI;
let client;
let db;

async function connectDB() {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(); // uses the database name from the URI (financeai)
  await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  console.log('Connected to MongoDB');
  return db;
}

class MongoSessionStore extends session.Store {
  get(sid, callback) {
    getDB().collection('sessions').findOne({ _id: sid }).then((doc) => {
      if (!doc || doc.expiresAt <= new Date()) return callback(null, null);
      callback(null, doc.session);
    }, callback);
  }

  set(sid, value, callback = () => {}) {
    const expiresAt = value.cookie && value.cookie.expires ? new Date(value.cookie.expires) :
      new Date(Date.now() + (value.cookie?.maxAge || 86400000));
    getDB().collection('sessions').updateOne(
      { _id: sid }, { $set: { session: value, expiresAt } }, { upsert: true }
    ).then(() => callback(null), callback);
  }

  destroy(sid, callback = () => {}) {
    getDB().collection('sessions').deleteOne({ _id: sid }).then(() => callback(null), callback);
  }

  touch(sid, value, callback = () => {}) {
    const expiresAt = value.cookie && value.cookie.expires ? new Date(value.cookie.expires) :
      new Date(Date.now() + (value.cookie?.maxAge || 86400000));
    getDB().collection('sessions').updateOne({ _id: sid }, { $set: { expiresAt } })
      .then(() => callback(null), callback);
  }
}

function getDB() {
  if (!db) throw new Error('Database not connected yet. Call connectDB() first.');
  return db;
}

module.exports = { connectDB, getDB, MongoSessionStore };

