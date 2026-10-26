# TypeSprint ⚡

A next-generation typing speed and accuracy platform featuring real-time feedback, mechanical key sound synthesis, interactive pacing charts, lifetime analytics, and multi-session trend analysis.

---

## ✨ Features

- **Dynamic Test Modes:**
  - **Words Mode:** 10, 25, 50, or 100 words dynamically generated from curated vocabulary.
  - **Time Mode:** 15s, 30s, 60s, or 120s with an infinite word stream that never runs out.
  - **Quote Mode:** Curated quotes with author attribution.
  - **Modifiers:** Toggle `@ punctuation` and `# numbers` on-demand.
- **Precision Metrics:**
  - **Net WPM** & **Raw WPM** (Gross Speed).
  - **Accurate Accuracy Calculation** with no underflow bugs.
  - **Rhythm Consistency Score (%)** using speed sample variance.
  - **Detailed Character Breakdown:** Correct, Incorrect, Extra, and Missed keystrokes.
- **Audio Experience:**
  - Built-in zero-latency mechanical key click synthesizer using the Web Audio API (toggleable with 🔊).
- **Smooth Animated Caret & Modern Aesthetics:**
  - Blinking gold glowing caret, fluid monospace typography (*JetBrains Mono*), and dark glassmorphic UI.
- **Dual Visualizations:**
  - **Interactive Vector Chart (Frontend):** Instant SVG chart with hover tooltips showing instantaneous WPM and error bursts per second.
  - **Pandas & Matplotlib Progress Graph (Backend):** Multi-session moving average progression trend over past sprints.
- **Analytics & History Dashboard (`/history`):**
  - Lifetime statistics: Best WPM, Average WPM, Average Accuracy, Total Sprints, and Time Typed.
  - History log table with date/time, mode, WPM, and errors.
- **Keyboard Shortcuts:**
  - `Tab + Enter` or `Esc` to instantly restart a sprint.

---

## 🛠 Tech Stack

- **Frontend:** React 19, Vite 7, React Router 7, Vanilla CSS (Design System Tokens)
- **Audio:** Web Audio API (zero audio file downloads, pure synthesized mechanical feedback)
- **Backend:** Python 3.11+, Flask, Flask-CORS
- **Data & Analytics:** Pandas (moving averages, summary metrics) & Matplotlib (trend visualization)

---

## 🚀 Getting Started

### 1. Backend Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Start the Flask API server (runs on port 5000)
python app.py
```

### 2. Frontend Setup
```bash
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```

Visit `http://localhost:5173` to start sprinting!

---

## 📡 API Reference

- `GET /api/text` — Generates dynamic typing passages based on `testMode`, `wordCount`, `testDuration`, `punctuation`, and `numbers`.
- `POST /api/calculate` — Computes comprehensive speed, accuracy, consistency metrics, records session to history, and renders dark-mode session graph.
- `GET /api/history` — Returns lifetime aggregated stats, past sessions, and Pandas-generated progression trend chart.
- `DELETE /api/history` — Clears past test history.
