'use client';

import { motion } from "framer-motion";

export function SocialProof() {
  return (
    <section className="py-20 border-y border-slate-100 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-12"
        >
          Integrates with your entire stack
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.4 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex flex-wrap justify-center items-center gap-12 md:gap-24 grayscale select-none"
        >
          {/* HubSpot */}
          <div className="flex items-center gap-2 hover:opacity-100 transition-opacity duration-300 cursor-default">
            <svg className="w-9 h-9 fill-current text-slate-900" viewBox="0 0 24 24">
              <path d="M18.895 10.378c.883 0 1.6-0.717 1.6-1.6s-.717-1.6-1.6-1.6-1.6.717-1.6 1.6.717 1.6 1.6 1.6zm-13.79 0c.883 0 1.6-0.717 1.6-1.6s-.717-1.6-1.6-1.6-1.6.717-1.6 1.6.717 1.6 1.6 1.6zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.328 14.153l-1.92-1.92c-.37.195-.79.317-1.242.34l-1.12 3.36c1.693-.243 3.197-.935 4.282-1.78zm-6.656 0c1.085.845 2.59 1.537 4.282 1.78l-1.12-3.36c-.452-.023-.872-.145-1.242-.34l-1.92 1.92zM12 13.6c-.883 0-1.6-.717-1.6-1.6s.717-1.6 1.6-1.6 1.6.717 1.6 1.6-.717 1.6-1.6 1.6z"/>
            </svg>
            <span className="font-extrabold text-xl text-slate-900 tracking-tight">HubSpot</span>
          </div>

          {/* Pipedrive */}
          <div className="flex items-center gap-2 hover:opacity-100 transition-opacity duration-300 cursor-default">
            <svg className="w-8 h-8 fill-current text-slate-900" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-4h2v4zm0-6h-2V8h2v2z"/>
            </svg>
            <span className="font-black text-xl text-slate-900 tracking-tight">pipedrive</span>
          </div>

          {/* Notion */}
          <div className="flex items-center gap-2 hover:opacity-100 transition-opacity duration-300 cursor-default">
            <svg className="w-8 h-8 fill-current text-slate-900" viewBox="0 0 24 24">
              <path d="M4.17 2.05C3.33 2.05 3 2.45 3 3.29v17.42c0 .84.33 1.24 1.17 1.24H19.8c.84 0 1.2-.4 1.2-1.24V3.29c0-.84-.36-1.24-1.2-1.24H4.17zm1.96 3.49h11.74v12.92H6.13V5.54zm2.14 2.14v8.64h1.79V9.77l2.84 4.41h1.34V7.68h-1.79v5.91l-2.84-4.41H8.27z"/>
            </svg>
            <span className="font-extrabold text-xl text-slate-900 tracking-tight">Notion</span>
          </div>

          {/* LinkedIn */}
          <div className="flex items-center gap-2 hover:opacity-100 transition-opacity duration-300 cursor-default">
            <svg className="w-8 h-8 fill-current text-slate-900" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            <span className="font-bold text-xl text-slate-900 tracking-tight">LinkedIn</span>
          </div>

          {/* Gmail */}
          <div className="flex items-center gap-2 hover:opacity-100 transition-opacity duration-300 cursor-default">
            <svg className="w-8 h-8 fill-current text-slate-900" viewBox="0 0 24 24">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
            <span className="font-extrabold text-xl text-slate-900 tracking-tight">Gmail</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
