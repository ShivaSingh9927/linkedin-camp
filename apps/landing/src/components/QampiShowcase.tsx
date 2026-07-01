'use client';

import { motion } from 'framer-motion';
import { User, Building2, Target, UserSearch, Sparkles, Send, ArrowRight, CheckCircle } from 'lucide-react';

// How the Qampi AI engine works: it reads four real context sources
// (you, your business, your campaign, your target) and writes one message
// no template could. Inputs → engine → output.
const INPUTS = [
  { icon: User, label: 'You', desc: 'Your role & writing voice', color: '#6366f1', bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
  { icon: Building2, label: 'Your business', desc: 'Company, value prop & ICP', color: '#8b5cf6', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
  { icon: Target, label: 'Your campaign', desc: 'Objective, CTA & tone', color: '#a855f7', bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' },
  { icon: UserSearch, label: 'Your target', desc: "Their profile & recent activity", color: '#7c3aed', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
];

export function QampiShowcase() {
  return (
    <section className="relative py-20 lg:py-28 overflow-hidden bg-white">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 max-w-3xl mx-auto"
        >
          <span className="inline-flex items-center gap-2 bg-indigo-50 text-primary px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-6 border border-indigo-100 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" /> Qampi AI Engine
          </span>
          <h2 className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold text-slate-900 leading-[1.1]">
            Four inputs.{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">One personal message.</span>
          </h2>
          <p className="mt-6 text-lg text-slate-500 font-medium">
            Qampi&apos;s engine reads four things before it writes a word — so every message sounds like you, speaks to your offer, and lands with that exact person.
          </p>
        </motion.div>

        {/* Inputs → Engine → Output */}
        <div className="grid lg:grid-cols-[1fr_auto_1.1fr] gap-8 lg:gap-6 items-center">

          {/* ── INPUTS ── */}
          <div className="space-y-4">
            {INPUTS.map((input, i) => (
              <motion.div
                key={input.label}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 120, damping: 18 }}
                className="flex items-center gap-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4"
              >
                <div className={`w-11 h-11 rounded-xl ${input.bg} ${input.text} border ${input.border} flex items-center justify-center shrink-0`}>
                  <input.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 text-[15px]">{input.label}</div>
                  <div className="text-[13px] text-slate-500 leading-snug">{input.desc}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 ml-auto shrink-0 hidden lg:block" />
              </motion.div>
            ))}
          </div>

          {/* ── ENGINE ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 120, damping: 16 }}
            className="flex flex-col items-center justify-center py-2"
          >
            <div className="relative w-40 h-40 flex items-center justify-center">
              {/* pulsing rings */}
              <motion.div className="absolute inset-0 rounded-full bg-indigo-100/40" animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} />
              <motion.div className="absolute inset-3 rounded-full border-2 border-indigo-200/50 border-dashed" animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} />
              <motion.div className="absolute inset-8 rounded-full border border-violet-300/40 border-dotted" animate={{ rotate: -360 }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }} />
              {/* core */}
              <motion.div
                className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/10 via-indigo-600/10 to-purple-600/10 border-4 border-white shadow-[0_0_40px_rgba(99,102,241,0.25)] flex items-center justify-center"
                animate={{ y: [-6, 6, -6] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <img src="/logo.png" alt="Qampi AI" className="w-14 h-14 object-contain drop-shadow" />
              </motion.div>
            </div>
            <span className="mt-3 text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Qampi AI</span>
            <ArrowRight className="w-5 h-5 text-indigo-400 mt-3 hidden lg:block" />
          </motion.div>

          {/* ── OUTPUT MESSAGE ── */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 120, damping: 18 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden"
          >
            {/* header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-purple-50/40 border-b border-blue-100/60">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">SJ</div>
              <div className="leading-tight">
                <div className="text-sm font-bold text-slate-800">Sarah Jenkins</div>
                <div className="text-[11px] text-slate-500">VP of Sales · Acme Corp</div>
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-white/80 border border-indigo-100 rounded-full px-2.5 py-1">
                <Sparkles className="w-3 h-3" /> AI Composed
              </span>
            </div>
            {/* message */}
            <div className="p-5">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-sm leading-relaxed p-4 rounded-2xl rounded-tl-sm shadow-md shadow-indigo-200/50">
                Hey Sarah — congrats on the Series B! 🎉 Saw your post on scaling the sales team. We help SaaS founders cut their hiring cycle by ~40% with AI-personalized outreach. Worth a quick chat Thursday?
              </div>
              {/* why it works */}
              <div className="mt-4 flex flex-wrap gap-2">
                {['In your voice', 'References her post', 'Speaks to your offer', 'Clear CTA'].map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-600 bg-slate-50 border border-slate-100 rounded-full px-3 py-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                <Send className="w-3.5 h-3.5" /> Sent
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
