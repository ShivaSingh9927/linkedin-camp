'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Sparkles, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Categorised FAQ Data
const categories = {
  general: "General",
  safety: "Account Safety",
  features: "Features & Models",
};

const faqData = {
  general: [
    {
      question: "What is Qampi?",
      answer: "Qampi is an AI-powered LinkedIn outreach and B2B prospecting platform. It researches every prospect's profile, recent posts, and company activity to craft highly personalized messages that sound genuinely like you. It's designed to automate outreach while maintaining authentic human relationships.",
    },
    {
      question: "Do I need a LinkedIn Sales Navigator account?",
      answer: "No, you don't. Qampi works perfectly with standard LinkedIn accounts. However, if you do use Sales Navigator, Qampi can leverage it to import search lists, target accounts, and coordinate advanced outreach campaigns.",
    },
    {
      question: "Can I cancel my subscription at any time?",
      answer: "Absolutely. You can upgrade, downgrade, or cancel your Qampi subscription at any time directly from your billing settings. There are no long-term contracts, hidden fees, or cancellation penalties.",
    },
  ],
  safety: [
    {
      question: "Is it safe to use Qampi for LinkedIn outreach?",
      answer: "Yes, safety is our primary focus. Qampi creates messages that sound natural because they are fine-tuned on your actual writing style. Combined with dedicated proxies, human-like sending patterns, randomized delays, working-hours sending, and automatic limit monitoring, Qampi is built to keep your account safe.",
    },
    {
      question: "How does Qampi stay within LinkedIn limits?",
      answer: "Qampi replicates manual browsing behaviors. It spaces out actions (visits, connections, messages) with random intervals, schedules send windows, and monitors weekly invitation thresholds. Qampi automatically pauses your campaigns before reaching any risk limits.",
    },
  ],
  features: [
    {
      question: "What's the difference between Qampi Fast and Qampi Pro?",
      answer: "Qampi Fast (free tier) uses our optimized model for quick, profile-based personalization. Qampi Pro (paid tiers) utilizes our largest reasoning models to execute deep web research on company news, intent signals, and shared connections for advanced, multi-layered message scripting.",
    },
    {
      question: "How does the AI learn my writing style?",
      answer: "By uploading a few samples of your own writing—past emails, LinkedIn messages, or articles. Qampi's AI voice engine extracts your tone, formatting preferences, vocabulary, and typical phrasing. The generated messages match your style perfectly, ensuring your prospects get a genuine response.",
    },
    {
      question: "Can I sync Qampi with my CRM?",
      answer: "Yes. Qampi integrates natively with HubSpot, Pipedrive, and Notion — sync leads, statuses, and conversation history in one click. Support for 2,000+ more tools via Zapier and Make is coming soon.",
    },
  ],
};

export function FAQSection() {
  const categoryKeys = Object.keys(categories) as Array<keyof typeof categories>;
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof categories>(categoryKeys[0]);

  return (
    <section 
      id="faq"
      className="relative overflow-hidden bg-purple-50/30 px-4 py-24 lg:py-32 text-slate-800"
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-bold mb-4 border border-indigo-100"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Frequently Asked Questions
          </motion.span>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-none mb-4"
          >
            Got questions? We've got{" "}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">answers</span>
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-2 text-lg text-slate-500 max-w-xl mx-auto font-medium"
          >
            Everything you need to know about Qampi AI outreach, security, and features.
          </motion.p>
        </div>

        {/* Categories Tab Selector */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 mb-16 bg-white p-2 rounded-[1.5rem] border border-slate-200 shadow-sm max-w-fit mx-auto">
          {Object.entries(categories).map(([key, label]) => {
            const isSelected = selectedCategory === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key as keyof typeof categories)}
                className={cn(
                  "relative overflow-hidden whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-300",
                  isSelected
                    ? "text-white"
                    : "text-slate-500 hover:text-slate-800 bg-transparent"
                )}
              >
                <span className="relative z-10">{label}</span>
                {isSelected && (
                  <motion.span
                    layoutId="activeFaqTab"
                    className="absolute inset-0 z-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-md shadow-indigo-500/20"
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* FAQs List */}
        <div className="mx-auto max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedCategory}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="space-y-4"
            >
              {faqData[selectedCategory].map((faq, index) => (
                <FAQItem key={index} {...faq} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </section>
  );
}

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      layout="position"
      className={cn(
        "rounded-[2rem] border transition-all duration-300 overflow-hidden bg-white",
        isOpen 
          ? "border-indigo-200/80 shadow-lg shadow-indigo-500/5 bg-gradient-to-b from-white to-slate-50/20" 
          : "border-slate-200/70 shadow-sm hover:border-slate-300 hover:shadow-md"
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-6 p-6 text-left"
      >
        <span
          className={cn(
            "text-base sm:text-lg font-bold transition-colors duration-300",
            isOpen ? "text-indigo-600" : "text-slate-800"
          )}
        >
          {question}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 135 : 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 border",
            isOpen 
              ? "bg-indigo-50 border-indigo-200/50 text-indigo-600" 
              : "bg-slate-50 border-slate-200 text-slate-400 group-hover:text-slate-600"
          )}
        >
          <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ 
              height: "auto", 
              opacity: 1,
              transition: { height: { duration: 0.35 }, opacity: { duration: 0.25, delay: 0.05 } } 
            }}
            exit={{ 
              height: 0, 
              opacity: 0,
              transition: { height: { duration: 0.3 }, opacity: { duration: 0.2 } } 
            }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-1 text-slate-500 text-sm sm:text-base leading-relaxed border-t border-slate-100/50">
              <p>{answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
