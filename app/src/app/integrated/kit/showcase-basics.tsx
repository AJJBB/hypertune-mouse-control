// Dev gallery for the basics group — every component in every variant/state,
// in the same order as the Figma component sets. ?app=1&kit=basics
import { useState, type CSSProperties, type ReactNode } from "react";
import { BatteryIcon, Icon } from "./icons";
import {
  Button, DeviceHeader, HeaderActions, IconButton, StatusPill, Tab, TabBar,
  type ButtonSize, type ButtonVariant, type TabItem,
} from "./basics";

const ALL_TABS: TabItem[] = [
  { id: "overview", label: "Overview" },
  { id: "performance", label: "Performance" },
  { id: "lighting", label: "Lighting" },
  { id: "buttons", label: "Buttons" },
  { id: "profiles", label: "Profiles" },
  { id: "advanced", label: "Advanced" },
  { id: "mouse-test", label: "Mouse test" },
];
const TABS_BY_COUNT: Record<number, string[]> = {
  4: ["overview", "performance", "buttons", "mouse-test"],
  5: ["overview", "performance", "buttons", "profiles", "mouse-test"],
  6: ["overview", "performance", "buttons", "profiles", "advanced", "mouse-test"],
  7: ["overview", "performance", "lighting", "buttons", "profiles", "advanced", "mouse-test"],
};
const pick = (n: number) => ALL_TABS.filter((t) => TABS_BY_COUNT[n].includes(t.id));

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 className="mk-t-caption12m mk-c-tertiary" style={{ margin: 0, textTransform: "uppercase" }}>{title}</h2>
      {children}
    </section>
  );
}
const row = (gap: number): CSSProperties => ({ display: "flex", alignItems: "center", gap });

function Pills(): ReactNode {
  return (
    <>
      <StatusPill type="active" label="Connected" />
      <StatusPill type="neutral" label="35%" icon={<BatteryIcon percent={15} />} />
      <StatusPill type="neutral" label="1600 DPI" icon={<Icon name="dpi" size={18} />} />
      <StatusPill type="neutral" label="2000 Hz" icon={<Icon name="pulse" size={18} />} />
    </>
  );
}

