'use client';

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

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

export function SocialProofV2() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  return (
    <section ref={ref} className="py-20 bg-white relative overflow-hidden">
      {/* Section Divider */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-200/60 to-transparent" />

      <motion.div style={{ opacity }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-12"
        >
          Trusted by 10,000+ sales reps, founders, and teams worldwide
        </motion.p>

        <div className="relative overflow-hidden mask-image-[linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
          <div className="flex animate-scroll">
            {[...logos, ...logos].map((logo, i) => (
              <div
                key={i}
                className="flex-shrink-0 mx-6 flex items-center justify-center w-28 h-12 rounded-xl hover:bg-indigo-50/50 transition-all duration-300 group"
              >
                <img
                  src={logo.logo}
                  alt={logo.name}
                  className="w-20 h-6 object-contain opacity-30 group-hover:opacity-80 transition-opacity duration-300 grayscale group-hover:grayscale-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-slate-300 group-hover:text-slate-600 font-bold text-sm transition-colors">${logo.name}</span>`;
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
