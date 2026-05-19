'use client';

import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { GlowButton } from "./GlowButton";

export function CTASection() {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-indigo-600 to-purple-700" />

      {/* Animated shapes */}
      <motion.div
        className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 10, repeat: Infinity, delay: 2 }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-white tracking-tight leading-tight"
        >
          Start reaching prospects today
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mt-6 text-xl text-white/80 max-w-2xl mx-auto"
        >
          And get your first replies tomorrow. No credit card required.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <GlowButton
            variant="outline"
            size="lg"
            href="https://app.qampi.com/register"
            className="bg-white text-primary border-white hover:bg-white/90 shadow-xl"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5 ml-2" />
          </GlowButton>
          <GlowButton
            variant="outline"
            size="lg"
            href="https://app.qampi.com/demo"
          >
            Book a Demo
          </GlowButton>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex items-center justify-center space-x-6 text-white/60 text-sm"
        >
          <span>14-day free trial</span>
          <span className="w-1 h-1 bg-white/40 rounded-full" />
          <span>No credit card</span>
          <span className="w-1 h-1 bg-white/40 rounded-full" />
          <span>Cancel anytime</span>
        </motion.div>
      </div>
    </section>
  );
}
