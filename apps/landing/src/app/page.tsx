'use client';

import { Navbar } from '@/components/Navbar';
import { HeroSection } from '@/components/HeroSection';
import { AIMessagePreview } from '@/components/AIMessagePreview';
import { SocialProof } from '@/components/SocialProof';
import { MetricsBar } from '@/components/MetricsBar';
import { HowAigeonWorks } from '@/components/HowAigeonWorks';
import { HowItWorks } from '@/components/HowItWorks';
import { FeaturesCarousel } from '@/components/FeaturesCarousel';
import { OldVsNew } from '@/components/OldVsNew';
import { TestimonialsSection } from '@/components/TestimonialsSection';
import { UseCasesSection } from '@/components/UseCasesSection';
import { IntegrationsSection } from '@/components/IntegrationsSection';
import { PricingSection } from '@/components/PricingSection';
import { FAQSection } from '@/components/FAQSection';
import { CTASection } from '@/components/CTASection';
import { Footer } from '@/components/Footer';
import { ScrollProgress } from '@/components/ScrollProgress';

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <ScrollProgress />
      <Navbar />
      <HeroSection />
      <AIMessagePreview />
      <SocialProof />
      <MetricsBar />
      <HowAigeonWorks />
      <HowItWorks />
      <FeaturesCarousel />
      <OldVsNew />
      <TestimonialsSection />
      <UseCasesSection />
      <IntegrationsSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </main>
  );
}
