'use client';

import { motion } from "framer-motion";

const logos = [
  "Stripe", "Shopify", "Notion", "Vercel", "Linear", "Figma", "Slack", "HubSpot"
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
                className="flex-shrink-0 mx-8 flex items-center justify-center w-32 h-12 bg-slate-50 rounded-xl text-slate-400 font-bold text-lg hover:text-primary hover:bg-primary/5 transition-colors"
              >
                {logo}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
