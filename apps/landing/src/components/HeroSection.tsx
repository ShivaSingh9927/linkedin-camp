'use client';

import { ArrowRight, Zap, Target, Mail, Users } from "lucide-react";
import { motion } from "framer-motion";
import { GlowButton } from "./GlowButton";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const floatingVariants = {
  animate: { y: [-8, 8, -8] },
};

const dashboardVariants = {
  hidden: { opacity: 0, y: 60, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { delay: 0.4 } },
};

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-20 lg:pt-0">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-purple-50/50 to-indigo-50/30" />

      {/* Animated blobs */}
      <motion.div
        className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-200/20 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <motion.div
            className="text-center lg:text-left"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants}>
              <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-bold mb-6">
                <Zap className="w-4 h-4" />
                <span>Now with AI-powered messaging</span>
              </div>
            </motion.div>

            <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-slate-900 tracking-tight leading-[1.1]">
              We make LinkedIn outreach{" "}
              <span className="text-primary relative inline-block">
                easy
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                  <motion.path
                    d="M2 8C50 2 150 2 198 8"
                    stroke="#8b5cf6"
                    strokeWidth="4"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.2, delay: 0.8, ease: "easeInOut" }}
                  />
                </svg>
              </span>
            </motion.h1>

            <motion.p variants={itemVariants} className="mt-6 text-lg sm:text-xl text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Reach 800+ potential buyers every month on LinkedIn. Auto follow-up until prospects reply. No complex setup. No database. No heavy workflows.
            </motion.p>

            <motion.div variants={itemVariants} className="mt-8 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <GlowButton size="lg" href="https://app.qampi.com/register">
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </GlowButton>
              <GlowButton variant="secondary" size="lg" href="#how-it-works">
                See How It Works
              </GlowButton>
            </motion.div>

            <motion.div variants={itemVariants} className="mt-8 flex items-center justify-center lg:justify-start space-x-6 text-sm text-slate-500">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="font-semibold">14-day free trial</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="font-semibold">No credit card</span>
              </div>
            </motion.div>

            {/* Trust badges */}
            <motion.div variants={itemVariants} className="mt-10 flex items-center justify-center lg:justify-start space-x-6">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-200 to-indigo-200 border-2 border-white flex items-center justify-center text-xs font-bold text-primary"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <svg key={i} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  <span className="font-bold text-slate-700">4.8/5</span> from 2,000+ users
                </p>
              </div>
            </motion.div>
          </motion.div>

          {/* Right - Product Preview */}
          <motion.div
            variants={dashboardVariants}
            initial="hidden"
            animate="visible"
            className="relative"
          >
            <div className="relative">
              {/* Main dashboard mockup */}
              <div className="relative bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                {/* Browser chrome */}
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center space-x-2">
                  <div className="flex space-x-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 bg-white rounded-lg px-3 py-1 text-xs text-slate-400 text-center">
                    app.qampi.com/dashboard
                  </div>
                </div>

                {/* Dashboard content */}
                <div className="p-6 space-y-4">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Leads", value: "1,247", icon: Users, color: "text-primary" },
                      { label: "Connected", value: "892", icon: Target, color: "text-emerald-500" },
                      { label: "Replies", value: "234", icon: Mail, color: "text-amber-500" },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-slate-50 rounded-2xl p-4 text-center">
                        <stat.icon className={cn("w-5 h-5 mx-auto mb-2", stat.color)} />
                        <p className="text-xl font-black text-slate-900">{stat.value}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Campaign preview */}
                  <div className="bg-gradient-to-br from-primary to-indigo-600 rounded-2xl p-5 text-white">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider opacity-80">Active Campaign</span>
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    </div>
                    <p className="font-bold text-lg">Tech Founders Outreach</p>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="opacity-80">Progress</span>
                      <span className="font-bold">67%</span>
                    </div>
                    <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full" style={{ width: "67%" }} />
                    </div>
                  </div>

                  {/* Activity feed */}
                  <div className="space-y-2">
                    {[
                      { name: "Sarah Chen", action: "replied to your message", time: "2m ago" },
                      { name: "Mike Johnson", action: "accepted connection", time: "15m ago" },
                      { name: "Emily Davis", action: "viewed your profile", time: "1h ago" },
                    ].map((activity, i) => (
                      <div key={i} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-300 to-indigo-300 flex items-center justify-center text-xs font-bold text-white">
                          {activity.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">
                            {activity.name} <span className="text-slate-400 font-normal">{activity.action}</span>
                          </p>
                        </div>
                        <span className="text-xs text-slate-400">{activity.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <motion.div
                variants={floatingVariants}
                animate="animate"
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-6 -right-6 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-4"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Mail className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">New Reply!</p>
                    <p className="text-[10px] text-slate-400">Just now</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                variants={floatingVariants}
                animate="animate"
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-4"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">+47% Reply Rate</p>
                    <p className="text-[10px] text-slate-400">This week</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
