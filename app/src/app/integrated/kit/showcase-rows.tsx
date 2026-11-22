// Gallery for the rows group (?app=1&kit=rows). Each "board" is the Figma component set's frame:
// same size, every variant at the same x/y as in the library, so a screenshot of a board can be
// diffed 1:1 against `crop_lib.py "<Component>"`. Extra boards below show the optional parts
// (count, action, popover, states) the library hides by default. Everything is wired with local state.
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "./basics";
import { ArrowStepper, Dropdown, NumberField, Segmented, StepPicker, TextInput, TimeStepper, Toggle, type DropOption, type SegOption } from "./controls";
import { InfoRow } from "./display";
import {
  CollapsibleSection, ColorPicker, ColorPickerPopover, SectionHeader, SettingGroup, SettingRow, SettingValue,
  SliderRow, ZonePicker, ZoneSwatch, type Zone,
} from "./rows";

function Board({ id, title, w, h, children }: { id: string; title: string; w: number; h: number; children: ReactNode }): ReactNode {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 className="mk-t-caption12m mk-c-muted" style={{ margin: 0 }}>{title}</h3>
      <div data-board={id} style={{ position: "relative", width: w, height: h, outline: "1px dashed var(--mk-border)" }}>{children}</div>
    </section>
  );
}
function At({ x, y, w, h, children }: { x: number; y: number; w?: number; h?: number; children: ReactNode }): ReactNode {
  const s: CSSProperties = { position: "absolute", left: x, top: y, width: w, height: h };
  return <div style={s}>{children}</div>;
}

const LMH: SegOption<string>[] = [{ value: "low", label: "Low" }, { value: "med", label: "Medium" }, { value: "high", label: "High" }];
const DEBOUNCE: DropOption<number>[] = [1, 2, 4, 8].map((v) => ({ value: v, label: `${v} ms` }));
const SENSOR: DropOption<string>[] = [{ value: "low", label: "Low" }, { value: "high", label: "High" }, { value: "max", label: "Max" }];
const NAME = "Setting name";
const DESC = "One line on what this setting does.";
const noop = (): void => {};

type Kind = "toggle" | "segmented" | "dropdown" | "arrow" | "steps" | "time" | "number" | "text" | "value" | "button";
const KINDS: { kind: Kind; y: number }[] = [
  { kind: "toggle", y: 20 }, { kind: "segmented", y: 100 }, { kind: "dropdown", y: 180 }, { kind: "arrow", y: 260 },
  { kind: "steps", y: 340 }, { kind: "time", y: 417 }, { kind: "number", y: 497 }, { kind: "text", y: 577 },
  { kind: "value", y: 657 }, { kind: "button", y: 734 },
];

/** One Setting row variant (Control=<kind>), with its own local state. */
function Row({ kind, disabled }: { kind: Kind; disabled: boolean }): ReactNode {
  const [tog, setTog] = useState<boolean | null>(true);
  const [seg, setSeg] = useState<string | null>("med");
  const [dd, setDd] = useState<number | null>(2);
  const [ar, setAr] = useState<string | null>("high");
  const [st, setSt] = useState<number | null>(3);
  const [ts, setTs] = useState(5 * 60 + 30);
  const [nf, setNf] = useState<number | null>(1600);
  const [tx, setTx] = useState("G502 X Plus");
  const [pairs, setPairs] = useState(0);
  const d = disabled;
  let control: ReactNode;
  switch (kind) {
    case "toggle": control = <Toggle value={tog} onChange={setTog} ariaLabel={NAME} disabled={d} />; break;
    case "segmented": control = <Segmented options={LMH} value={seg} onChange={setSeg} ariaLabel={NAME} disabled={d} />; break;
    case "dropdown": control = <Dropdown options={DEBOUNCE} value={dd} onChange={setDd} ariaLabel={NAME} disabled={d} />; break;
    case "arrow": control = <ArrowStepper options={SENSOR} value={ar} onChange={setAr} ariaLabel={NAME} disabled={d} />; break;
    case "steps": control = <StepPicker count={5} value={st} onChange={setSt} ariaLabel={NAME} disabled={d} />; break;
    case "time": control = <TimeStepper seconds={ts} onChange={setTs} ariaLabel={NAME} disabled={d} />; break;
    case "number": control = <NumberField value={nf} onApply={setNf} ariaLabel={NAME} unit="DPI" min={100} max={26000} step={50} disabled={d} />; break;
    case "text": control = <TextInput value={tx} onChange={setTx} ariaLabel={NAME} placeholder="Device name" disabled={d} />; break;
    case "value": control = <SettingValue>Wireless · 8K dongle</SettingValue>; break;
    case "button": control = <Button size="medium" label={pairs ? `Pair (${pairs})` : "Pair"} disabled={d} onClick={() => setPairs(pairs + 1)} />; break;
  }
  const hug = kind === "value" || kind === "button";
  return <SettingRow title={NAME} description={DESC} control={control} disabled={d} controlWidth={hug ? "hug" : "slot"} />;
}

