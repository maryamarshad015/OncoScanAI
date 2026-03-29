
import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-brand-text-primary">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-brand-pink rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <span className="text-2xl font-bold tracking-tight">OncoDetect <span className="text-brand-pink font-light">Pro</span></span>
          </div>
          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-brand-text-secondary">
            <Link to="/dashboard" className="px-5 py-2.5 bg-brand-text-primary text-white rounded-full hover:bg-black transition-all shadow-sm">
              SignUp/Login
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 overflow-hidden">
          <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
            <div className="z-10">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-pink-50 text-brand-pink text-xs font-bold mb-6">
                <span>AI-DRIVEN ONCOLOGY</span>

              </div>
              <h1 className="text-5xl lg:text-7xl font-extrabold leading-[1.1] mb-6 text-slate-900">
                Precision Diagnostics for <span className="text-brand-pink">Modern Oncology.</span>
              </h1>
              <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-xl">
                Empowering clinicians with deep-learning analysis for histopathology. Reduce diagnostic latency and enhance patient outcomes with validated AI models.
              </p>
              <div className="mt-12 flex items-center space-x-6">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => <img key={i} src={`https://i.pravatar.cc/100?u=${i}`} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="Doctor" />)}
                </div>
                <p className="text-sm text-slate-500">Trusted by <span className="font-bold text-slate-900">1,200+</span> specialists worldwide.</p>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-pink/10 rounded-full blur-3xl animate-pulse"></div>
              <div className="relative z-10 bg-white p-4 rounded-3xl shadow-2xl border border-slate-100 transform rotate-2">
                <img 
                  src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=1000" 
                  alt="Clinical Interface" 
                  className="rounded-2xl"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features / Capabilities */}
        <section className="py-24 bg-slate-50 border-y border-slate-200">
          <div className="container mx-auto px-6 text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Advanced Diagnostic Capabilities</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">Our platform utilizes validated neural architectures to assist in the early detection and classification of oncological pathologies.</p>
          </div>
          <div className="container mx-auto px-6 grid md:grid-cols-2 gap-8 md:max-w-5xl md:justify-center">
            <FeatureItem 
              title="State-of-the-Art Models" 
              desc="Powered by AI for unprecedented accuracy in cellular and structural analysis."
              icon={<svg className="w-6 h-6 text-brand-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
            />
            <FeatureItem 
              title="Sub-Millimeter Precision" 
              desc="Identify lesions as small as 0.2mm with confidence in clinical test environments."
              icon={<svg className="w-6 h-6 text-brand-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            />
          </div>
        </section>

        {/* Quick Start Cards */}
        <section className="py-10">
          <div className="container mx-auto px-6">
            <div className="mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl">
              {[
                {
                  title: 'Uni HistoAnalysis',
                  description: 'Focused on single-class histopathology detection.',
                  to: '/dashboard/histo-analysis',
                  icon: (
                    <svg className="w-6 h-6 text-brand-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3h6l2 4h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2l2-4z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
                    </svg>
                  ),
                },
                {
                  title: 'MultiClass HistoAnalysis',
                  description: 'Advanced multi-class tissue classification.',
                  to: '/dashboard/histo-analysis',
                  icon: (
                    <svg className="w-6 h-6 text-brand-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="7" cy="7" r="3" strokeWidth="2" />
                      <circle cx="17" cy="7" r="3" strokeWidth="2" />
                      <circle cx="12" cy="17" r="3" strokeWidth="2" />
                    </svg>
                  ),
                },
                {
                  title: 'Ultrasound Analysis',
                  description: 'Specialized AI tools for ultrasound imagery.',
                  to: '/dashboard/ultrasound-analysis',
                  icon: (
                    <svg className="w-6 h-6 text-brand-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v18" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8a5 5 0 0 1 10 0" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12a7 7 0 0 1 14 0" />
                    </svg>
                  ),
                },
                {
                  title: 'Patients Records',
                  description: 'Secure access to patient database and scan history.',
                  to: '/dashboard/patient-data',
                  icon: (
                    <svg className="w-6 h-6 text-brand-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7a2 2 0 0 1 2-2h6l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                    </svg>
                  ),
                },
              ].map(card => (
                <Link
                  key={card.title}
                  to={card.to}
                  className="group text-left bg-white border border-slate-200 border-t-4 border-t-brand-pink rounded-2xl p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1 hover:border-brand-pink/60 hover:bg-gradient-to-br hover:from-pink-50 hover:via-fuchsia-50 hover:to-purple-50 active:translate-y-0 active:shadow-md active:from-pink-100 active:via-fuchsia-100 active:to-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/40"
                >
                  <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center mb-4">
                    {card.icon}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{card.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">{card.description}</p>
                  <span className="text-xs font-bold text-brand-pink">Get Started -&gt;</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-slate-100 text-center text-sm text-slate-500">
        <div className="container mx-auto px-6">
          <p>© {new Date().getFullYear()} OncoDetect Medical Systems. For professional clinical use only.</p>
        </div>
      </footer>
    </div>
  );
};

const FeatureItem: React.FC<{ title: string; desc: string; icon: React.ReactNode }> = ({ title, desc, icon }) => (
  <div className="bg-gradient-to-br from-white via-pink-50 to-white p-8 rounded-2xl border border-brand-pink/30 shadow-sm shadow-pink-100 hover:shadow-lg hover:shadow-pink-200 hover:border-brand-pink/60 transition-all group">
    <div className="w-12 h-12 rounded-xl bg-brand-pink/10 text-brand-pink flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">{icon}</div>
    <h3 className="text-xl font-extrabold text-slate-900 mb-3">{title}</h3>
    <p className="text-slate-600 leading-relaxed">{desc}</p>
  </div>
);

export default LandingPage;
