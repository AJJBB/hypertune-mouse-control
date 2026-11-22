// Gallery for the controls group (?app=1&kit=controls). Each "board" is the Figma component set's
// frame: same size, every variant at the same x/y as in the library, so a screenshot of a board can
// be diffed 1:1 against `crop_lib.py "<Component>"`. Everything is wired with local state.
import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowStepper, Dropdown, MenuItem, NumberField, NumberFieldXY, Segment, Segmented, Slider, SnappingSlider,
  StepButton, StepPicker, TextInput, TimeStepper, Toggle, type DropOption, type SegOption,
} from "./controls";

function Board({ id, title, w, h, children }: { id: string; title: string; w: number; h: number; children: ReactNode }): ReactNode {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 className="mk-t-caption12m mk-c-muted" style={{ margin: 0 }}>{title}</h3>
      <div data-board={id} style={{ position: "relative", width: w, height: h, outline: "1px dashed var(--mk-border)" }}>{children}</div>
    </section>
  );
}
function At({ x, y, w, h, children }: { x: number; y: number; w: number; h?: number; children: ReactNode }): ReactNode {
  const s: CSSProperties = { position: "absolute", left: x, top: y, width: w, height: h };
  return <div style={s}>{children}</div>;
}

const opts = <T extends string | number>(...labels: [T, string][]): SegOption<T>[] => labels.map(([value, label]) => ({ value, label }));
const SEG_SETS: { opts: SegOption<string>[]; sel: string }[] = [
  { opts: opts(["1", "1 mm"], ["2", "2 mm"]), sel: "2" },
  { opts: opts(["low", "Low"], ["med", "Medium"], ["high", "High"]), sel: "med" },
  { opts: opts(["off", "Off"], ["low", "Low"], ["med", "Medium"], ["high", "High"]), sel: "med" },
  { opts: opts(["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]), sel: "3" },
  { opts: opts(["125", "125"], ["250", "250"], ["500", "500"], ["1000", "1000"], ["4000", "4000"], ["8000", "8000"]), sel: "500" },
  { opts: opts(["400", "400"], ["800", "800"], ["1000", "1,000"], ["1600", "1,600"], ["3200", "3,200"], ["6400", "6,400"], ["8000", "8,000"]), sel: "1000" },
];
const EFFECTS: SegOption<string>[] = [
  { value: "static", label: "Static", icon: "static" },
  { value: "wave", label: "Wave", icon: "wave" },
  { value: "breathing", label: "Breathing", icon: "breathing" },
  { value: "cycle", label: "Color Cycle", icon: "cycle" },
  { value: "off", label: "Off", icon: "power" },
];
const DEBOUNCE: DropOption<number>[] = [1, 2, 4, 8].map((v) => ({ value: v, label: `${v} ms` }));
const SENSOR: DropOption<string>[] = [{ value: "low", label: "Low" }, { value: "high", label: "High" }, { value: "max", label: "Max" }];
const RATES = [125, 500, 1000, 4000, 8000].map((v) => ({ value: v, label: String(v) }));
const ACTIONS: DropOption<string>[] = [
  "Left click", "Right click", "Middle click", "Back", "Forward", "DPI up", "DPI down", "DPI cycle", "Sniper (hold)",
  "Scroll up", "Scroll down", "Scroll left", "Scroll right", "Volume up", "Volume down", "Mute", "Play / pause",
  "Next track", "Previous track", "Copy", "Paste", "Undo", "Disabled",
].map((l, i) => ({ value: l, label: l, disabled: i === 22 }));

function SegmentedRow({ i, card }: { i: number; card: boolean }): ReactNode {
  const set = SEG_SETS[i];
  const [v, setV] = useState<string | null>(set.sel);
  return <Segmented options={set.opts} value={v} onChange={setV} ariaLabel={`Segmented ${i + 2}`} container={card ? "card" : "inline"} tall />;
}

function useS<T>(init: T): [T, (v: T) => void] { return useState<T>(init); }

export default function ShowcaseControls(): ReactNode {
  const [t1, setT1] = useS<boolean | null>(false);
  const [t2, setT2] = useS<boolean | null>(true);
  const [fx, setFx] = useS<string | null>("static");
  const [dd, setDd] = useS<number | null>(2);
  const [ddOpen, setDdOpen] = useS<number | null>(2);
  const [act, setAct] = useS<string | null>("Back");
  const [as1, setAs1] = useS<string | null>("high");
  const [sl, setSl] = useState([0, 25, 50, 75, 100]);
  const [hue, setHue] = useState([0, 90, 180, 270, 360]);
  const [rate, setRate] = useS(1000);
  const [sp5, setSp5] = useS<number | null>(3);
  const [sp10, setSp10] = useS<number | null>(6);
  const [sb, setSb] = useS(1);
  const [ts, setTs] = useS(5 * 60 + 30);
  const [nf, setNf] = useS<number | null>(1600);
  const [xy, setXy] = useS<[number, number]>([1600, 1600]);
  const [linked, setLinked] = useS(true);
  const [name, setName] = useS("G502 X Plus");
  const [blank, setBlank] = useS("");
  const noop = (): void => {};

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "28px 32px", alignItems: "flex-start" }}>
      <Board id="segment" title="Segment" w={616} h={156}>
        {(["default", "selected", "neutral", "disabled"] as const).map((s, i) => (
          <At key={s} x={20 + i * 149} y={20} w={107} h={36}><Segment label="Label" state={s} /></At>
        ))}
        {(["default", "selected", "neutral", "disabled"] as const).map((s, i) => (
          <At key={s} x={20 + i * 149} y={76} w={129} h={60}><Segment label="Label" type="icon" icon="static" state={s} /></At>
        ))}
      </Board>

      <Board id="segmented-icon" title="Segmented / Icon" w={665} h={74}>
        <At x={0} y={0} w={665}>
          <Segmented options={EFFECTS} value={fx} onChange={setFx} ariaLabel="Lighting effect" container="card" iconSegments />
        </At>
      </Board>

      <Board id="segmented" title="Segmented — Count 2–7 × Inline / Card" w={1390} h={470}>
        {SEG_SETS.map((_, i) => (
          <At key={`i${i}`} x={20} y={20 + i * 75} w={655}><SegmentedRow i={i} card={false} /></At>
        ))}
        {SEG_SETS.map((_, i) => (
          <At key={`c${i}`} x={705} y={20 + i * 75} w={665}><SegmentedRow i={i} card /></At>
        ))}
      </Board>

      <Board id="toggle" title="Toggle" w={640} h={140}>
        <At x={20} y={20} w={290}><Toggle value={t1} onChange={setT1} ariaLabel="Toggle off" /></At>
        <At x={330} y={20} w={290}><Toggle value={t2} onChange={setT2} ariaLabel="Toggle on" /></At>
        <At x={20} y={80} w={290}><Toggle value={false} onChange={noop} ariaLabel="Toggle off disabled" disabled /></At>
        <At x={330} y={80} w={290}><Toggle value onChange={noop} ariaLabel="Toggle on disabled" disabled /></At>
      </Board>

      <Board id="arrow-stepper" title="Arrow stepper" w={640} h={140}>
        <At x={20} y={20} w={290}><ArrowStepper options={SENSOR} value={as1} onChange={setAs1} ariaLabel="Sensor mode" /></At>
        <At x={330} y={20} w={290}><ArrowStepper options={SENSOR.slice(1)} value="high" onChange={noop} ariaLabel="At min" /></At>
        <At x={20} y={80} w={290}><ArrowStepper options={SENSOR.slice(0, 2)} value="high" onChange={noop} ariaLabel="At max" /></At>
        <At x={330} y={80} w={290}><ArrowStepper options={SENSOR} value="high" onChange={noop} ariaLabel="Disabled" disabled /></At>
      </Board>

      <Board id="dropdown" title="Dropdown — Closed / Disabled / Open" w={952} h={238}>
        <At x={21} y={21} w={290}><Dropdown options={DEBOUNCE} value={dd} onChange={setDd} ariaLabel="Debounce time" /></At>
        <At x={331} y={21} w={290}><Dropdown options={DEBOUNCE} value={2} onChange={noop} ariaLabel="Debounce time (disabled)" disabled /></At>
        <At x={641} y={21} w={290}><Dropdown options={DEBOUNCE} value={ddOpen} onChange={setDdOpen} ariaLabel="Debounce time (open)" open /></At>
      </Board>

      <Board id="menu-item" title="Menu item" w={320} h={202}>
        <div role="listbox" aria-label="Menu item states">
          <At x={21} y={21} w={278}><MenuItem label="Option" /></At>
          <At x={21} y={63} w={278}><MenuItem label="Option" active /></At>
          <At x={21} y={105} w={278}><MenuItem label="Option" selected /></At>
          <At x={21} y={147} w={278}><MenuItem label="Option" disabled /></At>
        </div>
      </Board>

      <Board id="slider" title="Slider — Default / Hue × Position" w={872} h={255}>
        {sl.map((v, i) => (
          <At key={`d${i}`} x={i % 2 ? 446 : 20} y={20 + Math.floor(i / 2) * 47} w={406}>
            <Slider value={v} min={0} max={100} showStops ariaLabel={`Slider ${i}`}
              onChange={(nv) => setSl(sl.map((o, k) => (k === i ? nv : o)))} />
          </At>
        ))}
        {hue.map((v, i) => {
          const k = i + 5;
          return (
            <At key={`h${i}`} x={k % 2 ? 446 : 20} y={20 + Math.floor(k / 2) * 47} w={406}>
              <Slider value={v} min={0} max={360} hue ariaLabel={`Hue ${i}`}
                onChange={(nv) => setHue(hue.map((o, j) => (j === i ? nv : o)))} />
            </At>
          );
        })}
      </Board>

      <Board id="snapping-slider" title="Snapping slider" w={527} h={48}>
        <At x={0} y={0} w={527}>
          <SnappingSlider stops={RATES} value={rate} onChange={setRate} ariaLabel="Polling rate" valueLabel={`${rate} Hz`} />
        </At>
      </Board>

      <Board id="step-picker" title="Step picker — Count 5 / 10" w={640} h={132}>
        <At x={20} y={20} w={290}><StepPicker count={5} value={sp5} onChange={setSp5} ariaLabel="DPI stages" /></At>
        <At x={330} y={20} w={290}><StepPicker count={10} value={sp10} onChange={setSp10} ariaLabel="Level" /></At>
      </Board>

      <Board id="step-button" title="Step button" w={190} h={78}>
        <At x={21} y={21} w={36}><StepButton label="1" selected={sb === 0} onClick={() => setSb(0)} /></At>
        <At x={77} y={21} w={36}><StepButton label="1" selected={sb === 1} onClick={() => setSb(1)} /></At>
        <At x={133} y={21} w={36}><StepButton label="1" disabled /></At>
      </Board>

      <Board id="time-stepper" title="Time stepper" w={332} h={202}>
        <At x={21} y={21} w={290}><TimeStepper seconds={ts} onChange={setTs} ariaLabel="Sleep timer" /></At>
        <At x={21} y={81} w={290}><TimeStepper seconds={330} onChange={noop} ariaLabel="Sleep timer (focused)" forceFocus="minutes" /></At>
        <At x={21} y={141} w={290}><TimeStepper seconds={330} onChange={noop} ariaLabel="Sleep timer (disabled)" disabled /></At>
      </Board>

      <Board id="number-field" title="Number field — Single / X and Y × Default / Focused / Changed / Error" w={1260} h={180}>
        <At x={20} y={20} w={290}><NumberField value={nf} onApply={setNf} ariaLabel="Custom DPI" unit="DPI" min={100} max={26000} step={50} /></At>
        <At x={330} y={20} w={290}><NumberField value={1600} onApply={noop} ariaLabel="Focused" unit="DPI" forceState="focused" /></At>
        <At x={640} y={20} w={290}><NumberField value={1600} onApply={noop} ariaLabel="Changed" unit="DPI" forceState="changed" /></At>
        <At x={950} y={20} w={290}><NumberField value={1600} onApply={noop} ariaLabel="Error" unit="DPI" min={100} max={26000} forceState="error" /></At>
        <At x={20} y={100} w={290}>
          <NumberFieldXY x={xy[0]} y={xy[1]} onApply={(a, b) => setXy([a, b])} ariaLabel="DPI" unit="DPI" min={100} max={26000} step={50} />
        </At>
        <At x={330} y={100} w={290}><NumberFieldXY x={1600} y={1600} onApply={noop} ariaLabel="Focused" forceState="focused" /></At>
        <At x={640} y={100} w={290}><NumberFieldXY x={1600} y={1600} onApply={noop} ariaLabel="Changed" forceState="changed" /></At>
        <At x={950} y={100} w={290}><NumberFieldXY x={1600} y={1600} onApply={noop} ariaLabel="Error" min={100} max={26000} forceState="error" /></At>
      </Board>

      <Board id="text-input" title="Text input — Default / Focused / Filled / Error / Disabled" w={950} h={160}>
        <At x={20} y={20} w={290}><TextInput value={blank} onChange={setBlank} ariaLabel="Device name" placeholder="Device name" /></At>
        <At x={330} y={20} w={290}><TextInput value="G502 X Plus" onChange={noop} ariaLabel="Focused" forceState="focused" /></At>
        <At x={640} y={20} w={290}><TextInput value={name} onChange={setName} ariaLabel="Filled" /></At>
        <At x={20} y={80} w={290}><TextInput value="G502 X Plus" onChange={noop} ariaLabel="Error" error="Name already in use" /></At>
        <At x={330} y={80} w={290}><TextInput value="G502 X Plus" onChange={noop} ariaLabel="Disabled" disabled /></At>
      </Board>

      <LiveExtras act={act} setAct={setAct} linked={linked} setLinked={setLinked} />
    </div>
  );
}

