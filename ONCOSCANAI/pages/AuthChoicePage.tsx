import React, { useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ─── tiny reusable input ──────────────────────────────────────────────────── */
const Field: React.FC<{
  label: string;
  type: string;
  placeholder: string;
  inputRef: React.RefObject<HTMLInputElement>;
  icon: React.ReactNode;
  hint?: React.ReactNode;
  rightBtn?: React.ReactNode;
}> = ({ label, type, placeholder, inputRef, icon, hint, rightBtn }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {hint}
    </div>
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
      <input
        ref={inputRef}
        type={type}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-pink/40 focus:border-brand-pink transition"
      />
      {rightBtn && <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightBtn}</span>}
    </div>
  </div>
);

const EmailIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
const LockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);
const PersonIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);
const EyeOff = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);
const EyeOn = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

type Mode = 'choose' | 'login' | 'signup';

/* ═══════════════════════════════════════════════════════════════════════════ */
const AuthChoicePage: React.FC = () => {
  const [mode, setMode] = useState<Mode>('choose');

  /* login */
  const loginEmailRef    = useRef<HTMLInputElement>(null);
  const loginPasswordRef = useRef<HTMLInputElement>(null);
  const [loginError,   setLoginError]   = useState('');
  const [loginMsg,     setLoginMsg]     = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLP,       setShowLP]       = useState(false);

  /* signup */
  const signupNameRef     = useRef<HTMLInputElement>(null);
  const signupEmailRef    = useRef<HTMLInputElement>(null);
  const signupPasswordRef = useRef<HTMLInputElement>(null);
  const signupConfirmRef  = useRef<HTMLInputElement>(null);
  const [signupError,   setSignupError]   = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [showSP,        setShowSP]        = useState(false);

  const { currentUser, login, signup, resetPassword, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state as { from?: { pathname: string }; message?: string } | null;
  const from     = locState?.from?.pathname ?? '/dashboard';

  function switchTo(m: Mode) {
    setLoginError(''); setLoginMsg('');
    setSignupError('');
    setMode(m);
  }

  /* ── login ──────────────────────────────────────────────────────────────── */
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(''); setLoginMsg('');
    const email    = loginEmailRef.current!.value.trim();
    const password = loginPasswordRef.current!.value;
    if (!email || !password) { setLoginError('Please fill in all fields.'); return; }
    setLoginLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(code)) {
        setLoginError('Invalid email or password.');
      } else if (code === 'auth/too-many-requests') {
        setLoginError('Too many attempts. Try again later or reset your password.');
      } else {
        setLoginError('Sign in failed. Please try again.');
      }
    } finally { setLoginLoading(false); }
  }

  async function handleForgotPassword() {
    const email = loginEmailRef.current?.value.trim();
    if (!email) { setLoginError('Enter your email first, then click "Forgot password".'); return; }
    setLoginError('');
    setLoginLoading(true);
    try {
      await resetPassword(email);
      setLoginMsg('Reset email sent — check your inbox.');
    } catch {
      setLoginError('Could not send reset email. Check the address.');
    } finally { setLoginLoading(false); }
  }

  /* ── signup ─────────────────────────────────────────────────────────────── */
  function validatePw(pw: string) {
    if (pw.length < 8)     return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(pw)) return 'Must contain an uppercase letter.';
    if (!/[0-9]/.test(pw)) return 'Must contain a number.';
    return '';
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupError('');
    const name    = signupNameRef.current!.value.trim();
    const email   = signupEmailRef.current!.value.trim();
    const pw      = signupPasswordRef.current!.value;
    const confirm = signupConfirmRef.current!.value;
    if (!name || !email || !pw || !confirm) { setSignupError('Please fill in all fields.'); return; }
    const err = validatePw(pw);
    if (err) { setSignupError(err); return; }
    if (pw !== confirm) { setSignupError('Passwords do not match.'); return; }
    setSignupLoading(true);
    try {
      await signup(email, pw, name);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/email-already-in-use') setSignupError('__exists__');
      else if (code === 'auth/invalid-email')   setSignupError('Invalid email address.');
      else if (code === 'auth/weak-password')   setSignupError('Password is too weak.');
      else                                      setSignupError('Failed to create account. Please try again.');
    } finally { setSignupLoading(false); }
  }

  /* ── render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50/30 to-white flex flex-col">

      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-9 h-9 bg-brand-pink rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight">
              OncoScanAI
            </span>
          </Link>
          {mode !== 'choose' && (
            <button onClick={() => switchTo('choose')}
              className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">

          {/* Redirect info banner */}
          {locState?.message && mode === 'choose' && (
            <div className="mb-6 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>{locState.message}</span>
            </div>
          )}

          {/* ── CHOICE SCREEN ─────────────────────────────────────────────── */}
          {mode === 'choose' && (
            <div>

              {currentUser && (
                <div className="mb-6 rounded-3xl border border-green-200 bg-green-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-green-800">You are already signed in</p>
                      <p className="mt-1 text-sm text-green-700">
                        Continue directly to your selected page, or sign out and choose a different account.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(from)}
                      className="shrink-0 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                    }}
                    className="mt-3 text-sm font-medium text-brand-pink hover:underline"
                  >
                    Sign out and choose another option
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Sign In card */}
                <button
                  type="button"
                  onClick={() => switchTo('login')}
                  className="group bg-white border-2 border-slate-200 hover:border-brand-pink rounded-3xl p-7 text-left shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/40"
                >
                  <div className="w-14 h-14 rounded-2xl bg-brand-pink/10 flex items-center justify-center mb-5 group-hover:bg-brand-pink/20 transition-colors">
                    <svg className="w-7 h-7 text-brand-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mb-1">Sign In</h2>
                  <p className="text-sm text-slate-500 leading-relaxed mb-5">
                    Already have an account? Sign in with your email and password.
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-pink group-hover:gap-2.5 transition-all">
                    Continue to Sign In
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </button>

                {/* Create Account card */}
                <button
                  type="button"
                  onClick={() => switchTo('signup')}
                  className="group bg-brand-pink border-2 border-brand-pink hover:bg-pink-600 hover:border-pink-600 rounded-3xl p-7 text-left shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/40"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-5">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-white mb-1">Create Account</h2>
                  <p className="text-sm text-pink-100 leading-relaxed mb-5">
                    New here? Create a free account to get started in seconds.
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white group-hover:gap-2.5 transition-all">
                    Continue to Sign Up
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </button>
              </div>

              <p className="text-center text-xs text-slate-400 mt-8">
                Protected by Firebase Authentication · OncoScanAI
              </p>
            </div>
          )}

          {/* ── LOGIN FORM ────────────────────────────────────────────────── */}
          {mode === 'login' && (
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
              <div className="text-center mb-7">
                <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-brand-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900">Sign in to your account</h2>
                <p className="text-xs text-slate-500 mt-1">Enter your credentials to continue</p>
              </div>

              {loginError && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {loginError}
                </div>
              )}
              {loginMsg && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {loginMsg}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <Field label="Email address" type="email" placeholder="doctor@hospital.com"
                  inputRef={loginEmailRef} icon={<EmailIcon />} />
                <Field
                  label="Password" type={showLP ? 'text' : 'password'} placeholder="••••••••"
                  inputRef={loginPasswordRef} icon={<LockIcon />}
                  hint={
                    <button type="button" onClick={handleForgotPassword}
                      className="text-xs text-brand-pink hover:underline font-medium">
                      Forgot password?
                    </button>
                  }
                  rightBtn={
                    <button type="button" onClick={() => setShowLP(v => !v)}
                      className="text-slate-400 hover:text-slate-600">
                      {showLP ? <EyeOff /> : <EyeOn />}
                    </button>
                  }
                />
                <button type="submit" disabled={loginLoading}
                  className="w-full py-2.5 rounded-xl bg-brand-pink text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-pink-200">
                  {loginLoading ? <><Spinner />Signing in…</> : 'Sign in'}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                No account yet?{' '}
                <button onClick={() => switchTo('signup')}
                  className="text-brand-pink font-semibold hover:underline">
                  Create one →
                </button>
              </p>
            </div>
          )}

          {/* ── SIGNUP FORM ───────────────────────────────────────────────── */}
          {mode === 'signup' && (
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
              <div className="text-center mb-7">
                <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-brand-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900">Create your account</h2>
                <p className="text-xs text-slate-500 mt-1">Start using OncoScanAI — free</p>
              </div>

              {signupError === '__exists__' ? (
                <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  <p className="font-semibold mb-0.5">Account already exists</p>
                  <p className="text-xs text-amber-700">
                    This email is already registered.{' '}
                    <button onClick={() => switchTo('login')}
                      className="font-bold underline text-brand-pink hover:opacity-80">
                      Sign in instead →
                    </button>
                  </p>
                </div>
              ) : signupError ? (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {signupError}
                </div>
              ) : null}

              <form onSubmit={handleSignup} className="space-y-4">
                <Field label="Full name" type="text" placeholder="Dr. Jane Smith"
                  inputRef={signupNameRef} icon={<PersonIcon />} />
                <Field label="Email address" type="email" placeholder="doctor@hospital.com"
                  inputRef={signupEmailRef} icon={<EmailIcon />} />
                <div>
                  <Field
                    label="Password" type={showSP ? 'text' : 'password'}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    inputRef={signupPasswordRef} icon={<LockIcon />}
                    rightBtn={
                      <button type="button" onClick={() => setShowSP(v => !v)}
                        className="text-slate-400 hover:text-slate-600">
                        {showSP ? <EyeOff /> : <EyeOn />}
                      </button>
                    }
                  />
                  <ul className="mt-2 grid grid-cols-3 gap-1">
                    {['8+ chars', 'Uppercase', 'Number'].map(h => (
                      <li key={h} className="text-[10px] text-center px-2 py-1 rounded-lg bg-slate-100 text-slate-500 font-medium">{h}</li>
                    ))}
                  </ul>
                </div>
                <Field label="Confirm password" type={showSP ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  inputRef={signupConfirmRef} icon={<LockIcon />} />
                <button type="submit" disabled={signupLoading}
                  className="w-full py-2.5 rounded-xl bg-brand-pink text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-pink-200">
                  {signupLoading ? <><Spinner />Creating account…</> : 'Create account'}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                Already have an account?{' '}
                <button onClick={() => switchTo('login')}
                  className="text-brand-pink font-semibold hover:underline">
                  Sign in →
                </button>
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AuthChoicePage;
