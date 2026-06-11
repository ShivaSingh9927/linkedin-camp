'use client';

import { motion } from "framer-motion";
import { Rocket, TrendingUp, Users } from "lucide-react";

const useCases = [
  {
    icon: Rocket,
    title: "For Founders & Business Owners",
    description: "Outreach that doesn't steal your day and still gets replies. Focus on building while Qampi handles prospecting.",
    stats: "3x more meetings",
    gradient: "from-indigo-500 to-purple-600",
    image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600&h=400&auto=format&fit=crop&q=80",
  },
  {
    icon: TrendingUp,
    title: "For Sales Reps",
    description: "Book more meetings without living on LinkedIn. Automate your pipeline and spend time closing deals.",
    stats: "40% reply rate",
    gradient: "from-emerald-500 to-teal-600",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&auto=format&fit=crop&q=80",
  },
  {
    icon: Users,
    title: "For Recruiters & HR",
    description: "Reach top talent before they apply elsewhere. Build your talent pipeline on autopilot.",
    stats: "10x more candidates",
    gradient: "from-amber-500 to-orange-600",
    image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&h=400&auto=format&fit=crop&q=80",
  },
];

export function UseCasesV2() {
  return (
    <section className="py-24 sm:py-32 bg-white relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/4 right-1/10 w-[500px] h-[500px] bg-indigo-500/[0.02] rounded-full blur-[140px] pointer-events-none" />

      {/* Section Divider */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-200/60 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-black mb-4 shadow-sm">
            <Rocket className="w-3.5 h-3.5 text-indigo-500" />
            <span>Use Cases</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
            Who is Qampi{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
              for?
            </span>
          </h2>
          <p className="mt-4.5 text-base sm:text-lg text-slate-600 font-semibold max-w-2xl mx-auto leading-relaxed">
            If this sounds like you, you&apos;re in the right place.
          </p>
        </motion.div>

        {/* Cards Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {useCases.map((useCase, i) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              whileHover={{ y: -8, transition: { duration: 0.3, ease: "easeOut" } }}
              className="group bg-white rounded-3xl overflow-hidden border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500"
            >
              {/* Image */}
              <div className="relative h-48 overflow-hidden">
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  src={useCase.image}
                  alt={useCase.title}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className={`absolute top-4 left-4 w-12 h-12 bg-gradient-to-br ${useCase.gradient} rounded-xl flex items-center justify-center shadow-lg`}>
                  <useCase.icon className="w-6 h-6 text-white" />
                </div>
                <div className="absolute bottom-4 left-4">
                  <span className="bg-white/90 backdrop-blur-sm text-slate-900 text-xs font-black px-3 py-1.5 rounded-full shadow-sm">
                    {useCase.stats}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">{useCase.title}</h3>
                <p className="text-slate-600 leading-relaxed font-medium text-sm">{useCase.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
