"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { HeroSlide } from "@/content/schema";

const INTERVAL_MS = 9000; // original Supersized slide_interval
const PRELOAD_NEXT_MS = 3000; // load the next photo only after the first one is shown

/** Full-screen cross-fading photo slideshow with a dark link box (original "Supersized" hero). */
export function Hero({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const [preloaded, setPreloaded] = useState(false);

  useEffect(() => {
    if (slides.length < 2) return;
    const preload = window.setTimeout(() => setPreloaded(true), PRELOAD_NEXT_MS);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return () => window.clearTimeout(preload);
    }
    const timer = window.setInterval(() => setActive((i) => (i + 1) % slides.length), INTERVAL_MS);
    return () => {
      window.clearTimeout(preload);
      window.clearInterval(timer);
    };
  }, [slides.length]);

  return (
    <section id="top" aria-label="Willkommen" className="relative h-svh min-h-[420px] overflow-hidden bg-[#3a3a3a]">
      {slides.map((slide, i) =>
        i === 0 || preloaded ? (
          <Image
            key={slide.image}
            src={slide.image}
            alt=""
            fill
            priority={i === 0}
            sizes="100vw"
            quality={70}
            className={`object-cover transition-opacity duration-[900ms] ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : null,
      )}
      <div className="absolute inset-0 bg-pattern" />

      <div className="absolute top-[42px] left-0 z-10 max-w-[650px] border-t-[3px] border-brand bg-black/64 pt-6 pr-6 pb-10 pl-[18px] sm:pt-[33px] sm:pr-10 sm:pb-[72px]">
        {slides.map((slide, i) => (
          <ul key={slide.image} hidden={i !== active} className="space-y-0.5">
            {slide.links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="font-display text-[22px] leading-[30px] font-light text-brand [text-shadow:1px_1px_2px_#000] hover:text-white sm:text-[36px] sm:leading-[42px]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}
