"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { AppWindow } from "./AppWindow";
import { NeatBackground } from "./NeatBackground";

const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/qampi-%E2%80%94-lead-importer/gcmepobpaoiokgcekafhpjehmpnckodk";

const TITLES = ["client", "investor", "recruiter", "customer", "hire"];

function Hero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const id = setTimeout(() => setTitleNumber((n) => (n + 1) % TITLES.length), 2500);
    return () => clearTimeout(id);
  }, [titleNumber]);

  return (
    <section className="relative overflow-hidden pt-28 sm:pt-32">
      {/* Animated gradient behind the headline, fading into the page colour
          before the product video so the video sits on a calm background. */}
      <NeatBackground className="absolute inset-x-0 top-0 h-[78%] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center">
        {/* The H1's visible text includes a rotating word, so aria-label gives
            crawlers and screen readers one clean, keyword-bearing sentence. */}
        <h1
          aria-label="Like a marketer wrote every message to your next client, investor, recruiter, customer, or hire — smart LinkedIn and email outreach that gets replies"
          className="font-display font-medium text-slate-900 leading-[0.95] tracking-tight text-[clamp(3.25rem,7vw,7rem)]"
        >
          <span className="block">Like a marketer wrote</span>
          <span className="block">
            every message to your next{" "}
            {/* Every candidate word shares one grid cell, so the slot is as
                wide as the longest word and the line never reflows. It clips
                with clip-path, not overflow-hidden: an overflow-clipped inline
                box takes its bottom edge as its baseline, which lifted the
                word above the rest of the line. The padding/negative margin
                pair leaves a hair of room so glyph edges aren't shaved, without
                changing line height (none of the words have descenders). */}
            <span className="relative inline-grid -my-[0.04em] py-[0.04em] text-left [clip-path:inset(0_-0.3em)]">
              {TITLES.map((title, index) => (
                <motion.span
                  key={title}
                  aria-hidden="true"
                  className="[grid-area:1/1] font-semibold gradient-text pr-[0.04em]"
                  initial={false}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 14 }}
                  animate={
                    titleNumber === index
                      ? { y: "0%", opacity: 1 }
                      : { y: titleNumber > index ? "-110%" : "110%", opacity: 0 }
                  }
                >
                  {title}
                </motion.span>
              ))}
            </span>
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
          Qampi reads each prospect&apos;s profile and recent posts, then writes LinkedIn and email
          outreach they actually answer — and runs it safely on autopilot.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
          <a
            href="https://app.qampi.com/register"
            className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold sm:w-auto"
          >
            Get Started Free <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-primary hover:decoration-violet-300"
          >
            or add the Chrome extension
          </a>
        </div>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
          {["No credit card needed", "Human-like, LinkedIn-safe sending", "Cancel anytime"].map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-primary" />
              {item}
            </li>
          ))}
        </ul>

        {/* The product, not an illustration of it: a real screen recording of
            the copilot going from "what should I run?" to a campaign ready to launch
            (cut from a longer recording; no real prospects' data in frame). */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-14 max-w-5xl sm:mt-16"
        >
          <AppWindow
            video={{
              src: "/videos/hero-copilot.mp4",
              poster: "/videos/hero-copilot-poster.jpg",
              width: 1920,
              height: 1080,
            }}
            alt="The Qampi copilot suggesting campaigns, finding leads on LinkedIn, and setting up a campaign's objective, tone and call to action before launch"
            url="app.qampi.com"
            priority
          />
        </motion.div>
      </div>
    </section>
  );
}

export { Hero };
