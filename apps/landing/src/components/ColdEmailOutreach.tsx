'use client';

import { Mail, CheckCircle2, Copy } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export function ColdEmailOutreach() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText("s.jenkins@techflow.io");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="email" className="py-24 bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
          
          {/* Right Content Column (since layout is lg:flex-row-reverse, content is on the right) */}
          <div className="w-full lg:w-1/2">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-primary text-xs font-bold uppercase tracking-wider mb-6"
            >
              <Mail className="w-3.5 h-3.5 text-primary" />
              <span>Cold Email Outreach</span>
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl font-bold text-slate-900 mb-8"
            >
              The Ultimate Email Hunter & Sender
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-slate-500 mb-10 leading-relaxed"
            >
              Qampi isn't just for LinkedIn. Find verified professional emails and launch high-converting cold email sequences directly from the platform.
            </motion.p>
            
            {/* Checklist */}
            <ul className="space-y-4">
              {[
                "Integrated Email Finder for any LinkedIn profile",
                "Multi-step email sequences with smart delays",
                "Direct Gmail, Outlook, and SMTP integration",
                "Real-time open, click, and reply tracking"
              ].map((item, idx) => (
                <motion.li
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 * idx }}
                  className="flex items-center gap-3 text-slate-700 font-semibold"
                >
                  <CheckCircle2 className="text-primary text-xl w-5 h-5 shrink-0" />
                  <span>{item}</span>
                </motion.li>
              ))}
            </ul>
          </div>
          
          {/* Left Mockup Column */}
          <div className="w-full lg:w-1/2">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="bg-white rounded-3xl p-8 border border-slate-200 card-shadow relative overflow-hidden"
            >
              {/* Profile Card Header */}
              <div className="flex items-center gap-4 mb-8">
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150"
                  alt="Sarah Jenkins"
                  className="w-16 h-16 rounded-2xl object-cover"
                />
                <div className="text-left">
                  <h4 className="font-bold text-lg text-slate-900">Sarah Jenkins</h4>
                  <p className="text-slate-400 text-sm">VP of Sales @ TechFlow</p>
                </div>
                <div className="ml-auto bg-blue-50 text-primary px-3 py-1 rounded-lg text-xs font-bold border border-blue-100">
                  Verified
                </div>
              </div>

              <div className="space-y-4">
                {/* Email Address Bar */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500 font-mono text-sm">s.jenkins@techflow.io</span>
                  <button
                    onClick={handleCopy}
                    className="text-slate-400 hover:text-primary transition-colors focus:outline-none"
                    title="Copy email address"
                  >
                    {copied ? (
                      <span className="text-xs font-bold text-primary font-sans">Copied!</span>
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Email Sequence Queue Preview */}
                <div className="bg-slate-900 text-white rounded-2xl p-6 text-left">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></div>
                    <p className="text-xs font-bold text-slate-400 tracking-wider">SEQUENCE STEP 01: COLD EMAIL</p>
                  </div>
                  
                  <p className="text-sm text-slate-300 italic mb-4 leading-relaxed">
                    "Hi Sarah, I saw your post about sales automation and thought you'd love Qampi..."
                  </p>
                  
                  {/* Progress Indicator */}
                  <div className="h-1 bg-slate-800 rounded-full w-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "65%" }}></div>
                  </div>
                  
                  <p className="text-[10px] mt-2.5 text-slate-500 font-bold tracking-wider uppercase">
                    SENDING IN 02:45 MINS
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
