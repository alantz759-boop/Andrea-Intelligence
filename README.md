# Human-AI Chat

A chat app that looks like an AI assistant, but every reply is actually
typed by you in real time from a separate admin console.

## How it works

- **User page** (`/`) — looks like a normal AI chat. Visitors type messages here.
- **Admin page** (`/admin`) — this is your console. It lists every active
  conversation; click one, see their messages, and type your reply. Your
  reply is instantly pushed to that user's chat window as a message from
  "the assistant."
- Built with Node.js, Express, and Socket.io (WebSockets) for real-time
  two-way messaging. Conversations are stored in memory, so they reset
  when the server restarts (fine for a prototype — see "Next steps" below
  for persistence).

## Setup

1. **Install Node.js** (includes npm): https://nodejs.org (LTS version)
2. **Install Git** (optional, for version control): https://git-scm.com
3. Open this folder in VS Code.
4. Open a terminal in VS Code (`Terminal > New Terminal`) and run:
   ```
   npm install
   npm start
   ```
5. You'll see:
   ```
   Server running at http://localhost:3000
   User chat:  http://localhost:3000/
   Admin view: http://localhost:3000/admin
   ```
6. Open **two browser windows**:
   - `http://localhost:3000/` — pretend to be a visitor, send a message.
   - `http://localhost:3000/admin` — see the message appear, click the
     conversation, and type a reply. It'll show up instantly in the first window.

## Project structure

```
human-ai-chat/
├── server.js           # Express + Socket.io backend, routes messages
├── package.json
└── public/
    ├── index.html       # User-facing chat UI
    ├── chat.js           # User-side Socket.io logic
    ├── admin.html        # Your operator console
    ├── admin.js           # Admin-side Socket.io logic
    └── style.css          # Shared styling for both pages
```

## Next steps / ideas to extend it

- **Persistence**: swap the in-memory `conversations` object in `server.js`
  for a real database (SQLite is the easiest starting point for a solo project).
- **Multiple admins**: right now any browser tab at `/admin` can reply to
  any conversation — fine solo, but add login/auth if more than one person
  will use the console.
- **Notifications**: play a sound or show a browser notification on the
  admin page when a new message arrives (`Notification` API).
- **Canned replies**: add a quick-reply panel in `admin.html` for common answers.
- **Deploy it**: once it works locally, you can deploy to something like
  Render, Railway, or Fly.io to make it reachable outside your machine.

## Note on transparency

Since visitors will believe they're talking to an AI, consider whether—
and how—you want to disclose that a human is on the other end, depending
on what you're using this for (e.g., a class project, a UX study, internal
tooling). That's a call for you to make based on context, not something
this code enforces either way.
