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
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: "easeOut" as const },
    },
  }

  const services = [
    {
      icon: <Mail className="w-6 h-6" />,
      secondaryIcon: <Sparkles className="w-4 h-4 absolute -top-1 -right-1 text-blue-500" />,
      title: "Email Hunting",
      description:
        "Instantly find and verify corporate email addresses of your target decision-makers directly from LinkedIn profiles.",
      position: "left",
    },
    {
      icon: <UserPlus className="w-6 h-6" />,
      secondaryIcon: <CheckCircle className="w-4 h-4 absolute -top-1 -right-1 text-purple-500" />,
      title: "Auto-Connecting",
      description:
        "Automate personalized connection requests with smart delays and custom variables to organically grow your network.",
      position: "left",
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      secondaryIcon: <Star className="w-4 h-4 absolute -top-1 -right-1 text-blue-500" />,
      title: "Smart Personalization",
      description:
        "Automatically inject first names, company titles, and custom icebreakers to make every touchpoint feel human.",
      position: "left",
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      secondaryIcon: <Sparkles className="w-4 h-4 absolute -top-1 -right-1 text-purple-500" />,
      title: "Message Sequences",
      description:
        "Set up multi-channel automated follow-ups that instantly halt as soon as a lead responds, keeping conversations natural.",
      position: "right",
    },
    {
      icon: <Database className="w-6 h-6" />,
      secondaryIcon: <CheckCircle className="w-4 h-4 absolute -top-1 -right-1 text-blue-500" />,
      title: "CRM Sync",
      description:
        "One-click export leads and interaction logs to popular platforms like HubSpot, Pipedrive, Salesforce, and Notion.",
      position: "right",
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      secondaryIcon: <Star className="w-4 h-4 absolute -top-1 -right-1 text-purple-500" />,
      title: "Real-time Analytics",
      description:
        "Track pending invites, open rates, click-through rates, and overall campaign metrics in a clean, unified dashboard.",
      position: "right",
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
      className="w-full py-24 px-4 bg-gradient-to-b from-white via-slate-50/50 to-slate-50 text-slate-800 overflow-hidden relative border-t border-slate-100"
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
        className="container mx-auto max-w-6xl relative z-10"
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
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 text-center tracking-tight">Outreach Made Effortless</h2>
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
                />
              ))}
          </div>

          {/* Center Image */}
          <div className="flex justify-center items-center order-first md:order-none mb-8 md:mb-0">
            <motion.div className="relative w-full max-w-xs" variants={itemVariants}>
              <motion.div
                className="rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white bg-slate-100 aspect-square"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                whileHover={{ scale: 1.03, transition: { duration: 0.3 } }}
              >
                <img
                  src="/pigeon_linkedin.png"
                  alt="Qampi Pigeon AI Assistant"
                  className="w-full h-full object-cover select-none"
                />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent flex items-end justify-center p-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.9 }}
                >
                  <MagneticButton>
                    <a
                      href="https://app.qampi.com/register"
                      className="bg-white hover:bg-slate-50 text-slate-900 px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-lg transition-transform duration-200"
                    >
                      Our Product <ArrowRight className="w-4 h-4 text-primary" />
                    </a>
                  </MagneticButton>
                </motion.div>
              </motion.div>
              <motion.div
                className="absolute inset-0 border-4 border-purple-200 rounded-[2.75rem] -m-3 z-[-1] opacity-60"
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              ></motion.div>

              {/* Floating accent elements */}
              <motion.div
                className="absolute -top-4 -right-8 w-16 h-16 rounded-full bg-blue-500/10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.9 }}
                style={{ y: y1 }}
              ></motion.div>
              <motion.div
                className="absolute -bottom-6 -left-10 w-20 h-20 rounded-full bg-purple-500/10"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 1.1 }}
                style={{ y: y2 }}
              ></motion.div>

              {/* Additional decorative elements */}
              <motion.div
                className="absolute -top-10 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-500"
                animate={{
                  y: [0, -10, 0],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              ></motion.div>
              <motion.div
                className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-purple-500"
                animate={{
                  y: [0, 10, 0],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                  delay: 0.5,
                }}
              ></motion.div>
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
}

function ServiceItem({ icon, secondaryIcon, title, description, variants, delay, direction }: ServiceItemProps) {
  return (
    <motion.div
      className="flex flex-col group"
      variants={variants}
      transition={{ delay }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
    >
      <motion.div
        className="flex items-center gap-3 mb-3"
        initial={{ x: direction === "left" ? -20 : 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: delay + 0.2 }}
      >
        <motion.div
          className="text-primary bg-blue-50 p-3 rounded-xl transition-colors duration-300 group-hover:bg-blue-100 relative border border-blue-100/50"
          whileHover={{ rotate: [0, -10, 10, -5, 0], transition: { duration: 0.5 } }}
        >
          {icon}
          {secondaryIcon}
        </motion.div>
        <h3 className="text-xl font-bold text-slate-800 group-hover:text-primary transition-colors duration-300">
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
        className="mt-3 pl-12 flex items-center text-primary text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0 }}
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
