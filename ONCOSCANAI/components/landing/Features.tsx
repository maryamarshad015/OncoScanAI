
import React from 'react';

const FeatureCard: React.FC<{ icon: React.ReactElement; title: string, description: string }> = ({ icon, title, description }) => (
  <div className="bg-white p-8 rounded-xl shadow-subtle text-center transform hover:-translate-y-2 hover:shadow-lifted transition-all duration-300">
    <div className="flex justify-center items-center h-16 w-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink-50 to-pink-100">{icon}</div>
    <h3 className="text-xl font-semibold text-brand-text-primary mb-2">{title}</h3>
    <p className="text-brand-text-secondary">{description}</p>
  </div>
);

const Features: React.FC = () => {
    const iconStyles = "h-8 w-8 text-brand-pink";
  return (
    <section className="bg-brand-background py-16">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className={iconStyles} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2.5 2.5 0 00-2.5 2.5V7h5V4.5A2.5 2.5 0 0012 2zM8 7a4 4 0 00-4 4v2h16v-2a4 4 0 00-4-4H8z"/><path d="M12 13a3 3 0 100 6 3 3 0 000-6z"/><path d="M9 13v6M15 13v6"/></svg>}
                title="AI-Powered Analysis" 
                description="Our proprietary algorithms detect subtle patterns and anomalies often missed by the human eye."
            />
            <FeatureCard 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className={iconStyles} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>}
                title="High-Accuracy Detection" 
                description="Achieve industry-leading sensitivity and specificity, reducing false positives and negatives."
            />
            <FeatureCard 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className={iconStyles} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12l-8 8-8-8"/><path d="M20 4l-8 8-8-8"/></svg>}
                title="Seamless Workflow" 
                description="Integrates effortlessly with your existing PACS and EMR systems for a frictionless experience."
            />
        </div>
      </div>
    </section>
  );
};

export default Features;