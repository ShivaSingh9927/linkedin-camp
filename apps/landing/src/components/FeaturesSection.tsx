'use client';

import { useRef, forwardRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  Bot,
  Shield,
  BarChart3,
  MessageSquare,
  Zap,
  Users,
  Sparkles,
  TrendingUp,
  Clock,
  Workflow,
  MoreHorizontal
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   FEATURE DATA
   ═══════════════════════════════════════════════════════════ */
const features = [
  {
    icon: Bot,
    title: "AI-Powered Messages",
    description:
      "Generate highly personalized, context-aware messages that genuinely sound like you. Qampi performs deep research on every prospect's profile, recent activity, and company news to craft irresistible hooks.",
    bullets: [
      "Deep-dive profile & activity analysis",
      "Perfect tone matching to your writing style",
      "Dynamic variables and bespoke icebreakers",
      "Multi-language support for global outreach"
    ],
    color: "#f5f3ff", // violet-50
    accent: "#7c3aed", // violet-600
    glow: "rgba(124, 58, 237, 0.08)",
  },
  {
    icon: Shield,
    title: "Safe & Human-Like",
    description:
      "Protect your LinkedIn account with our military-grade safety features. Qampi perfectly mimics human behavior by randomizing click delays, operating only during local business hours, and instantly pausing upon detecting limits.",
    bullets: [
      "Algorithmic human-like delay patterns",
      "Cloud-based, dedicated static IPs",
      "Smart rate-limit auto-pausing",
      "Configurable business hour constraints"
    ],
    color: "#ecfdf5", // emerald-50
    accent: "#059669", // emerald-600
    glow: "rgba(5, 150, 105, 0.08)",
  },
  {
    icon: BarChart3,
    title: "Smart Analytics",
    description:
      "Track reply rates, connection acceptances, and campaign performance in real-time. Know exactly what's working and optimize your outreach on the fly with our gorgeous visual dashboards.",
    bullets: [
      "Real-time reply & acceptance-rate tracking",
      "Conversion funnel: sent → connected → replied",
      "Per-campaign performance breakdown",
      "A/B testing for message variants (coming soon)"
    ],
    color: "#fffbeb", // amber-50
    accent: "#d97706", // amber-600
    glow: "rgba(217, 119, 6, 0.08)",
  },
  {
    icon: MessageSquare,
    title: "Reply-Aware Sending",
    description:
      "Qampi watches every conversation and pauses the moment a prospect replies — so you never fire an awkward automated message at someone who's already engaged. Take over a warm conversation instead.",
    bullets: [
      "Instantly auto-stops when a prospect replies",
      "Human-like delays between every action",
      "Working-hours-only sending",
      "Multi-step drip sequences across LinkedIn & email"
    ],
    color: "#f0f9ff", // sky-50
    accent: "#0284c7", // sky-600
    glow: "rgba(2, 132, 199, 0.08)",
  },
  {
    icon: Zap,
    title: "Omnichannel Campaigns",
    description:
      "Build multi-step workflows with an intuitive drag-and-drop builder. Chain LinkedIn actions — profile visits, likes, comments, connection requests, messages — with cold email steps and smart if/else branching.",
    bullets: [
      "Visual drag-and-drop workflow builder",
      "LinkedIn + Email in one sequence",
      "Smart branching logic (If/Else)",
      "Auto-stops the moment a prospect replies"
    ],
    color: "#fdf4ff", // fuchsia-50
    accent: "#c026d3", // fuchsia-600
    glow: "rgba(192, 38, 211, 0.08)",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Coming soon. Built for ambitious sales teams — share lead lists, coordinate outreach, and avoid duplicate messaging across your organization with unified workspaces and global collision detection.",
    bullets: [
      "Unified team inbox and CRM sync",
      "Global collision detection built-in",
      "Shared templates and performance boards",
      "Role-based access and permissions"
    ],
    color: "#fff1f2", // rose-50
    accent: "#e11d48", // rose-600
    glow: "rgba(225, 29, 72, 0.08)",
  },
];

/* ═══════════════════════════════════════════════════════════
   BESPOKE VISUAL COMPONENTS
   ═══════════════════════════════════════════════════════════ */

const AIPoweredVisual = () => (
  <div className="absolute inset-0 bg-white flex items-center justify-center p-6 overflow-hidden">
    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-5 mix-blend-multiply blur-md" />
    <div className="w-full max-w-sm bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-violet-100 overflow-hidden flex flex-col relative z-10">
      <div className="bg-violet-50/50 px-4 py-3 border-b border-violet-100/50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-xs border border-violet-200">JD</div>
        <div>
          <div className="text-xs font-bold text-slate-800">John Doe</div>
          <div className="text-[10px] text-slate-500">Founder @ Acme Corp</div>
        </div>
        <img src="/logo.png" alt="Qampi" className="w-4 h-4 ml-auto opacity-70" />
      </div>
      <div className="p-4 flex flex-col gap-3">
        <motion.div 
          className="self-start max-w-[85%] bg-slate-50 text-slate-600 text-[11px] p-3 rounded-2xl rounded-tl-sm border border-slate-100"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
        >
          Just launched our new product on ProductHunt! Would love your feedback.
        </motion.div>
        <motion.div 
          className="self-end max-w-[85%] bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-[11px] p-3 rounded-2xl rounded-tr-sm shadow-md shadow-violet-200"
          initial={{ opacity: 0, x: 10 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          Hey John, congrats on the launch! 🎉 Saw it trending #3. How are you handling the sudden influx of engineering leads?
        </motion.div>
        <motion.div 
          className="self-end flex items-center gap-1.5 text-[10px] text-violet-600 mt-[-2px] font-medium bg-violet-50 px-2 py-1 rounded-full border border-violet-100"
          initial={{ opacity: 0, y: 5 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Sparkles className="w-3 h-3 text-violet-500" /> AI Composed
        </motion.div>
      </div>
    </div>
  </div>
);

const SafeHumanVisual = () => (
  <div className="absolute inset-0 bg-white flex items-center justify-center p-6 overflow-hidden">
    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-5 mix-blend-multiply blur-md" />
    <div className="w-full max-w-xs relative z-10">
      <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-full" />
      <motion.div 
        className="relative bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-emerald-100 p-5 flex flex-col items-center text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
      >
        <div className="w-16 h-16 rounded-full bg-emerald-50 border-[2px] border-emerald-100 shadow-sm flex items-center justify-center mb-4 relative">
          <div className="absolute inset-0 rounded-full border-2 border-emerald-200 border-t-emerald-500 animate-[spin_3s_linear_infinite]" />
          <Shield className="w-6 h-6 text-emerald-500" />
        </div>
        <h3 className="text-sm font-medium text-slate-800 mb-1">Account Protected</h3>
        <p className="text-[11px] text-slate-500 mb-4">Activities running within safe human limits</p>
        
        <div className="w-full space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="flex justify-between text-[10px] font-medium text-slate-600">
            <span>Daily Connections</span>
            <span className="text-emerald-600">24 / 30</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-emerald-400"
              initial={{ width: 0 }}
              whileInView={{ width: "80%" }}
              transition={{ duration: 1, delay: 0.2 }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-medium text-slate-400 pt-1">
            <span>Next action in</span>
            <span>12m 45s</span>
          </div>
        </div>
      </motion.div>
    </div>
  </div>
);

const AnalyticsVisual = () => {
  const heights = [30, 45, 25, 60, 85, 40, 70];
  return (
    <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03] mix-blend-multiply blur-md" />
      <motion.div 
        className="w-full max-w-sm bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-amber-100 p-5 relative z-10"
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
      >
        <div className="flex justify-between items-end mb-6">
          <div>
            <div className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider mb-1">Reply Rate</div>
            <div className="text-4xl font-black text-slate-800 drop-shadow-sm">34.2%</div>
          </div>
          <div className="flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-1 rounded text-[11px] font-bold border border-amber-200">
            <TrendingUp className="w-3 h-3" /> +4.1%
          </div>
        </div>
        
        <div className="flex items-end justify-between h-32 gap-2">
          {heights.map((h, i) => (
            <div key={i} className="w-full bg-slate-50 rounded-t-sm relative group cursor-pointer h-full flex items-end">
              <motion.div 
                className="w-full bg-gradient-to-t from-amber-400 to-amber-300 rounded-t-sm transition-all group-hover:brightness-95 shadow-sm"
                initial={{ height: 0 }}
                whileInView={{ height: `${h}%` }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-3 text-[9px] font-medium text-slate-400 uppercase tracking-widest">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
        </div>
      </motion.div>
    </div>
  );
};

const FollowUpVisual = () => (
  <div className="absolute inset-0 bg-white flex items-center justify-center p-6 overflow-hidden">
    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03] mix-blend-multiply blur-md" />
    <div className="w-full max-w-xs relative z-10">
      <div className="relative pl-6 border-l-2 border-sky-100 space-y-6">
        <motion.div 
          className="relative"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
        >
          <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full bg-sky-400 border-4 border-white shadow-sm" />
          <div className="bg-white p-3 rounded-xl shadow-md border border-slate-100">
            <div className="text-[11px] font-bold text-slate-700">Connection Accepted</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Day 1 • 09:00 AM</div>
          </div>
        </motion.div>
        
        <motion.div 
          className="relative"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full bg-sky-500 border-4 border-white shadow-sm" />
          <div className="bg-sky-50 border border-sky-100 p-3 rounded-xl shadow-md backdrop-blur-sm">
            <div className="text-[11px] font-bold text-sky-600 flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Message Sent
            </div>
            <div className="text-[10px] text-slate-600 mt-1 line-clamp-1">"Thanks for connecting! I noticed..."</div>
          </div>
        </motion.div>

        <motion.div 
          className="relative"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 opacity-80 backdrop-blur-sm">
            <div className="text-[11px] font-bold text-slate-500">Follow-up #1</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Scheduled • Day 4</div>
          </div>
        </motion.div>
      </div>
    </div>
  </div>
);

const CampaignsVisual = () => (
  <div className="absolute inset-0 bg-white overflow-hidden flex items-center justify-center p-6">
    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03] mix-blend-multiply blur-md" />
    <div className="w-[120%] h-[120%] absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.03)_1px,transparent_1px)] [background-size:16px_16px]" />
    
    <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-4 mt-6">
      <motion.div 
        className="bg-white backdrop-blur-md px-4 py-2.5 rounded-lg shadow-md border border-slate-100 flex items-center gap-2 z-10 w-48"
        initial={{ y: -20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
      >
        <div className="w-6 h-6 rounded bg-slate-50 flex items-center justify-center shadow-sm border border-slate-100">
          <Users className="w-3 h-3 text-slate-500" />
        </div>
        <div className="text-[11px] font-bold text-slate-700">Profile Visited</div>
      </motion.div>
      
      <div className="w-px h-6 bg-gradient-to-b from-slate-200 to-fuchsia-200" />
      
      <motion.div 
        className="bg-white backdrop-blur-xl px-4 py-2.5 rounded-lg shadow-lg border border-fuchsia-200 flex items-center gap-2 z-10 w-56 relative"
        initial={{ scale: 0.9, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="absolute -right-1 -top-1 w-2.5 h-2.5 rounded-full bg-fuchsia-400 border-2 border-white animate-pulse" />
        <div className="w-6 h-6 rounded bg-fuchsia-50 flex items-center justify-center border border-fuchsia-100">
          <Workflow className="w-3 h-3 text-fuchsia-500" />
        </div>
        <div>
          <div className="text-[11px] font-bold text-slate-800">Connection Request</div>
          <div className="text-[9px] text-slate-500">Wait 1 hour</div>
        </div>
      </motion.div>

      <div className="w-px h-6 bg-gradient-to-b from-fuchsia-200 to-slate-200" />

      <motion.div 
        className="bg-white backdrop-blur-md px-4 py-2.5 rounded-lg shadow-md border border-slate-100 flex items-center gap-2 z-10 w-48"
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <div className="w-6 h-6 rounded bg-emerald-50 flex items-center justify-center border border-emerald-100">
          <MessageSquare className="w-3 h-3 text-emerald-500" />
        </div>
        <div className="text-[11px] font-bold text-slate-700">Send Message</div>
      </motion.div>
    </div>
  </div>
);

const CollaborationVisual = () => (
  <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-6 overflow-hidden">
    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557672172-298e090bd0f1?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03] mix-blend-multiply blur-xl" />
    <div className="w-full max-w-sm relative z-10">
      <motion.div 
        className="bg-white backdrop-blur-xl rounded-2xl shadow-lg border border-rose-100 p-4 mb-4 flex items-center justify-between"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
      >
        <div>
          <div className="text-[11px] font-bold text-slate-800">Sales Team Alpha</div>
          <div className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> 3 Online
          </div>
        </div>
        <div className="flex -space-x-2">
          <div className="w-7 h-7 rounded-full border-2 border-white bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white z-30 shadow-sm">AL</div>
          <div className="w-7 h-7 rounded-full border-2 border-white bg-amber-500 flex items-center justify-center text-[9px] font-bold text-white z-20 shadow-sm">MK</div>
          <div className="w-7 h-7 rounded-full border-2 border-white bg-rose-500 flex items-center justify-center text-[9px] font-bold text-white z-10 shadow-sm">SJ</div>
        </div>
      </motion.div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-md border border-slate-100 overflow-hidden">
        <div className="bg-slate-50/50 border-b border-slate-100 px-4 py-2 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <span>Recent Activity</span>
          <MoreHorizontal className="w-3 h-3 text-slate-400" />
        </div>
        <div className="divide-y divide-slate-50">
          {[
            { user: "AL", color: "bg-indigo-500", text: "Claimed 15 leads from list" },
            { user: "MK", color: "bg-amber-500", text: "Paused campaign 'Q3 Outreach'" },
          ].map((item, i) => (
            <motion.div 
              key={i} 
              className="p-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors"
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + (i * 0.1) }}
            >
              <div className={`w-6 h-6 rounded-full text-white text-[8px] font-bold flex items-center justify-center ${item.color} shadow-sm`}>{item.user}</div>
              <div className="text-[11px] text-slate-600">{item.text}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const featureVisuals = [
  AIPoweredVisual,
  SafeHumanVisual,
  AnalyticsVisual,
  FollowUpVisual,
  CampaignsVisual,
  CollaborationVisual
];

interface CardProps {
  i: number;
  feature: (typeof features)[0];
  progress: MotionValue<number>;
  range: [number, number];
  targetScale: number;
}

export const Card = ({
  i,
  feature,
  progress,
  range,
  targetScale,
}: CardProps) => {
  const scale = useTransform(progress, range, [1, targetScale]);
  
  const VisualComponent = featureVisuals[i];

  return (
    <div
      className='h-[800px] md:h-[650px] w-full flex-shrink-0 flex items-center justify-center sticky top-0 px-4 md:px-8'
    >
      <motion.div
        style={{
          backgroundColor: feature.color,
          scale,
          top: `calc(${i * 20}px)`,
          boxShadow: `0 10px 40px ${feature.glow}`,
          borderColor: `${feature.accent}20`
        }}
        className={`flex flex-col relative w-full h-[90%] md:h-[95%] max-w-[80rem] mx-auto rounded-[2.5rem] p-6 md:p-14 border-2 overflow-hidden origin-top`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.8),transparent_50%)] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 justify-center md:justify-start relative z-10 mb-8 md:mb-12">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm shrink-0" style={{ backgroundColor: `${feature.accent}15`, color: feature.accent }}>
            <feature.icon className="w-7 h-7" />
          </div>
          <h2 className='font-display text-5xl md:text-7xl text-center md:text-left font-semibold pt-1' style={{ color: feature.accent }}>{feature.title}</h2>
        </div>
        
        <div className={`flex flex-col lg:flex-row h-full gap-10 lg:gap-16 relative z-10`}>
          <div className={`w-full lg:w-[45%] flex flex-col justify-start`}>
            <p className='text-base md:text-lg leading-relaxed text-slate-700 font-medium'>{feature.description}</p>
            
            <ul className="mt-8 space-y-4">
              {feature.bullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-3 text-[15px] text-slate-700 font-medium">
                  <div className="mt-1 w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${feature.accent}15`, color: feature.accent }}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: feature.accent }} />
                  </div>
                  <span className="leading-tight">{bullet}</span>
                </li>
              ))}
            </ul>

            <span className='flex items-center gap-2 pt-8 md:pt-10 mt-auto pb-4'>
              <a
                href={'#'}
                target='_blank'
                className='font-bold tracking-wide transition-all hover:opacity-80 hover:gap-3 flex items-center gap-2 uppercase text-[13px]'
                style={{ color: feature.accent }}
              >
                Explore capability
                <svg width='18' height='10' viewBox='0 0 22 12' fill='none' xmlns='http://www.w3.org/2000/svg' className="transition-transform group-hover:translate-x-1">
                  <path d='M21.5303 6.53033C21.8232 6.23744 21.8232 5.76256 21.5303 5.46967L16.7574 0.696699C16.4645 0.403806 15.9896 0.403806 15.6967 0.696699C15.4038 0.989592 15.4038 1.46447 15.6967 1.75736L19.9393 6L15.6967 10.2426C15.4038 10.5355 15.4038 11.0104 15.6967 11.3033C15.9896 11.5962 16.4645 11.5962 16.7574 11.3033L21.5303 6.53033ZM0 6.75L21 6.75V5.25L0 5.25L0 6.75Z' fill={feature.accent}/>
                </svg>
              </a>
            </span>
          </div>

          <div
            className={`relative w-full lg:w-[55%] h-64 md:h-[400px] lg:h-full rounded-3xl overflow-hidden bg-white/50 border border-slate-200/60 shadow-inner`}
          >
            <motion.div
              className={`w-full h-full relative z-10`}
            >
              <VisualComponent />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const FeaturesSection = forwardRef<HTMLElement>((_, ref) => {
  const scrollContainerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    container: scrollContainerRef
  });

  return (
    <main className='bg-purple-50/30'>
      <section className='text-slate-900 h-[70vh] w-full bg-purple-50/30 grid place-content-center relative overflow-hidden'>
        <div className='absolute inset-0 pointer-events-none'>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.03)_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-violet-100/50 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 text-center px-4 py-16">
          <motion.span
            className="inline-flex items-center gap-2 bg-primary/10 text-primary px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border border-primary/20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Features
          </motion.span>
 <h1 className='font-display text-5xl sm:text-6xl lg:text-7xl font-semibold text-center leading-[1.1] max-w-6xl mx-auto'>
            Everything you need to <br />
            <span className="bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">scale outreach</span>
          </h1>
          <p className="mt-6 text-lg text-slate-500 max-w-2xl mx-auto">
            Scroll inside the viewer below to explore our powerful features without losing your place on the page. 👇
          </p>
        </div>
      </section>

      <section className='w-full bg-purple-50/30 pb-32 flex justify-center px-4 md:px-8'>
        <div 
          ref={scrollContainerRef}
          className="w-full max-w-[90rem] h-[800px] md:h-[650px] overflow-y-auto rounded-[3rem] shadow-2xl border border-slate-200 bg-white relative hide-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {features.map((feature, i) => {
            const targetScale = 1 - (features.length - i) * 0.05;
            return (
              <Card
                key={`p_${i}`}
                i={i}
                feature={feature}
                progress={scrollYProgress}
                range={[i * 0.15, 1]}
                targetScale={targetScale}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
});

FeaturesSection.displayName = 'FeaturesSection';
