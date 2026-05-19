'use client';

import { motion } from "framer-motion";
import { Rocket, TrendingUp, Users } from "lucide-react";

const useCases = [
  {
    icon: Rocket,
    emoji: "🚀",
    title: "For Founders & Business Owners",
    description: "Outreach that doesn't steal your day and still gets replies. Focus on building while Qampi handles prospecting.",
    stats: "3x more meetings",
    color: "from-primary to-indigo-600",
  },
  {
    icon: TrendingUp,
    emoji: "",
    title: "For Sales Reps",
    description: "Book more meetings without living on LinkedIn. Automate your pipeline and spend time closing deals.",
    stats: "40% reply rate",
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: Users,
    emoji: "🎯",
    title: "For Recruiters & HR",
    description: "Reach top talent before they apply elsewhere. Build your talent pipeline on autopilot.",
    stats: "10x more candidates",
    color: "from-amber-500 to-orange-600",
  },
];

export function UseCasesSection() {
  return (
    <section className="py-24 lg:py-32 bg-slate-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            Use Cases
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            Who is Qampi{" "}
            <span className="text-primary">for?</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            If this sounds like you, you're in the right place.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {useCases.map((useCase, i) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              whileHover={{ y: -8 }}
              className="group bg-white rounded-3xl p-8 border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500"
            >
              <div className="text-4xl mb-4">{useCase.emoji}</div>
              <h3 className="text-xl font-black text-slate-900 mb-3">{useCase.title}</h3>
              <p className="text-slate-600 leading-relaxed mb-6">{useCase.description}</p>
              <div className={`inline-block bg-gradient-to-r text-white text-sm font-bold px-4 py-2 rounded-xl ${useCase.color}`}>
                {useCase.stats}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
