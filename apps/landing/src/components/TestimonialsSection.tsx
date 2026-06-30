'use client';

import React, { useRef, useState } from 'react';
import { motion } from "framer-motion";
import { Star, Building2, Quote } from "lucide-react";

// --- Types ---
interface Testimonial {
  name: string;
  role: string;
  company: string;
  content: string;
  image: string;
  theme: string;
  accent: string;
  rating: number;
}

// --- Data ---
const testimonials: Testimonial[] = [
  {
    name: "Alex Rivera",
    role: "Founder",
    company: "TechStart",
    content: "Qampi completely transformed our outreach. We went from 5 meetings a month to 30+ in just 6 weeks. The AI messages actually sound like me!",
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&auto=format&fit=crop&q=80",
    theme: "bg-indigo-50/80 border-indigo-100",
    accent: "text-indigo-600",
    rating: 5
  },
  {
    name: "Sarah Chen",
    role: "Sales Director",
    company: "ScaleUp",
    content: "I was skeptical about LinkedIn automation, but Qampi's human-like approach is incredible. Our reply rate jumped from 8% to 34%.",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&auto=format&fit=crop&q=80",
    theme: "bg-emerald-50/80 border-emerald-100",
    accent: "text-emerald-600",
    rating: 5
  },
  {
    name: "Mike Johnson",
    role: "Recruiter",
    company: "TalentHub",
    content: "As a recruiter, time is everything. Qampi lets me reach 10x more candidates while maintaining personal touch. Game changer.",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&auto=format&fit=crop&q=80",
    theme: "bg-amber-50/80 border-amber-100",
    accent: "text-amber-600",
    rating: 5
  },
  {
    name: "Emily Davis",
    role: "Marketing Lead",
    company: "GrowthCo",
    content: "The campaign builder is so intuitive. I set up a 5-step sequence in 10 minutes and started getting replies the same day.",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&auto=format&fit=crop&q=80",
    theme: "bg-violet-50/80 border-violet-100",
    accent: "text-violet-600",
    rating: 5
  },
  {
    name: "David Park",
    role: "CEO",
    company: "InnovateLab",
    content: "We tried 3 other tools before Qampi. Nothing comes close. The safety features give us confidence, and the results speak for themselves.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&auto=format&fit=crop&q=80",
    theme: "bg-rose-50/80 border-rose-100",
    accent: "text-rose-600",
    rating: 5
  },
  {
    name: "Lisa Thompson",
    role: "VP Sales",
    company: "CloudBase",
    content: "Qampi is the real deal. Our prospects think we hired a dedicated copywriter. The personalized messages are indistinguishable from human-written ones.",
    image: "https://images.unsplash.com/photo-1548142813-c348350df52b?w=150&h=150&auto=format&fit=crop&q=80",
    theme: "bg-cyan-50/80 border-cyan-100",
    accent: "text-cyan-600",
    rating: 5
  },
  {
    name: "James Wilson",
    role: "Head of Growth",
    company: "Nexus",
    content: "The analytics dashboard is a masterpiece. I can see exactly which templates are performing best and optimize on the fly. Beautiful and functional.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&auto=format&fit=crop&q=80",
    theme: "bg-fuchsia-50/80 border-fuchsia-100",
    accent: "text-fuchsia-600",
    rating: 5
  },
  {
    name: "Ana Martinez",
    role: "BDR Manager",
    company: "Apex Solutions",
    content: "My team of 10 BDRs uses Qampi daily. The team collaboration features ensure we never double-message the same prospect. It's flawless.",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&auto=format&fit=crop&q=80",
    theme: "bg-sky-50/80 border-sky-100",
    accent: "text-sky-600",
    rating: 5
  },
  {
    name: "Thomas Wright",
    role: "Agency Owner",
    company: "Wright Media",
    content: "We manage LinkedIn outreach for 20+ clients. Qampi handles it all without breaking a sweat. It's the engine powering our agency.",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&auto=format&fit=crop&q=80",
    theme: "bg-teal-50/80 border-teal-100",
    accent: "text-teal-600",
    rating: 5
  },
];

const firstColumn = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn = testimonials.slice(6, 9);

