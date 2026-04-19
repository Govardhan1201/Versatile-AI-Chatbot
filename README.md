# 🚀 Versatile AI Bot: Complete Usage Guide

Welcome to the **Versatile AI Bot Platform**! This guide provides the complete, step-by-step path to running the backend, testing the chatbot, using the admin dashboard, and deploying the widget on external sites.

---

## 🟢 1. How to Start the System

The platform is designed as a full monorepo consisting of:
- **Server**: The AI backend (Express, RAG, OpenAI integration)
- **Admin**: The UI dashboard for managing knowledge and tenants
- **Widget**: The embeddable chatbot script

### Step 1: Open Terminal in the Root Directory
Navigate your terminal to your project folder:
```bash
cd "c:\Users\user\VERSATILE AI BOT"
```

### Step 2: Build the Latest Changes
If you ever edit code, compile all packages at once:
```bash
npm run build
```

### Step 3: Start the Backend Server
Run the production server (which also serves the Widget):
```bash
npm run start --workspace=packages/server
```
*(Or navigate to `packages/server` and run `node dist/server.js`)*

*Wait for the terminal to display `🚀 VERSATILE AI BOT backend running at http://localhost:3001`.*

### Step 4: Start the Admin Dashboard (Optional, in a new terminal)
If you want to view the visual dashboard:
```bash
npm run dev --workspace=packages/admin
```
*(Runs on `http://localhost:5173` by default).*

---

## 🌐 2. How to Open and Test the Chatbot

I have built a simulated website environment specifically for testing the **VIHARA Travel Guide** configuration.

**To view the active Chatbot:**
1. Open your web browser (Chrome/Edge recommended for voice features).
2. Go to: **http://localhost:3001/test/vihara**

**Things to test on this page:**
- **Chat**: Click the 🌿 icon on the bottom right and type *"Plan a 3-day trip to Spiti Valley"*.
- **Voice**: Click the `🎙️` icon inside the chat input area to speak instantly.
- **Multilingual**: Use the top-right header dropdown inside the chat window to switch from `EN` (English) to `हिं` (Hindi) or `తె` (Telugu). Ask a question and watch it reply natively.
- **Auto-Speak**: Click the `🔊` icon in the chat header, and the bot will read its answers out loud automatically.

---

## 🛠️ 3. How to Embed the Widget on ANY Website

The primary goal of this platform is **Portability**. To put this chatbot on your actual live website, all you need is a single HTML tag.

Copy and paste this snippet right before the closing `</body>` tag on any HTML page (WordPress, React, plain HTML, etc.):

```html
<script 
  src="http://localhost:3001/widget/widget.iife.js" 
  data-site-id="vihara">
</script>
```

**Note:** Make sure `http://localhost:3001` is running. In a real production deployment, you would change `http://localhost:3001` to your actual live server domain (e.g., `https://api.mybotplatform.com/widget/widget.iife.js`).

---

## 📂 4. How to Manage Tenants & Knowledge

The entire system is strictly separated by **Tenants** (i.e., different websites). Right now, the only active tenant is `vihara`.

All data for Vihara safely lives in:
```text
c:\Users\user\VERSATILE AI BOT\tenants\vihara\
```

### Modifying the Bot's Behavior (Configs)
Open `tenants\vihara\config.json`. Inside, you can change:
- **`chatTitle`**: The text displayed at the top of the chat window.
- **`theme`**: Change colors, positions, or toggle dark mode.
- **`systemPrompt`**: The core instructions telling the AI how to act. 
- **`languages`**: Add more supported languages (e.g., `"fr", "es"`).

### Modifying the Bot's Knowledge (RAG)
By default, the bot reads from `tenants\vihara\ingestion.json`. If you want to teach the bot new things:
1. Add `.md` or `.txt` files into `tenants\vihara\knowledge\`.
2. As long as `ingestion.json` points to them, the server automatically reads, chunks, and vectorizes them on its next startup.
3. *Restart the server using Step 3 above.* You will see terminal logs saying `Auto-ingested chunks for tenant: vihara`.

---

## 🧰 5. Included Architecture Tools
The system is heavily loaded with secure logic tools out-of-the-box:

- **Browser DOM Actions**: The bot can programmatically scroll a user down an HTML page or redirect their URL tabs if they ask for navigation help.
- **Lead Collection**: The bot can securely ask for emails and phone numbers and save them without showing the user backend architecture.
- **Vector Search Engine**: Completely offline, mathematics-based TF-IDF + Cosine Similarity text comparison to look up knowledge.
- **OpenAI Linked**: Connected securely to GPT-4o-Mini via the root `.env` file you provided. 

> **Important**: If you close the terminal window running the server, the widget on external websites will break and show a red "Connection Retry" banner until you boot the server back up!
