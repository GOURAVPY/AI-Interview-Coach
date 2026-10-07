import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { useLiveInterview } from '../hooks/useLiveInterview';
import { api } from '../services/api';
import type { InterviewDetail } from '../types/interview';
import '../styles/room.css';

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function InterviewRoom() {
  const { id = '' } = useParams();
  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [loadError, setLoadError] = useState('');
  const live = useLiveInterview(id);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ interview: InterviewDetail }>(`/interviews/${id}`)
      .then((res) => setInterview(res.interview))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load this interview'));
  }, [id]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [live.turns]);

  if (loadError) {
    return (
      <main className="room-center">
        <p className="error">{loadError}</p>
        <Link to="/dashboard" className="btn outline">
          Back to dashboard
        </Link>
      </main>
    );
  }
  if (!interview) return null;

  if (interview.status === 'completed' && live.phase === 'idle') {
    return (
      <main className="room-center">
        <span className="cap">Interview finished</span>
        <h1>This interview is already complete.</h1>
        <Link to="/dashboard" className="btn">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const isLive = live.phase === 'live';
  const interviewerTalking = isLive && live.activeSpeaker === 'interviewer';
  const candidateTalking = isLive && live.activeSpeaker === 'candidate' && !live.muted;

  return (
    <main className="room">
      <header className="room-top">
        <div>
          <span className="cap">
            {interview.level} {interview.role} · {interview.language}
          </span>
        </div>
        <div className={`timer${live.secondsLeft !== null && live.secondsLeft <= 60 ? ' low' : ''}`} aria-label="Time left">
          {formatClock(live.secondsLeft ?? 600)}
        </div>
      </header>

      <section className="stage">
        <Avatar getLevel={live.getLevel} speaking={interviewerTalking} listening={isLive && !interviewerTalking} />

        <p className="status" role="status">
          {live.phase === 'idle' && 'Ready when you are.'}
          {live.phase === 'connecting' && 'Connecting to your interviewer…'}
          {isLive && (interviewerTalking ? 'Interviewer is speaking. Talk any time to interrupt.' : candidateTalking ? 'Listening to you…' : 'Your turn. Speak when ready.')}
          {live.phase === 'saving' && 'Saving your interview…'}
          {live.phase === 'ended' && 'Interview saved.'}
        </p>

        {live.error && (
          <p className="error" role="alert">
            {live.error}
          </p>
        )}

        <div className="controls">
          {(live.phase === 'idle' || live.phase === 'connecting') && (
            <button className="btn big" onClick={live.start} disabled={live.phase === 'connecting'}>
              {live.phase === 'connecting' ? 'Connecting…' : 'Start interview'}
            </button>
          )}

          {isLive && (
            <>
              <button
                className={`mic${live.muted ? ' off' : ''}${candidateTalking ? ' hot' : ''}`}
                onClick={live.toggleMute}
                aria-pressed={live.muted}
                aria-label={live.muted ? 'Unmute microphone' : 'Mute microphone'}
              >
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />
                  {live.muted && <path d="M4 4l16 16" />}
                </svg>
              </button>
              <button className="btn outline" onClick={live.end}>
                End interview
              </button>
            </>
          )}

          {live.phase === 'error' && (
            <>
              {live.turns.length > 0 && (
                <button className="btn" onClick={live.end}>
                  Save what I have
                </button>
              )}
              <button className="btn outline" onClick={live.start}>
                Try again
              </button>
            </>
          )}

          {live.phase === 'ended' && (
            <Link to="/dashboard" className="btn">
              Back to dashboard
            </Link>
          )}
        </div>

        {live.phase === 'idle' && <p className="tip">Tip: use headphones so the interviewer does not hear itself.</p>}
      </section>

      <section className="transcript card" aria-label="Live transcript">
        <span className="cap">Live transcript</span>
        <div className="turns" ref={transcriptRef}>
          {live.turns.length === 0 && <p className="empty">The conversation will appear here as you talk.</p>}
          {live.turns.map((turn, i) => (
            <p key={i} className={`turn ${turn.speaker}`}>
              <b className="cap">{turn.speaker === 'interviewer' ? 'Interviewer' : 'You'}</b>
              {turn.text}
            </p>
          ))}
        </div>
      </section>
    </main>
  );
}
