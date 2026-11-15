import type { Provenance } from "../types/data";

/**
 * Where the numbers on screen come from. With a provenance, it names the
 * product actually loaded; without one (home page), the source the page uses.
 */
export function DataSourceBadge({ provenance }: { provenance?: Provenance | null }) {
  const sources = provenance?.sources.filter((s) => s !== "POWER") ?? [];
  const label = sources.length ? `NASA POWER · ${sources.join(" · ")}` : "NASA POWER";
  return (
    <span className="demo-badge source-badge">
      <span aria-hidden="true" /> {label}
    </span>
  );
}
