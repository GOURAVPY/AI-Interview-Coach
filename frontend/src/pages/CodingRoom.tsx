import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CodeEditor, { type EditSource, type EditorHandle } from '../components/CodeEditor';
import { api } from '../services/api';
import type { Annotation, CodingSession } from '../types/coding';
import { runTests, type RunOutcome } from '../utils/runner';
import '../styles/coding.css';

const MAX_HINTS = 3;

interface LogEntry {
  actor: 'ai' | 'you';
  text: string;
}

const show = (v: unknown) => {
  const text = JSON.stringify(v);
  return text === undefined ? 'undefined' : text.length > 160 ? `${text.slice(0, 160)}…` : text;
};

export default function CodingRoom() {
  const { id = '' } = useParams();
  const [session, setSession] = useState<CodingSession | null>(null);
  const [loadError, setLoadError] = useState('');
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [aiBusy, setAiBusy] = useState<'hint' | 'review' | null>(null);
  const [error, setError] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [flash, setFlash] = useState(false);

  const editor = useRef<EditorHandle>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const statusRef = useRef<CodingSession['status']>('in_progress');

  const note = useCallback((actor: LogEntry['actor'], text: string) => setLog((l) => [{ actor, text }, ...l].slice(0, 30)), []);

  const aiTouched = useCallback(() => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1400);
  }, []);

  useEffect(() => {
    api<{ session: CodingSession }>(`/coding/sessions/${id}`)
      .then((res) => {
        setSession(res.session);
        statusRef.current = res.session.status;
        note('ai', res.session.status === 'submitted' ? 'Review loaded.' : 'Loaded the starter code into the editor.');
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load this round'));
    return () => window.clearTimeout(saveTimer.current);
  }, [id, note]);

  // Once the editor exists, mark any earlier hints or review notes on its lines.
  const editorReady = session !== null;
  useEffect(() => {
    if (!session) return;
    const s = session;
    const notes: Annotation[] = s.review
      ? s.review.annotations
      : s.hints.filter((h) => h.line > 0).map((h) => ({ line: h.line, message: h.text, severity: 'hint' as const }));
    editor.current?.annotate(notes);
    // only when the editor first appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorReady]);

  const onEdit = useCallback(
    (code: string, source: EditSource) => {
      if (source === 'ai') aiTouched();
      if (statusRef.current !== 'in_progress') return;
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        api(`/coding/sessions/${id}/code`, { method: 'PUT', body: { code } }).catch(() => undefined);
      }, 1500);
    },
    [aiTouched, id],
  );

  const run = useCallback(async (): Promise<RunOutcome | null> => {
    if (!session) return null;
    setRunning(true);
    setError('');
    const result = await runTests(editor.current?.getCode() ?? '', session.problem.tests);
    setOutcome(result);
    setRunning(false);
    if (result.fatal) note('you', `Ran the tests, but the code did not load: ${result.fatal}`);
    else note('you', `Ran the tests: ${result.results.filter((r) => r.passed).length} of ${session.problem.tests.length} passed.`);
    return result;
  }, [note, session]);

  async function askHint() {
    if (!session) return;
    setAiBusy('hint');
    setError('');
    try {
      const res = await api<{ hint: { text: string; line: number }; hints: CodingSession['hints'] }>(`/coding/sessions/${id}/hint`, {
        method: 'POST',
        body: { code: editor.current?.getCode() ?? '' },
      });
      setSession({ ...session, hints: res.hints });
      const notes: Annotation[] = res.hints.filter((h) => h.line > 0).map((h) => ({ line: h.line, message: h.text, severity: 'hint' }));
      editor.current?.annotate(notes);
      if (res.hint.line > 0) {
        editor.current?.revealLine(res.hint.line);
        note('ai', `Gave hint ${res.hints.length} and marked line ${res.hint.line}.`);
      } else {
        note('ai', `Gave hint ${res.hints.length}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get a hint');
    } finally {
      setAiBusy(null);
    }
  }

  async function submit() {
    if (!session) return;
    const result = await run();
    if (!result) return;
    if (result.fatal) {
      setError(`Fix this first: ${result.fatal}`);
      return;
    }

    const tests = session.problem.tests;
    const failures = result.results
      .filter((r) => !r.passed)
      .slice(0, 5)
      .map((r) => {
        const t = tests[r.index];
        if (t.hidden) return `Hidden test ${r.index + 1} failed${r.error ? `: ${r.error}` : ''}`;
        return `Test ${r.index + 1}: solve(${t.args.map(show).join(', ')}) expected ${show(t.expected)} but ${r.error ? `threw ${r.error}` : `got ${show(r.actual)}`}`;
      });

    setAiBusy('review');
    try {
      const res = await api<{ session: CodingSession }>(`/coding/sessions/${id}/submit`, {
        method: 'POST',
        body: { code: editor.current?.getCode() ?? '', passed: result.results.filter((r) => r.passed).length, total: tests.length, failures },
      });
      statusRef.current = 'submitted';
      setSession(res.session);
      editor.current?.annotate(res.session.review?.annotations ?? []);
      note('ai', `Reviewed your code and marked ${res.session.review?.annotations.length ?? 0} lines.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit');
    } finally {
      setAiBusy(null);
    }
  }

  function loadIdeal() {
    if (!session?.review) return;
    editor.current?.setCode(session.review.idealSolution);
    editor.current?.clearAnnotations();
    note('ai', 'Replaced the editor with the ideal solution. Press Ctrl+Z to get your code back.');
  }

  function resetStarter() {
    if (!session) return;
    editor.current?.setCode(session.problem.starterCode, 'user');
    editor.current?.clearAnnotations();
    note('you', 'Reset the editor to the starter code.');
  }

  if (loadError) {
    return (
      <main className="room-center">
        <p className="error">{loadError}</p>
        <Link to="/coding" className="btn outline">
          Back to coding rounds
        </Link>
      </main>
    );
  }
  if (!session) return null;

  const { problem, review } = session;
  const submitted = session.status === 'submitted';
  const hintsLeft = MAX_HINTS - session.hints.length;
  const passedNow = outcome ? outcome.results.filter((r) => r.passed).length : null;

  return (
    <main className="coding">
      <header className="coding-top">
        <div>
          <Link to="/coding" className="cap back-link">
            ← Coding rounds
          </Link>
          <h1>{problem.title}</h1>
        </div>
        <span className="cap">
          {session.level} {session.role}
        </span>
      </header>

      <div className="coding-grid">
        <aside className="side">
          <section className="card problem">
            <div className="chips-row">
              {problem.topics.map((t) => (
                <span key={t} className="topic">
                  {t}
                </span>
              ))}
            </div>
            <p className="statement">{problem.statement}</p>
            <h2>Examples</h2>
            <ul className="examples">
              {problem.examples.map((ex, i) => (
                <li key={i}>
                  <code>Input: {ex.input}</code>
                  <code>Output: {ex.output}</code>
                  <span>{ex.explanation}</span>
                </li>
              ))}
            </ul>
          </section>

          {review && (
            <section className="card review">
              <div className="review-head">
                <span className="cap">AI review</span>
                <b className="review-score">{review.score}/10</b>
              </div>
              <p>{review.summary}</p>
              <p className="complexity">
                <span className="cap">Time</span> {review.timeComplexity} · <span className="cap">Space</span> {review.spaceComplexity}
              </p>
              <h3>Went well</h3>
              <ul>
                {review.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <h3>Improve</h3>
              <ul>
                {review.improvements.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <button className="btn outline" onClick={loadIdeal}>
                Show the ideal solution in the editor
              </button>
            </section>
          )}

          <section className="card mentor">
            <div className="mentor-head">
              <h2>AI mentor</h2>
              {!submitted && (
                <button className="btn outline small" onClick={askHint} disabled={aiBusy !== null || hintsLeft === 0}>
                  {aiBusy === 'hint' ? 'Thinking…' : hintsLeft === 0 ? 'No hints left' : `Hint (${hintsLeft} left)`}
                </button>
              )}
            </div>
            {session.hints.length === 0 && <p className="muted">Stuck? Ask for a hint. It nudges you, it never writes the solution.</p>}
            <ol className="hints">
              {session.hints.map((h, i) => (
                <li key={i}>
                  <span className="cap">
                    Hint {i + 1}
                    {h.line > 0 ? ` · line ${h.line}` : ''}
                  </span>
                  <p>{h.text}</p>
                </li>
              ))}
            </ol>

            <h3>Activity</h3>
            <ul className="activity-log" aria-live="polite">
              {log.map((entry, i) => (
                <li key={i} className={entry.actor}>
                  <b className="cap">{entry.actor === 'ai' ? 'AI' : 'You'}</b>
                  {entry.text}
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <section className="work">
          <div className="card editor-card">
            <div className="toolbar">
              <span className="cap">{flash ? 'The AI changed the editor. Ctrl+Z undoes it.' : 'JavaScript · write solve()'}</span>
              <div className="toolbar-actions">
                <button className="btn outline small" onClick={resetStarter} disabled={submitted && !review}>
                  Reset
                </button>
                <button className="btn outline small" onClick={() => void run()} disabled={running || aiBusy !== null}>
                  {running ? 'Running…' : 'Run tests'}
                </button>
                {!submitted && (
                  <button className="btn small" onClick={submit} disabled={running || aiBusy !== null}>
                    {aiBusy === 'review' ? 'AI is reviewing…' : 'Submit'}
                  </button>
                )}
              </div>
            </div>
            <div className={flash ? 'editor-frame ai-flash' : 'editor-frame'}>
              <CodeEditor ref={editor} initialCode={session.code} onChange={onEdit} onRun={() => void run()} label="Code editor" />
            </div>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div className="card results" aria-live="polite">
            <div className="results-head">
              <h2>Test results</h2>
              <span className="cap">
                {submitted
                  ? `Submitted · ${session.passed}/${session.total} passed`
                  : outcome && !outcome.fatal
                    ? `${passedNow} of ${problem.tests.length} passed`
                    : 'Run the tests to see results (Ctrl+Enter)'}
              </span>
            </div>

            {outcome?.fatal && <p className="error">{outcome.fatal}</p>}
            {outcome?.timedOut && <p className="error">Some tests timed out. Check for an infinite loop.</p>}

            <ul className="test-list">
              {outcome &&
                !outcome.fatal &&
                outcome.results.map((r) => {
                  const t = problem.tests[r.index];
                  return (
                    <li key={r.index} className={r.passed ? 'pass' : 'fail'}>
                      <div className="test-line">
                        <span className="mark" aria-hidden="true">
                          {r.passed ? '✓' : '✗'}
                        </span>
                        <b>{t.hidden ? `Hidden test ${r.index + 1}` : `Test ${r.index + 1}`}</b>
                        <span className="cap">{r.passed ? 'passed' : 'failed'}</span>
                      </div>
                      {!r.passed && !t.hidden && (
                        <div className="test-detail">
                          <code>solve({t.args.map(show).join(', ')})</code>
                          <code>expected {show(t.expected)}</code>
                          <code>{r.error ? `error: ${r.error}` : `got ${show(r.actual)}`}</code>
                        </div>
                      )}
                      {!r.passed && t.hidden && r.error && (
                        <div className="test-detail">
                          <code>error: {r.error}</code>
                        </div>
                      )}
                      {r.logs.length > 0 && (
                        <div className="test-detail logs">
                          {r.logs.map((l, i) => (
                            <code key={i}>console: {l}</code>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
