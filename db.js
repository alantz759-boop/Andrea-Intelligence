// db.js
// Very simple file-based persistence — no database server needed.
// Conversations are kept in memory while the app runs (fast), and
// mirrored to a JSON file on disk so they survive restarts.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "conversations.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadConversations() {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) return {};
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    // Socket IDs from a previous run are no longer valid — clear them.
    Object.values(parsed).forEach((conv) => {
      conv.userSocketId = null;
    });
    return parsed;
  } catch (err) {
    console.error("Could not read conversations.json, starting fresh:", err.message);
    return {};
  }
}

function saveConversations(conversations) {
  ensureDataDir();
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(conversations, null, 2));
  } catch (err) {
    console.error("Could not save conversations.json:", err.message);
  }
}

module.exports = { loadConversations, saveConversations };
