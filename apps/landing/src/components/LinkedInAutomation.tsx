'use client';

import { Users, UserPlus, MessageCircle, Sparkles, ArrowRight } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

// Reusable animated count-up component
function Counter({ value, duration = 1.5 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const end = value;
    if (start === end) return;

    const totalMiliseconds = duration * 1000;
    const incrementTime = 30; // ~33 fps
    const totalSteps = totalMiliseconds / incrementTime;
    const increment = (end - start) / totalSteps;

    let current = start;
    const timer = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [value, duration, isInView]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

export function LinkedInAutomation() {
  return (
    <section id="linkedin" className="py-24 lg:py-32 bg-transparent overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          
          {/* Left Content Column */}
          <div className="w-full lg:w-1/2 text-left">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-primary text-xs font-bold uppercase tracking-wider mb-6 border border-blue-100/50 shadow-sm"
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
              className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 mb-6 tracking-tight leading-[1.05]"
            >
              Scale your presence <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                without the manual grind
              </span>
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-slate-500 mb-10 leading-relaxed font-medium"
            >
              Qampi automates the repetitive LinkedIn tasks that normally take hours, letting you focus on real human interaction and closing deals.
            </motion.p>
            
            {/* Feature List */}
            <div className="space-y-4">
              {[
                {
                  icon: Users,
                  title: "Auto-Visits & Follows",
                  desc: 'Trigger "profile viewed" notifications naturally to increase curiosity and connection acceptance rates.',
                  color: "bg-blue-100 text-blue-600 border-blue-200/50 hover:bg-blue-50/70"
                },
                {
                  icon: UserPlus,
                  title: "Personalized Connection Requests",
                  desc: 'Send hundreds of requests per week with custom variables like "Hi {{firstName}}..." instantly.',
                  color: "bg-indigo-100 text-indigo-600 border-indigo-200/50 hover:bg-indigo-50/70"
                },
                {
                  icon: MessageCircle,
                  title: "Scheduled Auto-Messaging",
                  desc: "Automatically sequence follow-ups once a prospect accepts to keep the sales momentum high.",
                  color: "bg-purple-100 text-purple-600 border-purple-200/50 hover:bg-purple-50/70"
                }
              ].map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 * idx }}
                    className="flex gap-5 p-5 rounded-2xl border border-slate-200/60 bg-white hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 group cursor-default"
                  >
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:rotate-6", feature.color.split(" ")[0], feature.color.split(" ")[1])}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold mb-1 text-slate-800 transition-colors duration-300 group-hover:text-indigo-600">{feature.title}</h4>
                      <p className="text-slate-500 text-sm leading-relaxed font-medium">{feature.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
          
          {/* Right Visual Stats Column */}
          <div className="w-full lg:w-1/2 relative">
            
            {/* ── Mascot Sticker: Flying Bird ── */}
            <motion.div
              className="absolute -top-12 -left-8 md:-left-12 w-16 h-16 z-30 pointer-events-none mix-blend-plus-lighter opacity-90 hidden md:block"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            >
              <motion.img
                src="/stickers/bird_flying.png"
                alt="Flying Bird Mascot"
                className="w-full h-full object-contain"
                animate={{ y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
              />
            </motion.div>

            {/* Glowing background aura */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-[3rem] blur-3xl opacity-10 pointer-events-none" />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="bg-slate-900 rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden shadow-2xl border border-slate-800 backdrop-blur-sm"
            >
              {/* Giant Faint LinkedIn Logo in Background */}
              <div className="absolute top-0 right-0 p-8 text-white/5 pointer-events-none">
                <svg className="w-[12rem] h-[12rem] fill-current" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/>
                </svg>
              </div>

              <div className="relative z-10 text-left">
                <div className="flex items-center justify-between mb-8">
                  <span className="text-blue-400 font-bold uppercase tracking-widest text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Weekly Performance
                  </span>
                  <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-black tracking-wide">+320% Growth</div>
                </div>

                <div className="space-y-4">
                  {/* Connection Requests */}
                  <div className="bg-white/[0.03] hover:bg-white/[0.06] rounded-2xl p-5 border border-white/5 transition-all duration-300 group shadow-lg">
                    <p className="text-white/60 text-xs mb-1 font-bold uppercase tracking-wider">Connection Requests Sent</p>
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-3xl text-white font-black tracking-tight">
                        <Counter value={842} />
                      </h3>
                      <span className="text-emerald-400 text-xs font-bold">94% Accepted</span>
                    </div>
                  </div>

                  {/* Profile Visits */}
                  <div className="bg-white/[0.03] hover:bg-white/[0.06] rounded-2xl p-5 border border-white/5 transition-all duration-300 group shadow-lg">
                    <p className="text-white/60 text-xs mb-1 font-bold uppercase tracking-wider">Profile Visits</p>
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-3xl text-white font-black tracking-tight">
                        <Counter value={1420} />
                      </h3>
                      <span className="text-blue-400 text-xs font-bold">120+ / Day</span>
                    </div>
                  </div>

                  {/* Active Auto-Messages */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 shadow-xl shadow-blue-500/10 hover:brightness-110 transition-all duration-300 group">
                    <p className="text-white/80 text-xs mb-1 font-bold uppercase tracking-wider">Active Auto-Messages</p>
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-3xl text-white font-black tracking-tight">
                        <Counter value={458} />
                      </h3>
                      <span className="text-white bg-white/20 px-2 py-0.5 rounded text-[10px] font-black uppercase">Run mode</span>
                    </div>
                  </div>
                </div>

                {/* Animated progress chart representing activity */}
                <div className="mt-8">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                    <span>Campaign Conversion Activity</span>
                    <span>Mon - Sun</span>
                  </div>
                  <div className="flex items-end gap-2 h-20 pt-2 border-t border-white/5">
                    {[35, 55, 40, 75, 50, 85, 95].map((h, i) => (
                      <div key={i} className="flex-1 h-full flex flex-col justify-end">
                        <motion.div
                          className="bg-gradient-to-t from-blue-600 via-indigo-500 to-purple-500 rounded-lg w-full"
                          initial={{ height: 0 }}
                          whileInView={{ height: `${h}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: 0.08 * i, ease: "easeOut" }}
                        />
                      </div>
                    ))}
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
