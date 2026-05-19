'use client';

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "What is Qampi?",
    answer: "Qampi is a LinkedIn automation tool that helps you find prospects, send personalized messages, and auto follow-up until they reply. It's designed to be safe, human-like, and incredibly easy to use.",
  },
  {
    question: "Is Qampi safe to use with LinkedIn?",
    answer: "Absolutely. Qampi uses human-like behavior patterns, randomized delays, and stays well within LinkedIn's limits. We also automatically pause if we detect any unusual activity to keep your account safe.",
  },
  {
    question: "How fast can I see results?",
    answer: "Most users see their first replies within the first week. Our average user gets a 25-40% reply rate, which is significantly higher than manual outreach.",
  },
  {
    question: "Do I need a LinkedIn Sales Navigator subscription?",
    answer: "No, Qampi works with a free LinkedIn account. However, Sales Navigator gives you access to more advanced search filters, which can help you find better prospects.",
  },
  {
    question: "Can I use Qampi for my team?",
    answer: "Yes! Qampi offers team plans with shared lead lists, coordinated outreach, and team dashboards. You can avoid duplicate messaging and collaborate effectively.",
  },
  {
    question: "How much does Qampi cost?",
    answer: "We offer a 14-day free trial with full access. After that, plans start at $49/month. Check our pricing page for detailed plan comparisons.",
  },
  {
    question: "Can I integrate Qampi with my CRM?",
    answer: "Yes, Qampi integrates with HubSpot, Pipedrive, Salesforce, and 2,000+ apps through Zapier, Make, and n8n. You can also export all data as CSV.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 lg:py-32 bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            FAQ
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            Frequently Asked{" "}
            <span className="text-primary">Questions</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            You have questions, we have answers.
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="font-bold text-slate-900 pr-4">{faq.question}</span>
                <motion.div
                  animate={{ rotate: openIndex === i ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                </motion.div>
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
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
