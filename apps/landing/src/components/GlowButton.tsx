import { cn } from "@/lib/utils";

interface GlowButtonProps {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  href?: string;
}

export function GlowButton({ children, className, variant = "primary", size = "md", onClick, href }: GlowButtonProps) {
  const baseStyles = "inline-flex items-center justify-center font-bold rounded-2xl transition-all duration-300 hover:-translate-y-0.5 active:scale-95 cursor-pointer";
  
  const variants = {
    primary: "bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:bg-primary/90",
    secondary: "bg-white text-primary border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5",
    outline: "bg-transparent text-white border-2 border-white/30 hover:border-white/60 hover:bg-white/10",
  };

  const sizes = {
    sm: "px-5 py-2.5 text-sm",
    md: "px-8 py-3.5 text-base",
    lg: "px-10 py-4 text-lg",
  };

  const Component = href ? "a" : "button";
  const props = href ? { href } : { onClick };

  return (
    <Component
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </Component>
  );
}
