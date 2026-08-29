// server.js
// A minimal real-time chat server.
// - Users connect at "/" and send messages.
// - You (the human "AI") connect at "/admin" and see every conversation,
//   pick one, and reply. Your reply is pushed back to that specific user
//   and shown in their chat window as if it came from "the AI".

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");
const { loadConversations, saveConversations } = require("./db");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---- ADMIN PASSWORD PROTECTION ----
// Set ADMIN_PASSWORD as an environment variable in Render (Settings > Environment).
// Locally it falls back to "changeme123" — change this if you test it that way.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme123";
const ADMIN_TOKEN = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest("hex");
const COOKIE_NAME = "adminAuth";

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  });
  return out;
}

function isAdminAuthed(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] === ADMIN_TOKEN;
}

app.post("/admin-login", (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${ADMIN_TOKEN}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 30}`
    );
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false });
});

app.get("/admin", (req, res) => {
  if (isAdminAuthed(req)) {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
  } else {
    res.sendFile(path.join(__dirname, "public", "admin-login.html"));
  }
});

// Conversations live in memory while the server runs (fast reads/writes),
// and are mirrored to disk so they survive a restart.
// { [conversationId]: { id, userSocketId, userName, messages: [{sender, text, ts}], lastAutoReplyTs } }
const conversations = loadConversations();

function persist() {
  saveConversations(conversations);
}

function conversationSummary(conv) {
  return {
    id: conv.id,
    userName: conv.userName,
    lastMessage: conv.messages[conv.messages.length - 1] || null,
    messageCount: conv.messages.length,
    connected: !!conv.userSocketId,
  };
}

function broadcastConversationList() {
  const list = Object.values(conversations).map(conversationSummary);
  io.to("admins").emit("conversation_list", list);
}

// Witty away-messages, sent automatically when nobody's on the admin console.
const AWAY_MESSAGES = [
  "Away from the mainframe right now — back shortly!",
  "Andrea (aka the AI) stepped away from the keyboard. Hang tight!",
  "Currently offline recharging my one and only brain cell. Back soon!",
  "Beep boop... just kidding, I'm human and I'm AFK. Reply incoming eventually!",
  "Out grabbing coffee to power my \"neural network.\" Back in a bit!",
];

function adminIsOnline() {
  const room = io.sockets.adapter.rooms.get("admins");
  return !!room && room.size > 0;
}

io.on("connection", (socket) => {
  // ---- USER SIDE ----
  socket.on("user_join", ({ userName, conversationId }) => {
    // If the browser already has a conversation ID saved (a returning
    // visitor), reconnect them to it instead of starting a new one.
    if (conversationId && conversations[conversationId]) {
      const conv = conversations[conversationId];
      conv.userSocketId = socket.id;
      socket.data.conversationId = conv.id;
      socket.join(conv.id);
      socket.emit("joined", { conversationId: conv.id, userName: conv.userName });
      socket.emit("history", { messages: conv.messages });
      broadcastConversationList();
      persist();
      return;
    }

    const id = crypto.randomUUID();
    conversations[id] = {
      id,
      userSocketId: socket.id,
      userName: userName?.trim() || "Anonymous",
      messages: [],
    };
    socket.data.conversationId = id;
    socket.join(id);
    socket.emit("joined", { conversationId: id, userName: conversations[id].userName });
    broadcastConversationList();
    persist();
  });

  socket.on("user_message", ({ text }) => {
    const id = socket.data.conversationId;
    const conv = conversations[id];
    if (!conv || !text?.trim()) return;

    const message = { sender: "user", text: text.trim(), ts: Date.now() };
    conv.messages.push(message);

    // Show it in the user's own window
    io.to(id).emit("new_message", message);
    // Notify admins a message came in
    io.to("admins").emit("incoming_message", { conversationId: id, message });
    broadcastConversationList();
    persist();

    // If nobody's on the admin console, send a witty auto-reply —
    // but no more than once every 5 minutes per conversation, so it
    // doesn't spam every single message.
    const FIVE_MIN = 5 * 60 * 1000;
    if (!adminIsOnline() && (!conv.lastAutoReplyTs || Date.now() - conv.lastAutoReplyTs > FIVE_MIN)) {
      const awayText = AWAY_MESSAGES[Math.floor(Math.random() * AWAY_MESSAGES.length)];
      const awayMessage = { sender: "ai", text: awayText, ts: Date.now() };
      conv.messages.push(awayMessage);
      conv.lastAutoReplyTs = Date.now();
      io.to(id).emit("new_message", awayMessage);
      io.to("admins").emit("admin_message_sent", { conversationId: id, message: awayMessage });
      broadcastConversationList();
      persist();
    }
  });

  // ---- ADMIN SIDE ----
  socket.on("admin_join", ({ token } = {}) => {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const authed = cookies[COOKIE_NAME] === ADMIN_TOKEN || token === ADMIN_TOKEN;
    if (!authed) {
      socket.emit("unauthorized");
      return;
    }
    socket.join("admins");
    socket.emit("conversation_list", Object.values(conversations).map(conversationSummary));
  });

  socket.on("admin_get_history", ({ conversationId }) => {
    const conv = conversations[conversationId];
    if (!conv) return;
    socket.emit("conversation_history", { conversationId, messages: conv.messages });
  });

  socket.on("admin_reply", ({ conversationId, text }) => {
    const conv = conversations[conversationId];
    if (!conv || !text?.trim()) return;

    const message = { sender: "ai", text: text.trim(), ts: Date.now() };
    conv.messages.push(message);

    // Push to the user as "the AI"
    io.to(conversationId).emit("new_message", message);
    // Echo back to admin so their own panel updates too
    io.to("admins").emit("admin_message_sent", { conversationId, message });
    broadcastConversationList();
    persist();
  });

  socket.on("admin_typing", ({ conversationId, isTyping }) => {
    io.to(conversationId).emit("ai_typing", { isTyping });
  });

  // ---- DISCONNECT ----
  socket.on("disconnect", () => {
    const id = socket.data.conversationId;
    if (id && conversations[id]) {
      conversations[id].userSocketId = null;
      broadcastConversationList();
      persist();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`User chat:  http://localhost:${PORT}/`);
  console.log(`Admin view: http://localhost:${PORT}/admin`);
});