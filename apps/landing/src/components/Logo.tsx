import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
}

export function Logo({ size = "md", className, showText = true }: LogoProps) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className={cn("relative", sizes[size])}>
        <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
          <rect width="40" height="40" rx="10" fill="url(#logo-gradient)" />
          <circle cx="20" cy="18" r="7" stroke="white" strokeWidth="4.5" fill="none" />
          <path d="M24.5 22.5l6 6" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
          <defs>
            <linearGradient id="logo-gradient" x1="0" y1="0" x2="40" y2="40">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {showText && (
        <span className={cn("font-black tracking-tight text-slate-900", textSizes[size])}>
          Qampi
        </span>
      )}
    </div>
  );
}
