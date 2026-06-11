'use client';

import { NavbarV2 } from '@/components/v2/NavbarV2';
import { HeroSectionV2 } from '@/components/v2/HeroSectionV2';
import { MetricsBarV2 } from '@/components/v2/MetricsBarV2';
import { SocialProofV2 } from '@/components/v2/SocialProofV2';
import { InteractiveSequenceV2 } from '@/components/v2/InteractiveSequenceV2';
import { AIMessagePreviewV2 } from '@/components/v2/AIMessagePreviewV2';
import { FeaturesGridV2 } from '@/components/v2/FeaturesGridV2';
import { UseCasesV2 } from '@/components/v2/UseCasesV2';
import { IntegrationsV2 } from '@/components/v2/IntegrationsV2';
import { TestimonialsV2 } from '@/components/v2/TestimonialsV2';
import { PricingV2 } from '@/components/v2/PricingV2';
import { FAQV2 } from '@/components/v2/FAQV2';
import { CTAV2 } from '@/components/v2/CTAV2';
import { FooterV2 } from '@/components/v2/FooterV2';
import { ScrollProgress } from '@/components/ScrollProgress';

export default function LandingPageV2() {
  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900 overflow-x-hidden selection:bg-indigo-500/10 selection:text-indigo-900 font-sans">
      <ScrollProgress />
      
      {/* Aurora Ambient Glow Effects (Light Theme) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-[300px] left-1/4 w-[600px] h-[600px] bg-indigo-500/[0.04] rounded-full blur-[140px]" />
        <div className="absolute -top-[250px] right-1/4 w-[500px] h-[500px] bg-purple-500/[0.03] rounded-full blur-[120px]" />
      </div>

      <NavbarV2 />
      <HeroSectionV2 />
      <SocialProofV2 />
      <MetricsBarV2 />
      <InteractiveSequenceV2 />
      <AIMessagePreviewV2 />
      <FeaturesGridV2 />
      <UseCasesV2 />
      <IntegrationsV2 />
      <TestimonialsV2 />
      <PricingV2 />
      <FAQV2 />
      <CTAV2 />
      <FooterV2 />
    </main>
  );
}
