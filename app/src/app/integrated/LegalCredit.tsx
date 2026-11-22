import type { ReactNode } from "react";

/** OpenMouse / Source / AGPL-3.0 attribution — a licence requirement, so it
    shows on every integrated screen (home grid and device page). Styled by
    .mk-home-foot__legal in home.css. */
export function LegalCredit(): ReactNode {
  return (
    <span className="mk-home-foot__legal">
      In partnership with <a href="https://github.com/OpenMouse-Project/mouse-protocol" target="_blank" rel="noreferrer noopener">OpenMouse</a>
      {" · "}
      <a href="https://github.com/AJJBB/hypertune-mouse-control" target="_blank" rel="noreferrer noopener">Source</a>
      {" · "}
      <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer noopener">AGPL-3.0</a>
    </span>
  );
}
