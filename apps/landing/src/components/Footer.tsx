'use client';

import { Twitter, Linkedin, ArrowRight, Mail, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import React from "react";

export function Footer() {
  return (
    <footer className="bg-purple-50/30 pt-24 pb-8 relative overflow-hidden text-left border-t border-purple-200/60">
      
      {/* ── Background Elements ── */}
      {/* Huge subtle logo watermark */}
      <div className="absolute -bottom-24 -right-24 opacity-[0.03] pointer-events-none select-none">
        <img src="/logo.png" alt="Watermark" className="w-[600px] h-[600px] object-contain grayscale" />
      </div>
      
      {/* Top glowing gradient border effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-50" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-[3px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-30 blur-sm" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Footer Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-20">
          
          {/* Logo & About Column (Spans 4) */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white shadow-sm border border-slate-200 rounded-xl flex items-center justify-center p-1.5">
                <img src="/logo.png" alt="Qampi Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-900">Qampi</span>
            </div>
            
            <p className="text-slate-500 max-w-sm leading-relaxed mb-8 font-medium">
              The world's most advanced B2B lead generation robot. Find, contact, and close leads on autopilot.
            </p>
            
            {/* Social Icons */}
            <div className="flex gap-4">
              <a
                href="#"
                className="group w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-purple-600 hover:border-purple-200 hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                aria-label="Twitter"
              >
                <Twitter className="w-4.5 h-4.5 transition-transform group-hover:scale-110" />
              </a>
              <a
                href="#"
                className="group w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-purple-600 hover:border-purple-200 hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4.5 h-4.5 transition-transform group-hover:scale-110" />
              </a>
            </div>
          </div>
          
          {/* Navigation Columns Container (Spans 4) */}
          <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {/* Automation Column */}
            <div>
              <h4 className="font-medium text-slate-900 text-sm mb-6 uppercase tracking-wider">Product</h4>
              <ul className="space-y-4 text-sm text-slate-500 font-medium">
                {['LinkedIn Auto', 'Cold Email', 'Sequences', 'CRM Sync'].map((item, i) => (
                  <li key={i}>
                    <a href="#" className="group flex items-center text-slate-500 hover:text-purple-600 transition-colors">
                      <ArrowRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 mr-2 transition-all duration-300 text-purple-500" />
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Resources Column */}
            <div>
              <h4 className="font-medium text-slate-900 text-sm mb-6 uppercase tracking-wider">Resources</h4>
              <ul className="space-y-4 text-sm text-slate-500 font-medium">
                {[
                  { label: 'Blog', href: '/blog' },
                  { label: 'Sales Guides', href: '/blog' },
                  { label: 'Help Center', href: '#' },
                  { label: 'API Docs', href: '#' },
                ].map((item, i) => (
                  <li key={i}>
                    <a href={item.href} className="group flex items-center text-slate-500 hover:text-purple-600 transition-colors">
                      <ArrowRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 mr-2 transition-all duration-300 text-purple-500" />
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Legal Column */}
            <div>
              <h4 className="font-medium text-slate-900 text-sm mb-6 uppercase tracking-wider">Legal</h4>
              <ul className="space-y-4 text-sm text-slate-500 font-medium">
                {['Privacy', 'Terms', 'Security'].map((item, i) => (
                  <li key={i}>
                    <a href="#" className="group flex items-center text-slate-500 hover:text-purple-600 transition-colors">
                      <ArrowRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 mr-2 transition-all duration-300 text-purple-500" />
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Newsletter Column (Spans 4) */}
          <div className="lg:col-span-4">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.05)] relative overflow-hidden">
              {/* Decorative gradient blob inside the card */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              
              <div className="flex items-center gap-2 mb-4 relative z-10">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <h4 className="font-medium text-slate-900">Join the Newsletter</h4>
              </div>
              <p className="text-sm text-slate-500 mb-6 relative z-10 font-medium">
                Get the latest sales strategies, cold email templates, and product updates delivered weekly.
              </p>
              
              <form className="relative z-10 flex gap-2" onSubmit={(e) => e.preventDefault()}>
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <input 
                    type="email" 
                    placeholder="name@company.com" 
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium text-slate-900 placeholder:text-slate-400"
                    required
                  />
                </div>
                <button 
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-purple-500/20 transition-all hover:shadow-lg active:scale-95"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>
          
        </div>

        {/* Footer Bottom Bar */}
        <div className="pt-8 border-t border-slate-200/80 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-slate-500 text-sm font-medium">
            © 2024 Qampi Inc. Built for Closers.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
            {/* Status Indicator */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-slate-600">All systems operational</span>
            </div>
            
            <a href="https://qampi.com" className="text-slate-400 hover:text-purple-600 text-sm font-bold transition-colors">
              qampi.com
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
