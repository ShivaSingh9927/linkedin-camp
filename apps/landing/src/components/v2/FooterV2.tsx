'use client';

import { Logo } from "../Logo";
import { motion } from "framer-motion";
import { Linkedin, Twitter, Github } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "AI Outreach", href: "#ai-outreach" },
    { label: "Workflow Builder", href: "#workflow" },
  ],
  Resources: [
    { label: "Blog", href: "#" },
    { label: "Help Center", href: "#" },
    { label: "API Docs", href: "#" },
    { label: "Community", href: "#" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Contact", href: "#" },
    { label: "Partners", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Cookie Policy", href: "#" },
  ],
};

const socialLinks = [
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Github, href: "#", label: "GitHub" },
];

export function FooterV2() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200/80 text-slate-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="col-span-2 md:col-span-1"
          >
            <div className="flex items-center space-x-2 mb-4">
              <Logo size="md" showText={false} />
              <span className="font-black tracking-tight text-slate-900 text-lg">
                Qampi<span className="text-indigo-600">.</span>
              </span>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-semibold">
              Smart LinkedIn automation that gets replies. Built for founders, sales teams, and recruiters.
            </p>
            <div className="flex space-x-3 mt-6">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <motion.a
                    key={social.label}
                    href={social.href}
                    whileHover={{ scale: 1.05 }}
                    className="w-10 h-10 bg-white border border-slate-200/80 rounded-xl flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-600 transition-all cursor-pointer text-slate-400 shadow-sm"
                    aria-label={social.label}
                  >
                    <Icon className="w-4.5 h-4.5" aria-hidden="true" />
                  </motion.a>
                );
              })}
            </div>
          </motion.div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links], catIndex) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + catIndex * 0.05 }}
            >
              <h4 className="font-black text-xs uppercase tracking-wider text-slate-400 mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-slate-500 hover:text-indigo-600 text-xs sm:text-sm font-semibold transition-colors cursor-pointer">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Bottom bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-16 pt-8 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <p className="text-slate-400 text-xs font-semibold">
            © 2026 Qampi. All rights reserved.
          </p>
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-semibold">
            <span>Made with</span>
            <svg className="w-4 h-4 text-red-500 fill-current" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
            </svg>
            <span>for builders</span>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
