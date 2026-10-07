import { Outlet, useLocation } from 'react-router-dom';
import NavBar from './NavBar';

export default function AppShell() {
  const { pathname } = useLocation();
  const inRoom = pathname.startsWith('/interview/');

  return (
    <>
      <div style={{ paddingBottom: inRoom ? 0 : 120 }}>
        <Outlet />
      </div>
      {!inRoom && <NavBar />}
    </>
  );
}