/** Not in the Figma grid: behaviours worth eyeballing (long menu, scrolling, link toggle, actions). */
function LiveExtras({ act, setAct, linked, setLinked }: {
  act: string | null; setAct: (v: string) => void; linked: boolean; setLinked: (v: boolean) => void;
}): ReactNode {
  const [rename, setRename] = useState("Profile 1");
  const [log, setLog] = useState("—");
  const [xy, setXy] = useState<[number, number]>([800, 800]);
  const [bright, setBright] = useState(70);
  const [placeholderDd, setPlaceholderDd] = useState<number | null>(null);
  const [slot, setSlot] = useState<string | null>("med");
  const [bhop, setBhop] = useState<number | null>(1000);
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8, width: 1390 }}>
      <h3 className="mk-t-caption12m mk-c-muted" style={{ margin: 0 }}>Live extras (not in the Figma grid)</h3>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ width: 220 }}><Dropdown options={ACTIONS} value={act} onChange={setAct} ariaLabel="Button action" /></div>
        <div style={{ width: 290 }}><Dropdown options={[{ value: 1, label: "Low" }, { value: 2, label: "High" }]} value={placeholderDd}
          onChange={setPlaceholderDd} ariaLabel="Placeholder" placeholder="Choose…" /></div>
        <div style={{ width: 290 }}>
          <NumberFieldXY x={xy[0]} y={xy[1]} onApply={(a, b) => setXy([a, b])} ariaLabel="Stage DPI" min={100} max={26000} step={50}
            linked={linked} onLinkChange={setLinked} />
        </div>
        <div style={{ width: 290 }}>
          <TextInput value={rename} onChange={setRename} ariaLabel="Profile name" showActions maxLength={24}
            onConfirm={(v) => setLog(`confirmed “${v}”`)} onCancel={() => setLog("cancelled")} />
          <p className="mk-t-caption12 mk-c-secondary" style={{ margin: "6px 0 0" }}>{log}</p>
        </div>
        <div style={{ width: 290 }}>
          <Slider value={bright} min={0} max={100} onChange={setBright} ariaLabel="Brightness" valueText={`${bright}%`} />
        </div>
        <div style={{ width: 290 }} title="Inline Segmented at the Setting-row control slot size (290×40)">
          <Segmented options={SEG_SETS[1].opts} value={slot} onChange={setSlot} ariaLabel="Slot-size segmented" />
        </div>
        <div style={{ width: 290 }}>
          <NumberField value={bhop} onApply={setBhop} ariaLabel="Bunny-hop interval" unit="ms" min={1} max={1000} grouping={false} showApply={false} />
        </div>
      </div>
    </section>
  );
}
