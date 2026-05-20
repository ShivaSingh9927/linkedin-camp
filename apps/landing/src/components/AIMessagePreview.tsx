'use client';

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Check, Sparkles, ArrowRight } from "lucide-react";
import { GlowButton } from "./GlowButton";

const genericMessage = `Hi John,

I noticed your profile and thought we could connect. We offer a great tool that might help your team grow.

Would you be open to a quick 15-minute call next week?

Best,
Alex`;

const aiMessage = `Hey John,

Saw your post about scaling the engineering team at Acme — congrats on the Series B!

We just helped a similar SaaS founder cut their hiring cycle by 40% using automated LinkedIn outreach. Would love to share what worked for them.

No pitch, just insights. Open to a quick chat?

Cheers,
Alex`;

function TypingEffect({ text, speed = 30, startDelay = 0 }: { text: string; speed?: number; startDelay?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const delayTimer = setTimeout(() => setStarted(true), startDelay);
    return () => clearTimeout(delayTimer);
  }, [startDelay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, started]);

  return <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{displayed}{started && displayed.length < text.length && <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5" />}</pre>;
}

export function AIMessagePreview() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="py-24 lg:py-32 bg-gradient-to-br from-slate-50 via-white to-purple-50/50 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-100/30 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <Sparkles className="w-4 h-4" />
            Aigeon AI
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            The difference between{" "}
            <span className="text-red-500">"Hi [Name]"</span>
            {" "}and{" "}
            <span className="text-primary">"Hey Sarah, loved your post about..."</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-3xl mx-auto">
            See how Aigeon, our fine-tuned AI, transforms a generic message into one that gets replies.
          </p>
        </motion.div>

        {/* Side-by-side comparison */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Generic Message */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-white rounded-3xl border-2 border-red-100 shadow-sm overflow-hidden h-full">
              {/* Header */}
              <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <X className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Generic Template</p>
                    <p className="text-xs text-slate-500">What everyone else sends</p>
                  </div>
                </div>
                <div className="bg-red-100 text-red-600 text-xs font-bold px-3 py-1 rounded-full">
                  ~5% reply rate
                </div>
              </div>

              {/* Message body */}
              <div className="p-6">
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-slate-200 rounded-full" />
                    <div>
                      <p className="text-sm font-bold text-slate-700">To: John Smith</p>
                      <p className="text-xs text-slate-400">VP Engineering at Acme Corp</p>
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-wrap">{genericMessage}</p>
                </div>

                {/* Why it fails */}
                <div className="mt-4 space-y-2">
                  {["No personalization", "Feels like spam", "Easy to ignore"].map((reason) => (
                    <div key={reason} className="flex items-center gap-2 text-sm text-red-500">
                      <X className="w-4 h-4 flex-shrink-0" />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* AI Message */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-white rounded-3xl border-2 border-primary/30 shadow-lg shadow-primary/10 overflow-hidden h-full relative">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-indigo-50/50 pointer-events-none" />

              {/* Header */}
              <div className="bg-gradient-to-r from-primary/10 to-indigo-50/50 px-6 py-4 border-b border-primary/20 flex items-center justify-between relative">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Aigeon AI</p>
                    <p className="text-xs text-slate-500">Fine-tuned to your voice</p>
                  </div>
                </div>
                <div className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
                  ~34% reply rate
                </div>
              </div>

              {/* Message body */}
              <div className="p-6 relative">
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-5 border border-primary/20">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      A
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">To: John Smith</p>
                      <p className="text-xs text-slate-400">VP Engineering at Acme Corp</p>
                    </div>
                  </div>
                  {isVisible ? (
                    <TypingEffect text={aiMessage} speed={25} startDelay={800} />
                  ) : (
                    <p className="text-slate-400 text-sm">Generating...</p>
                  )}
                </div>

                {/* AI Analysis */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 2 }}
                  className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-100"
                >
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Aigeon analyzed:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Recent post about hiring",
                      "Acme's Series B funding",
                      "Your SaaS case study",
                      "Casual, data-driven tone",
                    ].map((signal) => (
                      <span key={signal} className="bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                        {signal}
                      </span>
                    ))}
                  </div>
                </motion.div>

                {/* Why it works */}
                <div className="mt-4 space-y-2">
                  {["References their actual activity", "Personal & conversational", "Clear value, no pressure"].map((reason) => (
                    <div key={reason} className="flex items-center gap-2 text-sm text-emerald-600">
                      <Check className="w-4 h-4 flex-shrink-0" />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-3 bg-white rounded-2xl px-6 py-4 border border-slate-200 shadow-sm">
            <div>
              <p className="text-sm font-bold text-slate-900">Free users get 25 Aigeon messages/week</p>
              <p className="text-xs text-slate-500">No credit card required</p>
            </div>
            <GlowButton size="sm" href="https://app.qampi.com/register">
              Try it free
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </GlowButton>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
