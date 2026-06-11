'use client';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Sparkles, ArrowRight, ScanFace, Activity, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Types
type LeadKey = "John Smith" | "Helena Rostova" | "Sanjay Patel";

interface LeadData {
  name: string;
  role: string;
  company: string;
  avatar: string;
  avatarColor: string;
  genericText: string;
  aiText: string;
  signals: string[];
  replyRateGeneric: number;
  replyRateAi: number;
}

const leads: Record<LeadKey, LeadData> = {
  "John Smith": {
    name: "John Smith",
    role: "VP of Engineering",
    company: "Acme Corp",
    avatar: "JS",
    avatarColor: "from-indigo-500 to-cyan-500",
    genericText: `Hi John,

I noticed your profile and thought we could connect. We offer a custom B2B outreach tool that might help Acme Corp scale and book more meetings.

Would you be open to a quick 15-minute call next week?

Best,
Alex`,
    aiText: `Hey John,

Saw your recent post about scaling the engineering team at Acme Corp — huge congrats on the Series B round!

We just helped a similar SaaS engineering founder cut their onboarding bottlenecks by 40% using automated outreach flows. Would love to share what worked for them.

No pitch, just pure insights. Open to a quick chat?

Cheers,
Alex`,
    signals: [
      "Series B funding round announcement",
      "Recent post on hiring velocity bottlenecks",
      "Engineering division team growth curve"
    ],
    replyRateGeneric: 4.8,
    replyRateAi: 36.4,
  },
  "Helena Rostova": {
    name: "Helena Rostova",
    role: "Head of Growth",
    company: "VentureSync",
    avatar: "HR",
    avatarColor: "from-purple-500 to-pink-500",
    genericText: `Hi Helena,

I see you are the Head of Growth at VentureSync. We have a powerful lead generation system that will help your team book more sales meetings.

Can we set up a quick demo call next Tuesday?

Best,
Alex`,
    aiText: `Hey Helena,

Loved your take in that developer advocacy thread last week. Spot on about developer-led marketing needing community-first approaches rather than standard ads.

We designed a custom B2B sequence that recently drove a 3.8x increase in qualified outbound replies for growth teams in dev-tech. 

Open to checking out the structural flow we used?

Best,
Alex`,
    signals: [
      "Developer advocacy community post",
      "Growth performance metrics thread",
      "Focus on developer-led marketing channels"
    ],
    replyRateGeneric: 3.2,
    replyRateAi: 44.7,
  },
  "Sanjay Patel": {
    name: "Sanjay Patel",
    role: "Director of Product",
    company: "DevFlow",
    avatar: "SP",
    avatarColor: "from-amber-500 to-rose-500",
    genericText: `Hi Sanjay,

I ran across your profile at DevFlow. Our platform helps companies improve product engagement and automate their user sequences.

Are you available for a brief call to see a demo?

Best,
Alex`,
    aiText: `Hey Sanjay,

Congratulations on launching DevFlow v3 last Tuesday! The new developer workspace interface looks incredibly clean.

We just helped another product team automate their context-based engagement flows to boost onboarding conversion by 28% without writing any custom code.

Open to seeing a 2-minute visual blueprint of how they did it?

Cheers,
Alex`,
    signals: [
      "DevFlow v3 public product launch",
      "Design release of developer workspace",
      "Focus on low-code user onboarding journeys"
    ],
    replyRateGeneric: 5.1,
    replyRateAi: 39.2,
  }
};

