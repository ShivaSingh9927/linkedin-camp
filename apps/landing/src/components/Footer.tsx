'use client';

import { Twitter, Linkedin } from "lucide-react";
import { motion } from "framer-motion";

export function Footer() {
  return (
    <footer className="bg-white pt-24 pb-12 border-t border-slate-100 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Footer Top Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12 mb-16">
          
          {/* Logo & About Column */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <img src="/logo.png" alt="Qampi Logo" className="w-8 h-8 object-contain rounded-lg" />
              <span className="text-xl font-bold tracking-tight text-slate-900">Qampi</span>
            </div>
            
            <p className="text-slate-500 max-w-xs leading-relaxed mb-8 text-sm">
              The world's most advanced B2B lead generation robot. Find, contact, and close leads on autopilot.
            </p>
            
            {/* Social Icons */}
            <div className="flex gap-4">
              <a
                href="#"
                className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-primary transition-colors duration-200"
                aria-label="Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-primary transition-colors duration-200"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>
          
          {/* Automation Column */}
          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-6 uppercase tracking-wider">Automation</h4>
            <ul className="space-y-4 text-sm text-slate-500 font-semibold">
              <li>
                <a href="#linkedin" id="footer-linkedin-auto" className="hover:text-primary transition-colors">
                  LinkedIn Auto
                </a>
              </li>
              <li>
                <a href="#email" id="footer-cold-email" className="hover:text-primary transition-colors">
                  Cold Email
                </a>
              </li>
              <li>
                <a href="#sequences" id="footer-sequences" className="hover:text-primary transition-colors">
                  Sequences
                </a>
              </li>
            </ul>
          </div>
          
          {/* Resources Column */}
          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-6 uppercase tracking-wider">Resources</h4>
            <ul className="space-y-4 text-sm text-slate-500 font-semibold">
              <li>
                <a href="#" id="footer-blog" className="hover:text-primary transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" id="footer-guides" className="hover:text-primary transition-colors">
                  Sales Guides
                </a>
              </li>
              <li>
                <a href="#" id="footer-support" className="hover:text-primary transition-colors">
                  Help Center
                </a>
              </li>
            </ul>
          </div>
          
          {/* Legal Column */}
          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-6 uppercase tracking-wider">Legal</h4>
            <ul className="space-y-4 text-sm text-slate-500 font-semibold">
              <li>
                <a href="#" id="footer-privacy" className="hover:text-primary transition-colors">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" id="footer-terms" className="hover:text-primary transition-colors">
                  Terms
                </a>
              </li>
              <li>
                <a href="#" id="footer-security" className="hover:text-primary transition-colors">
                  Security
                </a>
              </li>
            </ul>
          </div>
          
        </div>

        {/* Footer Bottom Bar */}
        <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-sm font-medium">
          <p>© 2024 Qampi Inc. Built for Closers.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
              Systems 100% Up
            </span>
            <span>qampi.com</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
