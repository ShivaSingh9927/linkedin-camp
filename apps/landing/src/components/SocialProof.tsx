'use client';

import { motion } from "framer-motion";

const logos = [
  { name: "Stripe", logo: "https://img.logo.dev/stripe.com?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
  { name: "Shopify", logo: "https://img.logo.dev/shopify.com?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
  { name: "Notion", logo: "https://img.logo.dev/notion.so?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
  { name: "Vercel", logo: "https://img.logo.dev/vercel.com?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
  { name: "Linear", logo: "https://img.logo.dev/linear.app?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
  { name: "Figma", logo: "https://img.logo.dev/figma.com?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
  { name: "Slack", logo: "https://img.logo.dev/slack.com?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
  { name: "HubSpot", logo: "https://img.logo.dev/hubspot.com?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
];

export function SocialProof() {
  return (
    <section className="py-16 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-sm font-bold text-slate-400 uppercase tracking-widest mb-10"
        >
          Trusted by 10,000+ sales reps, founders, and teams worldwide
        </motion.p>

        <div className="relative overflow-hidden">
          <div className="flex animate-scroll">
            {[...logos, ...logos].map((logo, i) => (
              <div
                key={i}
                className="flex-shrink-0 mx-6 flex items-center justify-center w-28 h-12 bg-slate-50 rounded-xl overflow-hidden hover:bg-primary/5 transition-colors"
              >
                <img
                  src={logo.logo}
                  alt={logo.name}
                  className="w-20 h-6 object-contain opacity-40 hover:opacity-100 transition-opacity"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-slate-400 font-bold text-sm">${logo.name}</span>`;
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
