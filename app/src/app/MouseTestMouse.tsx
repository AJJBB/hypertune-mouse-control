import type { CSSProperties, ReactNode } from "react";

export interface MouseClickButtons {
  left: boolean;
  right: boolean;
  middle: boolean;
  back: boolean;
  forward: boolean;
}

interface MouseTestMouseProps {
  buttons: MouseClickButtons;
  wheel: "up" | "down" | null;
}

const btnClass = (pressed: boolean): string => `mouse-test-mouse-btn${pressed ? " pressed" : ""}`;

// Original top-down schematic — deliberately geometric so it reads as a
// Hypertune diagram rather than the hand-drawn illustration it replaced. Each
// zone carries the shared highlight classes so a press/scroll lights it green.
const shell: CSSProperties = { fill: "var(--surface-panel)", stroke: "var(--border-hover)", strokeWidth: 3, strokeLinejoin: "round" };
const zone: CSSProperties = { fill: "var(--surface-strong)", stroke: "var(--border-hover)", strokeWidth: 2, strokeLinejoin: "round" };
const arrow: CSSProperties = { fill: "var(--muted)" };

export function MouseTestMouse({ buttons, wheel }: MouseTestMouseProps): ReactNode {
  return (
    <svg
      className="mouse-test-mouse"
      viewBox="0 0 200 320"
      role="img"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shell silhouette */}
      <path
        style={shell}
        d="M100 10 C58 10 38 46 32 98 C26 152 24 192 28 228 C33 272 54 312 100 312 C146 312 167 272 172 228 C176 192 174 152 168 98 C162 46 142 10 100 10 Z"
      />
      {/* Primary buttons */}
      <path className={btnClass(buttons.left)} style={zone} d="M95 24 L72 26 C55 32 47 62 44 98 C42 126 42 148 44 162 L95 162 Z" />
      <path className={btnClass(buttons.right)} style={zone} d="M105 24 L128 26 C145 32 153 62 156 98 C158 126 158 148 156 162 L105 162 Z" />
      {/* Scroll wheel (middle click) + scroll direction arrows */}
      <rect className={btnClass(buttons.middle)} style={zone} x="90" y="40" width="20" height="56" rx="10" />
      <path className={`mouse-test-wheel${wheel === "up" ? " active" : ""}`} style={arrow} d="M100 48 l5 7 h-10 z" />
      <path className={`mouse-test-wheel${wheel === "down" ? " active" : ""}`} style={arrow} d="M100 88 l5 -7 h-10 z" />
      {/* Side buttons */}
      <rect className={btnClass(buttons.forward)} style={zone} x="24" y="116" width="13" height="26" rx="6" />
      <rect className={btnClass(buttons.back)} style={zone} x="24" y="150" width="13" height="26" rx="6" />
    </svg>
  );
}
