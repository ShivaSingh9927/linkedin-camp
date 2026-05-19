import Image from "next/image";
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
        <Image
          src="/leadmate.png"
          alt="Qampi Logo"
          width={size === "sm" ? 32 : size === "md" ? 40 : 48}
          height={size === "sm" ? 32 : size === "md" ? 40 : 48}
          className="w-full h-full object-contain"
        />
      </div>
      {showText && (
        <span className={cn("font-black tracking-tight text-slate-900", textSizes[size])}>
          Qampi
        </span>
      )}
    </div>
  );
}
