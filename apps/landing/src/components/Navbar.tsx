'use client';

import { Logo } from "./Logo";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-white/80 backdrop-blur-xl shadow-lg shadow-slate-200/50 border-b border-slate-100"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <a href="/" className="flex items-center space-x-2">
            <Logo size="md" />
          </a>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={cn(
                  "text-sm font-semibold transition-colors hover:text-primary",
                  scrolled ? "text-slate-600" : "text-slate-700"
                )}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center space-x-4">
            <a
              href="https://app.qampi.com/login"
              className={cn(
                "text-sm font-semibold transition-colors hover:text-primary",
                scrolled ? "text-slate-600" : "text-slate-700"
              )}
            >
              Log in
            </a>
            <a
              href="https://app.qampi.com/register"
              className="bg-primary text-white px-6 py-2.5 rounded-2xl text-sm font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:bg-primary/90 transition-all hover:-translate-y-0.5 active:scale-95"
            >
              Start Free Trial
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? (
              <X className="w-6 h-6 text-slate-700" />
            ) : (
              <Menu className="w-6 h-6 text-slate-700" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden bg-white border-t border-slate-100 shadow-xl overflow-hidden"
          >
            <div className="px-4 py-6 space-y-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block text-base font-semibold text-slate-700 hover:text-primary transition-colors py-2"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-4 space-y-3 border-t border-slate-100">
                <a
                  href="https://app.qampi.com/login"
                  className="block text-center text-base font-semibold text-slate-700 hover:text-primary py-2"
                >
                  Log in
                </a>
                <a
                  href="https://app.qampi.com/register"
                  className="block text-center bg-primary text-white px-6 py-3 rounded-2xl text-base font-bold shadow-lg shadow-primary/25"
                >
                  Start Free Trial
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
