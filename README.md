# AI Interview Coach

[![CI](https://github.com/GOURAVPY/AI-Interview-Coach/actions/workflows/ci.yml/badge.svg)](https://github.com/GOURAVPY/AI-Interview-Coach/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-React-3178c6)
![Node](https://img.shields.io/badge/Node.js-Express-5fa04e)

**Practise your interview for a job abroad with an AI that talks back.**

A live voice interviewer that speaks with you in English, German, Japanese, Dutch, French or Spanish, asks questions for the job you choose, follows up on your answers, and gives you a scored report at the end. It also has a coding round where an AI writes the problem and you write the logic.

I built it to prepare for working abroad, and as a way to learn how to build real-time audio, AI and a full backend together. It is an open-source portfolio project, not a product.

| Landing page, with a no-sign-up demo | Live voice interview |
| :---: | :---: |
| ![Landing page](docs/screenshots/landing.jpg) | ![Interview room](docs/screenshots/interview-room.jpg) |

| Scored report | Progress over time |
| :---: | :---: |
| ![Report](docs/screenshots/report.jpg) | ![History](docs/screenshots/history.jpg) |

| Coding round: the AI sets the problem, you solve it |
| :---: |
| ![Coding round](docs/screenshots/coding-round.jpg) |

## What makes it interesting to build

| Problem | How it is solved | Where to look |
| --- | --- | --- |
| A voice chat that feels instant | The browser streams audio straight to Gemini Live over a WebSocket, in 40 ms chunks, and plays the reply as it arrives. Interrupting stops the audio in the same tick. | [`useLiveInterview.ts`](frontend/src/hooks/useLiveInterview.ts), [`audio.ts`](frontend/src/utils/audio.ts), [`pcm-capture-worklet.js`](frontend/public/pcm-capture-worklet.js) |
| Keeping the API key secret | The server mints a single-use token locked to one interview's instructions. The key never reaches the browser. | [`gemini.js`](backend/src/services/gemini.js) |
| Scores that are consistent | A written rubric with anchored levels, temperature 0, schema-validated JSON. Anything countable is plain code, not AI. | [`scoring.js`](backend/src/prompts/scoring.js), [`metrics.js`](backend/src/services/metrics.js) |
| Live voice is billed per minute | Time is reserved atomically before a session, refunded on the server's clock, and capped per user, per visitor, per network and globally. | [`usage.js`](backend/src/services/usage.js) |
| Running untrusted code safely | A candidate's code runs only in a browser Web Worker with a time limit. The server only runs the AI's own reference solution, in a limited thread. | [`runner.ts`](frontend/src/utils/runner.ts), [`sandbox.js`](backend/src/services/sandbox.js) |
| An AI and a user sharing one editor | The AI acts through a tiny handle, every change is logged and undoable, and problems are verified before you see them. | [`CodeEditor.tsx`](frontend/src/components/CodeEditor.tsx), [`codingAi.js`](backend/src/services/codingAi.js) |

**Read the write-up:** [How I kept the conversation fast, the scores fair and the bill small](docs/WRITEUP.md).

## Features

- **Voice interview:** pick a role, level and language, optionally paste a real job post. Live transcript, 10-minute timer, mute, and an avatar whose mouth follows the voice in any language.
- **Report:** a score out of 100, a score and feedback for each answer, a stronger example answer in the interview language, filler words, speaking speed, strengths and next steps.
- **Progress:** history with a chart (score, filler words, speaking speed), a GitHub-style practice graph, streaks and a dashboard.
- **Coding round:** AI-written problems with hidden tests, up to 3 hints, a review with complexity analysis and notes on your lines.
- **Try it with no account:** a 3-minute demo with a full report. Sign up afterwards and it is added to your account.

## How it works

```
Browser (React)                                      Gemini
  |  1. POST /api/interviews/:id/live-token             |
  |---------------------------> Express API             |
  |                              - writes the interviewer's instructions
  |                              - reserves voice time (budget check)
  |                              - creates a single-use token  ---->|
  |  <-- short-lived token (your real key stays on the server)      |
  |                                                                 |
  |  2. WebSocket, audio both ways, straight to Gemini Live API ===>|
  |     mic -> 16 kHz PCM  ...  24 kHz PCM voice <- played as it arrives
  |                                                                 |
  |  3. PUT transcript, POST finish   -> Express -> MongoDB         |
  |  4. POST report -> Express -> Gemini (text) -> scores as JSON   |
```

## Tech stack

| Part | Tools |
| --- | --- |
| Frontend | React, Vite, TypeScript, React Router, CodeMirror 6 |
| Voice AI | Gemini Live API |
| Scoring and coding AI | Gemini text model with JSON schemas |
| Backend | Node.js, Express, Zod |
| Database | MongoDB (Mongoose) |
| Auth | Email and password, bcrypt, JWT in an httpOnly cookie |
| Quality | Node's built-in test runner, GitHub Actions |

## Run it locally

You need Node.js 20.6 or newer, a MongoDB database ([Atlas](https://www.mongodb.com/atlas) free tier works) and a Gemini API key from [Google AI Studio](https://aistudio.google.com). Live voice costs money per minute, so set a spending limit on the key.

```bash
git clone https://github.com/GOURAVPY/AI-Interview-Coach.git
cd AI-Interview-Coach
```

**Backend**

```bash
cd backend
npm install
cp .env.example .env     # fill in MONGODB_URI, JWT_SECRET and GEMINI_API_KEY
npm run dev              # http://localhost:4000
```

**Frontend** (second terminal)

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

Open http://localhost:5173. The frontend proxies `/api` to the backend, so cookies work with no extra setup. Use headphones for the voice interview so the interviewer does not hear itself.

All settings are explained in [`backend/.env.example`](backend/.env.example). The ones that protect your bill are `USER_DAILY_VOICE_MINUTES`, `GLOBAL_MONTHLY_VOICE_MINUTES` and the demo limits. If you run behind a reverse proxy, set `TRUST_PROXY=1`.

## Tests

```bash
cd backend && npm test
```

27 tests cover the filler-word and speaking-speed counting (English, Japanese, German), the sandbox against infinite loops and memory bombs, the prompts, the budget periods, and a guard that fails if the backend and frontend role, level and language lists drift apart. GitHub Actions runs them, plus a frontend type check and build, on every push.

## Project structure

```
backend/src
  config/ controllers/ middleware/ models/ prompts/ routes/ services/
frontend/src
  components/ hooks/ pages/ utils/ styles/
docs/    write-up and screenshots
```

## Status and limitations

Working: login, demo, dashboard, voice interview, report, history, profile, coding round.

- Voice has been tested end to end in a desktop browser. Different microphones, echo and phone browsers still need real testing.
- Filler-word detection was checked against real transcripts only for English and Japanese.
- The AI's feedback and code reviews can be imperfect. Treat them as a mentor's opinion.
- Coding rounds are JavaScript only and are not in History yet.
- There are no integration tests against a real database yet.

## Roadmap, and ideas for contributors

Contributions are welcome. Open an issue first if you want to take something bigger.

- [ ] Interview styles by country (US startup, UK, German, Japanese)
- [ ] Eye-contact tips from the webcam, processed only in the browser
- [ ] A shareable result card
- [ ] A 3D avatar with lip sync (TalkingHead)
- [ ] Show coding rounds in History and the practice graph
- [ ] Integration tests for the voice-time budget using an in-memory MongoDB
- [ ] A small set of human-scored transcripts to measure how consistent the scoring is
- [ ] Python and TypeScript in the coding round

## License

Released under the [MIT License](LICENSE).
