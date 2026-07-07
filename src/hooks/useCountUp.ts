"use client";
import { useEffect, useRef, useState } from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * Ease a displayed number toward `target`. Tracks the shown value in a ref so
 * frequent re-renders never restart from a stale value, and includes a
 * setTimeout fallback so the final value always lands even when rAF is paused
 * (hidden/background tab, headless renderer).
 */
export function useCountUp(target: number, durationMs = 900): number {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const toRef = useRef(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      displayRef.current = target;
      toRef.current = target;
      setDisplay(target);
      return;
    }
    if (target === toRef.current) return;

    fromRef.current = displayRef.current;
    toRef.current = target;
    startRef.current = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 5);

    const tick = (now: number) => {
      if (startRef.current === 0) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const value = fromRef.current + (toRef.current - fromRef.current) * ease(t);
      displayRef.current = value;
      setDisplay(value);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    const fallback = window.setTimeout(() => {
      displayRef.current = target;
      setDisplay(target);
    }, durationMs + 150);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(fallback);
    };
  }, [target, reduced, durationMs]);

  return reduced ? target : display;
}
