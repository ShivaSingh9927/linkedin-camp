'use client';

import { motion } from "framer-motion";
import { MagneticButton } from "./MagneticButton";

export function CTASection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative bg-primary rounded-[3rem] p-12 lg:p-24 overflow-hidden text-center text-white shadow-2xl"
        >
          {/* Background Blobs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/20 blur-[80px] rounded-full -translate-x-1/2 translate-y-1/2 pointer-events-none"></div>
          
          <h2 className="text-4xl md:text-6xl font-bold mb-8 relative z-10 leading-[1.15] tracking-tight">
            Turn your browser into a <br className="hidden md:block"/> sales generating machine
          </h2>
          
          <p className="text-xl text-blue-100 mb-12 max-w-2xl mx-auto relative z-10 font-medium">
            Join 2,500+ teams using Qampi to automate their growth today.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 relative z-10">
            <MagneticButton>
              <a
                href="https://app.qampi.com/register"
                id="bottom-cta-primary"
                className="w-full sm:w-auto bg-white text-primary px-10 py-5 rounded-2xl text-lg font-bold hover:bg-blue-50 transition-colors shadow-lg shadow-black/10 inline-flex items-center justify-center hover:-translate-y-0.5 active:scale-98 duration-200"
              >
                Start Free Trial
              </a>
            </MagneticButton>
            <a
              href="#"
              id="bottom-cta-secondary"
              className="w-full sm:w-auto border-2 border-white/30 text-white px-10 py-5 rounded-2xl text-lg font-bold hover:bg-white/10 transition-colors inline-flex items-center justify-center hover:-translate-y-0.5 active:scale-98 duration-200"
            >
              Talk to Sales
            </a>
          </div>
          
          <p className="mt-10 text-blue-200 text-sm font-semibold opacity-80 relative z-10">
            No credit card required. Chrome v110+ compatible.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
