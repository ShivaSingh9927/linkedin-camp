'use client';

import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
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
    { label: "LinkedIn", href: "#linkedin", id: "nav-linkedin" },
    { label: "Email", href: "#email", id: "nav-email" },
    { label: "Sequences", href: "#sequences", id: "nav-sequences" },
    { label: "CRM", href: "#crm", id: "nav-crm" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-nav border-b border-gray-100 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2">
            <img src="/logo.png" alt="Qampi Logo" className="w-10 h-10 object-contain rounded-xl" />
            <span className="text-2xl font-bold tracking-tight text-slate-900">Qampi</span>
          </a>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-10">
            {navLinks.map((link) => (
              <a
                key={link.label}
                id={link.id}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="https://app.qampi.com/login"
              id="nav-login"
              className="text-sm font-semibold text-slate-900 hover:text-primary transition-colors"
            >
              Log in
            </a>
            <a
              href="https://app.qampi.com/register"
              id="nav-cta-btn"
              className="btn-primary px-6 py-2.5 rounded-full text-sm font-semibold inline-flex items-center justify-center"
            >
              Get Started Free
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <X className="w-6 h-6 text-slate-700" />
            ) : (
              <Menu className="w-6 h-6 text-slate-700" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 shadow-xl py-6 px-4 space-y-4">
          <div className="flex flex-col space-y-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-base font-semibold text-slate-700 hover:text-primary transition-colors py-2"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="pt-4 space-y-3 border-t border-slate-100 flex flex-col">
            <a
              href="https://app.qampi.com/login"
              className="text-center text-base font-semibold text-slate-700 hover:text-primary py-2"
              onClick={() => setIsOpen(false)}
            >
              Log in
            </a>
            <a
              href="https://app.qampi.com/register"
              className="btn-primary text-center px-6 py-3 rounded-full text-base font-semibold"
              onClick={() => setIsOpen(false)}
            >
              Get Started Free
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
