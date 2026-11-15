import type { ReactNode } from "react";
import { RichText } from "./rich-text";

/** 940px content column (the original 960px Skeleton grid) with 16px mobile gutters. */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[972px] px-4 ${className}`}>{children}</div>;
}

/** Section heading: big Oswald title with an accent bar and stacked subtitles. */
export function TitleBar({ title, subtitle }: { title: string; subtitle: string[] }) {
  return (
    // flex-wrap: on narrow phones a long title pushes the subtitle to the next line
    // instead of widening the page.
    <div className="my-[18px] flex flex-wrap items-start gap-x-[6px] gap-y-1">
      <h2 className="max-w-full border-r-4 border-brand pr-[6px] text-[32px] leading-[40px] text-[#333] sm:text-[40px] sm:leading-[44px]">
        {title}
      </h2>
      {subtitle.length > 0 ? (
        <p className="m-0 min-w-0 pt-1 text-sm leading-[18px]">
          {subtitle.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

/** Centered lead sentence between two hairlines (the original `.message-block`). */
export function MessageBlock({ text }: { text: string }) {
  return (
    <p className="mb-9 border-y border-rule px-2 py-[18px] text-center font-display text-xl leading-8 font-light text-[#535353] sm:px-9 sm:text-2xl sm:leading-9">
      <RichText text={text} />
    </p>
  );
}

export function Divider() {
  return <hr className="mt-2.5 mb-[30px] border-0 border-t border-rule" />;
}
