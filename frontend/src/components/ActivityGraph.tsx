import { useEffect, useMemo, useRef } from 'react';
import type { ActivityDay } from '../types/interview';

const WEEKS = 53;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function localKey(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function level(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

interface Cell {
  key: string;
  date: Date;
  future: boolean;
  entry?: ActivityDay;
}

// One square per day for the last year, like a GitHub contribution graph. Darker means more practice that day.
export default function ActivityGraph({ days }: { days: ActivityDay[] }) {
  const scroller = useRef<HTMLDivElement>(null);

  const weeks = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.date, d]));
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const start = new Date(today);
    start.setDate(start.getDate() - today.getDay() - (WEEKS - 1) * 7); // Sunday, 52 weeks before this week

    const columns: Cell[][] = [];
    for (let w = 0; w < WEEKS; w++) {
      const col: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        const key = localKey(date);
        col.push({ key, date, future: date > today, entry: byDate.get(key) });
      }
      columns.push(col);
    }
    return columns;
  }, [days]);

  // Show the most recent weeks first on narrow screens.
  useEffect(() => {
    scroller.current?.scrollTo({ left: scroller.current.scrollWidth });
  }, [weeks]);

  return (
    <div className="activity">
      <div className="activity-scroll" ref={scroller}>
        <div className="activity-grid" role="img" aria-label="Practice activity over the last year">
          <div className="months" aria-hidden="true">
            {weeks.map((col, i) => {
              // Label the column that contains the 1st of a month.
              const firstOfMonth = col.find((c) => c.date.getDate() === 1 && !c.future);
              return <span key={i}>{firstOfMonth ? MONTHS[firstOfMonth.date.getMonth()] : ''}</span>;
            })}
          </div>
          <div className="weeks">
            <div className="weekday" aria-hidden="true">
              <span />
              <span>Mon</span>
              <span />
              <span>Wed</span>
              <span />
              <span>Fri</span>
              <span />
            </div>
            {weeks.map((col, i) => (
              <div className="week" key={i}>
                {col.map((cell) =>
                  cell.future ? (
                    <i key={cell.key} className="cell future" />
                  ) : (
                    <i
                      key={cell.key}
                      className={`cell l${level(cell.entry?.count ?? 0)}`}
                      title={
                        cell.entry
                          ? `${cell.entry.count} interview${cell.entry.count > 1 ? 's' : ''}, ${cell.entry.minutes} min on ${cell.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : `No practice on ${cell.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
                      }
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="legend" aria-hidden="true">
        <span className="cap">Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={`cell l${l}`} />
        ))}
        <span className="cap">More</span>
      </div>
    </div>
  );
}
