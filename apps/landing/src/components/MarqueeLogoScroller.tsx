'use client';

import React from 'react';
import { GlowButton } from '@/components/GlowButton';
import { cn } from '@/lib/utils';

// Helper to convert SVG markup to safe Base64 Data URI (runs safely in Node SSR and browser)
const svgToDataUri = (svgStr: string) => {
  if (typeof window === 'undefined') {
    return `data:image/svg+xml;base64,${Buffer.from(svgStr).toString('base64')}`;
  }
  return `data:image/svg+xml;base64,${window.btoa(svgStr)}`;
};

// Define SVGs for Row 1 (LinkedIn, HubSpot, Pipedrive, Notion, Gmail, Salesforce, Zapier)
const LINKEDIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#0A66C2" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>`;

const HUBSPOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#FF7A59" d="M21.905 10.378c.883 0 1.6-.717 1.6-.683c0-.883-.717-1.6-1.6-1.6s-1.6.717-1.6 1.6c0 .882.717 1.6 1.6 1.6zm-19.8 0c.883 0 1.6-.717 1.6-.683c0-.883-.717-1.6-1.6-1.6s-1.6.717-1.6 1.6c0 .883.717 1.6 1.6 1.6zm10.9-8.378c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10s-4.48-10-10-10zm3.328 14.153l-1.92-1.92c-.37.195-.79.317-1.242.34l-1.12 3.36c1.693-.243 3.197-.935 4.282-1.78zm-6.656 0c1.085.845 2.59 1.537 4.282 1.78l-1.12-3.36c-.452-.023-.872-.145-1.242-.34l-1.92 1.92zm3.328-3.753c-.883 0-1.6-.717-1.6-1.6s.717-1.6 1.6-1.6 1.6.717 1.6 1.6-.717 1.6-1.6 1.6z"/></svg>`;

const PIPEDRIVE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#00B874" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-4h2v4zm0-6h-2V8h2v2z"/></svg>`;

const NOTION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000000" d="M4.17 2.05C3.33 2.05 3 2.45 3 3.29v17.42c0 .84.33 1.24 1.17 1.24H19.8c.84 0 1.2-.4 1.2-1.24V3.29c0-.84-.36-1.24-1.2-1.24H4.17zm1.96 3.49h11.74v12.92H6.13V5.54zm2.14 2.14v8.64h1.79V9.77l2.84 4.41h1.34V7.68h-1.79v5.91l-2.84-4.41H8.27z"/></svg>`;

const GMAIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#EA4335" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`;

const SALESFORCE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#00A1E0" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>`;

const ZAPIER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#FF4F00" d="M12 2.5a1.5 1.5 0 0 1 1.5 1.5v5.5a1.5 1.5 0 0 1-3 0V4a1.5 1.5 0 0 1 1.5-1.5zM21 9a1.5 1.5 0 0 1-.5 2.1l-5.2 3.8a1.5 1.5 0 1 1-1.8-2.4l5.2-3.8A1.5 1.5 0 0 1 21 9zM17.6 19.5a1.5 1.5 0 0 1-2.1-.5l-3.5-5.2a1.5 1.5 0 1 1 2.5-1.7l3.5 5.2a1.5 1.5 0 0 1-.4 2.2zM6.4 19.5a1.5 1.5 0 0 1-.4-2.2l-3.5-5.2a1.5 1.5 0 1 1 2.5 1.7l-3.5 5.2a1.5 1.5 0 0 1-.4 2.2zm-3.4-10.5a1.5 1.5 0 0 1 2.1-.4l5.2 3.8a1.5 1.5 0 1 1-1.8 2.4L3.3 11a1.5 1.5 0 0 1-.3-2z"/></svg>`;

// Define SVGs for Row 2 (Make, Slack, Outlook, Calendly, Google Sheets, Zoom, Stripe)
const MAKE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="#A92BE2" stroke-width="3"/><circle cx="12" cy="6" r="3" fill="#A92BE2"/><circle cx="18" cy="15" r="3" fill="#A92BE2"/><circle cx="6" cy="15" r="3" fill="#A92BE2"/></svg>`;

const SLACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#36C5F0" d="M5.04 15.12a2.52 2.52 0 1 1-2.52-2.52h2.52v2.52zm1.26 0a2.52 2.52 0 0 1 5.04 0v5.04a2.52 2.52 0 0 1-5.04 0v-5.04z"/><path fill="#2EB67D" d="M8.82 5.04a2.52 2.52 0 1 1 2.52-2.52v2.52h-2.52zm0 1.26a2.52 2.52 0 0 1 0 5.04H5.04a2.52 2.52 0 0 1 0-5.04h5.04z"/><path fill="#ECB22E" d="M18.96 8.82a2.52 2.52 0 1 1 2.52 2.52h-2.52v-2.52zm-1.26 0a2.52 2.52 0 0 1-5.04 0V3.78a2.52 2.52 0 0 1 5.04 0v5.04z"/><path fill="#E01E5A" d="M15.12 18.96a2.52 2.52 0 1 1-2.52 2.52v-2.52h2.52zm0-1.26a2.52 2.52 0 0 1 0-5.04h5.04a2.52 2.52 0 0 1 0 5.04h-5.04z"/></svg>`;

