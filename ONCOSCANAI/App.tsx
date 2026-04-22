import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

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

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
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
          <Route path="/dashboard/vision-workbench"   element={<ProtectedRoute><VisionWorkbench /></ProtectedRoute>} />
          <Route path="/dashboard/ultrasound-analysis" element={<ProtectedRoute><UploadScans /></ProtectedRoute>} />
          <Route path="/dashboard/multi-class-histo"  element={<ProtectedRoute><MultiClassHistoAnalysis /></ProtectedRoute>} />
          <Route path="/dashboard/reports"            element={<ProtectedRoute><Reports /></ProtectedRoute>} />
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
