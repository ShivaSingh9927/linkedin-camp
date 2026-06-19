import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-[13px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:pointer-events-none disabled:opacity-50 active:scale-[.98]",
  {
    variants: {
      variant: {
        // Primary brand action — the one with the lift shadow.
        default: "bg-brand text-white shadow-lift hover:bg-brand-600",
        // High-contrast dark action (e.g. Edit sequence).
        dark: "bg-ink-900 text-white hover:bg-ink-700",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Bordered neutral — secondary action on white surfaces.
        outline: "border border-line bg-card text-ink-700 hover:bg-surface",
        // Tinted fill — quiet secondary on cards.
        secondary: "bg-surface text-ink-700 hover:bg-brand-50 hover:text-brand",
        ghost: "text-ink-500 hover:bg-surface hover:text-foreground",
        link: "text-brand underline-offset-4 hover:underline px-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3.5 rounded-chip text-[12px]",
        lg: "h-11 px-6",
        icon: "h-9 w-9 rounded-control",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Shows a spinner, disables the button, and keeps its width steady. */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    // `asChild` (Slot) requires exactly one child, so a loading spinner can't be
    // injected alongside it. Loading therefore falls back to a real <button>.
    const Comp = asChild && !loading ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), loading && "relative")}
        ref={ref}
        disabled={Comp === "button" ? (disabled || loading) : undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {/* Slot (asChild) runs React.Children.only — it must receive exactly one
            child, so never emit the `loading && ...` sibling (which renders as a
            stray `false`) in that branch. asChild already forces loading off. */}
        {Comp === Slot ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
