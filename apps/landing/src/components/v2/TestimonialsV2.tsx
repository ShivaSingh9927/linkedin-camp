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
  },
  {
    name: "Sarah Chen",
    role: "Sales Director at ScaleUp",
    content: "I was skeptical about LinkedIn automation, but Qampi's human-like approach is incredible. Our reply rate jumped from 8% to 34%.",
    rating: 5,
    avatar: "SC",
  },
  {
    name: "Mike Johnson",
    role: "Recruiter at TalentHub",
    content: "As a recruiter, time is everything. Qampi lets me reach 10x more candidates while maintaining personal touch. Game changer.",
    rating: 5,
    avatar: "MJ",
  },
  {
    name: "Emily Davis",
    role: "Marketing Lead at GrowthCo",
    content: "The campaign builder is so intuitive. I set up a 5-step sequence in 10 minutes and started getting replies the same day.",
    rating: 5,
    avatar: "ED",
  },
  {
    name: "David Park",
    role: "CEO at InnovateLab",
    content: "We tried 3 other tools before Qampi. Nothing comes close. The safety features give us confidence, and the results speak for themselves.",
    rating: 5,
    avatar: "DP",
  },
  {
    name: "Lisa Thompson",
    role: "VP Sales at CloudBase",
    content: "Aigeon AI is the real deal. Our prospects think we hired a dedicated copywriter. The personalized messages are indistinguishable from human-written.",
    rating: 5,
    avatar: "LT",
  },
  {
    name: "Ryan Mitchell",
    role: "Head of Growth at DataPulse",
    content: "We onboarded 45 new enterprise clients in Q1 using Qampi. The AI sequences feel like a senior SDR wrote each one by hand.",
    rating: 5,
    avatar: "RM",
  },
  {
    name: "Priya Sharma",
    role: "Founder at NexusAI",
    content: "Qampi's research engine found insights I never would have spotted. Personalized follow-ups based on a tweet from 3 weeks ago — incredible.",
    rating: 5,
    avatar: "PS",
  },
];

const badges = [
  { platform: "Chrome Store", rating: "4.8", reviews: "2,000+" },
  { platform: "G2", rating: "4.5", reviews: "500+" },
  { platform: "Capterra", rating: "4.5", reviews: "300+" },
];

function TestimonialCard({ testimonial }: { testimonial: typeof testimonials[0] }) {
  return (
    <div className="flex-shrink-0 w-[340px] bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 p-6 group mx-3">
      {/* Stars */}
      <div className="flex space-x-0.5 mb-4">
        {[...Array(testimonial.rating)].map((_, i) => (
          <Star key={i} className="w-4 h-4 text-amber-400 fill-current" />
        ))}
      </div>
      
      {/* Quote */}
      <p className="text-sm text-slate-600 leading-relaxed font-medium mb-6 min-h-[60px]">
        &ldquo;{testimonial.content}&rdquo;
      </p>
      
      {/* Author */}
      <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shadow-sm">
          {testimonial.avatar}
        </div>
        <div>
          <p className="text-sm font-black text-slate-900">{testimonial.name}</p>
          <p className="text-xs text-slate-500 font-medium">{testimonial.role}</p>
        </div>
      </div>
    </div>
  );
}

export function TestimonialsV2() {
  const row1 = testimonials.slice(0, 4);
  const row2 = testimonials.slice(4, 8);

  return (
    <section className="py-24 sm:py-32 bg-slate-50 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/[0.03] rounded-full blur-[140px] -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />

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
          <span className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-600 px-4 py-1.5 rounded-full text-xs font-black mb-4 shadow-sm">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
            <span>Testimonials</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
            This is why users{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
              love Qampi
            </span>
          </h2>
          <p className="mt-4.5 text-base sm:text-lg text-slate-600 font-semibold max-w-2xl mx-auto leading-relaxed">
            75% of our users had never done LinkedIn outreach before. Now they&apos;re getting replies.
          </p>
        </motion.div>

        {/* Dual Row Marquee */}
        <div className="relative">
          {/* Gradient edge masks */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none" />
          
          {/* Row 1 - scrolls left */}
          <div className="overflow-hidden mb-4">
            <motion.div
              className="flex"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            >
              {[...row1, ...row1, ...row1, ...row1].map((t, i) => (
                <TestimonialCard key={`r1-${i}`} testimonial={t} />
              ))}
            </motion.div>
          </div>

          {/* Row 2 - scrolls right */}
          <div className="overflow-hidden">
            <motion.div
              className="flex"
              animate={{ x: ["-50%", "0%"] }}
              transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
            >
              {[...row2, ...row2, ...row2, ...row2].map((t, i) => (
                <TestimonialCard key={`r2-${i}`} testimonial={t} />
              ))}
            </motion.div>
          </div>
        </div>

        {/* Rating Badges */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-16 flex flex-wrap justify-center gap-5"
        >
          {badges.map((badge, i) => (
            <motion.div
              key={badge.platform}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="bg-white rounded-2xl px-6 py-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 text-center"
            >
              <div className="flex items-center justify-center space-x-0.5 mb-1.5">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 text-amber-400 fill-current" />
                ))}
              </div>
              <p className="font-black text-slate-900 text-sm">{badge.rating} on {badge.platform}</p>
              <p className="text-xs text-slate-500 font-medium">{badge.reviews} reviews</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
