// Kit gallery — display group. Every component in every variant/state, in the
// same order as the Figma variant grids, wired with local state.
import { useState, type ReactNode } from "react";
import {
  ReadoutTile, StatusPanel, InfoRow, DeviceInfoList, SignalStrength, SignalChart,
  Diagnostics, DiagnosticRow, StatTile, ButtonTester, type TesterButton, type SignalLevel,
} from "./display";
import { BatteryIcon } from "./icons";

function Section({ title, children, width }: { title: string; children: ReactNode; width?: number }): ReactNode {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 className="mk-t-caption12m mk-c-tertiary" style={{ margin: "0 0 10px", lineHeight: "15px", textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</h2>
      <div style={{ width }}>{children}</div>
    </section>
  );
}

const STAGES = [400, 800, 1600, 3200, 6400];
const fmt = (n: number): string => n.toLocaleString("en-US");
/* Traced from the Figma chart line (higher = stronger). */
const SAMPLES = [28, 28, 34, 30, 35, 34, 31, 35, 30, 33, 29, 28, 30, 32, 24, 23, 26, 29, 24, 23, 28, 20, 29, 24, 24, 26, 50, 57, 52, 35, 36, 34, 36, 31, 30, 30, 34, 30, 27, 28, 26].map((y) => 100 - y);

const BTN_MAP: Record<number, TesterButton> = { 0: "left", 1: "middle", 2: "right", 3: "back", 4: "forward" };

export default function ShowcaseDisplay(): ReactNode {
  const [stage, setStage] = useState(2);
  const [copied, setCopied] = useState(0);
  const [counts, setCounts] = useState<Record<TesterButton, number>>({ left: 0, right: 0, middle: 0, back: 0, forward: 0 });
  const [scroll, setScroll] = useState({ up: 0, down: 0 });
  const [pressed, setPressed] = useState<TesterButton | null>(null);
  const [wheel, setWheel] = useState<"up" | "down" | null>(null);

  const down = (e: globalThis.MouseEvent): void => {
    e.preventDefault();
    const b = BTN_MAP[e.button];
    if (!b) return;
    setPressed(b);
    setCounts((c) => ({ ...c, [b]: c[b] + 1 }));
  };
  const onWheel = (e: globalThis.WheelEvent): void => {
    if (e.deltaY === 0) return;
    const d =e.deltaY < 0 ? "up" : "down";
    setScroll((s) => ({ ...s, [d]: s[d] + 1 }));
    setWheel(d);
    window.setTimeout(() => setWheel(null), 150);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <Section title="Readout tile" width={325}>
        <ReadoutTile label="DPI" value="1,600" unit="DPI" icon="dpi" />
      </Section>

      <Section title="Readout tile — with prev / next (Performance DPI)" width={500}>
        <ReadoutTile label="DPI" value={fmt(STAGES[stage])} unit="DPI" icon="dpi"
          onPrev={() => setStage((s) => Math.max(0, s - 1))} onNext={() => setStage((s) => Math.min(STAGES.length - 1, s + 1))}
          prevDisabled={stage === 0} nextDisabled={stage === STAGES.length - 1} />
      </Section>

      <Section title="Status panel" width={660}>
        <StatusPanel tiles={<>
          <ReadoutTile label="DPI" value="1,600" unit="DPI" icon="dpi" />
          <ReadoutTile label="Polling rate" value="2000" unit="Hz" icon="pulse" />
        </>}>
          <InfoRow label="Battery" icon={<BatteryIcon percent={20} />} value="35%" secondary="Discharging" />
          <InfoRow label="Connection" value="Wireless" secondary="8K dongle" />
          <InfoRow label="Active profile" value="Profile 1" />
        </StatusPanel>
      </Section>

      <Section title="Info row — Text / Two values / Icon" width={660}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <InfoRow label="Battery" value="Wireless" />
          <InfoRow label="Battery" value="Wireless" secondary="8K dongle" />
          <InfoRow label="Battery" icon={<BatteryIcon percent={20} />} value="Wireless" secondary="8K dongle" />
        </div>
      </Section>

      <Section title="Device info list" width={660}>
        <DeviceInfoList>
          <InfoRow label="Manufacturer" value="Pulsar" />
          <InfoRow label="Mouse firmware" value="v1.0.3" />
          <InfoRow label="Dongle firmware" value="v2.25" />
          <InfoRow label="Onboard memory" value="4 profiles" />
          <InfoRow label="Sensor" value="PAW3395" />
        </DeviceInfoList>
      </Section>

      <Section title="Signal strength — Level 0–4 (+ no word, unknown)">
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          {([0, 1, 2, 3, 4] as SignalLevel[]).map((l) => <SignalStrength key={l} level={l} />)}
          <SignalStrength level={3} showWord={false} />
          <SignalStrength level={null} />
        </div>
      </Section>

      <Section title="Signal chart" width={665}>
        <SignalChart title="Signal strength" value="52 dBm" level={4} samples={SAMPLES} />
      </Section>

      <Section title="Diagnostics" width={665}>
        <Diagnostics onCopy={() => setCopied((n) => n + 1)}>
          <DiagnosticRow label="Report rate" value="1000 Hz" status="ok" />
          <DiagnosticRow label="Packet loss" value="0.2%" status="ok" />
          <DiagnosticRow label="Sensor" value="PAW3395" />
          <DiagnosticRow label="Firmware" value="Update available" status="warning" />
          <DiagnosticRow label="Receiver link" value="Not found" status="error" />
          <DiagnosticRow label="Last sync" value={copied ? `Log copied ×${copied}` : "2 min ago"} />
        </Diagnostics>
      </Section>

      <Section title="Diagnostic row — Neutral / OK / Warning / Error" width={645}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <DiagnosticRow label="Report rate" value="1000 Hz" status="neutral" />
          <DiagnosticRow label="Report rate" value="1000 Hz" status="ok" />
          <DiagnosticRow label="Report rate" value="1000 Hz" status="warning" />
          <DiagnosticRow label="Report rate" value="1000 Hz" status="error" />
        </div>
      </Section>

      <Section title="Stat tile — Idle / Counted / Active">
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ width: 140 }}><StatTile label="Right click" value={null} /></div>
          <div style={{ width: 140 }}><StatTile label="Right click" value="41" /></div>
          <div style={{ width: 140 }}><StatTile label="Right click" value="41" state="active" /></div>
        </div>
      </Section>

      <Section title="Button tester — Idle / Active" width={780}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <ButtonTester counts={{ left: 0, right: 0, middle: 0, back: 0, forward: 0 }} scroll={{ up: 0, down: 0 }} pressed={null} wheel={null} />
          <ButtonTester counts={{ left: 128, right: 41, middle: 6, back: 3, forward: 2 }} scroll={{ up: 48, down: 52 }} pressed="left" wheel={null} />
        </div>
      </Section>

      <Section title="Button tester — live (click / scroll in the box)" width={780}>
        <div onMouseDown={down} onMouseUp={() => setPressed(null)} onMouseLeave={() => setPressed(null)}
          onContextMenu={(e) => e.preventDefault()} onWheel={onWheel}
          style={{ cursor: "crosshair", userSelect: "none" }}>
          <ButtonTester counts={counts} scroll={scroll} pressed={pressed} wheel={wheel} />
        </div>
      </Section>
    </div>
  );
}
