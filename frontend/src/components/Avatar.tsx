import { useEffect, useRef } from 'react';

interface Props {
  getLevel: () => number;
  speaking: boolean;
  listening: boolean;
}

// A simple 2D interviewer. The mouth opens with the loudness of the voice,
// so lip movement works for any language.
export default function Avatar({ getLevel, speaking, listening }: Props) {
  const mouthRef = useRef<SVGEllipseElement>(null);
  const smoothRef = useRef(0);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const target = getLevel();
      smoothRef.current += (target - smoothRef.current) * 0.35;
      const open = smoothRef.current;
      mouthRef.current?.setAttribute('ry', String(2 + open * 15));
      mouthRef.current?.setAttribute('rx', String(13 - open * 3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [getLevel]);

  return (
    <div className={`avatar${speaking ? ' speaking' : ''}${listening ? ' listening' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 200 220" role="img">
        <path d="M30 220c0-42 30-62 70-62s70 20 70 62z" fill="#141414" />
        <path d="M84 150h32v22c0 8-7 14-16 14s-16-6-16-14z" fill="#d9b99b" />
        <path d="M86 160l14 16 14-16" fill="#f6f6f4" />
        <ellipse cx="100" cy="92" rx="52" ry="60" fill="#e6c7a8" />
        <path d="M48 88c-4-44 30-62 56-60 30 2 50 24 48 60-8-20-22-30-48-30s-44 10-56 30z" fill="#2b2622" />
        <g className="eyes" fill="#141414">
          <ellipse cx="78" cy="94" rx="5" ry="6" />
          <ellipse cx="122" cy="94" rx="5" ry="6" />
        </g>
        <path d="M68 80q10-7 20-1M112 79q10-6 20 1" stroke="#2b2622" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M100 98v14q-5 3 0 4" stroke="#c4a07f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <ellipse ref={mouthRef} cx="100" cy="132" rx="13" ry="2" fill="#7a2f2f" />
      </svg>
    </div>
  );
}
