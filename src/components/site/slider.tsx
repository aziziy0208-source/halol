"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { SliderSlide } from "@/content/schema";
import { FaIcon, ICONS } from "@/components/icons";

const INTERVAL_MS = 9000; // original Revolution Slider delay

/**
 * Four-slide partner banner (originally a Revolution Slider): text on the
 * left, logos on the right, captions fly in one after another.
 * All slides share one grid cell, so the banner is as tall as the tallest slide.
 */
export function Slider({ slides }: { slides: SliderSlide[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback(
    (delta: number) => setActive((i) => (i + delta + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => go(1), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [go, paused, slides.length]);

  return (
    <div
      role="region"
      aria-roledescription="Karussell"
      aria-label="Standards und Mitgliedschaften"
      className="relative mb-9 overflow-hidden bg-panel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* grid-cols-1 = minmax(0, 1fr): the stacked slides never grow wider than the screen.
          On desktop the banner is wider than the 940px text column, as on the original:
          the text starts in line with the column, the logos extend to the right. */}
      <div className="mx-auto grid max-w-[972px] grid-cols-1 px-12 py-10 md:px-14 lg:min-h-[500px] lg:max-w-[1240px] lg:items-center lg:py-16 lg:pl-[max(3.5rem,calc((min(1240px,100vw)-940px)/2))]">
        {slides.map((slide, i) => {
          const isActive = i === active;
          return (
            <div
              key={slide.title}
              role="group"
              aria-roledescription="Folie"
              aria-label={`${i + 1} von ${slides.length}`}
              aria-hidden={!isActive}
              inert={!isActive}
              className={`col-start-1 row-start-1 flex flex-col items-center gap-8 transition-opacity duration-500 lg:flex-row lg:items-center lg:justify-between ${
                isActive ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <div key={isActive ? `on-${active}` : "off"} className="w-full lg:w-[500px] lg:flex-none">
                <p className="slider-caption m-0 font-sans text-[48px] leading-[52px] font-extrabold text-brand-ink sm:text-[75px] sm:leading-[75px]">
                  {slide.title}
                </p>
                <p className="slider-caption mb-4 ml-1 text-sm font-bold text-[#545454] [animation-delay:150ms]">
                  {slide.subtitle}
                </p>
                {slide.intro ? (
                  <p className="slider-caption mb-1 text-[17px] leading-6 font-light text-black [animation-delay:300ms] sm:text-[19px]">
                    {slide.intro}
                  </p>
                ) : null}
                {slide.items.length > 0 ? (
                  <ul className="text-[15px] leading-[25px] font-light text-black sm:text-[19px]">
                    {slide.items.map((item, j) => (
                      <li
                        key={item}
                        className="slider-caption flex items-baseline gap-1.5"
                        style={{ animationDelay: `${450 + j * 150}ms` }}
                      >
                        <FaIcon icon={ICONS.check} className="h-3 w-3 shrink-0 text-brand" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {/* Logos take the remaining width and scale down on narrower desktops. */}
              <div className="flex shrink-0 items-start justify-center gap-4 md:gap-6 lg:min-w-0 lg:flex-1 lg:shrink lg:justify-end">
                {slide.images.map((image) => (
                  <Image
                    key={image.src}
                    src={image.src}
                    alt={image.alt}
                    width={image.width}
                    height={image.height}
                    sizes="(min-width: 1024px) 313px, 32vw"
                    className="slider-logo h-auto max-h-[274px] w-auto max-w-[32vw] lg:max-w-[48%]"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Vorherige Folie"
        className="absolute top-1/2 left-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/15 text-white hover:bg-black/35 md:left-5"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Nächste Folie"
        className="absolute top-1/2 right-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/15 text-white hover:bg-black/35 md:right-5"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
