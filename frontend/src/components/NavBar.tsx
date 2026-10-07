import { NavLink, useLocation } from 'react-router-dom';
import '../styles/nav.css';

const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const items = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    color: '#f44336',
    icon: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  },
  {
    to: '/practice',
    label: 'Practice',
    color: '#0fc70f',
    icon: <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />,
  },
  {
    to: '/history',
    label: 'History',
    color: '#2196f3',
    icon: <path d="M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4" />,
  },
  {
    to: '/profile',
    label: 'Profile',
    color: '#b145e9',
    icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
  },
];

export default function NavBar() {
  const { pathname } = useLocation();
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => pathname.startsWith(item.to) || (item.to === '/history' && pathname.startsWith('/report/'))),
  );

  return (
    <nav className="nav" aria-label="Main" style={{ '--n': items.length, '--i': activeIndex } as React.CSSProperties}>
      <ul>
        {items.map((item) => (
          <li key={item.to} style={{ '--clt': item.color } as React.CSSProperties}>
            <NavLink to={item.to} aria-label={item.label} title={item.label}>
              <span className="icon">
                <svg viewBox="0 0 24 24" width="24" height="24" {...ICON}>
                  {item.icon}
                </svg>
              </span>
            </NavLink>
          </li>
        ))}
        <div className="indicator" />
      </ul>
    </nav>
  );
}
