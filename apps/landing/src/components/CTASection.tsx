'use client';

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/qampi-%E2%80%94-lead-importer/gcmepobpaoiokgcekafhpjehmpnckodk";

export function CTASection() {
  return (
    <section className="px-4 pb-24 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center sm:px-12 sm:py-20"
      >
        {/* Light from the top edge, and the faint grid the hero uses. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(255,255,255,0.22),transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_30%,black,transparent)]"
        />

        <div className="relative mx-auto max-w-2xl">
          <h2 className="font-display text-[clamp(2.75rem,6vw,5rem)] font-semibold leading-[0.98] text-white">
            Your next reply is one campaign away
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-violet-100">
            Connect LinkedIn, pick your leads, and let Qampi write the first message. Free to start, no card needed.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <a
              href="https://app.qampi.com/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-violet-700 transition-all duration-200 hover:-translate-y-px hover:bg-violet-50 active:scale-[0.98] sm:w-auto"
            >
              Get Started Free <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white"
            >
              or add the Chrome extension
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
