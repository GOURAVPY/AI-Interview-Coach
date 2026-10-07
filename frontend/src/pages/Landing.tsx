import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { DemoStatus } from '../types/interview';
import '../styles/landing.css';

const LANGUAGES = ['English', 'Deutsch', '日本語', 'Nederlands', 'Français', 'Español'];

const STEPS = [
  { n: '01', title: 'Pick a role', text: 'Choose the job, your level and the language of the interview. Paste a real job post if you have one.' },
  { n: '02', title: 'Talk it out loud', text: 'An AI interviewer asks questions by voice and follows up on what you say. Interrupt it any time, like in real life.' },
  { n: '03', title: 'Get your report', text: 'A score for each answer, a stronger example answer, your filler words and how fast you speak.' },
];

const FEATURES = [
  { title: 'Real voice conversation', text: 'Speak and listen in real time. No typing, no waiting for a whole answer.' },
  { title: 'Interview in the local language', text: 'Practise in German, Japanese, Dutch and more, with the formal style a real company would use.' },
  { title: 'Fair, consistent scores', text: 'Every answer is judged against the same written guide, so progress you see is progress you made.' },
  { title: 'See yourself improve', text: 'History, a progress chart and a practice graph show how far you have come.' },
];

// The animated mouth here is decoration: it just moves, it is not tied to any audio.
const demoLevel = () => 0.3 + 0.28 * Math.max(0, Math.sin(Date.now() / 140)) * (0.6 + 0.4 * Math.sin(Date.now() / 530));

export default function Landing() {
  const { user } = useAuth();
  const [demo, setDemo] = useState<DemoStatus | null>(null);

  useEffect(() => {
    api<DemoStatus>('/demo/status')
      .then(setDemo)
      .catch(() => setDemo(null));
  }, []);

  const minutes = demo ? Math.max(1, Math.round(demo.totalSec / 60)) : 3;
  const demoBlocked = demo !== null && !demo.available;

  return (
    <main className="landing">
      <section className="hero-land">
        <div className="hero-copy">
          <span className="cap">AI interview practice</span>
          <h1>
            Practise your interview for a job abroad with an AI that <em>talks back.</em>
          </h1>
          <p>
            Speak with a live interviewer in English or in the language of the country you want to work in. Get a scored
            report at the end.
          </p>

          <div className="hero-actions">
            {user ? (
              <Link to="/practice" className="btn big">
                Start an interview
              </Link>
            ) : demoBlocked ? (
              <Link to="/register" className="btn big">
                Create free account
              </Link>
            ) : (
              <Link to="/demo" className="btn big">
                Try a free {minutes}-minute demo
              </Link>
            )}
            {!user && (
              <Link to="/login" className="btn outline big">
                Log in
              </Link>
            )}
          </div>

          <p className="fine" role="status">
            {user
              ? 'Welcome back.'
              : demoBlocked
                ? demo?.message
                : `No sign-up needed for the demo. You get ${minutes} minutes of voice, then it ends.`}
          </p>
        </div>

        <div className="hero-art" aria-hidden="true">
          <Avatar getLevel={demoLevel} speaking listening={false} />
          <div className="bubble">Tell me about a project you are proud of.</div>
        </div>
      </section>

      <section className="langs" aria-label="Interview languages">
        <span className="cap">Interview in</span>
        <ul>
          {LANGUAGES.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <section className="block">
        <span className="cap">How it works</span>
        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.n} className="card">
              <span className="cap">{s.n}</span>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="block">
        <span className="cap">Why it helps</span>
        <ul className="features">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {!user && (
        <section className="block final">
          <h2>Ready for the real thing?</h2>
          <div className="hero-actions">
            {!demoBlocked && (
              <Link to="/demo" className="btn big">
                Try the demo
              </Link>
            )}
            <Link to="/register" className="btn outline big">
              Create free account
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
