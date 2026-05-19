'use client';

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Alex Rivera",
    role: "Founder at TechStart",
    content: "Qampi completely transformed our outreach. We went from 5 meetings a month to 30+ in just 6 weeks. The AI messages actually sound like me!",
    rating: 5,
    avatar: "A",
  },
  {
    name: "Sarah Chen",
    role: "Sales Director at ScaleUp",
    content: "I was skeptical about LinkedIn automation, but Qampi's human-like approach is incredible. Our reply rate jumped from 8% to 34%.",
    rating: 5,
    avatar: "S",
  },
  {
    name: "Mike Johnson",
    role: "Recruiter at TalentHub",
    content: "As a recruiter, time is everything. Qampi lets me reach 10x more candidates while maintaining personal touch. Game changer.",
    rating: 5,
    avatar: "M",
  },
  {
    name: "Emily Davis",
    role: "Marketing Lead at GrowthCo",
    content: "The campaign builder is so intuitive. I set up a 5-step sequence in 10 minutes and started getting replies the same day.",
    rating: 5,
    avatar: "E",
  },
  {
    name: "David Park",
    role: "CEO at InnovateLab",
    content: "We tried 3 other tools before Qampi. Nothing comes close. The safety features give us confidence, and the results speak for themselves.",
    rating: 5,
    avatar: "D",
  },
];

export function TestimonialsSection() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-24 lg:py-32 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            This is why users{" "}
            <span className="text-primary">love Qampi</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            75% of our users had never done LinkedIn outreach before. Now they're getting replies.
          </p>
        </motion.div>

        {/* Main testimonial */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="bg-gradient-to-br from-slate-50 to-purple-50 rounded-3xl p-8 lg:p-12 border border-slate-100 relative min-h-[280px]">
            <svg className="absolute top-6 left-6 w-12 h-12 text-primary/10" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>

            <div className="relative pt-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                >
                  <p className="text-xl lg:text-2xl text-slate-700 leading-relaxed font-medium">
                    "{testimonials[current].content}"
                  </p>

                  <div className="mt-8 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-primary to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl">
                        {testimonials[current].avatar}
                      </div>
                      <div>
                        <p className="font-black text-slate-900">{testimonials[current].name}</p>
                        <p className="text-sm text-slate-500">{testimonials[current].role}</p>
                      </div>
                    </div>

                    <div className="flex space-x-1">
                      {[...Array(testimonials[current].rating)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 text-amber-400 fill-current" />
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Navigation dots */}
        <div className="flex justify-center space-x-2">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-3 rounded-full transition-all duration-300 ${
                i === current ? "bg-primary w-8" : "bg-slate-200 w-3 hover:bg-slate-300"
              }`}
            />
          ))}
        </div>

        {/* Rating badges */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-16 flex flex-wrap justify-center gap-6"
        >
          {[
            { platform: "Chrome Store", rating: "4.8", reviews: "2,000+" },
            { platform: "G2", rating: "4.5", reviews: "500+" },
            { platform: "Capterra", rating: "4.5", reviews: "300+" },
          ].map((badge) => (
            <div key={badge.platform} className="bg-slate-50 rounded-2xl px-6 py-4 border border-slate-100 text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-current" />
                ))}
              </div>
              <p className="font-black text-slate-900">{badge.rating} on {badge.platform}</p>
              <p className="text-xs text-slate-500">{badge.reviews} reviews</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
