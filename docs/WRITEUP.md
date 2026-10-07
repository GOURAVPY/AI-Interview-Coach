# How I kept the conversation fast, the scores fair and the bill small

Notes on the hard parts of building AI Interview Coach: a live voice interviewer, a scored report, and a coding round.

## 1. Keeping the voice conversation fast

A voice conversation feels broken if there is a pause before every reply. Three decisions kept it fast.

**The audio never goes through my server.** The server's only job is to write the interviewer's instructions and mint a short-lived, single-use token for the Gemini Live API ([`gemini.js`](../backend/src/services/gemini.js)). The browser then opens a WebSocket straight to Gemini. My real API key never reaches the browser, and there is no extra network hop in the audio path.

**Audio streams both ways in small pieces.**
- Going out, an `AudioWorklet` ([`pcm-capture-worklet.js`](../frontend/public/pcm-capture-worklet.js)) packs the microphone into 16-bit, 16 kHz chunks of 40 ms and sends each one as soon as it is full.
- Coming in, each chunk of the interviewer's 24 kHz voice is scheduled to start exactly when the previous one ends ([`audio.ts`](../frontend/src/utils/audio.ts)). Playback begins with the first chunk, not after the whole answer is ready.

**Interrupting is instant.** When Gemini reports the candidate started talking, every queued audio buffer is stopped and the schedule is cleared in the same tick. The interviewer cuts off like a person would.

Small things that mattered:
- The avatar's mouth follows the loudness of the audio it is playing, read through an `AnalyserNode` and written straight to the SVG every animation frame, without re-rendering React. Because it uses loudness, not phonemes, lip movement works for Japanese, German or any other language.
- The microphone permission is requested before the token, so a denied permission never costs any budget.

## 2. Keeping the scores fair

LLM scoring can easily be vague and inconsistent. What I did about it:

**The AI judges only what needs judgement.** It scores answer quality. Everything countable is plain code: filler words and speaking speed ([`metrics.js`](../backend/src/services/metrics.js)) and the overall score, which is the average of the answer scores. Counting is exact and repeatable. Asking a model to count would be neither.

**A written rubric with anchored levels** ([`scoring.js`](../backend/src/prompts/scoring.js)). Four criteria (relevance, depth, structure, correctness), and a 1 to 10 scale where each band is described, judged against the level the candidate picked. The prompt says not to inflate and that 10 is almost never deserved.

**Structured output.** The model must return JSON matching a schema, which is then validated with Zod. One retry on a bad response, and an interview with no real answers is rejected with a clear message instead of getting a made-up score.

**Transcripts are data, not instructions.** The transcript and the pasted job post are fenced with markers and the prompt says to ignore any instructions inside them.

**Speaking speed uses the microphone, not the transcript.** My first version divided word count by the time between transcript chunks. That understates speaking time and inflates words per minute. The browser now measures how long the microphone actually heard the candidate while the interviewer was silent, and the server uses that.

What I measured, honestly: scoring the same transcript twice gave identical scores, and a deliberately weak interview scored 20 against 80 for a strong one. That is a sanity check on a handful of transcripts, not a benchmark. There is no ground-truth dataset behind these scores.

## 3. Keeping the bill small

Live voice is billed by the minute, so the app has to protect its owner ([`usage.js`](../backend/src/services/usage.js)).

- **Reserve, then settle.** Before a session starts, the server reserves voice time against several counters at once: the user's daily budget, or for demo visitors a per-visitor and a per-network budget, and always a global monthly one. The token expires when the reserved time runs out.
- **Atomic.** Each counter is incremented with a single conditional MongoDB update, so two requests at the same moment cannot overspend. If any counter refuses, the ones already charged are rolled back.
- **The server's clock decides.** When an interview ends, the unused part is refunded using the time since the token was issued, so a tampered browser cannot claim a short session. If someone just closes the tab, the full reservation stays charged. The cap can only ever over-count, never under-count.

## 4. The coding round: letting an AI and a user share an editor

- **Problems are verified before you see them.** The AI writes a problem plus its own reference solution. The server runs that solution against every test in a separate thread with time and memory limits ([`sandbox.js`](../backend/src/services/sandbox.js)). A problem whose own answer fails is discarded and regenerated. Without this, some Senior problems were simply wrong.
- **Your code never runs on the server.** It runs in a throwaway Web Worker in your browser with a 3 second limit ([`runner.ts`](../frontend/src/utils/runner.ts)), so an infinite loop cannot freeze the page.
- **One small handle for the AI.** Everything the AI can do to the editor goes through a handful of calls: `setCode`, `annotate`, `revealLine` ([`CodeEditor.tsx`](../frontend/src/components/CodeEditor.tsx)). AI changes are tagged, shown in an activity log, and go into the undo history, so Ctrl+Z always hands control back to the user.

## 5. What I would do differently

- **Test on real devices earlier.** Voice has been tested end to end in a desktop browser. Echo, different microphones and phone browsers still need real testing.
- **Build an evaluation set for the scoring.** A few dozen human-scored transcripts would turn "seems consistent" into a number.
- **Add integration tests with a real database.** The tests today cover the pure logic and the sandbox. The budget logic against MongoDB was tested by hand.
- **Verify filler-word lists with native speakers.** Only English and Japanese were checked against real transcripts.
