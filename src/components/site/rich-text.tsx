import { Fragment, type ReactNode } from "react";

const TOKEN = /\{\{(.*?)\}\}|\n/g;

type Props = {
  text: string;
  /** Class for {{accent}} parts; the original site's `.color` spans. */
  accentClassName?: string;
};

/** Renders content text: {{…}} → accent span, \n → line break on md+ (space on mobile). */
export function RichText({ text, accentClassName = "text-brand-ink" }: Props) {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    if (match[0] === "\n") {
      parts.push(
        <Fragment key={key++}>
          {" "}
          <br className="hidden md:inline" />
        </Fragment>,
      );
    } else {
      parts.push(
        <span key={key++} className={accentClassName}>
          {match[1]}
        </span>,
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
