"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import {
  Mail,
  UserPlus,
  Sparkles,
  MessageSquare,
  Database,
  TrendingUp,
  Award,
  Users,
  CheckCircle,
  Star,
  ArrowRight,
  Zap,
  ShieldCheck,
  Bot,
  Network
} from "lucide-react"
import { motion, useScroll, useTransform, useInView, useSpring } from "framer-motion"
import { MagneticButton } from "./MagneticButton"

export default function AboutUsSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(sectionRef, { once: false, amount: 0.1 })
  const isStatsInView = useInView(statsRef, { once: false, amount: 0.3 })

  // Parallax effect for decorative elements
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  })

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -50])
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 50])
  const rotate1 = useTransform(scrollYProgress, [0, 1], [0, 20])
  const rotate2 = useTransform(scrollYProgress, [0, 1], [0, -20])

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 40, opacity: 0, scale: 0.95 },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: { type: "spring" as const, stiffness: 100, damping: 15 },
    },
  }

  const services = [
    {
      icon: <Mail className="w-6 h-6" />,
      secondaryIcon: <Sparkles className="w-4 h-4 absolute -top-1 -right-1 text-blue-500" />,
      title: "Email Hunting",
      description: "Instantly find and verify corporate email addresses of your target decision-makers directly from LinkedIn profiles.",
      position: "left",
      theme: { text: "text-blue-600", bg: "bg-blue-50", hoverBg: "group-hover:bg-blue-100", border: "border-blue-100/50" }
    },
    {
      icon: <UserPlus className="w-6 h-6" />,
      secondaryIcon: <CheckCircle className="w-4 h-4 absolute -top-1 -right-1 text-indigo-500" />,
      title: "Auto-Connecting",
      description: "Automate personalized connection requests with smart delays and custom variables to organically grow your network.",
      position: "left",
      theme: { text: "text-indigo-600", bg: "bg-indigo-50", hoverBg: "group-hover:bg-indigo-100", border: "border-indigo-100/50" }
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      secondaryIcon: <Star className="w-4 h-4 absolute -top-1 -right-1 text-violet-500" />,
      title: "Smart Personalization",
      description: "Automatically inject first names, company titles, and custom icebreakers to make every touchpoint feel human.",
      position: "left",
      theme: { text: "text-violet-600", bg: "bg-violet-50", hoverBg: "group-hover:bg-violet-100", border: "border-violet-100/50" }
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      secondaryIcon: <Sparkles className="w-4 h-4 absolute -top-1 -right-1 text-purple-500" />,
      title: "Message Sequences",
      description: "Set up multi-channel automated follow-ups that instantly halt as soon as a lead responds, keeping conversations natural.",
      position: "right",
      theme: { text: "text-purple-600", bg: "bg-purple-50", hoverBg: "group-hover:bg-purple-100", border: "border-purple-100/50" }
    },
    {
      icon: <Database className="w-6 h-6" />,
      secondaryIcon: <CheckCircle className="w-4 h-4 absolute -top-1 -right-1 text-blue-600" />,
      title: "CRM Sync",
      description: "One-click export leads and interaction logs to popular platforms like HubSpot, Pipedrive, Salesforce, and Notion.",
      position: "right",
      theme: { text: "text-blue-700", bg: "bg-blue-50", hoverBg: "group-hover:bg-blue-100", border: "border-blue-200/50" }
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      secondaryIcon: <Star className="w-4 h-4 absolute -top-1 -right-1 text-indigo-600" />,
      title: "Real-time Analytics",
      description: "Track pending invites, open rates, click-through rates, and overall campaign metrics in a clean, unified dashboard.",
      position: "right",
      theme: { text: "text-indigo-700", bg: "bg-indigo-50", hoverBg: "group-hover:bg-indigo-100", border: "border-indigo-200/50" }
    },
  ]

  const stats = [
    { icon: <Users className="w-6 h-6" />, value: 2500, label: "Active Users", suffix: "+" },
    { icon: <Mail className="w-6 h-6" />, value: 12, label: "Million Leads Found", suffix: "M+" },
    { icon: <TrendingUp className="w-6 h-6" />, value: 4, label: "X Higher Reply Rates", suffix: "x" },
    { icon: <ShieldCheck className="w-6 h-6" />, value: 99, label: "Deliverability Uptime", suffix: "%" },
  ]

  return (
    <section
      id="about-section"
      ref={sectionRef}
      className="w-full py-24 px-4 bg-transparent text-slate-800 overflow-hidden relative border-t border-slate-100"
    >
      {/* Decorative background elements */}
      <motion.div
        className="absolute top-20 left-10 w-64 h-64 rounded-full bg-blue-400/5 blur-3xl"
        style={{ y: y1, rotate: rotate1 }}
      />
      <motion.div
        className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-purple-400/5 blur-3xl"
        style={{ y: y2, rotate: rotate2 }}
      />
      <motion.div
        className="absolute top-1/2 left-1/4 w-4 h-4 rounded-full bg-blue-500/20"
        animate={{
          y: [0, -15, 0],
          opacity: [0.4, 0.8, 0.4],
        }}
        transition={{
          duration: 3,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-1/3 right-1/4 w-6 h-6 rounded-full bg-purple-500/20"
        animate={{
          y: [0, 20, 0],
          opacity: [0.4, 0.8, 0.4],
        }}
        transition={{
          duration: 4,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
          delay: 1,
        }}
      />

      <motion.div
        className="container mx-auto max-w-[90rem] relative z-10 px-4 lg:px-8"
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        variants={containerVariants}
      >
        <motion.div className="flex flex-col items-center mb-6" variants={itemVariants}>
          <motion.span
            className="text-primary font-bold text-sm tracking-wider mb-2 flex items-center gap-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Zap className="w-4.5 h-4.5 text-primary fill-current" />
            DISCOVER QAMPI
          </motion.span>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4 text-center tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">Outreach Made Effortless</h2>
          <motion.div
            className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: 96 }}
            transition={{ duration: 1, delay: 0.5 }}
          ></motion.div>
        </motion.div>

        <motion.p className="text-center max-w-2xl mx-auto mb-16 text-slate-500 text-lg" variants={itemVariants}>
          We built Qampi to take the complexity out of B2B prospecting. Our unified browser extension and dashboard automate the tedious parts of LinkedIn networking and cold email outreach, helping sales teams, founders, and recruiters focus on what they do best: closing deals.
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center relative">
          {/* Left Column */}
          <div className="space-y-12">
            {services
              .filter((service) => service.position === "left")
              .map((service, index) => (
                <ServiceItem
                  key={`left-${index}`}
                  icon={service.icon}
                  secondaryIcon={service.secondaryIcon}
                  title={service.title}
                  description={service.description}
                  variants={itemVariants}
                  delay={index * 0.15}
                  direction="left"
                  theme={service.theme}
                />
              ))}
          </div>

          {/* Center Figure */}
          <div className="flex justify-center items-center order-first md:order-none mb-12 md:mb-0 w-full">
            <motion.div className="relative w-full max-w-md flex justify-center" variants={itemVariants}>
              <AnimatedCenterFigure />
            </motion.div>
          </div>
          {/* Right Column */}
          <div className="space-y-12">
            {services
              .filter((service) => service.position === "right")
              .map((service, index) => (
                <ServiceItem
                  key={`right-${index}`}
                  icon={service.icon}
                  secondaryIcon={service.secondaryIcon}
                  title={service.title}
                  description={service.description}
                  variants={itemVariants}
                  delay={index * 0.15}
                  direction="right"
                  theme={service.theme}
                />
              ))}
          </div>
        </div>

        {/* Stats Section */}
        <motion.div
          ref={statsRef}
          className="mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
          initial="hidden"
          animate={isStatsInView ? "visible" : "hidden"}
          variants={containerVariants}
        >
          {stats.map((stat, index) => (
            <StatCounter
              key={index}
              icon={stat.icon}
              value={stat.value}
              label={stat.label}
              suffix={stat.suffix}
              delay={index * 0.1}
            />
          ))}
        </motion.div>

        {/* CTA Section */}
        <motion.div
          className="mt-20 bg-gradient-to-r from-slate-900 to-slate-950 text-white p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-slate-800"
          initial={{ opacity: 0, y: 30 }}
          animate={isStatsInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-2">Ready to scale your outreach?</h3>
            <p className="text-slate-400">Start automating your prospecting and sales funnel today.</p>
          </div>
          <MagneticButton>
            <a
              href="https://app.qampi.com/register"
              className="bg-primary hover:bg-blue-600 text-white px-8 py-4 rounded-2xl flex items-center gap-2 font-bold shadow-lg shadow-blue-500/20 transition-all duration-200 hover:-translate-y-0.5"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </a>
          </MagneticButton>
        </motion.div>
      </motion.div>
    </section>
  )
}

