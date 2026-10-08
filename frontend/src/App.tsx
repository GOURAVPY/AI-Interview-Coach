import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './components/PublicLayout';
import AuthPage from './pages/AuthPage';
import Coding from './pages/Coding';
import Dashboard from './pages/Dashboard';
import DemoSetup from './pages/DemoSetup';
import History from './pages/History';
import Landing from './pages/Landing';
import Practice from './pages/Practice';
import Profile from './pages/Profile';
import Report from './pages/Report';

// The voice room and coding room carry the biggest libraries, so they load only when opened.
const InterviewRoom = lazy(() => import('./pages/InterviewRoom'));
const CodingRoom = lazy(() => import('./pages/CodingRoom'));

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* Open to everyone, no account needed */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/demo" element={<DemoSetup />} />
          <Route path="/demo/report/:id" element={<Report demo />} />
        </Route>
        <Route path="/demo/interview/:id" element={<InterviewRoom demo />} />
  
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
  
        {/* Signed-in app */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/coding" element={<Coding />} />
            <Route path="/coding/:id" element={<CodingRoom />} />
            <Route path="/interview/:id" element={<InterviewRoom />} />
            <Route path="/report/:id" element={<Report />} />
            <Route path="/history" element={<History />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>
  
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
