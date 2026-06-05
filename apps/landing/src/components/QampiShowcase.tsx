'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  Brain,
  Search,
  Send,
  Sparkles,
  ArrowRight,
  Check,
  FileText,
  MessageSquare,
  User,
  Building2,
  Link2,
  Mic,
  Zap,
  Target,
  TrendingUp,
} from 'lucide-react';
import { GlowButton } from './GlowButton';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════
   COLOR THEMES — each step gets its own palette
   ═══════════════════════════════════════════════════════════ */

type StepTheme = {
  /** Primary accent hex */
  accent: string;
  /** Lighter tint for backgrounds */
  accentLight: string;
  /** Tailwind-friendly bg class for icon circle */
  iconBg: string;
  /** Tailwind active-icon bg class (filled) */
  iconBgActive: string;
  /** Tailwind text color for accents */
  textAccent: string;
  /** Gradient for the big filled card */
  cardGradient: string;
  /** Soft panel background gradient */
  panelGradient: string;
  /** Glow blur color */
  glow: string;
  /** Tab active bg */
  tabActive: string;
  /** Shadow on tab */
  tabShadow: string;
  /** Badge chip bg */
  chipBg: string;
  /** Badge chip border */
  chipBorder: string;
  /** Background image URL for panel */
  bgImage: string;
};

const themes: Record<string, StepTheme> = {
  voice: {
    accent: '#8b5cf6',
    accentLight: '#f5f3ff',
    iconBg: 'bg-violet-100 text-violet-600',
    iconBgActive: 'bg-violet-600 text-white shadow-md shadow-violet-600/25',
    textAccent: 'text-violet-600',
    cardGradient: 'from-violet-600 via-purple-600 to-indigo-600',
    panelGradient: 'from-violet-900/40 via-purple-900/40 to-indigo-900/40',
    glow: 'bg-violet-500',
    tabActive: 'bg-violet-600 text-white shadow-md shadow-violet-600/20',
    tabShadow: 'shadow-violet-600/20',
    chipBg: 'bg-violet-100/50',
    chipBorder: 'border-violet-200',
    bgImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop',
  },
  research: {
    accent: '#0891b2',
    accentLight: '#ecfeff',
    iconBg: 'bg-cyan-100 text-cyan-700',
    iconBgActive: 'bg-cyan-700 text-white shadow-md shadow-cyan-700/25',
    textAccent: 'text-cyan-700',
    cardGradient: 'from-cyan-600 via-blue-600 to-indigo-600',
    panelGradient: 'from-cyan-900/40 via-blue-900/40 to-teal-900/40',
    glow: 'bg-cyan-500',
    tabActive: 'bg-cyan-700 text-white shadow-md shadow-cyan-700/20',
    tabShadow: 'shadow-cyan-700/20',
    chipBg: 'bg-cyan-100/50',
    chipBorder: 'border-cyan-200',
    bgImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop',
  },
  message: {
    accent: '#d97706',
    accentLight: '#fffbeb',
    iconBg: 'bg-amber-100 text-amber-700',
    iconBgActive: 'bg-amber-600 text-white shadow-md shadow-amber-600/25',
    textAccent: 'text-amber-700',
    cardGradient: 'from-amber-500 via-orange-500 to-red-500',
    panelGradient: 'from-amber-900/40 via-orange-900/40 to-red-900/40',
    glow: 'bg-amber-500',
    tabActive: 'bg-amber-600 text-white shadow-md shadow-amber-600/20',
    tabShadow: 'shadow-amber-600/20',
    chipBg: 'bg-amber-100/50',
    chipBorder: 'border-amber-200',
    bgImage: 'https://images.unsplash.com/photo-1604871000636-074fa5117945?q=80&w=2574&auto=format&fit=crop',
  },
};

/* ═══════════════════════════════════════════════════════════
   STEP DATA
   ═══════════════════════════════════════════════════════════ */

