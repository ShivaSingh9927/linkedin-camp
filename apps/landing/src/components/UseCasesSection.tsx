'use client';

import { motion } from "framer-motion";
import { Rocket, TrendingUp, Users } from "lucide-react";

const useCases = [
  {
    icon: Rocket,
    title: "For Founders & Business Owners",
    description: "Outreach that doesn't steal your day and still gets replies. Focus on building while Qampi handles prospecting.",
    stats: "3x more meetings",
    color: "from-primary to-indigo-600",
    image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600&h=400&auto=format&fit=crop&q=80",
  },
  {
    icon: TrendingUp,
    title: "For Sales Reps",
    description: "Book more meetings without living on LinkedIn. Automate your pipeline and spend time closing deals.",
    stats: "40% reply rate",
    color: "from-emerald-500 to-teal-600",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&auto=format&fit=crop&q=80",
  },
  {
    icon: Users,
    title: "For Recruiters & HR",
    description: "Reach top talent before they apply elsewhere. Build your talent pipeline on autopilot.",
    stats: "10x more candidates",
    color: "from-amber-500 to-orange-600",
    image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&h=400&auto=format&fit=crop&q=80",
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
              className="group bg-white rounded-3xl overflow-hidden border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500"
            >
              {/* Image */}
              <div className="relative h-48 overflow-hidden">
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  src={useCase.image}
                  alt={useCase.title}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className={`absolute top-4 left-4 w-12 h-12 bg-gradient-to-br ${useCase.color} rounded-xl flex items-center justify-center shadow-lg`}>
                  <useCase.icon className="w-6 h-6 text-white" />
                </div>
                <div className="absolute bottom-4 left-4">
                  <span className="bg-white/90 backdrop-blur-sm text-slate-900 text-xs font-bold px-3 py-1.5 rounded-full">
                    {useCase.stats}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl font-black text-slate-900 mb-3">{useCase.title}</h3>
                <p className="text-slate-600 leading-relaxed">{useCase.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
