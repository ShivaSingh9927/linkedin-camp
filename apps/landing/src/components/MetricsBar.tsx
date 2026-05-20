'use client';

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { MessageSquare, TrendingUp, Users, Zap } from "lucide-react";

const metrics = [
  {
    value: 10000,
    suffix: "+",
    label: "AI messages sent",
    icon: MessageSquare,
    prefix: "",
  },
  {
    value: 34,
    suffix: "%",
    label: "Average reply rate",
    icon: TrendingUp,
    prefix: "",
  },
  {
    value: 3000,
    suffix: "+",
    label: "Active users",
    icon: Users,
    prefix: "",
  },
  {
    value: 3,
    suffix: "x",
    label: "More replies than manual",
    icon: Zap,
    prefix: "",
  },
];

function AnimatedCounter({ value, suffix, prefix }: { value: number; suffix: string; prefix: string }) {
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

export function MetricsBar() {
  return (
    <section className="py-16 lg:py-20 bg-slate-950 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px]" />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="flex items-center justify-center mb-3">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <metric.icon className="w-6 h-6 text-primary" />
                </div>
              </div>
              <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-2">
                <AnimatedCounter value={metric.value} suffix={metric.suffix} prefix={metric.prefix} />
              </p>
              <p className="text-sm text-slate-400 font-medium">{metric.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
