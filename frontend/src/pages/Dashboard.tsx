import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { DashboardSummary } from '../types/interview';
import '../styles/dashboard.css';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<DashboardSummary>(`/interviews/summary?tz=${new Date().getTimezoneOffset()}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your dashboard'));
  }, []);

  const stats = data?.stats;
  const tiles = [
    { label: 'Interviews', value: stats ? String(stats.interviews) : '–' },
    { label: 'Average score', value: stats?.averageScore != null ? `${stats.averageScore}` : '–' },
    { label: 'Minutes practised', value: stats ? String(stats.practiceMinutes) : '–' },
    { label: 'Day streak', value: stats ? String(stats.streakDays) : '–' },
  ];

  return (
    <main className="dash">
      <header className="dash-head">
        <div>
          <span className="cap">Dashboard</span>
          <h1>
            {greeting()}, {user?.name.split(' ')[0]}.
          </h1>
        </div>
        <button className="btn outline" onClick={logout}>
          Sign out
        </button>
      </header>

      <section className="hero-card card">
        <div>
          <span className="cap">Ready when you are</span>
          <h2>Practise your next interview out loud.</h2>
          <p>Pick a role, a level and a language. The interviewer asks, you answer by voice.</p>
        </div>
        <Link to="/practice" className="btn start">
          Start an interview
        </Link>
      </section>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="tiles" aria-label="Your stats">
        {tiles.map((tile) => (
          <div key={tile.label} className="card tile-stat">
            <span className="cap">{tile.label}</span>
            <b>{tile.value}</b>
          </div>
        ))}
      </section>

      <section className="card recent">
        <div className="recent-head">
          <h2>Recent interviews</h2>
          <Link to="/history" className="cap">
            View all
          </Link>
        </div>

        {data && data.recent.length === 0 && (
          <p className="empty">No interviews yet. Your first one will show up here with its score.</p>
        )}

        <ul>
          {data?.recent.map((item) => (
            <li key={item.id}>
              <Link to={item.status === 'completed' ? `/report/${item.id}` : `/interview/${item.id}`} className="row">
              <div>
                <b>{item.role}</b>
                <span className="cap">
                  {item.level} · {item.language} · {formatDate(item.createdAt)}
                </span>
              </div>
              <span className="score">{item.status === 'completed' && item.overallScore != null ? item.overallScore : '…'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
