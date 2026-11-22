// Integrated "Tools Hub" — Ivan's Figma "Tools Hub" (Hypertune v2.0 › App /
// Mouse): HyperTune's Tools landing, a 2×2 grid of tool tiles with Mouse Tools
// first and a small removable "New" highlight. In the real native shell the app
// draws this and "Mouse Tools" opens this web pane; here it's a web rendering of
// that landing (shown via ?hub=1). Only Mouse Tools is ours: Network and Disk
// Tools live in native HyperTune (their Open is inert here), Controller Tools
// is "Coming Soon" as on the reference.
import { type ReactNode } from "react";
import type { ControlSnapshot } from "../../device/types";
import { Button, Icon } from "./kit";
import "./kit/tokens.css";
import "./home.css";

type Tool = { key: string; name: string; art: string; isNew?: boolean; state: "open" | "native" | "soon" };

const TOOLS: Tool[] = [
  { key: "mouse", name: "Mouse Tools", art: "/v2/hub-mouse.png", isNew: true, state: "open" },
  { key: "network", name: "Network Tools", art: "/v2/hub-network.png", state: "native" },
  { key: "controller", name: "Controller Tools", art: "/v2/hub-controller.png", state: "soon" },
  { key: "disk", name: "Disk Tools", art: "/v2/hub-disk.png", state: "native" },
];

export function ToolsHub({ onOpenMouse }: { snapshot: ControlSnapshot; onOpenMouse: () => void }): ReactNode {
  return (
    <div className="mk-hub">
      <div className="mk-hub__grid">
        {TOOLS.map((tool) => (
          <article key={tool.key} className={`mk-hub__tile is-${tool.state}`} aria-label={tool.name}>
            <header className="mk-hub__head">
              <span className="mk-hub__name mk-t-button16">{tool.name}</span>
              <span className="mk-hub__help" aria-hidden="true"><Icon name="info" size={10} /></span>
              {tool.isNew ? <span className="mk-hub__new">NEW</span> : null}
            </header>
            <div className="mk-hub__art">
              <img src={tool.art} alt="" draggable={false} />
            </div>
            <Button
              label={tool.state === "soon" ? "Coming Soon" : "Open"}
              className="mk-hub__open"
              disabled={tool.state !== "open"}
              title={tool.state === "native" ? "Open this from HyperTune" : undefined}
              onClick={tool.state === "open" ? onOpenMouse : undefined}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