interface ServiceItemProps {
  icon: React.ReactNode
  secondaryIcon?: React.ReactNode
  title: string
  description: string
  variants: any
  delay: number
  direction: "left" | "right"
  theme: {
    text: string;
    bg: string;
    hoverBg: string;
    border: string;
  }
}

function ServiceItem({ icon, secondaryIcon, title, description, variants, delay, direction, theme }: ServiceItemProps) {
  return (
    <motion.div
      className="flex flex-col group cursor-pointer"
      variants={variants}
      transition={{ delay }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
    >
      <motion.div
        className="flex items-center gap-3 mb-3"
        initial={{ x: direction === "left" ? -30 : 30, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 15, delay: delay + 0.2 }}
      >
        <motion.div
          className={`${theme.text} ${theme.bg} p-3 rounded-xl transition-colors duration-300 ${theme.hoverBg} relative border ${theme.border}`}
          whileHover={{ rotate: [0, -10, 10, -5, 0], scale: 1.1, transition: { duration: 0.5 } }}
        >
          {icon}
          {secondaryIcon}
        </motion.div>
        <h3 className={`text-xl font-bold text-slate-800 transition-colors duration-300 group-hover:${theme.text.split('-')[1]}-600`}>
          {title}
        </h3>
      </motion.div>
      <motion.p
        className="text-sm text-slate-500 leading-relaxed pl-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: delay + 0.4 }}
      >
        {description}
      </motion.p>
      <motion.div
        className={`mt-3 pl-12 flex items-center ${theme.text} text-xs font-bold opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0`}
        initial={{ opacity: 0 }}
      >
        <span className="flex items-center gap-1">
          Learn more <ArrowRight className="w-3 h-3" />
        </span>
      </motion.div>
    </motion.div>
  )
}

interface StatCounterProps {
  icon: React.ReactNode
  value: number
  label: string
  suffix: string
  delay: number
}

function StatCounter({ icon, value, label, suffix, delay }: StatCounterProps) {
  const countRef = useRef(null)
  const isInView = useInView(countRef, { once: false })
  const [hasAnimated, setHasAnimated] = useState(false)

  const springValue = useSpring(0, {
    stiffness: 50,
    damping: 10,
  })

  useEffect(() => {
    if (isInView && !hasAnimated) {
      springValue.set(value)
      setHasAnimated(true)
    } else if (!isInView && hasAnimated) {
      springValue.set(0)
      setHasAnimated(false)
    }
  }, [isInView, value, springValue, hasAnimated])

  const displayValue = useTransform(springValue, (latest) => Math.floor(latest))

  return (
    <motion.div
      className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl flex flex-col items-center text-center group hover:bg-white transition-colors duration-300 border border-slate-100/50 hover:shadow-lg hover:shadow-slate-100/80"
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, delay },
        },
      }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
    >
      <motion.div
        className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-4 text-primary group-hover:bg-blue-50 transition-colors duration-300 border border-slate-100"
        whileHover={{ rotate: 360, transition: { duration: 0.8 } }}
      >
        {icon}
      </motion.div>
      <motion.div ref={countRef} className="text-3xl font-extrabold text-slate-800 flex items-center">
        <motion.span>{displayValue}</motion.span>
        <span>{suffix}</span>
      </motion.div>
      <p className="text-slate-500 text-sm mt-2 font-medium">{label}</p>
      <motion.div className="w-10 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 mt-3 group-hover:w-16 transition-all duration-300 rounded-full" />
    </motion.div>
  )
}

