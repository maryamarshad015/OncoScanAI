import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import UploadScans from './pages/UploadScans';
import HistoAnalysis from './pages/HistoAnalysis';

import PatientData from './pages/PatientData';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Navigate to="/dashboard/histo-analysis" replace />} />
        <Route path="/dashboard/patient-data" element={<PatientData />} />
        <Route path="/dashboard/vision-workbench" element={<Navigate to="/dashboard/histo-analysis" replace />} />
        <Route path="/dashboard/histo-analysis" element={<HistoAnalysis />} />
        <Route path="/dashboard/ultrasound-analysis" element={<UploadScans />} />
        <Route path="/dashboard/reports" element={<Reports />} />
        <Route path="/dashboard/settings" element={<Settings />} />
        {/* Keep old routes for compatibility if needed, or redirect */}
        <Route path="/dashboard/upload-scans" element={<UploadScans />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
