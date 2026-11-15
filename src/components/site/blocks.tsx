import type { Block, Row } from "@/content/schema";
import { FaIcon, ICONS } from "@/components/icons";
import { Divider } from "./layout-primitives";
import { RichText } from "./rich-text";

const LIST_ICON = {
  check: { icon: ICONS.check, className: "text-brand" },
  angle: { icon: ICONS.angle, className: "text-brand" },
  remove: { icon: ICONS.remove, className: "text-accent-red" },
} as const;

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return block.level === 3 ? (
        <h3 className="mb-[18px] text-xl leading-6">
          <RichText text={block.text} />
        </h3>
      ) : (
        <h4 className="mb-[18px] text-[15px] leading-[22px]">
          <RichText text={block.text} />
        </h4>
      );
    case "paragraph":
      return (
        <p className="mb-[18px]">
          <RichText text={block.text} />
        </p>
      );
    case "list": {
      if (block.icon === "dot") {
        return (
          <ul className="mb-[18px] list-disc pl-5">
            {block.items.map((item, i) => (
              <li key={i}>
                <RichText text={item} />
              </li>
            ))}
          </ul>
        );
      }
      const marker = LIST_ICON[block.icon];
      return (
        <ul className={`mb-[18px] ${block.icon === "remove" ? "space-y-4" : ""}`}>
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-1.5">
              <FaIcon icon={marker.icon} className={`mt-[4px] h-3 w-3 shrink-0 ${marker.className}`} />
              <span>
                <RichText text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    }
    case "spacer":
      // Aligns the right column with the left column's second heading on desktop.
      return <div aria-hidden className="hidden h-10 md:block" />;
  }
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </>
  );
}

/** Two-column text rows separated by hairlines, as on the original page. */
export function Rows({ rows }: { rows: Row[] }) {
  return (
    <>
      {rows.map((row, i) => (
        <div key={row.id ?? i} id={row.id}>
          {row.divider ? <Divider /> : null}
          <div className="grid gap-x-5 md:grid-cols-2">
            {row.columns.map((column, j) => (
              <div key={j}>
                <Blocks blocks={column} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