const AnimatedCenterFigure = () => {
  return (
    <div className="relative w-full max-w-[400px] aspect-square flex items-center justify-center">
      {/* Outer Pulse */}
      <motion.div
        className="absolute inset-0 rounded-full bg-blue-100/30"
        animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Spinning tech rings */}
      <motion.div
        className="absolute inset-4 rounded-full border-2 border-indigo-200/50 border-dashed"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-12 rounded-full border border-violet-300/40 border-dotted"
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-20 rounded-full border border-blue-200/30"
        animate={{ rotate: 180 }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />
      
      {/* Center Mascot & Logo */}
      <motion.div
        className="relative z-20 w-44 h-44 rounded-full bg-gradient-to-br from-blue-500/10 via-indigo-600/10 to-purple-600/10 shadow-[0_0_40px_rgba(79,70,229,0.2)] flex items-center justify-center border-4 border-white backdrop-blur-sm"
        animate={{ y: [-12, 12, -12] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <img src="/logo.png" alt="Qampi Logo" className="w-24 h-24 object-contain drop-shadow-xl" />
      </motion.div>

      {/* Orbiting capability nodes */}
      {[
        { Icon: Mail, color: "text-blue-500", border: "border-blue-100", angle: 0 },
        { Icon: MessageSquare, color: "text-violet-500", border: "border-violet-100", angle: 72 },
        { Icon: UserPlus, color: "text-indigo-500", border: "border-indigo-100", angle: 144 },
        { Icon: Database, color: "text-fuchsia-500", border: "border-fuchsia-100", angle: 216 },
        { Icon: Network, color: "text-purple-500", border: "border-purple-100", angle: 288 },
      ].map((node, i) => {
        return (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 w-[115%] h-[115%] -mt-[57.5%] -ml-[57.5%]"
            animate={{ rotate: [node.angle, node.angle + 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <motion.div
              className={`absolute top-0 left-1/2 -ml-7 flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-xl border ${node.border} ${node.color}`}
              animate={{ rotate: [-node.angle, -(node.angle + 360)] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <node.Icon className="w-6 h-6" />
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
};
