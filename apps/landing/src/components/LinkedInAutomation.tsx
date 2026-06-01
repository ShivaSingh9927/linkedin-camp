'use client';

import { Users, UserPlus, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

export function LinkedInAutomation() {
  return (
    <section id="linkedin" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          
          {/* Left Content Column */}
          <div className="w-full lg:w-1/2">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-primary text-xs font-bold uppercase tracking-wider mb-6"
            >
              {/* LinkedIn SVG Icon */}
              <svg className="w-3.5 h-3.5 fill-current text-primary" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/>
              </svg>
              <span>LinkedIn Automation</span>
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl font-bold text-slate-900 mb-8"
            >
              Scale your presence without the manual grind
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-slate-500 mb-10 leading-relaxed"
            >
              Qampi automates the repetitive LinkedIn tasks that normally take hours, letting you focus on human interaction.
            </motion.p>
            
            {/* Feature List */}
            <div className="space-y-6">
              {[
                {
                  icon: Users,
                  title: "Auto-Visits & Follows",
                  desc: 'Trigger "profile viewed" notifications naturally to increase curiosity and acceptance rates.'
                },
                {
                  icon: UserPlus,
                  title: "Personalized Connection Requests",
                  desc: 'Send hundreds of requests per week with custom notes like "Hi {{firstName}}..." effortlessly.'
                },
                {
                  icon: MessageCircle,
                  title: "Scheduled Auto-Messaging",
                  desc: "Automatically follow up once a prospect accepts, keeping the momentum high."
                }
              ].map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.15 * idx }}
                    className="flex gap-5 p-4 rounded-2xl border border-transparent hover:border-blue-100 hover:bg-blue-50/50 transition-all duration-300"
                  >
                    <div className="w-12 h-12 bg-blue-100 text-primary rounded-xl flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-1 text-slate-900">{feature.title}</h4>
                      <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
          
          {/* Right Visual Stats Column */}
          <div className="w-full lg:w-1/2">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="bg-slate-900 rounded-[2.5rem] p-10 relative overflow-hidden shadow-2xl"
            >
              {/* Giant Faint LinkedIn Logo in Background */}
              <div className="absolute top-0 right-0 p-8 text-white/5 pointer-events-none">
                <svg className="w-[12rem] h-[12rem] fill-current" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/>
                </svg>
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <span className="text-blue-400 font-bold uppercase tracking-widest text-xs">Weekly Stats</span>
                  <div className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-bold">+320% Growth</div>
                </div>

                <div className="space-y-6">
                  {/* Connection Requests */}
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-colors duration-300">
                    <p className="text-white/60 text-sm mb-2 font-medium">Connection Requests Sent</p>
                    <h3 className="text-3xl text-white font-extrabold tracking-tight">842</h3>
                  </div>

                  {/* Profile Visits */}
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-colors duration-300">
                    <p className="text-white/60 text-sm mb-2 font-medium">Profile Visits</p>
                    <h3 className="text-3xl text-white font-extrabold tracking-tight">1,420</h3>
                  </div>

                  {/* Active Auto-Messages */}
                  <div className="bg-primary rounded-2xl p-6 shadow-xl shadow-blue-900/40 hover:bg-primary-light transition-colors duration-300">
                    <p className="text-white/80 text-sm mb-2 font-medium">Active Auto-Messages</p>
                    <h3 className="text-3xl text-white font-extrabold tracking-tight">458</h3>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