const OUTLOOK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0078d4"><path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h13.5A1.5 1.5 0 0 1 18 3.5v6.23a4 4 0 0 0-2.3-.23H15V6.75L9.75 10.5 4.5 6.75v8.5a.75.75 0 0 0 .75.75h5.07c.2 1 .74 1.87 1.5 2.5H3a1.5 1.5 0 0 1-1.5-1.5v-13.5zM9.75 9l5.25-3.75H4.5L9.75 9z"/><path fill="#005a9e" d="M18.5 11c-2.48 0-4.5 2.02-4.5 4.5s2.02 4.5 4.5 4.5 4.5-2.02 4.5-4.5-2.02-4.5-4.5-4.5zm-1.5 6v-3l3 1.5-3 1.5z"/></svg>`;

const CALENDLY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#006BFF"><path d="M12 0L2.3 5.6v11.3L12 22.5l9.7-5.6V5.6L12 0zm5.6 15.3c-.9 1.5-2.5 2.4-4.2 2.4h-2.8c-2.7 0-4.9-2.2-4.9-4.9v-1.6c0-2.7 2.2-4.9 4.9-4.9h2.8c1.7 0 3.3.9 4.2 2.4l-2.4 1.4c-.4-.7-1.1-1.1-1.8-1.1h-2.8c-1.2 0-2.2 1-2.2 2.2v1.6c0 1.2 1 2.2 2.2 2.2h2.8c.7 0 1.4-.4 1.8-1.1l2.4 1.4z"/></svg>`;

const GOOGLE_SHEETS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0F9D58"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 9h-4V8h4v4zm-6 0H8V8h4v4zm6 6h-4v-4h4v4zm-6 0H8v-4h4v4z"/></svg>`;

const ZOOM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2D8CFF"><rect x="2" y="5" width="13" height="14" rx="3"/><path d="M17 9.5l4-3v11l-4-3v-5z"/></svg>`;

const STRIPE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#635BFF"><path d="M13.962 2.083c2.737 0 4.292 1.34 4.292 1.34l-1.042 2.378s-1.378-.894-2.883-.894c-1.597 0-2.312.69-2.312 1.554 0 2.215 6.983 1.705 6.983 6.845 0 3.738-3.076 5.867-6.93 5.867-2.907 0-4.992-1.353-4.992-1.353l1.107-2.385s1.782 1.144 3.704 1.144c1.783 0 2.613-.807 2.613-1.68 0-2.456-6.982-1.841-6.982-6.844.008-3.535 3.013-5.972 6.542-5.972z"/></svg>`;

const ICONS_ROW1 = [
  svgToDataUri(LINKEDIN_SVG),
  svgToDataUri(HUBSPOT_SVG),
  svgToDataUri(PIPEDRIVE_SVG),
  svgToDataUri(NOTION_SVG),
  svgToDataUri(GMAIL_SVG),
  svgToDataUri(SALESFORCE_SVG),
  svgToDataUri(ZAPIER_SVG)
];

const ICONS_ROW2 = [
  svgToDataUri(MAKE_SVG),
  svgToDataUri(SLACK_SVG),
  svgToDataUri(OUTLOOK_SVG),
  svgToDataUri(CALENDLY_SVG),
  svgToDataUri(GOOGLE_SHEETS_SVG),
  svgToDataUri(ZOOM_SVG),
  svgToDataUri(STRIPE_SVG)
];

// Utility to repeat icons enough times for smooth scrolling
const repeatedIcons = (icons: string[], repeat = 4) => 
  Array.from({ length: repeat }).flatMap(() => icons);

export function MarqueeLogoScroller() {
  return (
    <section className="relative py-12 lg:py-16 overflow-hidden bg-white">
      {/* Subtle radial dot grid background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.03)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {/* Content wrapper */}
      <div className="relative max-w-7xl mx-auto px-6 text-center z-10">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 mb-6 text-xs font-bold uppercase tracking-wider rounded-full border border-slate-200/80 bg-white shadow-sm text-slate-800">
          ⚡ Integrations
        </span>
        <h2 className="text-4xl lg:text-6xl font-black tracking-tight text-slate-900 leading-tight">
          Integrate with your favorite tools
        </h2>
        <p className="mt-4 text-base md:text-lg text-slate-500 max-w-xl mx-auto">
          Qampi connects and syncs lead data seamlessly across 250+ top CRM and automation apps.
        </p>
        <GlowButton variant="primary" size="md" className="mt-8">
          Get Started
        </GlowButton>

        {/* Carousel Container */}
        <div className="mt-16 overflow-hidden relative pb-2 select-none pointer-events-none w-full">
          
          {/* Row 1 (Scrolls Left) */}
          <div className="flex gap-10 whitespace-nowrap animate-scroll-left w-max">
            {repeatedIcons(ICONS_ROW1, 4).map((src, i) => (
              <div key={i} className="h-16 w-16 flex-shrink-0 rounded-full bg-white border border-slate-100/80 shadow-md flex items-center justify-center hover:scale-105 transition-all duration-300">
                <img src={src} alt="integrations row 1" className="h-10 w-10 object-contain" />
              </div>
            ))}
          </div>

          {/* Row 2 (Scrolls Right) */}
          <div className="flex gap-10 whitespace-nowrap mt-6 animate-scroll-right w-max">
            {repeatedIcons(ICONS_ROW2, 4).map((src, i) => (
              <div key={i} className="h-16 w-16 flex-shrink-0 rounded-full bg-white border border-slate-100/80 shadow-md flex items-center justify-center hover:scale-105 transition-all duration-300">
                <img src={src} alt="integrations row 2" className="h-10 w-10 object-contain" />
              </div>
            ))}
          </div>

          {/* Side Fade Overlays */}
          <div className="absolute left-0 top-0 h-full w-24 md:w-32 bg-gradient-to-r from-white to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 h-full w-24 md:w-32 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        </div>
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
        .animate-scroll-left {
          animation: scroll-left 35s linear infinite;
        }
        .animate-scroll-right {
          animation: scroll-right 35s linear infinite;
        }
      `}</style>
    </section>
  );
}
