'use client';

import { Clock, Mail, StopCircle } from "lucide-react";
import { motion } from "framer-motion";

export function SequencesSection() {
  return (
    <section id="sequences" className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-primary text-xs font-bold uppercase tracking-wider mb-6"
          >
            {/* Git pull request style SVG icon */}
            <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 15V9a4 4 0 0 0-4-4H9" />
              <path d="M6 9v6" />
            </svg>
            <span>Multi-Channel Sequences</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl font-bold mb-6 text-slate-900"
          >
            Build Smarter Outreach Workflows
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-slate-500"
          >
            Combine the power of LinkedIn and Email in one seamless automated flow.
          </motion.p>
        </div>

        {/* Timeline */}
        <div className="relative">
          
          {/* Step 1 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.7 }}
            className="relative pl-24 pb-16 sequence-dot text-left"
          >
            <div className="absolute left-0 top-0 w-16 h-16 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center shadow-sm z-10">
              {/* LinkedIn Blue SVG Icon */}
              <svg className="w-8 h-8 fill-current text-blue-600" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/>
              </svg>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 card-shadow">
              <h4 className="font-bold text-xl mb-2 text-slate-900">01. LinkedIn Connection Request</h4>
              <p className="text-slate-500">Automatically send a personalized invite to your selected prospect list.</p>
            </div>
          </motion.div>

          {/* Step 2 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative pl-24 pb-16 sequence-dot text-left"
          >
            <div className="absolute left-0 top-0 w-16 h-16 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center shadow-sm z-10">
              <Clock className="w-8 h-8 text-slate-400" />
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 card-shadow border-l-4 border-l-yellow-400">
              <h4 className="font-bold text-xl mb-2 text-slate-900">02. Smart Wait & Message</h4>
              <p className="text-slate-500">Wait 2 days after acceptance, then send a value-driven LinkedIn follow-up message.</p>
            </div>
          </motion.div>

          {/* Step 3 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative pl-24 pb-16 sequence-dot text-left"
          >
            <div className="absolute left-0 top-0 w-16 h-16 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center shadow-sm z-10">
              <Mail className="w-8 h-8 text-purple-600 fill-current" />
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 card-shadow border-l-4 border-l-purple-500">
              <h4 className="font-bold text-xl mb-2 text-slate-900">03. Fail-Safe Cold Email</h4>
              <p className="text-slate-500">If no LinkedIn reply after 7 days, automatically scrape their email and send a follow-up.</p>
            </div>
          </motion.div>

          {/* Step 4 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="relative pl-24 text-left"
          >
            <div className="absolute left-0 top-0 w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 z-10">
              <StopCircle className="w-8 h-8 fill-current" />
            </div>
            <div className="bg-primary text-white p-6 rounded-2xl shadow-xl">
              <h4 className="font-bold text-xl mb-2">04. Auto-Stop on Reply</h4>
              <p className="text-blue-100">The sequence stops immediately when a prospect replies so you can take over personally.</p>
            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
