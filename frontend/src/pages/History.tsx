import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LineChart, { type ChartPoint } from '../components/LineChart';
import { api } from '../services/api';
import type { HistoryItem } from '../types/interview';
import '../styles/history.css';

type Metric = 'score' | 'fillers' | 'pace';
type Filter = 'all' | 'completed' | 'unfinished';

const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: 'score', label: 'Score', unit: 'points' },
  { key: 'fillers', label: 'Filler words', unit: 'filler words' },
  { key: 'pace', label: 'Speaking speed', unit: 'per minute' },
];

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'unfinished', label: 'Unfinished' },
];

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function minutes(sec: number) {
  return sec < 60 ? `${sec}s` : `${Math.round(sec / 60)} min`;
}

export default function History() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState<Metric>('score');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    api<{ interviews: HistoryItem[] }>('/interviews')
      .then((res) => setItems(res.interviews))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your history'));
  }, []);

  // Oldest first, only interviews that have a report.
  const scored = useMemo(
    () => (items ?? []).filter((i) => i.status === 'completed' && i.overallScore != null).reverse(),
    [items],
  );

  const points: ChartPoint[] = useMemo(() => {
    return scored
      .map((i) => {
        const value = metric === 'score' ? i.overallScore : metric === 'fillers' ? i.totalFillers : i.pace;
        return value == null ? null : { label: shortDate(i.createdAt), value };
      })
      .filter((p): p is ChartPoint => p !== null);
  }, [scored, metric]);

  const best = scored.length ? Math.max(...scored.map((i) => i.overallScore ?? 0)) : null;
  const change =
    scored.length >= 2 ? (scored[scored.length - 1].overallScore ?? 0) - (scored[0].overallScore ?? 0) : null;

  const visible = (items ?? []).filter((i) =>
    filter === 'all' ? true : filter === 'completed' ? i.status === 'completed' : i.status !== 'completed',
  );

  const activeMetric = METRICS.find((m) => m.key === metric)!;

  return (
    <main className="history">
      <header>
        <span className="cap">History</span>
        <h1>Your progress.</h1>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {items && (
        <>
          <section className="card progress">
            <div className="progress-head">
              <div className="stat-row">
                <div>
                  <span className="cap">Scored interviews</span>
                  <b>{scored.length}</b>
                </div>
                <div>
                  <span className="cap">Best score</span>
                  <b>{best ?? '–'}</b>
                </div>
                <div>
                  <span className="cap">Since your first</span>
                  <b className={change != null && change > 0 ? 'up' : change != null && change < 0 ? 'down' : ''}>
                    {change == null ? '–' : `${change > 0 ? '+' : ''}${change}`}
                  </b>
                </div>
              </div>

              <div className="tabs" role="tablist" aria-label="Chart metric">
                {METRICS.map((m) => (
                  <button
                    key={m.key}
                    role="tab"
                    aria-selected={metric === m.key}
                    className={metric === m.key ? 'tab on' : 'tab'}
                    onClick={() => setMetric(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {points.length === 0 ? (
              <p className="empty">Finish an interview and get its report to see your progress here.</p>
            ) : (
              <LineChart points={points} unit={activeMetric.unit} max={metric === 'score' ? 100 : undefined} />
            )}
            {metric === 'fillers' && points.length > 0 && <p className="hint">Lower is better.</p>}
          </section>

          <section className="card list">
            <div className="list-head">
              <h2>All interviews</h2>
              <div className="chips" role="radiogroup" aria-label="Filter interviews">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    role="radio"
                    aria-checked={filter === f.key}
                    className={filter === f.key ? 'chip on' : 'chip'}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {visible.length === 0 && (
              <p className="empty">
                {items.length === 0 ? (
                  <>
                    No interviews yet. <Link to="/practice">Start your first one.</Link>
                  </>
                ) : (
                  'Nothing matches this filter.'
                )}
              </p>
            )}

            <ul>
              {visible.map((i) => (
                <li key={i.id}>
                  <Link to={i.status === 'completed' ? `/report/${i.id}` : `/interview/${i.id}`} className="row">
                    <div>
                      <b>
                        {i.level} {i.role}
                      </b>
                      <span className="cap">
                        {i.language} · {shortDate(i.createdAt)} · {i.status === 'completed' ? minutes(i.durationSec) : 'Unfinished'}
                      </span>
                    </div>
                    <span className="score">{i.status === 'completed' && i.overallScore != null ? i.overallScore : '–'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
