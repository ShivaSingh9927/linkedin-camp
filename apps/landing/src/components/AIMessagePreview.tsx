'use client';

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { X, Check, Sparkles, ArrowRight, Zap, ShieldCheck, Send } from "lucide-react";

const genericMessage = `Hi Sarah,

I noticed your profile and thought we could connect. We offer a great tool that might help your team grow.

Would you be open to a quick 15-minute call next week?

Best,
Alex`;

const aiMessage = `Hey Sarah, loved your post about doubling the SDR team — and your point that hiring well is the hardest part of scaling sales.

When a team doubles, the forecast usually gets noisier before it gets better. We help sales leaders spot slipping deals about two weeks earlier.

Worth a 15-minute look?

Alex`;

/* ═══════════════════════════════════════════════════════════
   TYPING EFFECT — Character-by-character reveal with cursor
   ═══════════════════════════════════════════════════════════ */
function TypingEffect({ text, speed = 30, startDelay = 0, onComplete }: { text: string; speed?: number; startDelay?: number; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

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
        setDone(true);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, started, onComplete]);

  return (
    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
      {displayed}
      {started && !done && (
        <motion.span
          className="inline-block w-0.5 h-4 bg-[#225aea] ml-0.5 rounded-full"
          animate={{ opacity: [1, 0] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
        />
      )}
    </pre>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export function AIMessagePreview() {
  const [isVisible, setIsVisible] = useState(false);
  const [typingDone, setTypingDone] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => setIsVisible(true), 300);
      return () => clearTimeout(timer);
    }
  }, [isInView]);

  return (
    <section
      ref={sectionRef}
      className="section relative overflow-hidden"
    >

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        
        {/* ═══════════════════════════════
            HEADER
            ═══════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-14 max-w-3xl"
        >
          <span className="eyebrow">Why it gets replies</span>
          <h2 className="section-title mt-3">
            Not <span className="text-slate-400 line-through decoration-slate-400/70 decoration-[3px]">&ldquo;Hi&nbsp;[Name]&rdquo;</span>.
            <br />
            <span className="accent">&ldquo;Hey Sarah, loved your post…&rdquo;</span>
          </h2>
          <p className="section-lead mt-5">
            Same prospect, same goal. One message reads like a template; the other reads like you
            spent ten minutes on her profile. Qampi writes the second kind, for every lead.
          </p>
        </motion.div>

        {/* ═══════════════════════════════
            COMPARISON CARDS
            ═══════════════════════════════ */}
        <div className="relative grid lg:grid-cols-2 gap-8 lg:gap-10 items-stretch">

          {/* ── Center VS Badge (desktop only) ── */}
          <motion.div
            className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 z-30 hidden lg:flex"
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8, type: "spring", stiffness: 300 }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-400 to-purple-500 rounded-full blur-xl opacity-40 animate-pulse" />
              <div className="relative w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-900 font-black text-xl shadow-2xl border-[6px] border-slate-50">
                VS
              </div>
            </div>
          </motion.div>

          {/* ═══════════════════════════════
              GENERIC MESSAGE CARD (Left)
              ═══════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative group"
          >
            <div className="relative bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden h-full group-hover:border-slate-300 transition-colors duration-300">
              
              {/* Card Header */}
              <div className="bg-slate-50 px-6 py-5 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                      <X className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-base">Generic Template</p>
                      <p className="text-xs text-slate-500 font-medium">What everyone else sends</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message Body */}
              <div className="relative p-6 sm:p-8">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                  {/* Recipient header */}
                  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200">
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-slate-500">SM</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">To: Sarah Mitchell</p>
                      <p className="text-[11px] text-slate-500 font-medium">VP of Sales at Brightloop</p>
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-wrap">{genericMessage}</p>
                </div>

                {/* Why it fails */}
                <motion.div
                  className="mt-6 space-y-3"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                >
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Why it fails</p>
                  {[
                    { text: "No personalization", detail: "Could be sent to anyone" },
                    { text: "Feels like spam", detail: "Templated & salesy" },
                    { text: "Easy to ignore", detail: "No compelling hook" },
                  ].map((reason) => (
                    <div key={reason.text} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                        <X className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-600">{reason.text}</span>
                        <span className="text-xs text-slate-400 ml-2 font-medium">— {reason.detail}</span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* ═══════════════════════════════
              AI MESSAGE CARD (Right)
              ═══════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            className="relative"
          >
            {/* Outer glow */}
            <div className="absolute -inset-2 bg-gradient-to-br from-violet-500/20 via-violet-500/10 to-purple-500/20 rounded-[2rem] blur-2xl opacity-70" />
            
            <div className="relative bg-white rounded-3xl border border-violet-200 shadow-2xl overflow-hidden h-full">
              {/* Premium gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.03] via-transparent to-purple-500/[0.03] pointer-events-none" />

              {/* Card Header */}
              <div className="relative bg-gradient-to-r from-violet-50/80 via-violet-50/50 to-purple-50/50 px-6 py-5 border-b border-violet-100/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/10 border border-violet-100">
                      <img src="/logo.png" alt="Qampi Logo" className="w-6 h-6 object-contain" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800 text-base">Qampi AI</p>
                        <motion.span
                          className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                          animate={{ scale: [1, 1.4, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Written in your voice</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message Body */}
              <div className="relative p-6 sm:p-8">
                <div className="bg-gradient-to-br from-violet-50/50 to-violet-50/30 rounded-2xl p-6 border border-violet-100 relative overflow-hidden">
                  {/* Shimmer effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear", repeatDelay: 4 }}
                  />
                  
                  {/* Recipient header */}
                  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-violet-200/50 relative">
                    <div className="w-10 h-10 bg-violet-600 rounded-full flex items-center justify-center shadow-md">
                      <img src="/logo.png" alt="Qampi" className="w-5 h-5 filter brightness-0 invert opacity-90" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">To: Sarah Mitchell</p>
                      <p className="text-[11px] text-slate-500 font-medium">VP of Sales at Brightloop</p>
                    </div>
                    <div className="ml-auto">
                      <motion.div
                        className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-100 shadow-sm"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={typingDone ? { opacity: 1, scale: 1 } : {}}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <Send className="w-3 h-3" />
                        Sent
                      </motion.div>
                    </div>
                  </div>
                  
                  {isVisible ? (
                    <TypingEffect text={aiMessage} speed={12} startDelay={600} onComplete={() => setTypingDone(true)} />
                  ) : (
                    <div className="flex items-center gap-2 text-violet-600 text-sm font-medium">
                      <motion.div
                        className="flex gap-1"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-600/60" />
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-600/60" />
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-600/60" />
                      </motion.div>
                      Generating...
                    </div>
                  )}
                </div>

                {/* AI Analysis Signals */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.5, duration: 0.6 }}
                  className="mt-6"
                >
                  <div className="bg-gradient-to-r from-violet-50/50 to-violet-50/30 rounded-2xl p-4 border border-violet-100/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <p className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Qampi analyzed</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "Recent post about hiring", icon: "📝" },
                        { label: "Team just doubled", icon: "📈" },
                        { label: "Pain: noisy forecast", icon: "🎯" },
                        { label: "Casual, data-driven tone", icon: "🎨" },
                      ].map((signal, i) => (
                        <motion.span
                          key={signal.label}
                          className="bg-white text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1.5"
                          initial={{ opacity: 0, y: 5 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 1.8 + i * 0.1 }}
                        >
                          <span>{signal.icon}</span>
                          {signal.label}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Why it works */}
                <motion.div
                  className="mt-6 space-y-3"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1 }}
                >
                  <p className="text-[11px] font-bold text-violet-600 uppercase tracking-widest mb-4">Why it works</p>
                  {[
                    { text: "References their actual activity", detail: "Builds instant rapport" },
                    { text: "Personal & conversational", detail: "Feels human-written" },
                    { text: "Clear value, no pressure", detail: "Earns the reply" },
                  ].map((reason) => (
                    <div key={reason.text} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-800">{reason.text}</span>
                        <span className="text-xs text-slate-500 ml-2 font-medium">— {reason.detail}</span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ═══════════════════════════════
            METRICS BAR
            ═══════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="mt-20 max-w-5xl mx-auto"
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 sm:p-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {[
                { icon: <Sparkles className="w-6 h-6" />, value: "4", label: "Inputs read before every message", color: "text-primary", bg: "bg-violet-50", border: "border-violet-100" },
                { icon: <Zap className="w-6 h-6" />, value: "18 / day", label: "Invite ceiling per account", color: "text-primary", bg: "bg-violet-50", border: "border-violet-100" },
                { icon: <ShieldCheck className="w-6 h-6" />, value: "1 : 1", label: "Dedicated proxy per LinkedIn account", color: "text-primary", bg: "bg-violet-50", border: "border-violet-100" },
              ].map((metric, i) => (
                <motion.div
                  key={metric.label}
                  className="text-center pt-8 md:pt-0 first:pt-0"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7 + i * 0.15 }}
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 shadow-sm ${metric.bg} ${metric.border} border`}>
                    <div className={metric.color}>{metric.icon}</div>
                  </div>
                  <div className="text-3xl md:text-4xl font-semibold text-slate-900 mb-2 tracking-tight tabular-nums">{metric.value}</div>
                  <div className="text-sm text-slate-500 font-medium">{metric.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
