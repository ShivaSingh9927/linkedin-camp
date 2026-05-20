'use client';

import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { GlowButton } from "./GlowButton";

export function CTASection() {
  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&h=1080&auto=format&fit=crop&q=80')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-indigo-600/95 to-purple-700/95" />

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.05]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 bg-white/10 text-white px-4 py-1.5 rounded-full text-sm font-bold mb-6 backdrop-blur-sm border border-white/20">
            <Sparkles className="w-4 h-4" />
            Powered by Aigeon AI
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Ready to 3x your LinkedIn reply rate?
          </h2>

          <p className="mt-6 text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
            Join 3,000+ founders and sales teams using Aigeon AI to turn cold outreach into warm conversations. Start free with 25 AI messages/week — no credit card required.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <GlowButton
              size="lg"
              href="https://app.qampi.com/register"
              className="bg-white text-primary hover:bg-white/90 border-white"
            >
              Start Free — 25 AI messages/week
              <ArrowRight className="w-5 h-5 ml-2" />
            </GlowButton>
            <a
              href="#pricing"
              className="text-white/70 hover:text-white font-medium text-sm transition-colors underline underline-offset-4"
            >
              See all pricing plans
            </a>
          </div>

          <div className="mt-8 flex items-center justify-center space-x-6 text-sm text-white/60">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              <span>No credit card</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