const steps = [
  {
    id: 'voice',
    icon: Brain,
    number: '01',
    tabLabel: 'Voice',
    title: 'Qampi learns your voice',
    text: 'Upload a few samples of your writing — emails, LinkedIn posts, or messages. Qampi fine-tunes to your exact tone, style, and personality. Every message it writes sounds like you, not a bot.',
    sticker: '/stickers/bird_laptop_transparent.png',
    stickerAlt: 'Qampi bird on laptop',
    stats: [
      { label: 'Tone Match', value: '97%', icon: Mic },
      { label: 'Setup Time', value: '30s', icon: Zap },
      { label: 'Styles Learned', value: '12+', icon: FileText },
    ],
  },
  {
    id: 'research',
    icon: Search,
    number: '02',
    tabLabel: 'Research',
    title: 'Deep-dives every prospect',
    text: "Before a single message is sent, Qampi reads each prospect's profile, recent activity, company news, and mutual connections. It finds the hook that makes them want to reply.",
    sticker: '/stickers/bird_search_transparent.png',
    stickerAlt: 'Qampi bird searching',
    stats: [
      { label: 'Data Points', value: '50+', icon: Target },
      { label: 'Accuracy', value: '94%', icon: TrendingUp },
      { label: 'Per Prospect', value: '<2s', icon: Zap },
    ],
  },
  {
    id: 'message',
    icon: Send,
    number: '03',
    tabLabel: 'Message',
    title: 'Crafts unique messages',
    text: 'Every message is one-of-a-kind. No templates. No copy-paste. Just a real conversation starter that references something the prospect actually cares about — backed by research.',
    sticker: '/stickers/bird_cool_transparent.png',
    stickerAlt: 'Qampi bird with thumbs up',
    stats: [
      { label: 'Reply Rate', value: '34%', icon: MessageSquare },
      { label: 'Unique', value: '100%', icon: Sparkles },
      { label: 'Avg. Words', value: '42', icon: FileText },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   PIGEON MASCOT — floating sticker per step
   ═══════════════════════════════════════════════════════════ */

const PigeonMascot = ({ src, alt }: { src: string; alt: string }) => (
  <motion.div
    className="absolute -top-12 -right-4 md:-top-16 md:-right-8 w-28 md:w-36 z-50 pointer-events-none select-none"
    initial={{ opacity: 0, y: 16, rotate: -8 }}
    animate={{ opacity: 1, y: 0, rotate: 0 }}
    exit={{ opacity: 0, y: -10, scale: 0.8 }}
    transition={{ duration: 0.5, ease: 'easeOut' }}
  >
    <motion.img
      src={src}
      alt={alt}
      className="w-full h-full object-contain drop-shadow-2xl"
      animate={{ y: [0, -8, 0], rotate: [0, 3, -3, 0] }}
      transition={{
        repeat: Infinity,
        duration: 4.5,
        ease: 'easeInOut',
      }}
    />
  </motion.div>
);

/* ═══════════════════════════════════════════════════════════
   ANIMATED VISUAL PANELS (right-side)
   ═══════════════════════════════════════════════════════════ */

/* --- Voice Learning Panel --- */
const VoicePanel = () => {
  const t = themes.voice;
  const samples = [
    { label: 'Email sample uploaded', icon: FileText, delay: 0 },
    { label: 'LinkedIn post analyzed', icon: MessageSquare, delay: 0.2 },
    { label: 'Tone profile extracted', icon: Mic, delay: 0.4 },
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center p-6 sm:p-10 overflow-hidden">
      {/* Background Image / Pattern */}
      <div className="absolute inset-0 z-0 bg-slate-900 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-50 blur-2xl scale-110"
          style={{ backgroundImage: `url(${t.bgImage})` }}
        />
        <div className={`absolute inset-0 bg-gradient-to-br ${t.panelGradient} mix-blend-overlay`} />
        <div className={`absolute top-0 right-0 w-96 h-96 ${t.glow} rounded-full blur-[120px] opacity-50 mix-blend-screen`} />
        <div className={`absolute bottom-0 left-0 w-80 h-80 bg-purple-500 rounded-full blur-[120px] opacity-40 mix-blend-screen`} />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-3">
        {/* Upload samples */}
        {samples.map((s) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: s.delay, duration: 0.5, ease: 'easeOut' }}
            className="flex items-center gap-3 bg-white/90 backdrop-blur-md rounded-xl px-4 py-3 shadow-sm border border-slate-200/60 group hover:border-violet-300 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 group-hover:bg-violet-200/70 transition-colors">
              <s.icon className="w-4 h-4 text-violet-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">{s.label}</span>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: s.delay + 0.4, type: 'spring', stiffness: 300 }}
              className="ml-auto w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/20"
            >
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </motion.div>
          </motion.div>
        ))}

        {/* Voice profile card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6, ease: 'easeOut' }}
          className={`bg-gradient-to-br ${t.cardGradient} rounded-2xl p-5 mt-4 shadow-xl shadow-violet-600/30 border border-white/20`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <img src="/logo.png" alt="Qampi" className="w-6 h-6 object-contain drop-shadow-md" />
            </div>
            <div>
              <p className="text-white font-bold text-sm drop-shadow-sm">Voice Profile Ready</p>
              <p className="text-white/80 text-xs">Conversational · Professional · Warm</p>
            </div>
          </div>
          {/* Audio waveform bars */}
          <div className="flex items-end gap-[3px] h-8">
            {Array.from({ length: 24 }).map((_, i) => (
              <motion.div
                key={i}
                className="flex-1 bg-white/60 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                initial={{ height: '20%' }}
                animate={{ height: `${20 + Math.random() * 80}%` }}
                transition={{
                  repeat: Infinity,
                  repeatType: 'reverse',
                  duration: 0.4 + Math.random() * 0.6,
                  delay: i * 0.05,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

/* --- Research Panel --- */
const ResearchPanel = () => {
  const t = themes.research;
  const dataPoints = [
    { label: 'Recent post', icon: MessageSquare, color: 'bg-emerald-500', detail: '"Just closed Series B 🎉"' },
    { label: 'Company news', icon: Building2, color: 'bg-cyan-600', detail: 'TechFlow raised $12M' },
    { label: 'Mutual connections', icon: Link2, color: 'bg-amber-500', detail: '3 shared contacts' },
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center p-6 sm:p-10 overflow-hidden">
      {/* Background Image / Pattern */}
      <div className="absolute inset-0 z-0 bg-slate-900 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-50 blur-2xl scale-110"
          style={{ backgroundImage: `url(${t.bgImage})` }}
        />
        <div className={`absolute inset-0 bg-gradient-to-br ${t.panelGradient} mix-blend-overlay`} />
        <div className={`absolute top-1/4 right-1/4 w-72 h-72 ${t.glow} rounded-full blur-[120px] opacity-60 mix-blend-screen`} />
        <div className={`absolute bottom-0 left-1/4 w-64 h-64 bg-teal-500 rounded-full blur-[120px] opacity-50 mix-blend-screen`} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Prospect card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200/60 overflow-hidden mb-4"
        >
          <div className="p-4 flex items-center gap-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-inner">
              SJ
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800">Sarah Jenkins</div>
              <div className="text-xs text-slate-500">VP of Sales · TechFlow</div>
            </div>
            <div className="ml-auto">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                className="w-5 h-5 border-2 border-cyan-200 border-t-cyan-600 rounded-full drop-shadow-sm"
              />
            </div>
          </div>

          {/* Data points */}
          <div className="p-4 space-y-2.5">
            {dataPoints.map((d, i) => (
              <motion.div
                key={d.label}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.25, duration: 0.4 }}
                className="flex items-center gap-3 bg-slate-50/80 rounded-lg px-3 py-2.5 border border-slate-100/80"
              >
                <div className={`w-6 h-6 ${d.color} rounded-md flex items-center justify-center shrink-0 shadow-sm`}>
                  <d.icon className="w-3 h-3 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">{d.label}</div>
                  <div className="text-xs text-slate-800 font-medium truncate">{d.detail}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* AI thinking indicator */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, duration: 0.4 }}
          className="flex items-center gap-3 bg-white/95 backdrop-blur-md rounded-xl px-4 py-3 shadow-lg shadow-cyan-900/5 border border-cyan-200"
        >
          <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center shadow-inner">
            <img src="/logo.png" alt="Qampi" className="w-5 h-5 object-contain" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-slate-800">Finding the perfect hook…</div>
            <div className="flex gap-1 mt-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-cyan-600"
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

/* --- Message Craft Panel --- */
const MessagePanel = () => {
  const t = themes.message;
  const messages = [
    {
      align: 'left' as const,
      text: 'Hey Sarah, congrats on the Series B! 🎉 Noticed you\'re scaling the sales team — that\'s exactly what our workflow builder automates.',
      delay: 0,
    },
    {
      align: 'right' as const,
      text: 'That sounds interesting! We\'ve been looking for something like this.',
      delay: 0.8,
    },
    {
      align: 'left' as const,
      text: 'Would love to share how TechFlow-sized teams typically save 15+ hrs/week. Free to chat Thursday?',
      delay: 1.4,
    },
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center p-6 sm:p-10 overflow-hidden">
      {/* Background Image / Pattern */}
      <div className="absolute inset-0 z-0 bg-slate-900 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-50 blur-2xl scale-110"
          style={{ backgroundImage: `url(${t.bgImage})` }}
        />
        <div className={`absolute inset-0 bg-gradient-to-br ${t.panelGradient} mix-blend-overlay`} />
        <div className={`absolute top-0 right-1/4 w-80 h-80 ${t.glow} rounded-full blur-[120px] opacity-60 mix-blend-screen`} />
        <div className={`absolute bottom-0 left-0 w-96 h-96 bg-red-500 rounded-full blur-[120px] opacity-50 mix-blend-screen`} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Chat window */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden">
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 bg-white/50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-[10px] font-bold shadow-inner">
              SJ
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Sarah Jenkins</div>
              <div className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_#10b981]" />
                Online
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-md shadow-sm">
              <img src="/logo.png" alt="Qampi" className="w-3.5 h-3.5 object-contain" />
              <span className="text-[10px] font-bold">AI Composed</span>
            </div>
          </div>

          {/* Messages */}
          <div className="p-4 space-y-3 min-h-[200px]">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: msg.delay, duration: 0.4, ease: 'easeOut' }}
                className={cn('flex', msg.align === 'right' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] px-3.5 py-2.5 text-xs leading-relaxed shadow-sm',
                    msg.align === 'right'
                      ? 'bg-slate-100 text-slate-700 rounded-2xl rounded-br-md border border-slate-200/50'
                      : 'bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-2xl rounded-bl-md shadow-amber-500/20 border border-amber-400/50'
                  )}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Reply rate badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 0.5 }}
          className="mt-3 flex items-center justify-center gap-2 bg-amber-50/90 backdrop-blur-sm border border-amber-200/60 rounded-xl px-4 py-2.5 shadow-lg shadow-amber-900/5"
        >
          <TrendingUp className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-bold text-amber-800">3.4× higher reply rate</span>
          <span className="text-xs text-amber-600/70 font-medium">vs templates</span>
        </motion.div>
      </div>
    </div>
  );
};

const panels: Record<string, React.FC> = {
  voice: VoicePanel,
  research: ResearchPanel,
  message: MessagePanel,
};

/* ═══════════════════════════════════════════════════════════
   MAIN SHOWCASE SECTION
   ═══════════════════════════════════════════════════════════ */

export function QampiShowcase() {
  const [activeStep, setActiveStep] = useState(steps[0].id);
  const active = steps.find((s) => s.id === activeStep)!;
  const ActivePanel = panels[activeStep];
  const t = themes[activeStep];

  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '8%']);

  return (
    <section
      ref={sectionRef}
      id="qampi-ai"
      className="relative w-full bg-white py-24 lg:py-32 overflow-hidden"
    >
      {/* ── Subtle background texture ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.02)_1px,transparent_1px)] [background-size:20px_20px]" />
        <motion.div
          style={{ y: bgY }}
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-b from-violet-500/4 via-cyan-500/3 to-transparent rounded-full blur-[120px]"
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ═══════════ HEADER ═══════════ */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 lg:mb-20"
        >
          <span className="inline-flex items-center gap-2 bg-violet-50 text-violet-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5 border border-violet-200/60">
            <img src="/logo.png" alt="Qampi" className="w-4 h-4 object-contain" />
            Qampi AI Engine
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.05] max-w-3xl">
            3 steps from stranger{' '}
            <br className="hidden sm:block" />
            to{' '}
            <span className="bg-gradient-to-r from-violet-600 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
              conversation
            </span>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-slate-500 max-w-xl leading-relaxed">
            Qampi doesn't guess. It researches every prospect, learns your writing
            style, and crafts messages that feel genuinely personal — at scale.
          </p>
        </motion.div>

        {/* ═══════════ SPLIT LAYOUT ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* ── Left: Accordion steps ── */}
          <div className="lg:col-span-5 xl:col-span-5">
            {/* Step list */}
            <div className="space-y-2">
              {steps.map((step) => {
                const isActive = step.id === activeStep;
                const st = themes[step.id];
                return (
                  <motion.button
                    key={step.id}
                    onClick={() => setActiveStep(step.id)}
                    className={cn(
                      'w-full text-left rounded-2xl border transition-all duration-300 overflow-hidden',
                      isActive
                        ? 'border-2 shadow-xl shadow-slate-200/50'
                        : 'bg-white/60 border-slate-200/60 hover:border-slate-300 hover:bg-white border'
                    )}
                    style={
                      isActive 
                        ? { 
                            borderColor: st.accent,
                            backgroundColor: st.accentLight,
                          } 
                        : undefined
                    }
                    layout
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-3.5 p-4 sm:p-5">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300',
                          isActive ? st.iconBgActive : st.iconBg
                        )}
                      >
                        <step.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-widest block mb-0.5 transition-colors',
                            isActive ? st.textAccent : 'text-slate-400'
                          )}
                        >
                          Step {step.number}
                        </span>
                        <span
                          className={cn(
                            'text-base sm:text-lg font-bold transition-colors leading-tight',
                            isActive ? st.textAccent : 'text-slate-600'
                          )}
                          style={isActive ? { color: st.accent } : undefined}
                        >
                          {step.title}
                        </span>
                      </div>
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0'
                        )}
                        style={
                          isActive
                            ? { borderColor: st.accent, backgroundColor: st.accent }
                            : { borderColor: '#cbd5e1' }
                        }
                      >
                        {isActive && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                          >
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* Expanded content */}
                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5">
                            <p className="text-sm text-slate-500 leading-relaxed mb-4">
                              {step.text}
                            </p>

                            {/* Stat chips — themed */}
                            <div className="flex flex-wrap gap-2">
                              {step.stats.map((stat) => (
                                <div
                                  key={stat.label}
                                  className={cn(
                                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 border',
                                    st.chipBg,
                                    st.chipBorder
                                  )}
                                >
                                  <stat.icon className="w-3 h-3" style={{ color: st.accent }} />
                                  <span className="text-xs font-bold text-slate-800">{stat.value}</span>
                                  <span className="text-[10px] text-slate-400">{stat.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap gap-3">
              <GlowButton href="https://app.qampi.com/register">
                Try Qampi Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </GlowButton>
              <GlowButton variant="secondary" href="#pricing">
                See all plans
              </GlowButton>
            </div>

            {/* Free tier note */}
            <p className="mt-4 text-xs text-slate-400 flex items-center gap-1.5">
              <img src="/logo.png" alt="" className="w-3.5 h-3.5 object-contain opacity-60" />
              Free: 25 Qampi messages/week (Fast model) · No credit card required
            </p>
          </div>

          {/* ── Right: Interactive visual panel ── */}
          <div className="lg:col-span-7 xl:col-span-7">
            <div className="sticky top-24">
              <div className="relative">
                {/* Pigeon mascot — floats above the panel, changes per step */}
                <AnimatePresence mode="wait">
                  <PigeonMascot
                    key={active.id}
                    src={active.sticker}
                    alt={active.stickerAlt}
                  />
                </AnimatePresence>

                <div className="relative rounded-3xl border border-slate-200/60 bg-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] overflow-hidden">
                  {/* Browser chrome */}
                  <div className="flex items-center gap-2 bg-slate-50/80 px-4 py-2.5 border-b border-slate-200/40">
                    <div className="flex gap-1.5">
                      <span className="w-[9px] h-[9px] rounded-full bg-[#FF5F57]" />
                      <span className="w-[9px] h-[9px] rounded-full bg-[#FEBC2E]" />
                      <span className="w-[9px] h-[9px] rounded-full bg-[#28C840]" />
                    </div>
                    <div className="flex-1 mx-6">
                      <div className="bg-white/80 rounded-md px-3 py-1 text-[11px] text-slate-400 text-center border border-slate-200/40 max-w-[240px] mx-auto font-mono flex items-center justify-center gap-1.5">
                        <img src="/logo.png" alt="" className="w-3 h-3 object-contain" />
                        app.qampi.com/ai
                      </div>
                    </div>
                  </div>

                  {/* Tab pills — colored per step theme */}
                  <div className="flex justify-center gap-1.5 py-3 border-b border-slate-100 bg-white relative z-20">
                    {steps.map((step) => {
                      const isActive = step.id === activeStep;
                      const st = themes[step.id];
                      return (
                        <button
                          key={step.id}
                          onClick={() => setActiveStep(step.id)}
                          className={cn(
                            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200',
                            isActive
                              ? st.tabActive
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200/70 hover:text-slate-700'
                          )}
                        >
                          <step.icon className="w-3.5 h-3.5" />
                          {step.tabLabel}
                        </button>
                      );
                    })}
                  </div>

                  {/* Panel content — fixed height */}
                  <div className="relative h-[420px] sm:h-[480px] overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeStep}
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -16, scale: 0.98 }}
                        transition={{ duration: 0.35, ease: 'easeInOut' }}
                        className="absolute inset-0"
                      >
                        <ActivePanel />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Bottom upgrade banner */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="mt-4 bg-gradient-to-r from-violet-50 via-cyan-50/50 to-amber-50 rounded-2xl px-5 py-4 border border-slate-200/60 flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
                    <img src="/logo.png" alt="Qampi" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      Upgrade to Qampi Pro
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Advanced reasoning · Deeper personalization · Unlimited messages
                    </p>
                  </div>
                </div>
                <a
                  href="https://app.qampi.com/register"
                  className="text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors flex items-center gap-1 shrink-0"
                >
                  Learn more <ArrowRight className="w-3 h-3" />
                </a>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
