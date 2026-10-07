import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import type { InterviewDetail, Report as ReportData } from '../types/interview';
import '../styles/report.css';

function verdict(score: number) {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Strong';
  if (score >= 50) return 'Getting there';
  return 'Needs work';
}

function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={`Overall score ${score} out of 100`}>
      <svg viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} className="track" />
        <circle
          cx="64"
          cy="64"
          r={r}
          className="fill"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
        />
      </svg>
      <div className="ring-text">
        <b>{score}</b>
        <span className="cap">out of 100</span>
      </div>
    </div>
  );
}

function formatSeconds(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

export default function Report() {
  const { id = '' } = useParams();
  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const first = await api<{ interview: InterviewDetail }>(`/interviews/${id}`);
        if (cancelled) return;
        setInterview(first.interview);

        if (first.interview.status === 'completed' && !first.interview.report) {
          setWorking(true);
          const made = await api<{ interview: InterviewDetail }>(`/interviews/${id}/report`, { method: 'POST' });
          if (!cancelled) setInterview(made.interview);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load the report');
      } finally {
        if (!cancelled) setWorking(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <main className="report">
        <span className="cap">Report</span>
        <h1>We could not build this report.</h1>
        <p className="error" role="alert">
          {error}
        </p>
        <Link to="/dashboard" className="btn outline back">
          Back to dashboard
        </Link>
      </main>
    );
  }

  if (!interview) return null;

  if (interview.status !== 'completed') {
    return (
      <main className="report">
        <span className="cap">Report</span>
        <h1>This interview is not finished yet.</h1>
        <Link to={`/interview/${interview.id}`} className="btn back">
          Go to the interview room
        </Link>
      </main>
    );
  }

  if (working || !interview.report) {
    return (
      <main className="report">
        <span className="cap">Report</span>
        <h1>Scoring your interview…</h1>
        <p className="muted">Reading every answer against the scoring guide. This can take up to 20 seconds.</p>
      </main>
    );
  }

  const report: ReportData = interview.report;
  const m = report.metrics;
  const maxFiller = Math.max(1, ...m.fillers.map((f) => f.count));

  return (
    <main className="report">
      <header className="report-head">
        <div>
          <span className="cap">
            {interview.level} {interview.role} · {interview.language} · {formatSeconds(interview.durationSec)}
          </span>
          <h1>Your interview report.</h1>
        </div>
        <Link to="/practice" className="btn">
          Practise again
        </Link>
      </header>

      <section className="card overview">
        <ScoreRing score={report.overallScore} />
        <div className="overview-text">
          <span className="cap">{verdict(report.overallScore)}</span>
          <p>{report.summary}</p>
        </div>
      </section>

      <section className="metrics" aria-label="Speaking metrics">
        <div className="card metric">
          <span className="cap">Speaking speed</span>
          <b>{m.pace ?? '–'}</b>
          <small>{m.pace ? m.paceUnit : 'Not enough speech to measure'}</small>
        </div>
        <div className="card metric">
          <span className="cap">Time speaking</span>
          <b>{m.speakingSec ? formatSeconds(m.speakingSec) : '–'}</b>
          <small>measured from your microphone</small>
        </div>
        <div className="card metric">
          <span className="cap">Filler words</span>
          <b>{m.totalFillers}</b>
          <small>{m.totalFillers === 0 ? 'None detected. Nice.' : 'counted across your answers'}</small>
        </div>
      </section>

      {m.fillers.length > 0 && (
        <section className="card fillers">
          <span className="cap">Filler words by type</span>
          <ul>
            {m.fillers.map((f) => (
              <li key={f.label}>
                <span>{f.label}</span>
                <i style={{ width: `${(f.count / maxFiller) * 100}%` }} />
                <b>{f.count}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="two-col">
        <div className="card">
          <span className="cap">What went well</span>
          <ul className="bullets">
            {report.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="card">
          <span className="cap">Work on next</span>
          <ul className="bullets">
            {report.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="answers" aria-label="Answer by answer">
        <h2>Answer by answer</h2>
        {report.answers.map((a, i) => (
          <details key={i} className="card answer" open={i === 0}>
            <summary>
              <span className="q">
                <span className="cap">Question {i + 1}</span>
                {a.question}
              </span>
              <span className={`pill s${a.score >= 8 ? 'hi' : a.score >= 5 ? 'mid' : 'lo'}`}>{a.score}/10</span>
            </summary>
            <div className="answer-body">
              <div>
                <span className="cap">Your answer</span>
                <p className="quote">{a.answerExcerpt}</p>
              </div>
              <div>
                <span className="cap">Feedback</span>
                <p>{a.feedback}</p>
              </div>
              <div className="better">
                <span className="cap">A stronger answer</span>
                <p>{a.betterAnswer}</p>
              </div>
            </div>
          </details>
        ))}
      </section>
    </main>
  );
}
