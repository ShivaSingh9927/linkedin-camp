'use client';

import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { MarqueeLogoScroller } from '@/components/MarqueeLogoScroller';
import AboutUsSection from '@/components/AboutUsSection';
import { AIMessagePreview } from '@/components/AIMessagePreview';
import { OldVsNew } from '@/components/OldVsNew';
import { HowItWorks } from '@/components/HowItWorks';
import { QampiShowcase } from '@/components/QampiShowcase';
// import { LinkedInAutomation } from '@/components/LinkedInAutomation';
import { ColdEmailOutreach } from '@/components/ColdEmailOutreach';
import { SequencesSection } from '@/components/SequencesSection';
// import { CRMAnalyticsSection } from '@/components/CRMAnalyticsSection';
import { UseCasesSection } from '@/components/UseCasesSection';
import { TestimonialsSection } from '@/components/TestimonialsSection';
import { PricingSection } from '@/components/PricingSection';
import { FAQSection } from '@/components/FAQSection';
import { CTASection } from '@/components/CTASection';
import { Footer } from '@/components/Footer';
import { GlobalEffects } from '@/components/GlobalEffects';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-purple-50/20">
      <GlobalEffects />
      {/* ── Hook ── */}
      <Navbar />
      <Hero />

      {/* ── What is it → How it works ── */}
      <AboutUsSection />
      <HowItWorks />

      {/* ── See it & believe it (proof / differentiator) ── */}
      <AIMessagePreview />
      <OldVsNew />

      {/* ── The details (feature deep-dives) ── */}
      {/* <LinkedInAutomation /> */}
      <ColdEmailOutreach />
      <SequencesSection />
      {/* <CRMAnalyticsSection /> */}

      {/* ── Works with your stack ── */}
      <MarqueeLogoScroller />

      {/* ── Who it's for + the AI engine showcase ── */}
      <UseCasesSection />
      <QampiShowcase />

      {/* ── Validation & Action ── */}
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </main>
  );
}
