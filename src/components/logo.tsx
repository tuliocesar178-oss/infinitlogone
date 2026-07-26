import logoAsset from "@/assets/infinitlog-logo.png.asset.json";

type LogoProps = {
  /** Height in pixels. Width scales automatically. */
  size?: number;
  /** Show wordmark next to the mark. */
  withWordmark?: boolean;
  /** Force wordmark color (defaults to currentColor via text-foreground). */
  className?: string;
};

/**
 * InfinitLog brand lockup.
 * Uses the official circular mark; wordmark is rendered as text so it
 * inherits the current theme color and stays crisp at every size.
 */
export function Logo({ size = 32, withWordmark = true, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src={logoAsset.url}
        alt="InfinitLog"
        width={size}
        height={size}
        style={{ height: size, width: size }}
        className="shrink-0 object-contain"
        loading="eager"
        decoding="async"
      />
      {withWordmark && (
        <span
          className="font-semibold tracking-tight text-foreground"
          style={{ fontSize: Math.round(size * 0.5) }}
        >
          Infinit<span className="text-brand">Log</span>
        </span>
      )}
    </span>
  );
}

export const logoUrl = logoAsset.url;
