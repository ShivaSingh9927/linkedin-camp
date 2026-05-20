'use client';

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Sparkles } from "lucide-react";

const faqs = [
  {
    question: "What is Aigeon?",
    answer: "Aigeon is Qampi's fine-tuned AI engine that reads every prospect's profile, posts, and activity to craft personalized messages that sound like you. It's not a template spinner — it generates unique messages for every single prospect.",
  },
  {
    question: "What's the difference between Aigeon Fast and Aigeon Pro?",
    answer: "Aigeon Fast (free tier) uses our optimized model for quick, high-quality personalization based on profile data. Aigeon Pro (paid tiers) uses our largest reasoning models that perform deep research, detect intent signals, and craft multi-layered personalized messages. Both are fine-tuned on your writing style.",
  },
  {
    question: "Is it safe to use AI for LinkedIn outreach?",
    answer: "Yes. Aigeon generates messages that sound human because they're fine-tuned on real human writing. Combined with our human-like sending patterns, randomized delays, and LinkedIn limit detection, your account stays safe. We've never had a user banned.",
  },
  {
    question: "How many AI messages do I get on the free plan?",
    answer: "Free users get 25 Aigeon messages per week. That's enough to test the power of AI personalization and see real results. If you need more, you can upgrade to any paid plan at any time.",
  },
  {
    question: "Can I use my own writing style?",
    answer: "Absolutely. Aigeon learns from your writing samples — emails, LinkedIn posts, or messages — and fine-tunes to match your tone, style, and personality. The messages sound like you wrote them, not a robot.",
  },
  {
    question: "Do I need a LinkedIn account to use Qampi?",
    answer: "Yes, Qampi works with your existing LinkedIn account. We automate actions on your behalf while staying within LinkedIn's limits to keep your account safe.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes, you can cancel your subscription at any time with no penalties. Your account will remain active until the end of your billing period.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 lg:py-32 bg-slate-50 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <Sparkles className="w-4 h-4" />
            FAQ
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            Frequently asked{" "}
            <span className="text-primary">questions</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Everything you need to know about Qampi and Aigeon AI.
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <span className="text-lg font-bold text-slate-900 pr-4">{faq.question}</span>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                </motion.div>
              </button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-6 pb-6">
                      <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
