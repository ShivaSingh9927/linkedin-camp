'use client';

import { motion } from "framer-motion";

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

export function IntegrationsSection() {
  return (
    <section className="py-24 lg:py-32 bg-slate-50 relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-100/30 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Mascot Sticker: Integration Bird ── */}
        <motion.div
          className="absolute left-[5%] top-4 md:left-[15%] lg:left-[20%] w-14 md:w-16 z-20 pointer-events-none mix-blend-darken opacity-90 hidden md:block"
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        >
          <motion.img
            src="/stickers/bird_integration.png"
            alt="Integration Bird Mascot"
            className="w-full h-full object-contain"
            animate={{ y: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            Integrations
          </span>
          <h2 className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold text-slate-900">
            Connected to your{" "}
            <span className="text-primary">stack</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Qampi integrates seamlessly with HubSpot, Pipedrive, and 2,000+ apps through Zapier, Make, and n8n.
          </p>
        </motion.div>

        {/* Integration logos grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 max-w-5xl mx-auto mb-12"
        >
          {integrations.map((integration, i) => (
            <motion.div
              key={integration.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.05, y: -4 }}
              className="bg-white rounded-2xl p-6 border border-slate-100 hover:border-primary/30 hover:shadow-lg transition-all cursor-default flex flex-col items-center justify-center gap-3"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden">
                <img
                  src={integration.logo}
                  alt={integration.name}
                  className="w-8 h-8 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <span className="text-slate-600 font-bold text-sm">{integration.name}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Visual connector image */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="max-w-4xl mx-auto"
        >
          <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-xl">
            <img
              src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&h=600&auto=format&fit=crop&q=80"
              alt="Integrations ecosystem"
              className="w-full h-64 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-indigo-600/80 flex items-center justify-center">
              <div className="text-center text-white">
                <p className="text-4xl font-black mb-2">2,000+</p>
                <p className="text-lg font-medium opacity-90">Apps & Integrations</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8 text-slate-500"
        >
          And <span className="font-bold text-slate-700">2,000+ more</span> through automation platforms
        </motion.p>
      </div>
    </section>
  );
}