const ZONES3: Zone[] = [
  { id: "all", label: "All zones", color: "#ff4d4d", spectrum: true },
  { id: "logo", label: "Logo", color: "#f21382" },
  { id: "wheel", label: "Scroll wheel", color: "#13f287" },
  { id: "strip", label: "Light strip", color: "#4c7dff" },
];
const ZONES6: Zone[] = [
  { id: 0, label: "All zones", color: "#ff4d4d", spectrum: true },
  { id: 1, label: "Zone 1", color: "#f21382" },
  { id: 2, label: "Zone 2", color: "#ff4d4d" },
  { id: 3, label: "Zone 3", color: "#ffb02e" },
  { id: 4, label: "Zone 4", color: "#13f287" },
  { id: 5, label: "Zone 5", color: "#2ed8ff" },
  { id: 6, label: "Zone 6", color: "#000000", off: true },
];

function PopoverDemo(): ReactNode {
  const [open, setOpen] = useState(false);
  const [c, setC] = useState("#2ed8ff");
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button ref={ref} type="button" aria-label="Stage 1 colour" aria-haspopup="dialog" aria-expanded={open}
        onClick={() => setOpen(!open)}
        style={{ width: 29, height: 29, borderRadius: 8, border: 0, background: "var(--mk-bg-page)", display: "grid", placeItems: "center" }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
      </button>
      <span className="mk-t-body14 mk-c-secondary">Click the swatch: Full picker as a popover ({c.toUpperCase()})</span>
      <ColorPickerPopover open={open} anchorRef={ref} onClose={() => setOpen(false)} value={c} onChange={setC} ariaLabel="Stage 1 colour" />
    </div>
  );
}

