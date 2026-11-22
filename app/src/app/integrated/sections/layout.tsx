// Shared screen anatomy for the integrated (Figma v2) device page.
// From the reference screens (content frame 1210×695, padding 10, gap 10):
//   Tab bar (1190×45) → Device header → content row that fills the rest.
//   Split tabs:   left 500 | gap 25 | right 665   (Performance, Lighting, Buttons, Profiles-app, Advanced)
//   Overview:     left 500 | gap 10 | right 680
//   Full width:   1190                            (Profiles onboard cards, Mouse test)
// Content that doesn't fit scrolls inside the right column — the spec says
// never shrink rows.
import type { ReactNode } from "react";
import * as control from "../../../device/controller";
import type { ControlSnapshot } from "../../../device/types";
import { deviceImage } from "../../../ui/device-images";
import "./layout.css";

export function SplitLayout({ left, right, variant = "default" }: { left: ReactNode; right: ReactNode; variant?: "default" | "overview" }): ReactNode {
  return (
    <div className={`mk-split mk-split--${variant}`}>
      <div className="mk-split__left">{left}</div>
      <div className="mk-split__right" data-scroll="y">{right}</div>
    </div>
  );
}

export function FullLayout({ children, scroll = true }: { children: ReactNode; scroll?: boolean }): ReactNode {
  return <div className={`mk-full${scroll ? " mk-full--scroll" : ""}`} data-scroll={scroll ? "y" : undefined}>{children}</div>;
}

/** The product render column. `dots` adds the faint dot-grid backdrop + accent
    glow used on the settings tabs (Overview shows the render plain). `footer`
    docks content at the bottom of the column — the DPI readout tile, DPI presets
    or the DPI stage table on Performance. */
export function MouseRender({ snapshot, dots = true, footer }: { snapshot: ControlSnapshot; dots?: boolean; footer?: ReactNode }): ReactNode {
  const s = snapshot.status;
  const src = deviceImage(control.getActiveDevice(), s?.name ?? "");
  return (
    <div className={`mk-render${dots ? " mk-render--dots" : ""}`}>
      <div className="mk-render__stage">
        <img className="mk-render__img" src={src} alt={s?.name ?? ""} draggable={false}
          onError={(e) => { e.currentTarget.src = "/v2/empty-mouse.png"; }} />
      </div>
      {footer ? <div className="mk-render__footer">{footer}</div> : null}
    </div>
  );
}

/** Vertical stack for the right column: Section headers + groups, gap 10. */
export function Stack({ children, gap = 10 }: { children: ReactNode; gap?: 5 | 10 | 20 }): ReactNode {
  return <div className={`mk-stack mk-stack--${gap}`}>{children}</div>;
}

/** Shown in a tab body when a device exposes nothing for it (rare — tabs are
    normally hidden instead). The brief's "not available for this mouse" state
    isn't in the library yet, so this stays deliberately quiet. */
export function EmptyNote({ children }: { children: ReactNode }): ReactNode {
  return <p className="mk-empty-note mk-t-body14 mk-c-secondary">{children}</p>;
}
