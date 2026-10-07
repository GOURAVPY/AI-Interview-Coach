import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { InterviewDetail } from '../types/interview';
import { JOB_POST_MAX, LANGUAGES, LEVELS, ROLES } from '../utils/options';
import '../styles/practice.css';

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <fieldset className="group">
      <legend className="cap">{label}</legend>
      <div className="chips" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === value}
            className={option === value ? 'chip on' : 'chip'}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function Practice() {
  const navigate = useNavigate();
  const [role, setRole] = useState<(typeof ROLES)[number]>('Frontend');
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('Junior');
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>('English');
  const [jobPost, setJobPost] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Starting…' : 'Start interview'}
        </button>
      </form>
    </main>
  );
}
