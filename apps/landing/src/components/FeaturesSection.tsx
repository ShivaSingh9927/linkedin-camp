import { Bot, Shield, BarChart3, MessageSquare, Zap, Users } from "lucide-react";
import { AnimatedSection } from "./AnimatedSection";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Bot,
    title: "AI-Powered Messages",
    description: "Generate personalized messages that sound like you. Our AI analyzes profiles and crafts messages that get replies.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Shield,
    title: "Safe & Human-Like",
    description: "Stay within LinkedIn limits with randomized delays, human-like behavior patterns, and automatic pause on detection.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: BarChart3,
    title: "Smart Analytics",
    description: "Track reply rates, connection acceptance, and campaign performance. Know what works and optimize in real-time.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: MessageSquare,
    title: "Auto Follow-Up",
    description: "Never lose a lead again. Automated follow-up sequences that nurture prospects until they reply or convert.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Zap,
    title: "Smart Campaigns",
    description: "Build multi-step campaigns with visual builder. Combine visits, likes, connection requests, and messages.",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Share lead lists, coordinate outreach, and avoid duplicate messaging. Perfect for sales teams of any size.",
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 lg:py-32 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="text-center mb-16 lg:mb-20">
            <span className="inline-block bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
              Features
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              Everything you need to{" "}
              <span className="text-primary">scale outreach</span>
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Powerful features designed to help you connect with the right people and start meaningful conversations.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, i) => (
            <AnimatedSection key={feature.title} delay={i * 0.1}>
              <div className="group bg-slate-50 rounded-3xl p-8 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 border border-transparent hover:border-slate-100 transition-all duration-500 h-full">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform", feature.bg)}>
                  <feature.icon className={cn("w-7 h-7", feature.color)} />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
