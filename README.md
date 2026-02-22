# Graph AI 📊

AI-powered data visualization app. Describe a chart in plain English → get a beautiful interactive Plotly chart.

## Stack
- **Frontend**: React + Vite
- **Backend**: Express.js
- **AI**: Google Gemini 1.5 Flash (free tier — 1,500 req/day, no credit card)
- **Charts**: Plotly.js

## Project Structure
```
graph-ai/
├── client/          ← React frontend (Vite)
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   ├── ChatArea.jsx
│       │   ├── InputBar.jsx
│       │   ├── StarField.jsx
│       │   └── WaveHero.jsx
│       └── utils/
│           └── conversations.js
└── server/          ← Express backend (holds API key)
    ├── index.js
    └── .env         ← YOU CREATE THIS
```

## Setup

### 1. Get your free Gemini API key
Go to https://aistudio.google.com → sign in with Google → Get API Key  
It's free forever, no credit card needed.

### 2. Setup the server
```bash
cd server
npm install

# Create your .env file
cp .env.example .env
# Edit .env and paste your Gemini key:
# GEMINI_API_KEY=AIza...your key here...
```

### 3. Setup the client
```bash
cd client
npm install
```

### 4. Run both (two terminals)

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
# Running on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# Running on http://localhost:5173
```

Open http://localhost:5173 and start chatting!

## Usage
- Type any chart description: *"Show monthly sales for 2024 as a bar chart"*
- Attach a CSV or JSON file and ask: *"Visualize this data as a heatmap"*
- Each conversation is saved in the sidebar
- Start new conversations with the "+ New conversation" button
