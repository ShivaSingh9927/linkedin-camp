'use client';

import { motion } from "framer-motion";

const integrations = [
  "HubSpot", "Pipedrive", "Salesforce", "Zapier", "Make", "n8n", "Slack", "Notion"
];

export function IntegrationsSection() {
  return (
    <section className="py-24 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            Integrations
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            Connected to your{" "}
            <span className="text-primary">stack</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Qampi integrates seamlessly with HubSpot, Pipedrive, and 2,000+ apps through Zapier, Make, and n8n.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-4"
        >
          {integrations.map((integration, i) => (
            <motion.div
              key={integration}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.05 }}
              className="bg-slate-50 rounded-2xl px-8 py-4 border border-slate-100 text-slate-600 font-bold text-lg hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all cursor-default"
            >
              {integration}
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8 text-slate-500"
        >
          And <span className="font-bold text-slate-700">2,000+ more</span> through automation platforms
        </motion.p>
      </div>
    </section>
  );
}
