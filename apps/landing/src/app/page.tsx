'use client';

import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { SocialProof } from '@/components/SocialProof';
import { HowItWorks } from '@/components/HowItWorks';
import { LinkedInAutomation } from '@/components/LinkedInAutomation';
import { ColdEmailOutreach } from '@/components/ColdEmailOutreach';
import { SequencesSection } from '@/components/SequencesSection';
import { CRMAnalyticsSection } from '@/components/CRMAnalyticsSection';
import { ConnectingStackSection } from '@/components/ConnectingStackSection';
import AboutUsSection from '@/components/AboutUsSection';
import { CTASection } from '@/components/CTASection';
import { Footer } from '@/components/Footer';
import { AuroraBackground } from '@/components/AuroraBackground';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <AuroraBackground>
        <Hero />
        <SocialProof />
        <HowItWorks />
        <LinkedInAutomation />
        <ColdEmailOutreach />
        <SequencesSection />
        <CRMAnalyticsSection />
        <ConnectingStackSection />
        <AboutUsSection />
        <CTASection />
      </AuroraBackground>
      <Footer />
    </main>
  );
}
