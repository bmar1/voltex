interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
  variant?: "mark" | "stamp";
}

/**
 * Stormwatch mark.
 *
 * Arc above (storm front sweeping in), three vertical strokes beneath it
 * (people/poles/the grid we watch), single warm amber stroke in the centre
 * (the location currently being assessed), horizon line below (community
 * baseline). `currentColor` flows through the mono strokes so it inherits
 * paper/ink depending on the surface.
 */
export function Logo({
  size = 28,
  withWordmark = false,
  className,
  variant = "mark",
}: LogoProps) {
  const stroke = variant === "stamp" ? 2.5 : 2;
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`.trim()}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        role="img"
        aria-label="GridGuard"
      >
        <path
          d="M 10 40 A 22 22 0 0 1 54 40"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <line
          x1="22"
          y1="34"
          x2="22"
          y2="46"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="30"
          x2="32"
          y2="46"
          stroke="#e0a458"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <line
          x1="42"
          y1="34"
          x2="42"
          y2="46"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <line
          x1="9"
          y1="52"
          x2="55"
          y2="52"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </svg>
      {withWordmark && (
        <span className="text-base font-semibold tracking-tight text-[var(--paper)]">
          GridGuard
        </span>
      )}
    </span>
  );
}
