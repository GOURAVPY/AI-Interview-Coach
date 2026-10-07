import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <main style={{ padding: 24 }}>
      <span className="cap">Dashboard</span>
      <h1 style={{ fontWeight: 400, fontSize: 34, letterSpacing: '-0.045em' }}>Hi, {user?.name}.</h1>
      <button className="btn outline" style={{ marginTop: 16 }} onClick={logout}>
        Sign out
      </button>
    </main>
  );
}
