// Shared pieces of the Profiles tab (sections/ProfilesSection.tsx): the onboard
// card grid, the editor's two-column row, notes and number formatting.
import type { ReactNode, Ref } from "react";

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(" ");

/** DPI with a thousands separator ("1,600"), as the copy rules ask. */
export const fmtDpi = (v: number): string => v.toLocaleString("en-US");

/** "1000 Hz" — space before the unit, no separator (reference screens). */
export const fmtHz = (v: number | null | undefined): string => (v ? `${v} Hz` : "—");

/** Onboard profile cards across the full 1190 content width, up to 4 per row.
    A single row stretches the cards to the reference height (450) so the
    footer buttons line up at the bottom, as on the Profiles (onboard) screen. */
export function CardGrid({ count, label, children }: { count: number; label: string; children: ReactNode }): ReactNode {
  return (
    <div className={cx("mk-pf-cards", count <= 4 && "is-one-row")} role="group" aria-label={label}>
      {children}
    </div>
  );
}

/** The editor under the cards: settings in a 665 column (the Setting row /
    DPI stage table width), buttons in the remaining 500 — the split anatomy
    of the settings tabs, mirrored. `side` is optional. */
export function EditorColumns({ main, side }: { main: ReactNode; side?: ReactNode }): ReactNode {
  return (
    <div className="mk-pf-cols">
      <div className="mk-pf-col">{main}</div>
      {side ? <div className="mk-pf-col">{side}</div> : null}
    </div>
  );
}

/** Editor block under the cards (scroll target for a card's Open). */
export function Editor({ editorRef, label, children }: { editorRef?: Ref<HTMLDivElement>; label: string; children: ReactNode }): ReactNode {
  return <div ref={editorRef} className="mk-pf-editor" role="region" aria-label={label}>{children}</div>;
}

/** A plain caption under a group (12 px, secondary). */
export function Note({ children, live = false }: { children: ReactNode; live?: boolean }): ReactNode {
  if (children === null || children === undefined || children === "") return null;
  return (
    <p className="mk-pf-note mk-t-caption12" role={live ? "status" : undefined} aria-live={live ? "polite" : undefined}>
      {children}
    </p>
  );
}

/** Several header actions side by side (Section header takes one node). */
export function Actions({ children }: { children: ReactNode }): ReactNode {
  return <div className="mk-pf-actions">{children}</div>;
}

/** Scroll the editor into view inside the tab's scroll column. */
export function revealEditor(el: HTMLElement | null): void {
  if (!el) return;
  let reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* no matchMedia */ }
  // Let the opened profile render first, then bring its editor up.
  window.requestAnimationFrame(() => el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" }));
}
