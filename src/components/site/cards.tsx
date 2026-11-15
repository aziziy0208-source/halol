import type { Accent, IconCard, StatCard } from "@/content/schema";
import { FaIcon, ICONS } from "@/components/icons";
import { RichText } from "./rich-text";

// Icon colours of the original theme (blue.css: .list1 … .list5).
const ACCENT_CLASS: Record<Accent, string> = {
  green: "text-accent-green",
  orange: "text-accent-orange",
  lightblue: "text-accent-lightblue",
  yellow: "text-accent-yellow",
  red: "text-accent-red",
  dark: "text-[#444]",
};

/** Three centred service-style cards with a large icon. */
export function IconCards({ cards }: { cards: IconCard[] }) {
  return (
    <ul className="grid gap-6 text-center md:grid-cols-3">
      {cards.map((card, i) => (
        <li key={i}>
          <FaIcon
            icon={ICONS[card.icon]}
            className={`mx-auto mb-3 h-[72px] w-auto sm:h-[90px] ${ACCENT_CLASS[card.color]}`}
          />
          <h3 className="mb-[18px] text-base">
            <RichText text={card.title} />
          </h3>
          <p className="px-[18px]">
            <RichText text={card.text} />
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Two "Daten weltweit / Europa" cards with an icon and short paragraphs. */
export function StatCards({ stats }: { stats: StatCard[] }) {
  return (
    <ul className="grid gap-6 md:grid-cols-2">
      {stats.map((stat, i) => (
        <li key={i} className="text-center">
          <FaIcon
            icon={ICONS[stat.icon]}
            className={`mx-auto mb-3 h-[72px] w-auto sm:h-[90px] ${ACCENT_CLASS[stat.color]}`}
          />
          <h3 className="mb-[18px] text-base">
            <RichText text={stat.title} />
          </h3>
          <div className="mx-auto w-fit max-w-full text-left text-[13px] leading-[18px]">
            {stat.paragraphs.map((paragraph, j) => (
              <p key={j} className="mb-[18px]">
                <RichText text={paragraph} />
              </p>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
