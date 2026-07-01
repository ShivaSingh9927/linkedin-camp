'use client';

import { motion } from "framer-motion";
import { Linkedin, MessageSquareText, Mail, BarChart3, Settings, ArrowRight } from "lucide-react";
import React from "react";

export function SequencesSection() {
  const steps = [
    {
      id: "01",
      title: "Connection Request",
      desc: "Send an automated, personalized connection request.",
      icon: Linkedin,
      color: "from-blue-500 to-blue-600",
      iconBg: "bg-blue-50",
      textColor: "text-blue-600",
      shadow: "shadow-blue-500/20",
      glow: "group-hover:shadow-[0_10px_40px_-10px_rgba(59,130,246,0.25)]",
      borderColor: "group-hover:border-blue-400/40",
    },
    {
      id: "02",
      title: "AI Message",
      desc: "Wait 2 days then send a highly personalized message using their recent activity.",
      icon: MessageSquareText,
      color: "from-purple-500 to-purple-600",
      iconBg: "bg-purple-50",
      textColor: "text-purple-600",
      shadow: "shadow-purple-500/20",
      glow: "group-hover:shadow-[0_10px_40px_-10px_rgba(168,85,247,0.25)]",
      borderColor: "group-hover:border-purple-400/40",
    },
    {
      id: "03",
      title: "Auto Cold Email",
      desc: "Wait another 3 days. Extract verified email and send cold email sequence.",
      icon: Mail,
      color: "from-pink-500 to-pink-600",
      iconBg: "bg-pink-50",
      textColor: "text-pink-600",
      shadow: "shadow-pink-500/20",
      glow: "group-hover:shadow-[0_10px_40px_-10px_rgba(236,72,153,0.25)]",
      borderColor: "group-hover:border-pink-400/40",
    },
  ];

  return (
    <section id="sequences" className="py-24 lg:py-32 bg-white relative overflow-hidden text-slate-900">
      
      {/* ── Background Elements ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Glows */}
        <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-blue-100/50 rounded-full blur-[120px] -translate-y-1/2" />
        <div className="absolute bottom-0 left-1/4 w-[800px] h-[800px] bg-purple-100/40 rounded-full blur-[120px] translate-y-1/2" />
        
        {/* Subtle Tech Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_40%,transparent_100%)]" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
        
        {/* ═══════════════════════════════
            HEADER
            ═══════════════════════════════ */}
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-widest mb-6 border border-blue-100/80 shadow-sm"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>LinkedIn + Email Workflow Builder</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold mb-6 leading-[1.1]"
          >
            Build Smarter{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
              Outreach Workflows
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed"
          >
            Combine the power of LinkedIn automation and high-deliverability cold email in one unified, intelligent sequence.
          </motion.p>
        </div>

        {/* ═══════════════════════════════
            TIMELINE / WORKFLOW STACK
            ═══════════════════════════════ */}
        <div className="relative">
          
          {/* Animated glowing vertical line behind steps */}
          <div className="absolute top-10 bottom-10 w-1 bg-slate-100 left-8 md:left-1/2 md:-translate-x-1/2 z-0 rounded-full">
            <motion.div 
              className="absolute top-0 left-0 w-full bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              initial={{ height: 0 }}
              whileInView={{ height: "100%" }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 2.5, ease: "easeInOut" }}
            />
          </div>

          <div className="space-y-8 md:space-y-12">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.7, delay: 0.2 + index * 0.2 }}
                className={`group relative flex flex-col md:flex-row items-center gap-6 md:gap-12 w-full ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}
              >
                {/* ── Empty space for the alternating layout on desktop ── */}
                <div className="hidden md:block w-1/2" />

                {/* ── Timeline Node ── */}
                <div className="absolute left-8 md:left-1/2 -translate-x-1/2 flex items-center justify-center z-20">
                  <div className={`w-12 h-12 rounded-full bg-white border-4 border-slate-50 group-hover:border-white shadow-lg flex items-center justify-center transition-colors duration-300 relative`}>
                    {/* Inner glowing dot */}
                    <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${step.color} shadow-md ${step.shadow}`} />
                    
                    {/* Ripple effect on hover */}
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${step.color} opacity-0 group-hover:opacity-20 group-hover:animate-ping`} />
                  </div>
                </div>

                {/* ── Content Card ── */}
                <div className="w-full md:w-1/2 pl-24 md:pl-0 relative">
                  <div className={`bg-white border border-slate-200 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] rounded-2xl p-6 md:p-8 transition-all duration-300 hover:-translate-y-1 ${step.glow} ${step.borderColor} relative overflow-hidden`}>
                    
                    {/* Subtle inner gradient hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                    <div className="flex items-start gap-5 relative z-10">
                      <div className={`w-14 h-14 rounded-xl ${step.iconBg} border border-white/50 flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110`}>
                        <step.icon className={`w-6 h-6 ${step.textColor}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-[10px] font-bold ${step.textColor} ${step.iconBg} px-2.5 py-1 rounded-md uppercase tracking-wider`}>
                            Step {step.id}
                          </span>
                        </div>
                        <h3 className="text-xl font-medium text-slate-900 mb-2 tracking-tight">{step.title}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed font-medium">{step.desc}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* ═══════════════════════════════
                FINAL STEP (HIGHLIGHTED)
                ═══════════════════════════════ */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.7, delay: 1 }}
              className="group relative flex flex-col md:flex-row items-center gap-6 md:gap-12 w-full md:flex-row-reverse mt-12"
            >
              <div className="hidden md:block w-1/2" />

              {/* Timeline Node */}
              <div className="absolute left-8 md:left-1/2 -translate-x-1/2 flex items-center justify-center z-20">
                <div className="w-16 h-16 rounded-full bg-white border-4 border-blue-50 flex items-center justify-center shadow-lg">
                  <div className="w-6 h-6 rounded-full bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.6)] animate-pulse" />
                </div>
              </div>

              <div className="w-full md:w-1/2 pl-24 md:pl-0 relative">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 border border-blue-500 rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2 shadow-[0_10px_40px_-10px_rgba(37,99,235,0.4)] hover:shadow-[0_15px_50px_-10px_rgba(37,99,235,0.5)] relative overflow-hidden text-white">
                  
                  {/* Shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />

                  <div className="flex items-start gap-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 shadow-sm">
                      <BarChart3 className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-bold text-blue-100 bg-black/10 px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm">
                          The Result
                        </span>
                      </div>
                      <h3 className="text-2xl font-medium text-white mb-2 tracking-tight">Success Probability</h3>
                      <p className="text-blue-100 text-sm leading-relaxed font-medium mb-6">
                        Track which steps drive the most replies, so you double down on what books meetings.
                      </p>
                      
                      <div className="flex items-center gap-2 text-blue-700 text-sm font-bold bg-white hover:bg-slate-50 shadow-md hover:shadow-lg transition-all w-max px-5 py-2.5 rounded-full cursor-pointer hover:-translate-y-0.5">
                        View Analytics <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </section>
  );
}
