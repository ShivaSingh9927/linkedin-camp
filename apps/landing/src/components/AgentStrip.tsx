"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, ArrowUpRight } from "lucide-react";
import { ClaudeIcon, OpenAIIcon, CursorIcon, McpIcon } from "./AgentIcons";

const REPO_URL = "https://github.com/ShivaSingh9927/qampi-plugins";

type Agent = {
  id: string;
  name: string;
  icon: React.ReactNode;
  command: string;
};

// One install line per client. Claude Code and Codex take the plugin
// (MCP server + the skill that keeps launches behind an explicit yes);
// everything else gets the bare MCP server.
const AGENTS: Agent[] = [
  {
    id: "claude",
    name: "Claude Code",
    icon: <ClaudeIcon className="h-4 w-4" fill="#D97757" />,
    command: "claude plugin marketplace add ShivaSingh9927/qampi-plugins",
  },
  {
    id: "codex",
    name: "Codex",
    icon: <OpenAIIcon className="h-4 w-4" />,
    command: "codex plugin marketplace add ShivaSingh9927/qampi-plugins",
  },
  {
    id: "cursor",
    name: "Cursor",
    icon: <CursorIcon className="h-4 w-4" />,
    command: "npx -y @qampi/mcp-server",
  },
  {
    id: "mcp",
    name: "Any MCP client",
    icon: <McpIcon className="h-4 w-4" />,
    command: "npx -y @qampi/mcp-server",
  },
];

export function AgentStrip() {
  const [active, setActive] = useState(AGENTS[0]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active.command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (insecure context, permissions); the
      // command stays selectable, so there is nothing else to do.
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.15, duration: 0.8 }}
      className="mt-10 w-full max-w-2xl mx-auto text-left"
    >
      <div className="rounded-3xl border border-slate-200/80 bg-white/75 backdrop-blur-md shadow-[0_20px_50px_-20px_rgba(34,90,234,0.25)] p-2">
        <div className="flex flex-col gap-3 px-3 pt-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              New
            </span>
            Run Qampi from your AI agent
          </p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-primary transition-colors"
          >
            Setup guide <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="flex flex-wrap gap-1.5 px-2 pb-2" role="group" aria-label="Choose your agent">
          {AGENTS.map((agent) => {
            const selected = agent.id === active.id;
            return (
              <button
                key={agent.id}
                type="button"
                aria-pressed={selected}
                onClick={() => { setActive(agent); setCopied(false); }}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  selected
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <span className={selected && agent.id !== "claude" ? "text-white" : "text-slate-900"}>
                  {agent.icon}
                </span>
                {agent.name}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-slate-950 py-2 pl-4 pr-2">
          <span className="select-none font-mono text-sm text-slate-500" aria-hidden="true">$</span>
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[13px] text-slate-100 [scrollbar-width:none]">
            {active.command}
          </code>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Copied" : `Copy the ${active.name} install command`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
