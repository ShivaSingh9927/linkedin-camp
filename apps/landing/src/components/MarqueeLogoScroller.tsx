'use client';

import { GlowButton } from '@/components/GlowButton';

// Accurate, self-hosted brand logos (see public/integrations/*.svg).
// Full-colour marks from gilbarbara/logos, brand-tinted marks from simple-icons.
const ROW1 = [
  { name: 'LinkedIn', src: '/integrations/linkedin.svg' },
  { name: 'HubSpot', src: '/integrations/hubspot.svg' },
  { name: 'Pipedrive', src: '/integrations/pipedrive.svg' },
  { name: 'Notion', src: '/integrations/notion.svg' },
  { name: 'Gmail', src: '/integrations/gmail.svg' },
  { name: 'Salesforce', src: '/integrations/salesforce.svg' },
  { name: 'Zapier', src: '/integrations/zapier.svg' },
];

const ROW2 = [
  { name: 'Make', src: '/integrations/make.svg' },
  { name: 'Slack', src: '/integrations/slack.svg' },
  { name: 'Outlook', src: '/integrations/outlook.svg' },
  { name: 'Calendly', src: '/integrations/calendly.svg' },
  { name: 'Google Sheets', src: '/integrations/googlesheets.svg' },
  { name: 'Zoom', src: '/integrations/zoom.svg' },
  { name: 'Stripe', src: '/integrations/stripe.svg' },
];

// Repeat enough times that the -50% scroll loop is seamless across wide screens.
const repeat = (icons: typeof ROW1, times = 4) =>
  Array.from({ length: times }).flatMap(() => icons);

export function MarqueeLogoScroller() {
  return (
    <section className="relative py-12 lg:py-16 overflow-hidden bg-white">
      {/* Subtle radial dot grid background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.03)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {/* Heading block stays centered + narrow */}
      <div className="relative max-w-7xl mx-auto px-6 text-center z-10">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 mb-6 text-xs font-bold uppercase tracking-wider rounded-full border border-slate-200/80 bg-white shadow-sm text-slate-800">
          ⚡ Integrations
        </span>
 <h2 className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold text-slate-900 leading-tight">
          Integrate with your favorite tools
        </h2>
        <p className="mt-4 text-base md:text-lg text-slate-500 max-w-xl mx-auto">
          Qampi connects and syncs lead data seamlessly across 250+ top CRM and automation apps.
        </p>
        <GlowButton variant="primary" size="md" className="mt-8">
          Get Started
        </GlowButton>
      </div>

      {/* Carousel breaks out full-width so logos use the whole viewport */}
      <div className="relative mt-16 w-full overflow-hidden select-none pointer-events-none z-10">
        {/* Row 1 (Scrolls Left) */}
        <div className="flex gap-10 whitespace-nowrap animate-scroll-left w-max">
          {repeat(ROW1).map((logo, i) => (
            <div key={`r1-${i}`} className="h-20 w-20 flex-shrink-0 rounded-2xl bg-white border border-slate-100/80 shadow-md flex items-center justify-center">
              <img src={logo.src} alt={logo.name} className="h-10 w-10 object-contain" />
            </div>
          ))}
        </div>

        {/* Row 2 (Scrolls Right) */}
        <div className="flex gap-10 whitespace-nowrap mt-6 animate-scroll-right w-max">
          {repeat(ROW2).map((logo, i) => (
            <div key={`r2-${i}`} className="h-20 w-20 flex-shrink-0 rounded-2xl bg-white border border-slate-100/80 shadow-md flex items-center justify-center">
              <img src={logo.src} alt={logo.name} className="h-10 w-10 object-contain" />
            </div>
          ))}
        </div>

        {/* Side fade overlays */}
        <div className="absolute left-0 top-0 h-full w-24 md:w-40 bg-gradient-to-r from-white to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 h-full w-24 md:w-40 bg-gradient-to-l from-white to-transparent pointer-events-none" />
      </div>

      <style>{`
        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scroll-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .animate-scroll-left { animation: scroll-left 40s linear infinite; }
        .animate-scroll-right { animation: scroll-right 40s linear infinite; }
      `}</style>
    </section>
  );
}
