import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<Props> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  // Wait for Firebase to restore session after a full page reload — do not
  // treat "no user yet" as logged-out until auth has finished initializing.
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 text-slate-600">
        <svg className="h-10 w-10 animate-spin text-brand-pink" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm font-medium">Verifying your session…</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Navigate
        to="/auth"
        state={{ from: location, message: 'Please sign in or create an account to access this page.' }}
        replace
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
