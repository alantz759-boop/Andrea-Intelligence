const socket = io();

const joinScreen = document.getElementById("joinScreen");
const chatWrap = document.getElementById("chatWrap");
const nameInput = document.getElementById("nameInput");
const joinBtn = document.getElementById("joinBtn");
const messagesEl = document.getElementById("messages");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const emptyChatState = document.getElementById("emptyChatState");

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

joinBtn.addEventListener("click", () => {
  socket.emit("user_join", { userName: nameInput.value });
  joinScreen.style.display = "none";
  chatWrap.style.display = "flex";
  textInput.focus();
});

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

socket.on("ai_typing", ({ isTyping }) => {
  typingIndicator.style.display = isTyping ? "block" : "none";
  if (isTyping) messagesEl.scrollTop = messagesEl.scrollHeight;
});