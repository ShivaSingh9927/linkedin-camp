'use client';

import { X, Check } from "lucide-react";
import { motion } from "framer-motion";

const oldWay = [
  "Scraping lead databases already outdated",
  "Spending hours setting up tools",
  "Complicated workflows for big teams",
  "Forgetting follow-ups constantly",
  "Losing conversations in messy inbox",
  "Generic templates that prospects ignore",
  "5-8% reply rate — most messages go unanswered",
];

const newWay = [
  "Prospect directly on LinkedIn, always fresh",
  "Launch outreach in minutes with templates",
  "One simple flow, no tech to manage",
  "Auto follow-ups that turn silence to replies",
  "One inbox for every conversation",
  "Aigeon crafts unique messages referencing actual posts and activity",
  "25-40% reply rate — every message feels personal",
];

export function OldVsNew() {
  return (
    <section className="py-24 lg:py-32 bg-gradient-to-br from-purple-50 to-indigo-50 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            {"Outreach shouldn't feel like a "}
            <span className="text-primary">second job</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            From "ugh" to "done" in 10 minutes.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Old Way */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <X className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-xl font-black text-slate-900">The Old Way</h3>
              </div>
              <ul className="space-y-4">
                {oldWay.map((item) => (
                  <li key={item} className="flex items-start space-x-3">
                    <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* New Way */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-white rounded-3xl p-8 border-2 border-primary/30 shadow-lg shadow-primary/10 relative">
              <div className="absolute -top-3 right-6 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                Qampi Way
              </div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Check className="w-5 h-5 text-emerald-500" />
                </div>
                <h3 className="text-xl font-black text-slate-900">The Qampi Way</h3>
              </div>
              <ul className="space-y-4">
                {newWay.map((item) => (
                  <li key={item} className="flex items-start space-x-3">
                    <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
