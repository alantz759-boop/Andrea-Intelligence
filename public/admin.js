const socket = io();

const sidebar = document.getElementById("sidebar");
const chatWrap = document.getElementById("chatWrap");
const emptyState = document.getElementById("emptyState");
const messagesEl = document.getElementById("messages");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");

let activeConversationId = null;
let conversations = [];
let typingTimeout = null;

socket.emit("admin_join");

socket.on("unauthorized", () => {
  window.location.href = "/admin";
});

function renderSidebar() {
  sidebar.innerHTML = "";
  if (conversations.length === 0) {
    sidebar.innerHTML = `<div style="padding:16px;color:var(--text-muted);font-size:13px;">No conversations yet</div>`;
    return;
  }
  conversations
    .slice()
    .sort((a, b) => (b.lastMessage?.ts || 0) - (a.lastMessage?.ts || 0))
    .forEach((conv) => {
      const item = document.createElement("div");
      item.className = "conv-item" + (conv.id === activeConversationId ? " active" : "");
      item.innerHTML = `
        <div class="name">
          <span>${escapeHtml(conv.userName)} ${conv.connected ? "🟢" : "⚪"}</span>
        </div>
        <div class="preview">${conv.lastMessage ? escapeHtml(conv.lastMessage.text) : "No messages yet"}</div>
      `;
      item.addEventListener("click", () => openConversation(conv.id));
      sidebar.appendChild(item);
    });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function openConversation(id) {
  activeConversationId = id;
  chatWrap.style.display = "flex";
  emptyState.style.display = "none";
  messagesEl.innerHTML = "";
  socket.emit("admin_get_history", { conversationId: id });
  renderSidebar();
  textInput.focus();
}

function addBubble(sender, text) {
  const row = document.createElement("div");
  // In admin view, flip perspective: the user's messages appear on the left,
  // your ("ai") replies appear on the right since you're the one typing them.
  row.className = `bubble-row ${sender === "ai" ? "user" : "ai"}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = sender === "ai" ? "You" : "U";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  if (sender === "ai") {
    row.appendChild(bubble);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(bubble);
  }

  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function sendReply() {
  const text = textInput.value.trim();
  if (!text || !activeConversationId) return;
  socket.emit("admin_reply", { conversationId: activeConversationId, text });
  textInput.value = "";
  textInput.style.height = "auto";
  socket.emit("admin_typing", { conversationId: activeConversationId, isTyping: false });
}

sendBtn.addEventListener("click", sendReply);
textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendReply();
  }
});
textInput.addEventListener("input", () => {
  textInput.style.height = "auto";
  textInput.style.height = textInput.scrollHeight + "px";

  if (!activeConversationId) return;
  socket.emit("admin_typing", { conversationId: activeConversationId, isTyping: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("admin_typing", { conversationId: activeConversationId, isTyping: false });
  }, 1500);
});

socket.on("conversation_list", (list) => {
  conversations = list;
  renderSidebar();
});

socket.on("incoming_message", ({ conversationId, message }) => {
  if (conversationId === activeConversationId) {
    addBubble(message.sender, message.text);
  }
});

socket.on("admin_message_sent", ({ conversationId, message }) => {
  if (conversationId === activeConversationId) {
    addBubble(message.sender, message.text);
  }
});

socket.on("conversation_history", ({ conversationId, messages }) => {
  if (conversationId !== activeConversationId) return;
  messagesEl.innerHTML = "";
  messages.forEach((m) => addBubble(m.sender, m.text));
});