export default function ShowcaseBasics(): ReactNode {
  const [log, setLog] = useState("—");
  const [tab, setTab] = useState("overview");
  const [tabs4, setTabs4] = useState("overview");
  const [tabs5, setTabs5] = useState("overview");
  const [tabs6, setTabs6] = useState("overview");
  const [tabs7, setTabs7] = useState("overview");
  const tabState: Record<number, [string, (v: string) => void]> = {
    4: [tabs4, setTabs4], 5: [tabs5, setTabs5], 6: [tabs6, setTabs6], 7: [tabs7, setTabs7],
  };
  const sizes: ButtonSize[] = ["large", "medium"];
  const variants: ButtonVariant[] = ["neutral", "primary", "danger"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36, width: 1190 }}>
      <Section title="Button — Size × Style × State (Default · Hover · Disabled)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 131px)", columnGap: 22, rowGap: 20, justifyItems: "start" }}>
          {sizes.flatMap((s) => variants.flatMap((v) => [
            <Button key={`${s}${v}d`} label="Button" icon="reset" size={s} variant={v} onClick={() => setLog(`${s} ${v}`)} />,
            <Button key={`${s}${v}h`} label="Button" icon="reset" size={s} variant={v} className="is-hover" />,
            <Button key={`${s}${v}x`} label="Button" icon="reset" size={s} variant={v} disabled />,
          ]))}
        </div>
        <div style={row(10)}>
          <Button label="No icon" variant="primary" onClick={() => setLog("no icon")} />
          <Button label="Apply" size="medium" variant="primary" icon="check" onClick={() => setLog("apply")} />
          <Button label="Delete" size="medium" variant="danger" icon="trash" onClick={() => setLog("delete")} />
          <span className="mk-t-caption12 mk-c-secondary">last click: {log}</span>
        </div>
      </Section>

      <Section title="Icon button — Default · Hover · Danger · Disabled">
        <div style={row(20)}>
          <IconButton icon="edit" label="Rename" onClick={() => setLog("icon: rename")} />
          <IconButton icon="edit" label="Rename (hover)" className="is-hover" />
          <IconButton icon="edit" label="Rename (danger)" danger className="is-danger-state" />
          <IconButton icon="edit" label="Rename (disabled)" disabled />
          <span style={{ width: 20 }} />
          <IconButton icon="trash" label="Delete" danger onClick={() => setLog("icon: delete")} />
          <IconButton icon="copy" label="Copy" onClick={() => setLog("icon: copy")} />
          <IconButton icon="reset" label="Reset" onClick={() => setLog("icon: reset")} />
        </div>
      </Section>

      <Section title="Status pill — Active · Neutral · Warning · Error · Plain">
        <div style={row(20)}>
          <StatusPill type="active" label="Connected" />
          <StatusPill type="neutral" label="Connected" icon={<BatteryIcon percent={15} />} />
          <StatusPill type="warning" label="Connected" />
          <StatusPill type="error" label="Connected" />
          <StatusPill type="plain" label="Connected" />
        </div>
        <div style={row(10)}>
          <StatusPill type="neutral" label="1600" unit="DPI" icon={<Icon name="dpi" size={18} />} />
          <StatusPill type="neutral" label="2000" unit="Hz" icon={<Icon name="pulse" size={18} />} />
          <StatusPill type="neutral" label="80%" icon={<BatteryIcon percent={80} charging />} />
          <StatusPill type="active" label="Active" />
          <StatusPill type="error" label="Recording" />
          <StatusPill type="plain" label="3 of 5" />
        </div>
      </Section>

      <Section title="Tab bar — Tabs 4 · 5 · 6 · 7 (click / ← → Home End)">
        {[4, 5, 6, 7].map((n) => (
          <TabBar key={n} tabs={pick(n)} active={tabState[n][0]} onSelect={tabState[n][1]} ariaLabel={`${n} tabs`} />
        ))}
        <TabBar
          tabs={ALL_TABS.map((t) => (t.id === "lighting" ? { ...t, disabled: true } : t))}
          active={tab} onSelect={setTab} ariaLabel="With a disabled tab"
        />
      </Section>

      <Section title="Tab — Default · Selected · Hover · Disabled">
        <div style={row(20)}>
          {[
            <Tab key="d" label="Overview" />,
            <Tab key="s" label="Overview" selected />,
            <Tab key="h" label="Overview" className="is-hover" />,
            <Tab key="x" label="Overview" disabled />,
          ].map((t, i) => <div key={i} role="tablist" aria-label="Tab state" style={{ display: "flex", width: 196 }}>{t}</div>)}
        </div>
      </Section>

      <Section title="Device header">
        <DeviceHeader
          brand="Pulsar" model="G502 X PLUS"
          pills={<Pills />}
          actions={<HeaderActions onReport={() => setLog("report")} onShare={() => setLog("share")} />}
        />
        <DeviceHeader
          brand="Logitech" model="PRO X SUPERLIGHT 2"
          onBack={() => setLog("back")}
          pills={<>
            <StatusPill type="active" label="Connected" />
            <StatusPill type="neutral" label="35%" icon={<BatteryIcon percent={35} />} />
            <StatusPill type="neutral" label="1600" unit="DPI" icon={<Icon name="dpi" size={18} />} />
            <StatusPill type="neutral" label="2000" unit="Hz" icon={<Icon name="pulse" size={18} />} />
          </>}
          actions={<HeaderActions onReport={() => setLog("report")} onShare={() => setLog("share")} />}
        />
      </Section>

      <Section title="Header actions (Reset · Report · Share)">
        <div style={row(0)}>
          <HeaderActions onReset={() => setLog("reset")} onReport={() => setLog("report")} onShare={() => setLog("share")} />
        </div>
      </Section>
    </div>
  );
}