export function AIMessagePreviewV2() {
  const [selectedLead, setSelectedLead] = useState<LeadKey>("John Smith");
  const activeLead = leads[selectedLead];

  // Dynamic typing simulation
  const [typedMessage, setTypedMessage] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    setScanning(true);
    setTypedMessage("");
    
    // Simulate scan delay before typing
    const scanTimer = setTimeout(() => {
      setScanning(false);
      let index = 0;
      const targetText = activeLead.aiText;
      let timer: NodeJS.Timeout;
      
      const type = () => {
        if (index < targetText.length) {
          setTypedMessage((prev) => prev + targetText.charAt(index));
          index++;
          timer = setTimeout(type, 8);
        }
      };
      
      timer = setTimeout(type, 50);
      return () => clearTimeout(timer);
    }, 1500);

    return () => clearTimeout(scanTimer);
  }, [selectedLead]);

  // Format highlighted tokens dynamically
  const formatTokens = (text: string) => {
    const tokens = [
      "John Smith", "Helena Rostova", "Sanjay Patel",
      "Acme Corp", "VentureSync", "DevFlow",
      "Series B round", "Series B", "launching DevFlow v3",
      "DevFlow v3", "hiring velocity bottlenecks",
      "developer workspace interface", "developer advocacy thread",
      "developer-led marketing", "qualified outbound replies"
    ];

    let output = text;
    tokens.forEach((t) => {
      const regex = new RegExp(`(${t})`, "gi");
      output = output.replace(
        regex,
        `<span class="text-indigo-600 font-extrabold bg-indigo-50 border border-indigo-100/60 px-1.5 rounded-md">$1</span>`
      );
    });

    return <span dangerouslySetInnerHTML={{ __html: output }} />;
  };

  return (
    <section id="ai-outreach" className="py-24 bg-[#f8fafc] relative overflow-hidden border-t border-slate-200/60">
      
      {/* Background ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-br from-indigo-500/[0.015] to-purple-600/[0.015] rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-black mb-4">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>AI Personalization Engine</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight max-w-4xl mx-auto">
            The difference between <span className="text-red-500">cold spam</span> and <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">warm connections</span>
          </h2>
          <p className="mt-4 text-base text-slate-600 max-w-2xl mx-auto font-semibold leading-relaxed">
            Click on different high-profile leads below to see how Qampi scans their profiles, extracts unique signals, and generates a natural message instantly.
          </p>
        </div>

        {/* Lead Selector Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-12 max-w-2xl mx-auto">
          {(Object.keys(leads) as LeadKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedLead(key)}
              className={cn(
                "flex items-center gap-2.5 px-5 py-3 rounded-2xl border text-xs font-black transition-all cursor-pointer shadow-sm",
                selectedLead === key
                  ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                  : "bg-white border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800"
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] text-white font-black shadow-sm",
                leads[key].avatarColor
              )}>
                {leads[key].avatar}
              </div>
              <span>{key}</span>
            </button>
          ))}
        </div>

        {/* Side-by-Side Live Lab Workspace */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto items-stretch">
          
          {/* Panel Left: Standard Template Outreach */}
          <div className="bg-white border border-red-200 rounded-3xl p-6 lg:p-8 flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.01)]">
            <div>
              {/* Header metadata */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center text-red-500">
                    <X className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 leading-none">Traditional Cold Outreach</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-1.5">Generic copy-paste template</p>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-100 text-red-600 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Fail Rate: High
                </div>
              </div>

              {/* Message Block */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 min-h-[220px]">
                <div className="flex items-center gap-2 mb-4 text-[10px] text-slate-400 font-black uppercase tracking-wider">
                  <span>To: {activeLead.name}</span>
                  <span>•</span>
                  <span>{activeLead.role}</span>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed text-slate-600 font-semibold">
                  {activeLead.genericText}
                </pre>
              </div>

              {/* Warnings */}
              <div className="mt-6 space-y-2.5 border-t border-slate-100 pt-4">
                {[
                  "Fails to mention any specific interest or context",
                  "Instantly triggers the recipient's spam defenses",
                  "Directly asks for a call without demonstrating any value"
                ].map((warn) => (
                  <div key={warn} className="flex items-start gap-2 text-xs text-red-600 font-bold leading-tight">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Stat bar */}
            <div className="mt-8 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs font-black mb-2">
                <span className="text-slate-500">Projected Reply Rate</span>
                <span className="text-red-500">{activeLead.replyRateGeneric}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-500 to-rose-600 rounded-full transition-all duration-500"
                  style={{ width: `${(activeLead.replyRateGeneric / 50) * 100}%` }}
                />
              </div>
            </div>

          </div>

          {/* Panel Right: Qampi AI Personalization */}
          <div className="bg-white border border-indigo-200/80 rounded-3xl p-6 lg:p-8 flex flex-col justify-between shadow-[0_12px_40px_rgba(99,102,241,0.04)] relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.01] to-purple-500/[0.01] pointer-events-none rounded-3xl" />
            
            <div className="relative">
              {/* Header metadata */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm animate-pulse">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 leading-none">Qampi AI Outreach</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-1.5">Contextual outbound writing agent</p>
                  </div>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Success Rate: High
                </div>
              </div>

              {/* Message Block with Active states */}
              <div className="bg-slate-50 border border-indigo-100/50 rounded-2xl p-5 min-h-[220px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {scanning ? (
                    <motion.div 
                      key="scan"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-8 space-y-4"
                    >
                      <ScanFace className="w-10 h-10 mx-auto text-indigo-500 animate-pulse" />
                      <div className="space-y-1">
                        <p className="text-xs font-black text-slate-900">Analyzing prospect background...</p>
                        <p className="text-[10px] text-slate-500 font-bold font-mono">Scanning LinkedIn posts, public activity, & firmographics</p>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        {[0, 1, 2].map((i) => (
                          <div 
                            key={i} 
                            className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-4 text-[10px] text-slate-400 font-black uppercase tracking-wider">
                          <span>To: {activeLead.name}</span>
                          <span>•</span>
                          <span>Personalized voice mode active</span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-semibold">
                          {formatTokens(typedMessage)}
                          {typedMessage.length < activeLead.aiText.length && (
                            <span className="w-1.5 h-3.5 bg-indigo-600 inline-block animate-pulse ml-0.5" />
                          )}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Detected Signals Diagnostics */}
              <div className="mt-6 bg-slate-50 border border-slate-200/60 rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Signals Captured:</span>
                </div>
                <div className="space-y-1.5">
                  {activeLead.signals.map((sig) => (
                    <div key={sig} className="flex items-center gap-2 text-[10px] text-slate-700 font-bold">
                      <Check className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{sig}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Performance Stat bar */}
            <div className="mt-8 pt-4 border-t border-slate-100 relative z-10">
              <div className="flex items-center justify-between text-xs font-black mb-2">
                <span className="text-slate-500">Projected Reply Rate</span>
                <span className="text-indigo-600">{activeLead.replyRateAi}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-1000"
                  style={{ width: `${(activeLead.replyRateAi / 50) * 100}%` }}
                />
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
