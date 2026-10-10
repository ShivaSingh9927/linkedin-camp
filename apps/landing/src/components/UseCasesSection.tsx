'use client';

import { motion } from "framer-motion";
import { ArrowUpRight, Briefcase, Building2, Target, Users } from "lucide-react";

// One card per audience, each linking to its /for/<slug> page
// (content/use-cases.ts).
const AUDIENCES = [
  {
    icon: Building2,
    role: "Founders",
    line: "Reach customers and investors from one tool, in your own voice — without losing your day to prospecting.",
    href: "/for/founders",
  },
  {
    icon: Target,
    role: "Sales teams",
    line: "LinkedIn and email in one sequence, personalized at every seat, with your CRM kept in sync.",
    href: "/for/sales-teams",
  },
  {
    icon: Users,
    role: "Recruiters",
    line: "Outreach that sounds like a recruiter who did their homework, so passive candidates actually reply.",
    href: "/for/recruiters",
  },
  {
    icon: Briefcase,
    role: "Job seekers",
    line: "Turn your resume into notes to the hiring manager, not another application lost in the ATS.",
    href: "/for/job-seekers",
  },
];

export function UseCasesSection() {
  return (
    <section className="section relative">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="eyebrow">Who it&apos;s for</span>
          <h2 className="section-title mt-3">
            Built for anyone who <span className="accent">needs a reply</span>
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {AUDIENCES.map((a, i) => (
            <motion.a
              key={a.role}
              href={a.href}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              className="group flex gap-5 rounded-2xl border border-slate-200/80 bg-white p-6 transition-colors hover:border-violet-200 sm:p-8"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-primary">
                <a.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 text-xl font-semibold tracking-tight text-slate-900">
                  {a.role}
                  <ArrowUpRight className="h-4 w-4 text-slate-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{a.line}</p>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
