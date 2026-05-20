'use client';

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Alex Rivera",
    role: "Founder at TechStart",
    content: "Qampi completely transformed our outreach. We went from 5 meetings a month to 30+ in just 6 weeks. The AI messages actually sound like me!",
    rating: 5,
    avatar: "AR",
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&auto=format&fit=crop&q=80",
  },
  {
    name: "Sarah Chen",
    role: "Sales Director at ScaleUp",
    content: "I was skeptical about LinkedIn automation, but Qampi's human-like approach is incredible. Our reply rate jumped from 8% to 34%.",
    rating: 5,
    avatar: "SC",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&auto=format&fit=crop&q=80",
  },
  {
    name: "Mike Johnson",
    role: "Recruiter at TalentHub",
    content: "As a recruiter, time is everything. Qampi lets me reach 10x more candidates while maintaining personal touch. Game changer.",
    rating: 5,
    avatar: "MJ",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&auto=format&fit=crop&q=80",
  },
  {
    name: "Emily Davis",
    role: "Marketing Lead at GrowthCo",
    content: "The campaign builder is so intuitive. I set up a 5-step sequence in 10 minutes and started getting replies the same day.",
    rating: 5,
    avatar: "ED",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&auto=format&fit=crop&q=80",
  },
  {
    name: "David Park",
    role: "CEO at InnovateLab",
    content: "We tried 3 other tools before Qampi. Nothing comes close. The safety features give us confidence, and the results speak for themselves.",
    rating: 5,
    avatar: "DP",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&auto=format&fit=crop&q=80",
  },
  {
    name: "Lisa Thompson",
    role: "VP Sales at CloudBase",
    content: "Aigeon AI is the real deal. Our prospects think we hired a dedicated copywriter. The personalized messages are indistinguishable from human-written ones.",
    rating: 5,
    avatar: "LT",
    image: "https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&h=400&auto=format&fit=crop&q=80",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 lg:py-32 bg-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

        <div className="flex flex-wrap justify-center gap-8">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="max-w-80 w-full group"
            >
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    src={testimonial.image}
                    alt={testimonial.name}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <Quote className="absolute top-4 left-4 w-8 h-8 text-white/60" />
                </div>

                {/* Content */}
                <div className="p-5">
                  <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">
                    "{testimonial.content}"
                  </p>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{testimonial.name}</p>
                        <p className="text-xs text-slate-500">{testimonial.role}</p>
                      </div>
                    </div>

                    <div className="flex space-x-0.5">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-current" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
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
