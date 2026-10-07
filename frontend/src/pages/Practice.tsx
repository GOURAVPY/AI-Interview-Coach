import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import ChipGroup from '../components/ChipGroup';
import { api } from '../services/api';
import type { InterviewDetail, UsageInfo } from '../types/interview';
import { JOB_POST_MAX, LANGUAGES, LEVELS, ROLES } from '../utils/options';
import '../styles/practice.css';

export default function Practice() {
  const navigate = useNavigate();
  const [role, setRole] = useState<(typeof ROLES)[number]>('Frontend');
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('Junior');
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>('English');
  const [jobPost, setJobPost] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  useEffect(() => {
    api<UsageInfo>('/usage')
      .then(setUsage)
      .catch(() => setUsage(null)); // the server enforces the limit anyway
  }, []);

  const minutesLeft = usage ? Math.floor(usage.dailyRemainingSec / 60) : null;
  const blocked = usage !== null && (!usage.serviceAvailable || usage.dailyRemainingSec < 60);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api<{ interview: InterviewDetail }>('/interviews', {
        method: 'POST',
        body: { role, level, language, jobPost },
      });
      navigate(`/interview/${res.interview.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the interview');
      setBusy(false);
    }
  }

  return (
    <main className="practice">
      <header>
        <span className="cap">Practice</span>
        <h1>Set up your interview.</h1>
        <p>A 10-minute voice interview. The questions follow the role and level you pick.</p>
      </header>

      {usage && (
        <p className={blocked ? 'quota blocked' : 'quota'} role="status">
          {!usage.serviceAvailable
            ? 'Voice interviews are paused for this month because the free limit has been reached.'
            : usage.dailyRemainingSec < 60
              ? "You've used today's free voice time. It resets at midnight UTC."
              : `Free voice time left today: ${minutesLeft} of ${Math.round(usage.dailyLimitSec / 60)} minutes.`}
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

        <label className="group">
          <span className="cap">Job post (optional)</span>
          <textarea
            value={jobPost}
            onChange={(e) => setJobPost(e.target.value)}
            maxLength={JOB_POST_MAX}
            rows={6}
            placeholder="Paste a real job description and the interviewer will ask about it."
          />
          <small>
            {jobPost.length} / {JOB_POST_MAX}
          </small>
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button className="btn" type="submit" disabled={busy || blocked}>
          {busy ? 'Starting…' : 'Start interview'}
        </button>
      </form>
    </main>
  );
}
