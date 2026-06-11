'use client';

import { useEffect, useState, useRef } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { MessageSquare, TrendingUp, Users, Zap } from "lucide-react";

const metrics = [
  {
    value: 10000,
    suffix: "+",
    label: "AI messages sent",
    icon: MessageSquare,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50 border-indigo-100/50",
  },
  {
    value: 34,
    suffix: "%",
    label: "Average reply rate",
    icon: TrendingUp,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 border-emerald-100/50",
  },
  {
    value: 3000,
    suffix: "+",
    label: "Active users",
    icon: Users,
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-100/50",
  },
  {
    value: 3,
    suffix: "x",
    label: "More replies than manual",
    icon: Zap,
    color: "text-amber-600",
    bgColor: "bg-amber-50 border-amber-100/50",
  },
];

function AnimatedCounter({ value, suffix, prefix = "" }: { value: number; suffix: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isInView, value]);

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

export function MetricsBarV2() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

  return (
    <section ref={ref} className="py-16 lg:py-20 relative overflow-hidden bg-white/40 backdrop-blur-md border-y border-slate-200/80">
      {/* Background effects with parallax */}
      <motion.div style={{ y: bgY }} className="absolute inset-0">
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-indigo-500/[0.03] rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-purple-500/[0.03] rounded-full blur-[80px]" />
      </motion.div>

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.4]" style={{
        backgroundImage: `radial-gradient(#e2e8f0 1.5px, transparent 1.5px)`,
        backgroundSize: '24px 24px'
      }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ 
                type: "spring",
                stiffness: 100,
                damping: 20,
                delay: i * 0.1 
              }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_20px_50px_rgba(99,102,241,0.06)] hover:border-slate-300/80 transition-all duration-300 text-center flex flex-col items-center"
            >
              <div className="flex items-center justify-center mb-4">
                <div className={`w-12 h-12 ${metric.bgColor} border rounded-2xl flex items-center justify-center shadow-sm`}>
                  <metric.icon className={`w-5.5 h-5.5 ${metric.color}`} />
                </div>
              </div>
              <p className="text-3xl sm:text-4xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mb-1">
                <AnimatedCounter value={metric.value} suffix={metric.suffix} />
              </p>
              <p className="text-xs sm:text-sm text-slate-500 font-semibold leading-snug">{metric.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
