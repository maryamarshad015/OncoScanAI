import React from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import LandingPage              from './pages/LandingPage';
import AuthChoicePage           from './pages/AuthChoicePage';
import LoginPage                from './pages/LoginPage';
import SignupPage               from './pages/SignupPage';
import VisionWorkbench          from './pages/VisionWorkbench';
import UploadScans              from './pages/UploadScans';
import MultiClassHistoAnalysis  from './pages/MultiClassHistoAnalysis';
import PatientData              from './pages/PatientData';
import Reports                  from './pages/Reports';
import Settings                 from './pages/Settings';

const BackToHomeButton: React.FC = () => {
  const location = useLocation();

  if (location.pathname === '/') return null;

  return (
    <div className="border-b border-pink-100 bg-gradient-to-r from-pink-50 via-white to-rose-50">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center px-4 md:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-brand-pink bg-brand-pink px-5 py-2 text-sm font-black text-white shadow-lg shadow-pink-200 transition-all hover:-translate-y-0.5 hover:bg-brand-pink-dark hover:shadow-xl hover:shadow-pink-200"
          aria-label="Go back to home page"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <BackToHomeButton />
        <Routes>
          {/* Public routes */}
          <Route path="/"       element={<LandingPage />} />
          <Route path="/auth"   element={<AuthChoicePage />} />
          {/* Keep /login and /signup working as direct links */}
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* /dashboard → redirect to default sub-page (also protected) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard/vision-workbench" replace />
              </ProtectedRoute>
            }
          />

          {/* Protected dashboard routes */}
          <Route path="/dashboard/patient-data"       element={<ProtectedRoute><PatientData /></ProtectedRoute>} />
          <Route path="/dashboard/patient-data/:recordId" element={<ProtectedRoute><PatientData /></ProtectedRoute>} />
          <Route path="/dashboard/vision-workbench"   element={<ProtectedRoute><VisionWorkbench /></ProtectedRoute>} />
          <Route path="/dashboard/ultrasound-analysis" element={<ProtectedRoute><UploadScans /></ProtectedRoute>} />
          <Route path="/dashboard/multi-class-histo"  element={<ProtectedRoute><MultiClassHistoAnalysis /></ProtectedRoute>} />
          <Route path="/dashboard/reports"            element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/dashboard/reports/:recordId"  element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/dashboard/settings"           element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          {/* Legacy redirects */}
          <Route path="/dashboard/upload-scans"    element={<ProtectedRoute><UploadScans /></ProtectedRoute>} />
          <Route path="/dashboard/histo-analysis"  element={<Navigate to="/dashboard/vision-workbench" replace />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
