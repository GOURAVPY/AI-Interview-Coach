import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/public.css';

// Top bar and footer for pages anyone can open without an account.
export default function PublicLayout() {
  const { user, loading } = useAuth();

  return (
    <div className="public">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          AI Interview Coach
        </Link>
        <nav aria-label="Account">
          {loading ? null : user ? (
            <Link to="/dashboard" className="btn">
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn outline">
                Log in
              </Link>
              <Link to="/register" className="btn">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>

      <Outlet />

      <footer className="foot">
        <span className="cap">Built to prepare for working abroad</span>
      </footer>
    </div>
  );
}
