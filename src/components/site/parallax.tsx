import Image from "next/image";
import type { ParallaxImage } from "@/content/schema";
import { RichText } from "./rich-text";

/**
 * Full-width image band with a fixed background on desktop (the original
 * `background-attachment: fixed`). Implemented with clip-path + a fixed layer so
 * the photo still goes through next/image (AVIF/WebP, responsive sizes).
 * On mobile the layer is absolute: iOS ignores fixed backgrounds, and lazy
 * loading keeps the photos out of the critical path.
 */
export function Parallax({ image, text }: { image: ParallaxImage; text?: string }) {
  return (
    <section
      aria-label={text ? undefined : "Bildband"}
      // Dark base colour: the white caption stays readable before the photo has loaded.
      className="relative h-[300px] overflow-hidden bg-[#3a3a3a] [clip-path:inset(0)] md:h-[524px]"
    >
      <div className="absolute inset-0 md:fixed">
        <Image
          src={`/assets/parallax/${image}.jpg`}
          alt=""
          fill
          sizes="100vw"
          quality={70}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-pattern" />
      </div>
      {text ? (
        <div className="relative flex h-full items-center justify-center px-4">
          <p className="text-center text-lg leading-6 font-semibold text-white uppercase [text-shadow:1px_1px_2px_#666] md:text-[28px] md:leading-8">
            <RichText text={text} accentClassName="" />
          </p>
        </div>
      ) : null}
    </section>
  );
}
