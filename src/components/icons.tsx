// Font Awesome Free solid icons (CC BY 4.0, https://fontawesome.com/license/free),
// rendered as inline SVG — the original site used Font Awesome 3 icon fonts.
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { faAngleRight } from "@fortawesome/free-solid-svg-icons/faAngleRight";
import { faAsterisk } from "@fortawesome/free-solid-svg-icons/faAsterisk";
import { faCheck } from "@fortawesome/free-solid-svg-icons/faCheck";
import { faComment } from "@fortawesome/free-solid-svg-icons/faComment";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons/faEnvelope";
import { faEye } from "@fortawesome/free-solid-svg-icons/faEye";
import { faGear } from "@fortawesome/free-solid-svg-icons/faGear";
import { faGears } from "@fortawesome/free-solid-svg-icons/faGears";
import { faGlobe } from "@fortawesome/free-solid-svg-icons/faGlobe";
import { faHouse } from "@fortawesome/free-solid-svg-icons/faHouse";
import { faSignal } from "@fortawesome/free-solid-svg-icons/faSignal";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons/faTriangleExclamation";
import { faUser } from "@fortawesome/free-solid-svg-icons/faUser";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import type { IconName } from "@/content/schema";

export const ICONS = {
  comment: faComment,
  asterisk: faAsterisk,
  eye: faEye,
  cog: faGear,
  cogs: faGears,
  globe: faGlobe,
  signal: faSignal,
  check: faCheck,
  warning: faTriangleExclamation,
  remove: faXmark,
  angle: faAngleRight,
  user: faUser,
  home: faHouse,
  envelope: faEnvelope,
} as const;

// Every content icon name must have an SVG (compile-time check).
const _contentIcons: Record<IconName, IconDefinition> = ICONS;
void _contentIcons;

type Props = {
  icon: IconDefinition;
  className?: string;
  /** Accessible name; omit for decorative icons. */
  title?: string;
};

export function FaIcon({ icon, className, title }: Props) {
  const [width, height, , , path] = icon.icon;
  const paths = Array.isArray(path) ? path : [path];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      fill="currentColor"
      focusable="false"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
