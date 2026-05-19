import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPosition = window.scrollY;
      setProgress(totalHeight > 0 ? (scrollPosition / totalHeight) * 100 : 0);
      setShowTop(scrollPosition > 500);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-1 bg-transparent">
        <div
          className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Scroll to top button */}
      <button
        onClick={scrollToTop}
        className={cn(
          "fixed bottom-8 right-8 z-50 w-12 h-12 bg-primary text-white rounded-2xl shadow-lg shadow-primary/25 flex items-center justify-center transition-all duration-300 hover:bg-primary/90 hover:-translate-y-1 active:scale-95",
          showTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
        aria-label="Scroll to top"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </>
  );
}