// --- Sub-Components ---
const TestimonialsColumn = (props: {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
}) => {
  return (
    <div className={props.className}>
      <motion.ul
        animate={{
          translateY: "-50%",
        }}
        transition={{
          duration: props.duration || 35,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6 list-none m-0 p-0 hover:[animation-play-state:paused]"
      >
        {[...new Array(2)].map((_, index) => (
          <React.Fragment key={index}>
            {props.testimonials.map((t, i) => (
              <motion.li 
                key={`${index}-${i}`}
                whileHover={{ 
                  scale: 1.03,
                  y: -5,
                  transition: { type: "spring", stiffness: 400, damping: 17 }
                }}
                className={`p-8 rounded-3xl border ${t.theme} shadow-sm hover:shadow-xl transition-all duration-300 max-w-[420px] w-full cursor-pointer group relative overflow-hidden`} 
              >
                {/* Watermark Icon */}
                <div className="absolute -top-4 -right-4 p-6 opacity-[0.03] group-hover:opacity-10 transition-opacity duration-500 pointer-events-none transform group-hover:scale-110 group-hover:-rotate-6">
                  <Building2 size={120} className={t.accent} />
                </div>
                
                <div className="flex space-x-1 mb-6 relative z-10">
                  {[...Array(t.rating)].map((_, idx) => (
                    <Star key={idx} className={`w-4 h-4 ${t.accent} fill-current`} />
                  ))}
                </div>
                
                <blockquote className="m-0 p-0 relative z-10">
                  <div className="relative">
                    <Quote className={`absolute -top-3 -left-3 w-8 h-8 opacity-20 ${t.accent}`} />
                    <p className="text-[15px] text-slate-700 font-medium leading-relaxed mb-8 relative z-10">
                      "{t.content}"
                    </p>
                  </div>
                  
                  <footer className="flex items-center gap-4 pt-4 border-t border-black/5">
                    <img
                      src={t.image}
                      alt={`Avatar of ${t.name}`}
                      className={`h-12 w-12 rounded-full object-cover ring-4 ${t.theme.split(' ')[0].replace('50/80', '100')} group-hover:ring-white shadow-sm transition-all`}
                    />
                    <div className="flex flex-col">
                      <cite className="font-bold not-italic tracking-tight text-[15px] text-slate-900">
                        {t.name}
                      </cite>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                        {t.role} <span className="lowercase normal-case font-semibold">at</span> <span className={`${t.accent} ml-0.5`}>{t.company}</span>
                      </span>
                    </div>
                  </footer>
                </blockquote>
              </motion.li>
            ))}
          </React.Fragment>
        ))}
      </motion.ul>
    </div>
  );
};

export function TestimonialsSection() {
  return (
    <section className="py-24 lg:py-32 bg-purple-50/30 relative overflow-hidden" id="testimonials">
      {/* Decorative background blurs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="relative max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Cool Bird Mascot Sticker */}
        <motion.div
          className="absolute right-[5%] top-4 md:right-[15%] lg:right-[20%] w-14 md:w-16 z-20 pointer-events-none mix-blend-darken opacity-90 hidden md:block"
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        >
          <motion.img
            src="/stickers/bird_cool.png"
            alt="Cool Bird Mascot"
            className="w-full h-full object-contain"
            animate={{ y: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-white border border-slate-200 shadow-sm text-slate-700 px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            Wall of Love
          </span>
          <h2 className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold text-slate-900">
            This is why users{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-600">love Qampi</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Discover how thousands of sales teams, agencies, and founders stream-line their outreach operations and book more meetings.
          </p>
        </motion.div>

        {/* Scrolling Columns */}
        <div 
          className="flex justify-center gap-8 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] h-[600px] overflow-hidden group"
          role="region"
          aria-label="Scrolling Testimonials"
        >
          <TestimonialsColumn testimonials={firstColumn} duration={35} />
          <TestimonialsColumn testimonials={secondColumn} className="hidden md:block" duration={45} />
          <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={38} />
        </div>
        
        {/* Trust Badges */}
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
            <div key={badge.platform} className="bg-white rounded-2xl px-6 py-4 border border-slate-100 shadow-sm text-center">
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
