import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';

export default function AppShell() {
  return (
    <>
      <div style={{ paddingBottom: 120 }}>
        <Outlet />
      </div>
      <NavBar />
    </>
  );
}
