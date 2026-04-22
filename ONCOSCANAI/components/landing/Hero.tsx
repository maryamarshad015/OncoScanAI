
import React from 'react';
import { Link } from 'react-router-dom';

const Hero: React.FC = () => {
  return (
    <section className="bg-gradient-to-b from-white to-pink-50">
      <div className="container mx-auto px-6 py-16 lg:py-24 flex flex-col lg:flex-row items-center">
        <div className="lg:w-1/2 lg:pr-12 mb-12 lg:mb-0 text-center lg:text-left">
          <h1 className="text-4xl md:text-6xl font-bold text-brand-text-primary leading-tight mb-4">
            AI-Powered Precision in Breast Cancer Diagnostics
          </h1>
          <p className="text-lg text-brand-text-secondary mb-8">
            Leverage our state-of-the-art deep learning models to analyze mammograms with unparalleled accuracy. OncoScanAI provides rapid, reliable insights to support your clinical decisions and improve patient outcomes.
          </p>
          <div className="flex justify-center lg:justify-start space-x-4">
            <Link to="/dashboard" className="bg-brand-pink text-white font-semibold px-8 py-3 rounded-lg shadow-md hover:bg-brand-pink-dark hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300">
              Access Dashboard
            </Link>
            <button className="bg-white text-brand-pink font-semibold px-8 py-3 rounded-lg border border-brand-pink-light hover:bg-pink-50 hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-300">
              Explore Technology
            </button>
          </div>
        </div>
        <div className="lg:w-1/2">
          <img 
            src="https://images.unsplash.com/photo-1576091160550-2173dba9996a?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80"
            alt="Doctor analyzing medical scans on a laptop" 
            className="rounded-lg shadow-2xl w-full h-auto object-cover"
          />
        </div>
      </div>
    </section>
  );
};

export default Hero;