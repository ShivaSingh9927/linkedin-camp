'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Categorised FAQ Data
const categories = {
  general: "General",
  safety: "Account Safety",
  features: "Features",
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
      answer: "Yes, safety is our primary focus. Qampi creates messages that sound natural because they're written in your own voice, learned from samples of your writing. Combined with dedicated proxies, human-like sending patterns, randomized delays, working-hours sending, and automatic limit monitoring, Qampi is built to keep your account safe.",
    },
    {
      question: "How does Qampi stay within LinkedIn limits?",
      answer: "Qampi replicates manual browsing behaviors. It spaces out actions (visits, connections, messages) with random intervals, schedules send windows, and monitors weekly invitation thresholds. Qampi automatically pauses your campaigns before reaching any risk limits.",
    },
  ],
  features: [
    {
      question: "Which email accounts can I send from?",
      answer: "Connect Gmail or Outlook in one click, or any other mailbox over SMTP. Qampi's built-in email finder looks up and verifies a prospect's work address first, so your cold emails go to real inboxes.",
    },
    {
      question: "How does the AI learn my writing style?",
      answer: "By uploading a few samples of your own writing—past emails, LinkedIn messages, or articles. Qampi's AI voice engine extracts your tone, formatting preferences, vocabulary, and typical phrasing. The generated messages match your style perfectly, ensuring your prospects get a genuine response.",
    },
    {
      question: "Can I sync Qampi with my CRM?",
      answer: "Yes. Qampi integrates natively with HubSpot, Pipedrive, and Notion — sync leads, statuses, and conversation history in one click. On Pro and Business, the public API and webhooks connect Qampi to Zapier, Make, n8n, or your own tools.",
    },
  ],
};

export function FAQSection() {
  const categoryKeys = Object.keys(categories) as Array<keyof typeof categories>;
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof categories>(categoryKeys[0]);

  // FAQPage structured data across ALL categories. The visible answers are
  // conditionally rendered (collapsed = not in the DOM), so this JSON-LD is the
  // only machine-readable copy of the Q&A — it powers AI-search citations
  // (ChatGPT/Perplexity/AI Overviews) and semantic understanding of the page.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: categoryKeys.flatMap((k) =>
      faqData[k].map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    ),
  };

  return (
    <section id="faq" className="section relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
        {/* Header — sticks beside the questions on wide screens */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <span className="eyebrow">FAQ</span>
            <h2 className="section-title mt-3">Questions, answered</h2>
            <p className="section-lead mt-5">
              Still unsure? Start on the free plan — it runs the whole loop, no card needed.
            </p>
          </div>
        </div>

        <div className="lg:col-span-8">
          {/* Category tabs */}
          <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="FAQ topics">
            {Object.entries(categories).map(([key, label]) => {
              const isSelected = selectedCategory === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedCategory(key as keyof typeof categories)}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors duration-200",
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedCategory}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="divide-y divide-slate-200 border-y border-slate-200"
            >
              {faqData[selectedCategory].map((faq) => (
                <FAQItem key={faq.question} {...faq} />
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
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="group flex w-full items-center justify-between gap-6 py-5 text-left"
      >
        <span
          className={cn(
            "text-base font-semibold transition-colors duration-200 sm:text-lg",
            isOpen ? "text-primary" : "text-slate-900 group-hover:text-primary"
          )}
        >
          {question}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex h-7 w-7 shrink-0 items-center justify-center text-slate-400"
        >
          <Plus className="h-5 w-5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="max-w-2xl pb-6 text-[15px] leading-relaxed text-slate-600">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
