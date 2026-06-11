'use client';

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { 
  UserPlus, 
  Clock, 
  Sparkles, 
  Send, 
  Target, 
  Network, 
  Award,
  Zap, 
  Sliders, 
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Heart
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
type Audience = "B2B Founder" | "DevOps Leader" | "VP of Sales";
type Trigger = "Recent Post" | "Mutual Friend" | "Achievement";
type Tone = "Short & Punchy" | "Highly Professional" | "Casual & Warm";

interface TemplateSet {
  prospect: string;
  title: string;
  company: string;
  avatar: string;
  templates: Record<Trigger, Record<Tone, string>>;
}

const prospectData: Record<Audience, TemplateSet> = {
  "B2B Founder": {
    prospect: "Sarah Chen",
    title: "Founder & CEO",
    company: "AetherSaaS",
    avatar: "S",
    templates: {
      "Recent Post": {
        "Short & Punchy": "Hi Sarah, loved your recent post on scaling to $2M ARR. Your point about customer-led growth hit home. We helped 3 founders implement exactly that. Worth a brief chat?",
        "Highly Professional": "Dear Sarah, I read your insightful article regarding SaaS scaling methodologies with great interest. Your analysis of product-led growth metrics aligns closely with our research. I would appreciate the opportunity to connect and share our outbound scaling framework.",
        "Casual & Warm": "Hey Sarah! Just saw your post about bootstrapping to $2M ARR — huge congrats, that's incredibly inspiring! Love how you focused on early customer success. I'd love to connect and keep up with your journey."
      },
      "Mutual Friend": {
        "Short & Punchy": "Hi Sarah, noticed we both know Alex Rivera. Saw your amazing work with AetherSaaS. I recently put together a custom outreach template for B2B founders that's getting great replies. Let's connect?",
        "Highly Professional": "Dear Sarah, I noted our mutual connection with Alex Rivera. Having followed AetherSaaS's progress, I wanted to reach out. We specialize in developing high-performance outreach sequences for B2B technology founders.",
        "Casual & Warm": "Hey Sarah! Saw that we're both connected with Alex Rivera — he's awesome! It reminded me to check out AetherSaaS, and I'm really impressed by what you guys are building. Let's connect!"
      },
      "Achievement": {
        "Short & Punchy": "Hi Sarah, congratulations on the recent funding round for AetherSaaS! Scaling up must be exciting. We recently helped a similar team expand their outbound sales pipeline by 45%. Let's connect?",
        "Highly Professional": "Dear Sarah, allow me to congratulate you on AetherSaaS's recent series funding milestone. Under your leadership, the company's growth trajectory is outstanding. I would welcome the opportunity to discuss your outbound pipeline strategy.",
        "Casual & Warm": "Hey Sarah, huge congratulations on the recent funding round! That's a massive milestone for AetherSaaS. Hope you and the team are taking a moment to celebrate! Let's connect to stay in touch."
      }
    }
  },
  "DevOps Leader": {
    prospect: "David Kovac",
    title: "Head of Infrastructure",
    company: "CloudCore",
    avatar: "D",
    templates: {
      "Recent Post": {
        "Short & Punchy": "Hey David, saw your thread on Kubernetes latency issues. Loved the practical take on config maps. We automated a similar infrastructure deployment recently to cut overhead by 30%. Connect?",
        "Highly Professional": "Dear David, your technical analysis of Kubernetes latency metrics is outstanding. Our engineering team reviewed your recommendations regarding configuration mapping with interest. I would appreciate the opportunity to connect.",
        "Casual & Warm": "Hey David! Just read your awesome thread on K8s latency — spot on about the hidden config map gotchas. Thanks for sharing that! Let's connect to talk shop sometime."
      },
      "Mutual Friend": {
        "Short & Punchy": "Hey David, saw we're both connected with Alex Rivera. Noticed your focus on high-performance infrastructure orchestration. I'd love to share how we helped 3 DevOps teams automate their latency monitoring. Connect?",
        "Highly Professional": "Dear David, I noted our mutual connection with Alex Rivera. Having monitored CloudCore's impressive system engineering milestones, I wanted to reach out to discuss infrastructure automation workflows.",
        "Casual & Warm": "Hey David! Noticed we both know Alex Rivera. Small world! I saw your recent work on high-availability clusters at CloudCore — really impressive engineering. Let's connect!"
      },
      "Achievement": {
        "Short & Punchy": "Hey David, congrats on deploying the new system architecture last week! Huge technical milestone. I'd love to connect to learn how you're optimizing developer velocity under the new setup. Let's connect?",
        "Highly Professional": "Dear David, congratulations on the successful deployment of CloudCore's new microservices architecture. It represents a significant technical accomplishment. I would welcome a brief connection to discuss optimization protocols.",
        "Casual & Warm": "Hey David, awesome job on the massive system architecture launch last week! I know how much midnight oil goes into those deployments. Hope the post-launch phase is going smoothly! Let's connect."
      }
    }
  },
  "VP of Sales": {
    prospect: "Marcus Vane",
    title: "VP of Global Sales",
    company: "ScaleFlow",
    avatar: "M",
    templates: {
      "Recent Post": {
        "Short & Punchy": "Hello Marcus, read your post on outbound reply rates dropping. Spot on about generic templates killing pipeline. We built a personalized system that keeps reply rates above 38% for sales teams. Let's connect?",
        "Highly Professional": "Dear Marcus, I read your recent publication concerning declining outbound conversion rates. Your assertion regarding template saturation is highly accurate. I would welcome a discussion on how Qampi improves outreach efficiency.",
        "Casual & Warm": "Hey Marcus! Your post about outbound reply rates dropping was so incredibly refreshing. It's so true that generic spam is killing the pipeline. I'd love to connect and exchange some ideas on what's working now!"
      },
      "Mutual Friend": {
        "Short & Punchy": "Hello Marcus, noticed we both know Alex Rivera. Saw your outstanding focus on scaling high-performance sales pipelines. I recently designed an outreach workflow that boosts B2B outbound performance. Connect?",
        "Highly Professional": "Dear Marcus, I noted our mutual professional connection with Alex Rivera. Given your responsibilities scaling global sales pipelines at ScaleFlow, I believe a connection would be mutually beneficial.",
        "Casual & Warm": "Hey Marcus! Saw that we both know Alex Rivera. He speaks very highly of you! I've been watching ScaleFlow's sales expansion with a lot of interest. Let's connect to share insights."
      },
      "Achievement": {
        "Short & Punchy": "Hello Marcus, congratulations on your sales team hitting record outbound targets this quarter! Dynamic growth. I'd love to connect to share a custom sequence blueprint we used to scale sales volume. Connect?",
        "Highly Professional": "Dear Marcus, please accept my congratulations on your sales division achieving record target thresholds this past quarter. I would welcome an opportunity to share outreach blueprints designed to sustain sales pipeline velocity.",
        "Casual & Warm": "Hey Marcus, absolute congrats to you and the team for hitting record numbers this quarter! That is a stellar sales achievement. Would love to connect and keep learning from your sales playbook."
      }
    }
  }
};

export function InteractiveSequenceV2() {
  const [audience, setAudience] = useState<Audience>("B2B Founder");
  const [trigger, setTrigger] = useState<Trigger>("Recent Post");
  const [tone, setTone] = useState<Tone>("Short & Punchy");
  
  // Animation state for output message typing
  const [displayedText, setDisplayedText] = useState("");
  const targetText = prospectData[audience].templates[trigger][tone];

  // Simulating natural typing behavior
  useEffect(() => {
    setDisplayedText("");
    let index = 0;
    let timer: NodeJS.Timeout;
    
    const type = () => {
      if (index < targetText.length) {
        setDisplayedText((prev) => prev + targetText.charAt(index));
        index++;
        timer = setTimeout(type, 10);
      }
    };
    
    timer = setTimeout(type, 100);
    return () => clearTimeout(timer);
  }, [audience, trigger, tone, targetText]);

  // Helper to format tokens beautifully in the preview
  const renderFormattedText = (text: string) => {
    const tokens = [
      "Sarah Chen", "David Kovac", "Marcus Vane", 
      "AetherSaaS", "CloudCore", "ScaleFlow", 
      "Alex Rivera", "bootstrapping to $2M ARR", 
      "scaling to $2M ARR", "series funding milestone",
      "recent funding round", "Kubernetes latency issues",
      "K8s latency", "microservices architecture",
      "system architecture launch", "outbound reply rates dropping",
      "outbound conversion rates", "record numbers this quarter",
      "record outbound targets"
    ];

    let result = text;
    tokens.forEach((token) => {
      const regex = new RegExp(`(${token})`, "gi");
      result = result.replace(
        regex, 
        `<span class="text-indigo-600 font-extrabold px-1.5 bg-indigo-50 border border-indigo-100 rounded-md">$1</span>`
      );
    });

    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };

  return (
    <section id="sequence" className="relative py-24 bg-white overflow-hidden border-t border-slate-200/60">
      
      {/* Dynamic Cosmic Backdrops */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-br from-indigo-500/[0.02] to-purple-600/[0.02] rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center space-x-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-black mb-4">
            <Zap className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500/20" />
            <span>Interactive Playground</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            See the AI rewrite <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">in real-time</span>
          </h2>
          <p className="mt-4 text-base text-slate-600 font-semibold max-w-2xl mx-auto leading-relaxed">
            Unlike static templates that get flagged as spam, Qampi analyzes specific signals to write hyper-resonant, tailored messages. Test the engine below.
          </p>
        </div>

        {/* The Sandbox Dashboard Container */}
        <div className="grid lg:grid-cols-12 gap-8 items-stretch max-w-6xl mx-auto">
          
          {/* Left: Input Sandbox Panel */}
          <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-6 lg:p-8 flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <div>
              <div className="flex items-center space-x-2 mb-6 pb-4 border-b border-slate-100">
                <Sliders className="w-4.5 h-4.5 text-indigo-600" />
                <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">Playground Settings</h3>
              </div>

              {/* 1. Target Audience */}
              <div className="mb-6">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-3">
                  1. Target Audience
                </label>
                <div className="space-y-2">
                  {(["B2B Founder", "DevOps Leader", "VP of Sales"] as Audience[]).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setAudience(opt)}
                      className={cn(
                        "w-full flex items-center justify-between p-3.5 rounded-2xl border text-xs font-black transition-all cursor-pointer",
                        audience === opt
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                          : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800"
                      )}
                    >
                      <span>{opt}</span>
                      <span className="text-[9px] opacity-75 font-bold uppercase tracking-wider text-indigo-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                        {opt === "B2B Founder" ? "Sarah" : opt === "DevOps Leader" ? "David" : "Marcus"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Personalized Trigger */}
              <div className="mb-6">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-3">
                  2. Research Trigger
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: "Recent Post", label: "Post Activity", icon: MessageSquare },
                    { id: "Mutual Friend", label: "Shared Network", icon: Network },
                    { id: "Achievement", label: "Achievement", icon: Award },
                  ].map((trig) => {
                    const Icon = trig.icon;
                    return (
                      <button
                        key={trig.id}
                        onClick={() => setTrigger(trig.id as Trigger)}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-2xl border text-[10px] font-black transition-all text-center gap-2 cursor-pointer",
                          trigger === trig.id
                            ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                            : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{trig.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Message Tone */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-3">
                  3. Conversation Tone
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(["Short & Punchy", "Highly Professional", "Casual & Warm"] as Tone[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={cn(
                        "p-2.5 rounded-2xl border text-[10px] font-black transition-all text-center cursor-pointer",
                        tone === t
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                          : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Quality indicators */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-bold">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> High deliverability</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 100% organic custom</span>
            </div>
          </div>

          {/* Right: Live Interactive Sequence & Preview Screen */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-6">
            
            {/* Real-time sequence map */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 relative overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
              <div className="absolute inset-0 opacity-[0.3] pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(#e2e8f0 1.5px, transparent 1.5px)`,
                  backgroundSize: "20px 20px",
                }}
              />
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Campaign Sequence Flow</span>
                <span className="text-[10px] font-black text-indigo-600 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full">Executing Node...</span>
              </div>

              {/* Path Flow Diagram */}
              <div className="relative flex items-center justify-between px-4 py-3">
                {/* Connecting SVG with animate offsets */}
                <svg className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-2 pointer-events-none" aria-hidden="true">
                  <motion.line
                    x1="10%" y1="50%" x2="90%" y2="50%"
                    stroke="url(#pulse-gradient)"
                    strokeWidth="2.5"
                    strokeDasharray="6,4"
                    animate={{ strokeDashoffset: [-20, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  />
                  <defs>
                    <linearGradient id="pulse-gradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#4f46e5" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Node Invite */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-11 h-11 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 shadow-sm">
                    <UserPlus className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[9px] font-black text-slate-400 mt-1.5 uppercase tracking-wider">Invite</span>
                </div>

                {/* Node Research */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-11 h-11 bg-indigo-50 border border-indigo-400 rounded-2xl flex items-center justify-center text-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.12)] animate-pulse">
                    <Target className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[9px] font-black text-indigo-600 mt-1.5 uppercase tracking-wider">Research</span>
                </div>

                {/* Node AI Message */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-11 h-11 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 shadow-sm">
                    <Sparkles className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[9px] font-black text-slate-400 mt-1.5 uppercase tracking-wider">AI Gen</span>
                </div>

                {/* Node CRM */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-11 h-11 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 shadow-sm">
                    <Send className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[9px] font-black text-slate-400 mt-1.5 uppercase tracking-wider">CRM Sync</span>
                </div>
              </div>
            </div>

            {/* LinkedIn Message Preview Block */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.03)] flex-1 flex flex-col justify-between">
              
              {/* Header Card Profile info */}
              <div className="bg-slate-50 p-4 border-b border-slate-200/60 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-200 flex items-center justify-center text-xs font-black text-indigo-700">
                    {prospectData[audience].avatar}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">{prospectData[audience].prospect}</h4>
                    <p className="text-[10px] text-slate-500 font-bold leading-none mt-0.5">
                      {prospectData[audience].title} at <span className="text-indigo-600 font-extrabold">{prospectData[audience].company}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_8px_#10B981]" />
                  <span className="text-[10px] font-black text-slate-500">Active now</span>
                </div>
              </div>

              {/* Message bubble workspace */}
              <div className="p-6 flex-1 bg-white flex flex-col justify-center min-h-[170px]">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black shrink-0 mt-0.5 shadow-sm">
                    Q
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl rounded-tl-none p-4.5 max-w-[85%] relative shadow-sm">
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-semibold">
                      {renderFormattedText(displayedText)}
                      <span className="w-1.5 h-4 bg-indigo-600 inline-block animate-pulse ml-0.5" />
                    </p>
                  </div>
                </div>
              </div>

              {/* Active statistics comparison panel */}
              <div className="bg-slate-50 p-4 border-t border-slate-200/60 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Qampi Match Score</p>
                  <p className="text-base font-black text-emerald-600 mt-1">98.6%</p>
                </div>
                <div className="border-x border-slate-200/60">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Est. Reply Rate</p>
                  <p className="text-base font-black text-indigo-600 mt-1">
                    {trigger === "Recent Post" ? "42%" : trigger === "Mutual Friend" ? "48%" : "39%"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Personalization</p>
                  <p className="text-base font-black text-purple-600 mt-1">Hyper-Deep</p>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
