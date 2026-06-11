'use client';

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Link2 } from "lucide-react";

const integrations = [
  { name: "HubSpot", logo: "https://img.logo.dev/hubspot.com?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
  { name: "Pipedrive", logo: "https://img.logo.dev/pipedrive.com?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
  { name: "Salesforce", logo: "https://img.logo.dev/salesforce.com?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
  { name: "Zapier", logo: "https://img.logo.dev/zapier.com?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
  { name: "Make", logo: "https://img.logo.dev/make.com?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
  { name: "n8n", logo: "https://img.logo.dev/n8n.io?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
  { name: "Slack", logo: "https://img.logo.dev/slack.com?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
  { name: "Notion", logo: "https://img.logo.dev/notion.so?token=pk_YjPmzKTaQJqYX8V5Z9xJ1g" },
];

export function IntegrationsV2() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [30, -30]);

  return (
    <section ref={ref} className="py-24 sm:py-32 bg-slate-50 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/[0.03] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[120px] pointer-events-none" />

      {/* Section Divider */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-200/60 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-black mb-4 shadow-sm">
            <Link2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Integrations</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
            Connected to your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
              stack
            </span>
          </h2>
          <p className="mt-4.5 text-base sm:text-lg text-slate-600 font-semibold max-w-2xl mx-auto leading-relaxed">
            Qampi integrates seamlessly with HubSpot, Pipedrive, and 2,000+ apps through Zapier, Make, and n8n.
          </p>
        </motion.div>

        {/* Integration Grid */}
        <motion.div style={{ y }} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 max-w-5xl mx-auto mb-16">
          {integrations.map((integration, i) => (
            <motion.div
              key={integration.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04, duration: 0.4 }}
              whileHover={{ scale: 1.08, y: -6, transition: { duration: 0.25, ease: "easeOut" } }}
              className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 transition-all duration-300 cursor-default flex flex-col items-center justify-center gap-3 group"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-50 group-hover:bg-indigo-50 flex items-center justify-center overflow-hidden transition-colors duration-300">
                <img
                  src={integration.logo}
                  alt={integration.name}
                  className="w-8 h-8 object-contain opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <span className="text-slate-500 group-hover:text-slate-800 font-bold text-xs transition-colors duration-300">
                {integration.name}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats Banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-xl group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600" />
            <div className="absolute inset-0 opacity-[0.08]" style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
            }} />
            <div className="relative py-16 px-8 text-center text-white">
              <motion.p
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 15 }}
                className="text-5xl sm:text-6xl font-black mb-3 tracking-tight"
              >
                2,000+
              </motion.p>
              <p className="text-lg font-semibold opacity-90">Apps & Integrations</p>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8 text-sm text-slate-500 font-medium"
        >
          And <span className="font-bold text-slate-700">2,000+ more</span> through automation platforms
        </motion.p>
      </div>
    </section>
  );
}
