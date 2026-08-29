const socket = io();

// ---- Elements ----
const joinScreen = document.getElementById("joinScreen");
const chatWrap = document.getElementById("chatWrap");
const nameInput = document.getElementById("nameInput");
const joinBtn = document.getElementById("joinBtn");
const messagesEl = document.getElementById("messages");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const emptyChatState = document.getElementById("emptyChatState");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const taglineEl = document.getElementById("tagline");
const chatSidebar = document.getElementById("chatSidebar");
const chatList = document.getElementById("chatList");
const newChatBtn = document.getElementById("newChatBtn");
const menuBtn = document.getElementById("menuBtn");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const appLayout = document.querySelector(".app-layout");

// ---- Witty taglines ----
const TAGLINES = [
  "Here for your most complex questions (doesn't mean I'll get them right).",
  "Powered by determination and mild Googling.",
  "Ask me anything — results not guaranteed.",
  "Your friendly neighborhood not-quite-AI.",
  "I promise at least 60% accuracy.",
  "Big brain energy, moderate follow-through.",
  "Thinking really hard about your question rn.",
  "I run on caffeine, not algorithms.",
  "99% helpful, 1% making it up as I go.",
  "Insert impressive AI catchphrase here.",
  "Warning: may respond slower than an actual robot.",
  "Certified human, allegedly intelligent.",
];
taglineEl.textContent = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];

// ---- Local state ----
let userName = localStorage.getItem("aiChatUserName");
let conversations = [];
try {
  conversations = JSON.parse(localStorage.getItem("aiChatConversationsList") || "[]");
} catch (err) {
  conversations = [];
}
let activeConversationId = localStorage.getItem("aiChatActiveConversationId") || null;

function saveConversationsList() {
  localStorage.setItem("aiChatConversationsList", JSON.stringify(conversations));
}

function setActiveConversation(id) {
  activeConversationId = id;
  localStorage.setItem("aiChatActiveConversationId", id);
}

// ---- Message rendering ----
function clearMessages() {
  messagesEl.querySelectorAll(".bubble-row").forEach((el) => el.remove());
}

function addBubble(sender, text) {
  const row = document.createElement("div");
  row.className = `bubble-row ${sender}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = sender === "ai" ? "AI" : "Y";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  if (sender === "user") {
    row.appendChild(bubble);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(bubble);
  }

  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ---- Sidebar ----
function renderChatList() {
  chatList.innerHTML = "";
  if (conversations.length === 0) {
    chatList.innerHTML = `<div style="padding:12px 14px;color:var(--text-muted);font-size:12.5px;">No chats yet</div>`;
    return;
  }
  conversations.forEach((c) => {
    const item = document.createElement("div");
    item.className = "chat-list-item" + (c.id === activeConversationId ? " active" : "");
    item.textContent = c.title || "New chat";
    item.addEventListener("click", () => selectConversation(c.id));
    chatList.appendChild(item);
  });
}

function showAppShell() {
  joinScreen.style.display = "none";
  chatSidebar.style.display = "flex";
  chatWrap.style.display = "flex";
}

function closeMobileSidebar() {
  appLayout.classList.remove("sidebar-open");
}

function selectConversation(id) {
  closeMobileSidebar();
  if (id === activeConversationId) return;
  clearMessages();
  emptyChatState.style.display = "none";
  socket.emit("user_join", { conversationId: id });
}

function startNewChat() {
  closeMobileSidebar();
  clearMessages();
  emptyChatState.style.display = "block";
  socket.emit("user_join", { userName });
}

newChatBtn.addEventListener("click", startNewChat);
menuBtn.addEventListener("click", () => appLayout.classList.toggle("sidebar-open"));
sidebarBackdrop.addEventListener("click", closeMobileSidebar);

// ---- Join screen ----
joinBtn.addEventListener("click", () => {
  userName = nameInput.value.trim() || "Anonymous";
  socket.emit("user_join", { userName });
});

// ---- Socket events ----
socket.on("joined", ({ conversationId, userName: confirmedName, isNew, title }) => {
  userName = confirmedName;
  localStorage.setItem("aiChatUserName", userName);
  setActiveConversation(conversationId);

  if (!conversations.find((c) => c.id === conversationId)) {
    conversations.unshift({ id: conversationId, title: title || "New chat" });
    saveConversationsList();
  }

  showAppShell();
  renderChatList();
  textInput.focus();
});

socket.on("history", ({ messages }) => {
  clearMessages();
  if (messages.length > 0) {
    emptyChatState.style.display = "none";
    messages.forEach((m) => addBubble(m.sender, m.text));
  } else {
    emptyChatState.style.display = "block";
  }
});

socket.on("title_updated", ({ conversationId, title }) => {
  const conv = conversations.find((c) => c.id === conversationId);
  if (conv) {
    conv.title = title;
    saveConversationsList();
    renderChatList();
  }
});

// ---- Boot: reconnect to saved state, if any ----
if (userName) {
  showAppShell();
  renderChatList();
  if (activeConversationId && conversations.find((c) => c.id === activeConversationId)) {
    socket.emit("user_join", { conversationId: activeConversationId });
  } else if (conversations.length > 0) {
    socket.emit("user_join", { conversationId: conversations[0].id });
  } else {
    socket.emit("user_join", { userName });
  }
}

// ---- Sending messages ----
function sendMessage() {
  const text = textInput.value.trim();
  if (!text) return;
  socket.emit("user_message", { text });
  textInput.value = "";
  textInput.style.height = "auto";
}

sendBtn.addEventListener("click", sendMessage);
textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
textInput.addEventListener("input", () => {
  textInput.style.height = "auto";
  textInput.style.height = textInput.scrollHeight + "px";
});

socket.on("new_message", ({ sender, text }) => {
  typingIndicator.style.display = "none";
  emptyChatState.style.display = "none";
  addBubble(sender, text);
});

const TYPING_PHRASES = [
  "Andrea is thinking…",
  "Consulting my one brain cell…",
  "Andrea is typing (moderately fast)…",
  "Generating a totally-not-scripted response…",
  "Processing at human speed…",
];

socket.on("ai_typing", ({ isTyping }) => {
  if (isTyping) {
    typingIndicator.textContent = TYPING_PHRASES[Math.floor(Math.random() * TYPING_PHRASES.length)];
    typingIndicator.style.display = "block";
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } else {
    typingIndicator.style.display = "none";
  }
});

socket.on("admin_status", ({ online }) => {
  if (online) {
    statusDot.classList.add("online");
    statusText.textContent = "Online";
  } else {
    statusDot.classList.remove("online");
    statusText.textContent = "Away";
  }
});
