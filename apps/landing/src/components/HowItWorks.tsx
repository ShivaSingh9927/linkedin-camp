'use client';

import { Search, Workflow, MessageSquarePlus, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    step: "STEP 01",
    title: "Target",
    desc: "Identify your ideal customers on LinkedIn using our native Chrome extension.",
    icon: Search,
    shift: false,
  },
  {
    step: "STEP 02",
    title: "Automate",
    desc: "Launch multi-channel sequences across LinkedIn and Cold Email automatically.",
    icon: Workflow,
    shift: true,
  },
  {
    step: "STEP 03",
    title: "Reply",
    desc: "Engage with prospects directly through our unified web dashboard Inbox.",
    icon: MessageSquarePlus,
    shift: false,
  },
  {
    step: "STEP 04",
    title: "Sync",
    desc: "Push warm leads directly to HubSpot, Pipedrive, or Notion in one click.",
    icon: ExternalLink,
    shift: true,
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const }
  }
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-24">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-bold text-slate-900 mb-6"
          >
            Your Sales Team on Autopilot
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-lg text-slate-500 max-w-2xl mx-auto"
          >
            Four simple steps to turn your LinkedIn browser into a meeting-generating machine.
          </motion.p>
        </div>

        {/* Steps Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={index}
                variants={cardVariants}
                className={cn(
                  "group bg-white p-8 rounded-3xl border border-slate-100 hover:border-primary/20 card-shadow transition-all duration-300",
                  item.shift ? "lg:translate-y-8" : ""
                )}
              >
                <div className="w-14 h-14 bg-blue-50 text-primary rounded-2xl flex items-center justify-center mb-8 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  <Icon className="w-7 h-7" />
                </div>
                <span className="text-xs font-bold text-primary mb-3 block">{item.step}</span>
                <h3 className="text-xl font-bold mb-4 text-slate-900">{item.title}</h3>
                <p className="text-slate-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Extra spacing to compensate for translation shifts */}
        <div className="h-8 hidden lg:block"></div>

      </div>
    </section>
  );
}

// Simple local fallback for classnames utility if utils fails
function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
