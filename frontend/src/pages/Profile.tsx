import { useEffect, useState, type FormEvent } from 'react';
import ActivityGraph from '../components/ActivityGraph';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { ActivityData } from '../types/interview';
import { ROLES } from '../utils/options';
import '../styles/profile.css';

const COUNTRIES = [
  'Germany',
  'Netherlands',
  'Japan',
  'United Kingdom',
  'United States',
  'Canada',
  'Australia',
  'Ireland',
  'Switzerland',
  'Sweden',
  'France',
  'Spain',
  'Singapore',
  'United Arab Emirates',
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function Profile() {
  const { user, updateProfile, logout } = useAuth();
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [activityError, setActivityError] = useState('');

  const [name, setName] = useState(user?.name ?? '');
  const [targetRole, setTargetRole] = useState(user?.targetRole ?? '');
  const [targetCountry, setTargetCountry] = useState(user?.targetCountry ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api<ActivityData>(`/interviews/activity?tz=${new Date().getTimezoneOffset()}`)
      .then(setActivity)
      .catch((err) => setActivityError(err instanceof Error ? err.message : 'Could not load your activity'));
  }, []);

  if (!user) return null;

  const dirty = name !== user.name || targetRole !== user.targetRole || targetCountry !== user.targetCountry;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      await updateProfile({ name, targetRole, targetCountry });
      setMessage({ kind: 'ok', text: 'Profile saved.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save your profile' });
    } finally {
      setSaving(false);
    }
  }

  const goal =
    user.targetRole || user.targetCountry
      ? `${user.targetRole ? `${user.targetRole} developer` : 'Developer'}${user.targetCountry ? ` in ${user.targetCountry}` : ''}`
      : 'Set your goal below';

  const stats = [
    { label: 'Interviews', value: activity?.totalInterviews },
    { label: 'Active days', value: activity?.activeDays },
    { label: 'Current streak', value: activity?.currentStreak },
    { label: 'Longest streak', value: activity?.longestStreak },
  ];

  return (
    <main className="profile">
      <header className="who card">
        <div className="avatar-badge" aria-hidden="true">
          {initials(user.name)}
        </div>
        <div>
          <h1>{user.name}</h1>
          <span className="cap">{goal}</span>
          <p className="since">
            {user.email} · Member since {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </header>

      <section className="stats" aria-label="Practice stats">
        {stats.map((s) => (
          <div key={s.label} className="card stat">
            <span className="cap">{s.label}</span>
            <b>{s.value ?? '–'}</b>
          </div>
        ))}
      </section>

      <section className="card graph-card">
        <div className="graph-head">
          <h2>Practice activity</h2>
          <span className="cap">Last 12 months</span>
        </div>
        {activityError && (
          <p className="error" role="alert">
            {activityError}
          </p>
        )}
        {activity && <ActivityGraph days={activity.days} />}
        {activity && activity.totalInterviews === 0 && (
          <p className="muted">Every finished interview colours in a square. Your first one starts the graph.</p>
        )}
      </section>

      <form className="card edit" onSubmit={onSubmit}>
        <h2>Your goal</h2>

        <label className="field">
          <span className="cap">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </label>

        <label className="field">
          <span className="cap">Role you are aiming for</span>
          <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)}>
            <option value="">Not set</option>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="cap">Country you want to work in</span>
          <input
            value={targetCountry}
            onChange={(e) => setTargetCountry(e.target.value)}
            list="countries"
            maxLength={60}
            placeholder="Start typing, or enter your own"
          />
          <datalist id="countries">
            {COUNTRIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        {message && (
          <p className={message.kind === 'ok' ? 'ok' : 'error'} role={message.kind === 'ok' ? 'status' : 'alert'}>
            {message.text}
          </p>
        )}

        <div className="actions">
          <button className="btn" type="submit" disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button className="btn outline" type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </form>
    </main>
  );
}
