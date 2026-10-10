'use client';

import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { AIMessagePreview } from '@/components/AIMessagePreview';
import { HowItWorks } from '@/components/HowItWorks';
import { QampiShowcase } from '@/components/QampiShowcase';
import { FeatureGrid } from '@/components/FeatureGrid';
import { OldVsNew } from '@/components/OldVsNew';
import { UseCasesSection } from '@/components/UseCasesSection';
import { PricingSection } from '@/components/PricingSection';
import { FAQSection } from '@/components/FAQSection';
import { CTASection } from '@/components/CTASection';
import { Footer } from '@/components/Footer';

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main id="main">
        {/* ── The promise, shown: product in the first screen ── */}
        <Hero />

        {/* ── Why it's different, then how it works ── */}
        <AIMessagePreview />
        <HowItWorks />
        <QampiShowcase />

        {/* ── Everything else it does ── */}
        <FeatureGrid />
        <OldVsNew />

        {/* ── Who it's for, what it costs, objections, ask ── */}
        <UseCasesSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
