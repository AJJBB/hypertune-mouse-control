// v2.0 integrated "Tools Hub" (Figma "Tools Hub") — HyperTune's Tools landing,
// a 2×2 grid of tool tiles. In the real native shell this is drawn by the app
// and "Mouse Tools" opens this web pane; here it's a web rendering of that
// landing (shown via ?hub=1). Only Mouse Tools is ours, so the other tiles are
// honest "Coming soon" placeholders rather than dead Open buttons.
import { type ReactNode } from "react";
import { Gamepad2, HardDrive, Router } from "lucide-react";
import * as control from "../../device/controller";
import type { ControlSnapshot } from "../../device/types";
import { deviceImage } from "../../ui/device-images";

type Tool = { key: string; name: string; isNew?: boolean; enabled?: boolean };

const TOOLS: Tool[] = [
  { key: "mouse", name: "Mouse Tools", isNew: true, enabled: true },
  { key: "network", name: "Network Tools" },
  { key: "controller", name: "Controller Tools" },
  { key: "disk", name: "Disk Tools" },
];

function ToolArt({ tool, snapshot }: { tool: Tool; snapshot: ControlSnapshot }): ReactNode {
  if (tool.key === "mouse") {
    const device = control.getActiveDevice();
    return (
      <img
        className="htv2-hub-img"
        src={snapshot.status ? deviceImage(device, snapshot.status.name) : "/v2/empty-mouse.png"}
        alt=""
        draggable={false}
        onError={(e) => { e.currentTarget.src = "/v2/empty-mouse.png"; }}
      />
    );
  }
  const Icon = tool.key === "network" ? Router : tool.key === "controller" ? Gamepad2 : HardDrive;
  return <Icon className="htv2-hub-icon" size={76} strokeWidth={1.3} aria-hidden="true" />;
}

export function ToolsHub({ snapshot, onOpenMouse }: { snapshot: ControlSnapshot; onOpenMouse: () => void }): ReactNode {
  return (
    <div className="htv2-hub">
      <div className="htv2-hub-grid">
        {TOOLS.map((tool) => (
          <article key={tool.key} className={`htv2-hub-tile${tool.enabled ? "" : " is-soon"}`}>
            <div className="htv2-hub-media">
              <span className="htv2-hub-label">
                {tool.name}
                {tool.isNew ? <span className="htv2-hub-new">NEW</span> : null}
              </span>
              <ToolArt tool={tool} snapshot={snapshot} />
            </div>
            <button
              type="button"
              className="htv2-hub-open"
              disabled={!tool.enabled}
              onClick={tool.enabled ? onOpenMouse : undefined}
            >
              {tool.enabled ? "Open" : "Coming soon"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
