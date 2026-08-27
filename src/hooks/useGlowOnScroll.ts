import { useEffect, useRef } from "react";

/**
 * Attaches a one-shot "glow-pulse" CSS animation (defined in theme.css) each
 * time the element scrolls into view — re-triggerable on every re-entry, not
 * just once per mount. Toggles the class directly via the DOM ref rather
 * than React state so this stays cheap even with many cards on the page.
 */
export function useGlowOnScroll<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            target.classList.remove("glow-pulse");
            // Force reflow so the animation restarts even if the class name
            // is identical to before (re-entering the viewport).
            void target.offsetWidth;
            target.classList.add("glow-pulse");
          }
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
