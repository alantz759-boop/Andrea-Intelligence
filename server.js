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

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// In-memory store of conversations.
// { [conversationId]: { id, userSocketId, userName, messages: [{sender, text, ts}] } }
const conversations = {};

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

io.on("connection", (socket) => {
  // ---- USER SIDE ----
  socket.on("user_join", ({ userName }) => {
    const id = crypto.randomUUID();
    conversations[id] = {
      id,
      userSocketId: socket.id,
      userName: userName?.trim() || "Anonymous",
      messages: [],
    };
    socket.data.conversationId = id;
    socket.join(id);
    socket.emit("joined", { conversationId: id });
    broadcastConversationList();
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
  });

  // ---- ADMIN SIDE ----
  socket.on("admin_join", () => {
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
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`User chat:  http://localhost:${PORT}/`);
  console.log(`Admin view: http://localhost:${PORT}/admin`);
});
