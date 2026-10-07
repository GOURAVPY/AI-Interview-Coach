import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ChipGroup from '../components/ChipGroup';
import { api } from '../services/api';
import type { DemoStatus, InterviewDetail } from '../types/interview';
import { LANGUAGES, LEVELS, ROLES } from '../utils/options';
import '../styles/practice.css';

// A short interview for visitors without an account. The server enforces the time limit.
export default function DemoSetup() {
  const navigate = useNavigate();
  const [role, setRole] = useState<(typeof ROLES)[number]>('Frontend');
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('Junior');
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>('English');
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<DemoStatus>('/demo/status')
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const blocked = status !== null && !status.available;
  const minutes = status ? Math.max(1, Math.round(status.remainingSec / 60)) : 3;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api<{ interview: InterviewDetail }>('/demo/interviews', {
        method: 'POST',
        body: { role, level, language },
      });
      navigate(`/demo/interview/${res.interview.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the demo');
      setBusy(false);
    }
  }

  return (
    <main className="practice">
      <header>
        <span className="cap">Free demo</span>
        <h1>Try a short interview.</h1>
        <p>No account needed. You get about {minutes} minute{minutes === 1 ? '' : 's'} of live voice, then the interview ends and you see your report.</p>
      </header>

      {blocked && status?.message && (
        <p className="quota blocked" role="status">
          {status.message}
        </p>
      )}

      <form className="card setup" onSubmit={onSubmit}>
        <ChipGroup label="Role" options={ROLES} value={role} onChange={setRole} />
        <ChipGroup label="Level" options={LEVELS} value={level} onChange={setLevel} />

        <label className="group">
          <span className="cap">Interview language</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value as (typeof LANGUAGES)[number])}>
            {LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button className="btn" type="submit" disabled={busy || blocked}>
          {busy ? 'Starting…' : 'Start the demo'}
        </button>

        {blocked && (
          <Link to="/register" className="btn outline demo-signup">
            Create a free account
          </Link>
        )}
      </form>
    </main>
  );
}
