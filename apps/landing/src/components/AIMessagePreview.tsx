'use client';

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { X, Check, Sparkles, ArrowRight, Zap, TrendingUp, Send } from "lucide-react";
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
   FLOATING SPARKLE PARTICLES — Ambient floating dots
   ═══════════════════════════════════════════════════════════ */
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 25 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 4 + 2,
            height: Math.random() * 4 + 2,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 3 === 0 
              ? 'rgba(34, 90, 234, 0.4)' // Primary blue
              : i % 3 === 1 
                ? 'rgba(168, 85, 247, 0.3)' // Purple
                : 'rgba(59, 130, 246, 0.2)', // Light blue
          }}
          animate={{
            y: [0, -40 - Math.random() * 50, 0],
            x: [0, Math.random() * 30 - 15, 0],
            opacity: [0, 0.8, 0],
            scale: [0.5, 1.5, 0.5],
          }}
          transition={{
            duration: 5 + Math.random() * 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: Math.random() * 5,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   REPLY RATE METER — Animated circular progress
   ═══════════════════════════════════════════════════════════ */
function ReplyRateMeter({ rate, color, delay = 0 }: { rate: number; color: string; delay?: number }) {
  const circumference = 2 * Math.PI * 18;
  
  return (
    <motion.div 
      className="relative w-12 h-12 flex-shrink-0"
      initial={{ scale: 0, rotate: -90 }}
      whileInView={{ scale: 1, rotate: 0 }}
      viewport={{ once: true }}
      transition={{ delay, type: "spring", stiffness: 200 }}
    >
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-100" />
        <motion.circle
          cx="20" cy="20" r="18" fill="none" stroke={color} strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: circumference - (rate / 100) * circumference }}
          viewport={{ once: true }}
          transition={{ delay: delay + 0.5, duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black" style={{ color }}>
        {rate}%
      </span>
    </motion.div>
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
      className="relative pt-12 pb-20 lg:pt-16 lg:pb-32 overflow-hidden bg-white"
    >
      {/* ── Background Gradients ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-50/60 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-50/60 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3" />
        
        {/* Subtle grid */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,90,234,0.04)_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>

      <FloatingParticles />

      {/* ── Floating Sticker: Bird Cool ── */}
      <motion.div
        className="absolute top-20 right-[10%] w-20 md:w-24 pointer-events-none hidden lg:block"
        initial={{ opacity: 0, y: 20, rotate: -10 }}
        whileInView={{ opacity: 0.9, y: 0, rotate: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
      >
        <motion.img
          src="/stickers/bird_cool_transparent.png"
          alt="Cool Bird"
          className="w-full h-full object-contain filter drop-shadow-xl"
          animate={{ y: [0, -8, 0], rotate: [0, 4, 0] }}
          transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
        />
      </motion.div>

      {/* ── Floating Sticker: Bird Flying ── */}
      <motion.div
        className="absolute bottom-32 left-[8%] w-16 md:w-20 pointer-events-none hidden lg:block"
        initial={{ opacity: 0, x: -30 }}
        whileInView={{ opacity: 0.85, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.8 }}
      >
        <motion.img
          src="/stickers/bird_flying_transparent.png"
          alt="Flying Bird"
          className="w-full h-full object-contain filter drop-shadow-xl"
          animate={{ y: [0, -10, 0], x: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
        />
      </motion.div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        
        {/* ═══════════════════════════════
            HEADER
            ═══════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <motion.div
            className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border border-blue-100 shadow-sm"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <img src="/logo.png" alt="Qampi Logo" className="w-4 h-4 object-contain" />
            Powered by Qampi AI
          </motion.div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.5rem] font-black text-slate-900 tracking-tight leading-[1.15] max-w-5xl mx-auto">
            The difference between{" "}
            <span className="text-slate-300 line-through decoration-red-400/60 decoration-[3px] whitespace-nowrap">&ldquo;Hi [Name]&rdquo;</span>
            <br />
            and
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
              &ldquo;Hey Sarah, loved your post...&rdquo;
            </span>
          </h2>

          <motion.p
            className="mt-6 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            See how Qampi transforms generic copy-paste templates into deeply personalized messages that actually get replies.
          </motion.p>
        </motion.div>

        {/* ═══════════════════════════════
            COMPARISON CARDS
            ═══════════════════════════════ */}
        <div className="relative grid lg:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto items-stretch">

          {/* ── Center VS Badge (desktop only) ── */}
          <motion.div
            className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 z-30 hidden lg:flex"
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8, type: "spring", stiffness: 300 }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur-xl opacity-40 animate-pulse" />
              <div className="relative w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-900 font-black text-xl shadow-2xl border-[6px] border-slate-50">
                VS
              </div>
            </div>
          </motion.div>

          {/* ═══════════════════════════════
              GENERIC MESSAGE CARD (Left)
              ═══════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
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
                  <div className="flex items-center gap-3">
                    <ReplyRateMeter rate={5} color="#64748b" delay={0.3} />
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reply Rate</p>
                      <p className="text-[10px] text-slate-400 font-medium">Industry avg</p>
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
                      <span className="text-xs font-bold text-slate-500">JS</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">To: John Smith</p>
                      <p className="text-[11px] text-slate-500 font-medium">VP Engineering at Acme Corp</p>
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
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            className="relative"
          >
            {/* Outer glow */}
            <div className="absolute -inset-2 bg-gradient-to-br from-blue-500/20 via-indigo-500/10 to-purple-500/20 rounded-[2rem] blur-2xl opacity-70" />
            
            <div className="relative bg-white rounded-3xl border border-blue-200 shadow-2xl overflow-hidden h-full">
              {/* Premium gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] via-transparent to-purple-500/[0.03] pointer-events-none" />

              {/* ── Sticker: Bird waving on the AI card ── */}
              <motion.div
                className="absolute -top-6 -right-4 w-20 z-20 pointer-events-none hidden md:block"
                initial={{ opacity: 0, scale: 0, rotate: 20 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1, type: "spring", stiffness: 200 }}
              >
                <motion.img
                  src="/stickers/bird_waving_transparent.png"
                  alt="Waving Bird"
                  className="w-full h-full object-contain filter drop-shadow-xl"
                  animate={{ rotate: [0, -8, 8, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                />
              </motion.div>

              {/* Card Header */}
              <div className="relative bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-purple-50/50 px-6 py-5 border-b border-blue-100/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/10 border border-blue-100">
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
                      <p className="text-xs text-slate-500 font-medium">Fine-tuned to your voice</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ReplyRateMeter rate={34} color="#2563eb" delay={0.5} />
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Reply Rate</p>
                      <p className="text-[10px] text-slate-500 font-medium">6.8× better</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message Body */}
              <div className="relative p-6 sm:p-8">
                <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-2xl p-6 border border-blue-100 relative overflow-hidden">
                  {/* Shimmer effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear", repeatDelay: 4 }}
                  />
                  
                  {/* Recipient header */}
                  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-blue-200/50 relative">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                      <img src="/logo.png" alt="Qampi" className="w-5 h-5 filter brightness-0 invert opacity-90" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">To: John Smith</p>
                      <p className="text-[11px] text-slate-500 font-medium">VP Engineering at Acme Corp</p>
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
                    <TypingEffect text={aiMessage} speed={25} startDelay={600} onComplete={() => setTypingDone(true)} />
                  ) : (
                    <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                      <motion.div
                        className="flex gap-1"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600/60" />
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600/60" />
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600/60" />
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
                  <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/30 rounded-2xl p-4 border border-blue-100/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <p className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Qampi analyzed</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "Recent post about hiring", icon: "📝" },
                        { label: "Series B funding", icon: "💰" },
                        { label: "SaaS case study match", icon: "🎯" },
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
                  <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-4">Why it works</p>
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
                { icon: <TrendingUp className="w-6 h-6" />, value: "6.8×", label: "Higher reply rate", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
                { icon: <Zap className="w-6 h-6" />, value: "< 3s", label: "Per message generation", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
                { icon: <Sparkles className="w-6 h-6" />, value: "40%", label: "Shorter sales cycles", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
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
                  <div className={`text-3xl md:text-4xl font-black ${metric.color} mb-2 tracking-tight`}>{metric.value}</div>
                  <div className="text-sm text-slate-500 font-bold">{metric.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
