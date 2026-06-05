'use client';

import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { Users, ArrowRight, Sparkles, Building2, Target } from "lucide-react";
import { MouseEvent } from "react";

const useCases = [
  {
    icon: Building2,
    title: "For Founders & Owners",
    description: "Outreach that doesn't steal your day. Focus on building your product while Qampi handles the prospecting pipeline.",
    stats: "3x more meetings",
    color: "from-blue-500 to-indigo-600",
    shadow: "shadow-blue-500/20",
    image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600&h=400&auto=format&fit=crop&q=80",
    delay: 0.1
  },
  {
    icon: Target,
    title: "For Sales Reps",
    description: "Book more meetings without living on LinkedIn. Automate your pipeline and spend your precious time actually closing deals.",
    stats: "40% reply rate",
    color: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/20",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&auto=format&fit=crop&q=80",
    delay: 0.3
  },
  {
    icon: Users,
    title: "For Recruiters & HR",
    description: "Reach top talent before they apply elsewhere. Build your talent pipeline on autopilot and close the best candidates.",
    stats: "10x more candidates",
    color: "from-indigo-500 to-fuchsia-600",
    shadow: "shadow-fuchsia-500/20",
    image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&h=400&auto=format&fit=crop&q=80",
    delay: 0.5
  },
];

const UseCaseCard = ({ useCase }: { useCase: typeof useCases[0] }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ delay: useCase.delay, duration: 0.7, type: "spring", bounce: 0.4 }}
      onMouseMove={handleMouseMove}
      className="group relative flex flex-col bg-white rounded-[2.5rem] overflow-hidden border border-slate-100/80 hover:border-indigo-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl transition-all duration-500"
    >
      {/* Spotlight Hover Effect */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-[2.5rem] opacity-0 transition duration-300 group-hover:opacity-100 z-20"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              600px circle at ${mouseX}px ${mouseY}px,
              rgba(99, 102, 241, 0.05),
              transparent 80%
            )
          `,
        }}
      />

      {/* Image Header */}
      <div className="relative h-64 md:h-56 overflow-hidden">
        <motion.img
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          src={useCase.image}
          alt={useCase.title}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent transition-opacity duration-500" />
        
        {/* Floating Icon */}
        <div className={`absolute top-5 left-5 w-14 h-14 bg-gradient-to-br ${useCase.color} rounded-2xl flex items-center justify-center shadow-lg ${useCase.shadow} border border-white/20 backdrop-blur-md group-hover:scale-110 transition-transform duration-500`}>
          <useCase.icon className="w-7 h-7 text-white" />
        </div>
        
        {/* Floating Stat Badge */}
        <div className="absolute bottom-5 left-5 translate-y-2 opacity-90 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-bold px-4 py-2 rounded-full flex items-center gap-2 shadow-xl">
            <Sparkles className="w-4 h-4 text-blue-300" />
            {useCase.stats}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 flex flex-col flex-grow bg-white z-10 relative">
        <h3 className="text-2xl font-black text-slate-800 mb-4 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 transition-all duration-300">
          {useCase.title}
        </h3>
        <p className="text-slate-600 leading-relaxed font-medium">
          {useCase.description}
        </p>
        
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-slate-400 group-hover:text-indigo-600 transition-colors mt-auto">
          <span>Explore Use Case</span>
          <ArrowRight className="w-5 h-5 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500" />
        </div>
      </div>
    </motion.div>
  );
};

export function UseCasesSection() {
  return (
    <section className="py-32 bg-white relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-white to-transparent pointer-events-none" />
      <div className="absolute top-40 right-[-10%] w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-[-10%] w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col items-center text-center mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-6 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Who We Serve
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight"
          >
            Who is Qampi <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">for?</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-xl text-slate-500 max-w-2xl font-medium"
          >
            Whether you're a scrappy startup founder or a seasoned sales rep, Qampi adapts to your specific outreach needs.
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 md:gap-12">
          {useCases.map((useCase) => (
            <UseCaseCard key={useCase.title} useCase={useCase} />
          ))}
        </div>
      </div>
    </section>
  );
}
