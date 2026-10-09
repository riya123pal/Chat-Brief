# 💬 ChatBrief — WhatsApp Chat Summarizer

**ChatBrief** is an intelligent conversational analytics and summarization application built specifically for exported WhatsApp chats. It transforms long, chaotic group chats or 1-on-1 threads into concise, structured, and actionable intelligence.

---

## ✨ Core Features

1. **Upload & Parse WhatsApp Exports**:
   - Supports both **Android** (`DD/MM/YYYY, HH:MM - Name: Msg`) and **iOS** (`[DD/MM/YY, HH:MM:SS] Name: Msg`) chat export formats.
   - Cleans multi-line messages, detects media attachments, and filters system event notifications.
   - Supports files up to 50MB with instant parsing.

2. **Executive Conversation Summary**:
   - High-level overview explaining the goal, tone, and outcome of the exchange.
   - Automatically detects conversation sentiment and dynamics.

3. **Key Topics Detection**:
   - Clusters discussions into 3–6 core thematic categories.
   - Highlights key contributors and discussion depth for each topic.

4. **Decisions, Promises & Upcoming Plans**:
   - **Decisions Finalized**: Clear agreements, consensus items, and who approved them.
   - **Promises & Commitments**: Explicit individual commitments made to the group.
   - **Upcoming Plans**: Scheduled meetings, trips, dinners, and events with timestamps.

5. **Action Items & Responsibility Delegation**:
   - Extracts concrete tasks with **Assignee** badges and stated **Deadlines**.
   - Includes interactive checkboxes and a **1-click "Copy Checklist"** feature formatted for task managers (Notion, Slack, Trello, Jira).

6. **Unanswered Questions Tracker**:
   - Identifies open queries asked during the chat that never received a decisive resolution or are pending verification.

7. **Chronological Milestone Timeline**:
   - Visual milestone flow tracking critical turning points in the chat from start to finish.

8. **Configurable Summary Depth (Short, Medium, Detailed)**:
   - **Short (⚡)**: Quick executive bullet points, top 3 action items, crucial decisions.
   - **Medium (⚖️)**: Balanced narrative with core topics, key agreements, and delegated tasks.
   - **Detailed (🔍)**: In-depth breakdown with quotes, context, full task register, and participant analysis.
   - Switch between depths on the fly without re-uploading!

9. **Export & Sharing**:
   - **1-Click Copy**: Copies full markdown report with formatted headers.
   - **Download as Markdown (.md)**
   - **Download as Plain Text (.txt)**
   - **Download as Structured JSON (.json)**
   - **Print / Save as PDF**: Beautifully styled for clean white-page document printing.

10. **Dual-Engine Architecture (Zero-Setup + AI Power)**:
    - **Local NLP Heuristic Engine**: Works 100% offline with zero configuration and zero API keys!
    - **Google Gemini AI Engine**: Seamless integration with `gemini-2.5-flash`, `gemini-2.0-flash`, or `gemini-1.5-flash` for deep semantic synthesis.
    - Handles massive multi-thousand-message conversations using automated hierarchical chunking.

---

## 🚀 Quick Start Guide

### 1. Run the Application
Open a terminal in the project directory and run:

```bash
python app.py
```

Then visit **http://127.0.0.1:5000** in your browser.

### 2. (Optional) Connect Gemini AI
- Click the **Local NLP Engine / Settings** badge in the top navigation bar.
- Paste your Google Gemini API Key (obtained from [Google AI Studio](https://aistudio.google.com/app/apikey)).
- Click **Test Connection** & **Save**.
- Or add `GEMINI_API_KEY=your_key_here` to a `.env` file in the root directory.

---

## 📱 How to Export a WhatsApp Chat

1. Open WhatsApp on your Android or iPhone.
2. Open the desired chat or group.
3. Tap the contact or group name at the top (or tap **⋮ More**).
4. Tap **Export Chat**.
5. Select **Without Media** (for a fast, lightweight `.txt` export).
6. Upload or drag & drop the generated `.txt` file into ChatBrief!

---

## 📁 Project Structure

```
Chatbrief/
├── app.py                     # Flask web server & REST API
├── parser.py                  # Android & iOS WhatsApp regex parser & stats
├── summarizer.py              # Gemini AI + Local NLP chunked summarizer
├── requirements.txt           # Python dependencies
├── .env.example               # Environment variables template
├── sample_chats/              # Realistic demo chats for instant testing
│   ├── startup_product_launch.txt
│   └── weekend_roadtrip_planning.txt
├── static/
│   ├── css/
│   │   └── style.css          # Glassmorphism, animations & print styling
│   └── js/
│       └── app.js            # Frontend application controller
└── templates/
    └── index.html             # Modern UI with Tailwind CSS & Lucide icons
```