export default function ShowcaseRows(): ReactNode {
  const [full, setFull] = useState("#f21382");
  const [compact, setCompact] = useState("#f21382");
  const [z3, setZ3] = useState<string | number>("logo");
  const [z6, setZ6] = useState<string | number>(1);
  const [sw, setSw] = useState(1);
  const [bright, setBright] = useState(70);
  const [speed, setSpeed] = useState(40);
  const [open2, setOpen2] = useState(false);
  const [lift, setLift] = useState<string | null>("2");

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "28px 32px", alignItems: "flex-start" }}>
      <Board id="setting-row" title="Setting row — Control × State (Default / Disabled)" w={1390} h={811}>
        {KINDS.map(({ kind, y }) => (
          <At key={`d-${kind}`} x={20} y={y} w={665}><Row kind={kind} disabled={false} /></At>
        ))}
        {KINDS.map(({ kind, y }) => (
          <At key={`x-${kind}`} x={705} y={y} w={665}><Row kind={kind} disabled /></At>
        ))}
      </Board>

      <Board id="section-header" title="Section header" w={665} h={49}>
        <At x={0} y={0} w={665}>
          <SectionHeader title="Polling rate" description="Higher rates update the cursor more often but use more battery." />
        </At>
      </Board>

      <Board id="section-header-extras" title="Section header — Show count + Show action / title only" w={665} h={140}>
        <At x={0} y={0} w={665}>
          <SectionHeader title="DPI stages" count={7} description="Cycle through these with the DPI button."
            action={<Button label="Reset to default" icon="reset" onClick={noop} />} />
        </At>
        <At x={0} y={70} w={665}><SectionHeader title="Processing" count="3 on" /></At>
        <At x={0} y={110} w={665}><SectionHeader title="Lift-off distance" /></At>
      </Board>

      <Board id="setting-group" title="Setting group — gap 10 / dense 5" w={665} h={330}>
        <At x={0} y={0} w={665}>
          <SettingGroup>
            <SectionHeader title="Processing" description="Filters the sensor applies before the cursor moves." />
            <SettingRow title="Motion sync" description="Lines reports up with the PC's polling." control={<Toggle value={true} onChange={noop} ariaLabel="Motion sync" />} />
            <SettingRow title="Lift-off distance" control={<Segmented options={[{ value: "1", label: "1 mm" }, { value: "2", label: "2 mm" }]} value={lift} onChange={setLift} ariaLabel="Lift-off distance" />} />
          </SettingGroup>
        </At>
        <At x={0} y={200} w={665}>
          <SettingGroup dense>
            <InfoRow label="Manufacturer" value="Logitech" />
            <InfoRow label="Firmware" value="v12.4" />
            <InfoRow label="Onboard memory" value="5 profiles" />
          </SettingGroup>
        </At>
      </Board>

      <Board id="color-picker" title="Color picker — Full / Compact" w={1027} h={328}>
        <At x={21} y={21}><ColorPicker layout="full" value={full} onChange={setFull} ariaLabel="Stage colour" /></At>
        <At x={341} y={21} w={665}><ColorPicker layout="compact" value={compact} onChange={setCompact} ariaLabel="Lighting colour" /></At>
        <At x={341} y={130} w={665}><ColorPicker layout="compact" value="#4c7dff" onChange={noop} ariaLabel="Lighting colour (disabled)" disabled /></At>
        <At x={341} y={240} w={665}><PopoverDemo /></At>
      </Board>

      <Board id="zone-picker" title="Zone picker — Count 3 / 6" w={698} h={232}>
        <At x={21} y={21}><ZonePicker zones={ZONES3} value={z3} onChange={setZ3} ariaLabel="Lighting zone" /></At>
        <At x={21} y={126}><ZonePicker zones={ZONES6} value={z6} onChange={setZ6} ariaLabel="Lighting zone (6)" /></At>
      </Board>

      <Board id="zone-swatch" title="Zone swatch — Default / Selected / Off" w={334} h={107}>
        <At x={21} y={21}><ZoneSwatch label="Logo" color="#f21382" state={sw === 0 ? "selected" : "default"} onClick={() => setSw(0)} /></At>
        <At x={125} y={21}><ZoneSwatch label="Logo" color="#f21382" state={sw === 1 ? "selected" : "default"} onClick={() => setSw(1)} /></At>
        <At x={229} y={21}><ZoneSwatch label="Logo" color="#f21382" state="off" /></At>
      </Board>

      <Board id="slider-row" title="Slider row" w={665} h={49}>
        <At x={0} y={0} w={665}>
          <SliderRow label="Brightness" icon="sun" value={bright} min={0} max={100} onChange={setBright} valueLabel={`${bright}%`} />
        </At>
      </Board>

      <Board id="slider-row-extras" title="Slider row — no icon / disabled" w={665} h={108}>
        <At x={0} y={0} w={665}>
          <SettingGroup>
            <SliderRow label="Speed" value={speed} min={0} max={100} onChange={setSpeed} valueLabel={`${speed}%`} />
            <SliderRow label="Brightness" icon="sun" value={30} min={0} max={100} onChange={noop} valueLabel="30%" disabled />
          </SettingGroup>
        </At>
      </Board>

      <Board id="collapsible-section" title="Collapsible section — Expanded / Collapsed" w={1392} h={223}>
        <At x={21} y={21} w={665}>
          <CollapsibleSection title="Diagnostics" count={4} summary="All checks passed">
            <InfoRow label="Report rate" value="1000 Hz" />
            <InfoRow label="Packet loss" value="0.2%" />
            <InfoRow label="Sensor" value="PAW3395" />
          </CollapsibleSection>
        </At>
        <At x={706} y={21} w={665}>
          <CollapsibleSection title="Diagnostics" count={4} summary="All checks passed" open={open2} onToggle={setOpen2}>
            <InfoRow label="Report rate" value="1000 Hz" />
            <InfoRow label="Packet loss" value="0.2%" />
            <InfoRow label="Sensor" value="PAW3395" />
          </CollapsibleSection>
        </At>
      </Board>
    </div>
  );
}
