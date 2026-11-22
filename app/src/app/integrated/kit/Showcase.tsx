// Dev-only gallery: ?app=1&kit=<group> renders every component of one group in
// all its states, so each group can be screenshotted and compared with Ivan's
// Figma components in isolation. Groups load lazily so a broken group can't
// take the others down.
import { Suspense, lazy, type ReactNode } from "react";
import "./tokens.css";

const GROUPS = {
  basics: lazy(() => import("./showcase-basics")),
  controls: lazy(() => import("./showcase-controls")),
  rows: lazy(() => import("./showcase-rows")),
  lists: lazy(() => import("./showcase-lists")),
  display: lazy(() => import("./showcase-display")),
} as const;

export function KitShowcase({ group }: { group: string }): ReactNode {
  const G = GROUPS[group as keyof typeof GROUPS];
  return (
    <div className="mk" style={{ background: "var(--mk-bg-page)", minHeight: "100vh", padding: 24 }}>
      {G ? <Suspense fallback={null}><G /></Suspense>
        : <p className="mk-t-body14">Unknown kit group “{group}”. Try: {Object.keys(GROUPS).join(", ")}.</p>}
    </div>
  );
}
