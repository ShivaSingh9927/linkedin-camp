"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { AppWindow } from "./AppWindow";

/* The real Qampi journey, each step shown with a screenshot of the app
   (captured with a fictional demo account by scripts/capture-screens.mjs). */
const STEPS = [
  {
    title: "Set up in minutes",
    description:
      "Connect your LinkedIn and tell Qampi about your business — your company, value prop, and ideal customer. That's what the AI writes from.",
    bullets: [
      "Connect your LinkedIn account",
      "Add company info, value prop & ideal customer",
      "Sync HubSpot, Pipedrive, or Notion (optional)",
    ],
    shot: {
      src: "/screens/profile.png",
      url: "app.qampi.com/settings/ai-profile",
      alt: "Qampi AI Profile summarizing the business, target customer, edge and writing voice",
    },
  },
  {
    title: "Import your leads",
    description:
      "Pull prospects straight from LinkedIn with the Qampi extension, or upload a CSV / Excel. Every lead is enriched with profile data.",
    bullets: [
      "Capture profiles from LinkedIn with the extension",
      "Upload a CSV / Excel, or add leads manually",
      "Auto-enriched with role, company & profile data",
    ],
    shot: {
      src: "/screens/prospects.png",
      url: "app.qampi.com/prospects",
      alt: "Qampi prospects table with lists, filters and lead status",
    },
  },
  {
    title: "Launch a campaign",
    description:
      "Pick the objective, audience, CTA, and tone. Qampi researches each prospect and writes a personal message — then runs it safely, on autopilot.",
    bullets: [
      "Set your goal, CTA & tone in a few clicks",
      "Steps: connect, message, like & comment",
      "Every message shows why the AI wrote it",
    ],
    shot: {
      src: "/screens/messages.png",
      url: "app.qampi.com/campaigns",
      alt: "AI-written campaign messages, each with the reason it was written and the prospect's reply",
    },
  },
  {
    title: "Watch replies roll in",
    description:
      "A live view tracks every invite, connection, and reply — and the moment a lead replies, the automation pauses so you take over.",
    bullets: [
      "Live activity for every action",
      "Funnel from invite to reply, per campaign",
      "Auto-pauses on reply · results sync to your CRM",
    ],
    shot: {
      src: "/screens/campaign.png",
      url: "app.qampi.com/campaigns",
      alt: "Live campaign view with leads, invites, connections, messages, replies and the funnel",
    },
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section relative">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="eyebrow">How it works</span>
          <h2 className="section-title mt-3">
            From a list of names to <span className="accent">booked calls</span>
          </h2>
          <p className="section-lead mt-5">
            Four steps, about ten minutes of setup. After that, Qampi does the daily work and hands you
            the conversations.
          </p>
        </div>

        <ol className="mt-16 space-y-24 md:mt-20 md:space-y-32">
          {STEPS.map((step, i) => {
            const flip = i % 2 === 1;
            return (
              <li key={step.title} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className={`min-w-0 lg:col-span-4 ${flip ? "lg:order-2" : ""}`}
                >
                  <span className="font-mono text-sm font-medium text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 font-display text-4xl font-semibold leading-[1.02] text-slate-900 sm:text-5xl">
                    {step.title}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">{step.description}</p>
                  <ul className="mt-6 space-y-3">
                    {step.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-[15px] text-slate-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className={`min-w-0 lg:col-span-8 ${flip ? "lg:order-1" : ""}`}
                >
                  <AppWindow {...step.shot} />
                </motion.div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
