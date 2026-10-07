import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ChipGroup from '../components/ChipGroup';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { CodingListItem, CodingSession } from '../types/coding';
import { LEVELS, ROLES } from '../utils/options';
import '../styles/practice.css';
import '../styles/coding.css';

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function Coding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const startRole = ROLES.find((r) => r === user?.targetRole) ?? 'Frontend';
  const [role, setRole] = useState<(typeof ROLES)[number]>(startRole);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('Junior');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [past, setPast] = useState<CodingListItem[] | null>(null);

  useEffect(() => {
    api<{ sessions: CodingListItem[] }>('/coding/sessions')
      .then((res) => setPast(res.sessions))
      .catch(() => setPast([]));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api<{ session: CodingSession }>('/coding/sessions', { method: 'POST', body: { role, level } });
      navigate(`/coding/${res.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the coding round');
      setBusy(false);
    }
  }

  return (
    <main className="practice">
      <header>
        <span className="cap">Coding round</span>
        <h1>Solve a problem with an AI mentor.</h1>
        <p>The AI writes a fresh problem for your role. You write the logic, run the tests and ask for hints only if you need them.</p>
      </header>

      <form className="card setup" onSubmit={onSubmit}>
        <ChipGroup label="Role" options={ROLES} value={role} onChange={setRole} />
        <ChipGroup label="Level" options={LEVELS} value={level} onChange={setLevel} />

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'The AI is writing your problem…' : 'Give me a problem'}
        </button>
        {busy && <p className="quota">This takes 10 to 30 seconds. The AI also checks that its own answer passes the tests.</p>}
      </form>

      {past && past.length > 0 && (
        <section className="card past">
          <h2>Your coding rounds</h2>
          <ul>
            {past.map((s) => (
              <li key={s.id}>
                <Link to={`/coding/${s.id}`} className="row">
                  <div>
                    <b>{s.title}</b>
                    <span className="cap">
                      {s.level} {s.role} · {shortDate(s.createdAt)} · {s.status === 'submitted' ? `${s.passed}/${s.total} tests` : 'Unfinished'}
                    </span>
                  </div>
                  <span className="score">{s.score ?? '–'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
