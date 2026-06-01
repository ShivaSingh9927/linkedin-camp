'use client';

import { BarChart3, UploadCloud } from "lucide-react";
import { motion } from "framer-motion";

export function CRMAnalyticsSection() {
  return (
    <section id="crm" className="py-24 bg-slate-900 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          
          {/* Left Content Column */}
          <div className="w-full lg:w-1/2 text-left">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-400 text-xs font-bold uppercase tracking-wider mb-6"
            >
              <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
              <span>CRM & Analytics</span>
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl font-bold mb-8 text-white"
            >
              Decisions powered by real-time data
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-slate-400 mb-10 leading-relaxed"
            >
              Track every lead's status, monitor conversion rates, and push "warm" prospects to your enterprise CRM seamlessly.
            </motion.p>
            
            {/* Avg Rates Row */}
            <div className="grid grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.25 }}
                className="bg-white/5 p-6 rounded-2xl border border-white/10"
              >
                <h5 className="text-3xl text-blue-400 font-extrabold mb-1">24%</h5>
                <p className="text-sm text-slate-500 font-semibold">Avg. Acceptance Rate</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.35 }}
                className="bg-white/5 p-6 rounded-2xl border border-white/10"
              >
                <h5 className="text-3xl text-green-400 font-extrabold mb-1">12%</h5>
                <p className="text-sm text-slate-500 font-semibold">Avg. Reply Rate</p>
              </motion.div>
            </div>
            
            {/* Small Integrations Row */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.5 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-12 flex flex-wrap items-center gap-8 text-white select-none grayscale"
            >
              {/* HubSpot */}
              <div className="flex items-center gap-2 text-sm font-semibold">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.895 10.378c.883 0 1.6-0.717 1.6-1.6s-.717-1.6-1.6-1.6-1.6.717-1.6 1.6.717 1.6 1.6 1.6zm-13.79 0c.883 0 1.6-0.717 1.6-1.6s-.717-1.6-1.6-1.6-1.6.717-1.6 1.6.717 1.6 1.6 1.6zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.328 14.153l-1.92-1.92c-.37.195-.79.317-1.242.34l-1.12 3.36c1.693-.243 3.197-.935 4.282-1.78zm-6.656 0c1.085.845 2.59 1.537 4.282 1.78l-1.12-3.36c-.452-.023-.872-.145-1.242-.34l-1.92 1.92zM12 13.6c-.883 0-1.6-.717-1.6-1.6s.717-1.6 1.6-1.6 1.6.717 1.6 1.6-.717 1.6-1.6 1.6z"/>
                </svg>
                <span>HubSpot</span>
              </div>
              
              {/* Pipedrive */}
              <div className="flex items-center gap-2 text-sm font-semibold">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-4h2v4zm0-6h-2V8h2v2z"/>
                </svg>
                <span>Pipedrive</span>
              </div>
              
              {/* Notion */}
              <div className="flex items-center gap-2 text-sm font-semibold">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M4.17 2.05C3.33 2.05 3 2.45 3 3.29v17.42c0 .84.33 1.24 1.17 1.24H19.8c.84 0 1.2-.4 1.2-1.24V3.29c0-.84-.36-1.24-1.2-1.24H4.17zm1.96 3.49h11.74v12.92H6.13V5.54zm2.14 2.14v8.64h1.79V9.77l2.84 4.41h1.34V7.68h-1.79v5.91l-2.84-4.41H8.27z"/>
                </svg>
                <span>Notion</span>
              </div>
            </motion.div>
          </div>
          
          {/* Right Visual Stats Column */}
          <div className="w-full lg:w-1/2">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="bg-slate-800 rounded-3xl p-8 border border-white/10 shadow-2xl relative text-left"
            >
              <div className="flex justify-between items-center mb-8">
                <h4 className="font-bold text-white text-lg">Active Campaign Stats</h4>
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
              </div>
              
              <div className="space-y-6">
                {/* Pending */}
                <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-white/5 hover:bg-slate-900/70 transition-colors duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-10 bg-blue-500 rounded-full"></div>
                    <div>
                      <p className="font-bold text-white">Pending</p>
                      <p className="text-xs text-slate-500">Sent but not accepted</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-lg">420</span>
                </div>
                
                {/* Connected */}
                <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-white/5 hover:bg-slate-900/70 transition-colors duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-10 bg-yellow-500 rounded-full"></div>
                    <div>
                      <p className="font-bold text-white">Connected</p>
                      <p className="text-xs text-slate-500">Accepted invite</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-lg">185</span>
                </div>
                
                {/* Replied */}
                <div className="flex items-center justify-between p-4 bg-primary/20 rounded-xl border border-primary/30 hover:bg-primary/30 transition-colors duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-10 bg-green-500 rounded-full"></div>
                    <div>
                      <p className="font-bold text-white">Replied</p>
                      <p className="text-xs text-blue-300 font-bold uppercase tracking-wider">READY FOR CRM SYNC</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-white text-lg">42</span>
                </div>
              </div>
              
              {/* Export Button */}
              <button className="w-full mt-8 py-4 bg-primary hover:bg-primary-hover rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20 hover:-translate-y-0.5 active:scale-98">
                <UploadCloud className="w-5 h-5" />
                Export to HubSpot
              </button>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
