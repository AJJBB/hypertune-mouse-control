// v2.0 integrated device-detail view — the screen after "Open" on a device card.
// Header (back + section switcher + device name + status pills) over a per-section
// body. Matches Figma "App / Mouse WIP → Mouse - *", driven by the live controller.
//
// The per-section CONTROLS come from the shared `deviceCards` builder — the same
// source the standalone web shell renders — so the integrated screens expose the
// exact same surface for every mouse. The screens here add the v2 presentation
// (mouse hero render, status pills, the live Mouse Test) around those cards;
// control.css restyles the cards under `.htv2-detail2` to match the v2 look.
import { useState, useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, Crosshair, Activity, Battery, BatteryCharging, Share2, Flag } from "lucide-react";
import * as control from "../../device/controller";
import { activeSoftwareProfile } from "../../software-profiles";
import { cardAvailability, hasNativeProfileManagement } from "../cards/availability";
import type { ControlSnapshot, WorkspaceTab } from "../../device/types";
import { deviceImage } from "../../ui/device-images";
import { computeResults, formatHz, rollingLiveHz, stabilityClass, type TestResults } from "../../ui/polling-stats";
import { MouseTestMouse } from "../MouseTestMouse";
import { deviceCards, type DeviceCardSets } from "../device-cards";

function isCharging(state: string | undefined): boolean {
  return state === "Charging" || state === "Charging slowly" || state === "Almost full";
}

function StatusPills({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const s = snapshot.status;
  if (!s) return null;
  const charging = isCharging(s.batteryState);
  return (
    <div className="htv2-pills">
      <span className="htv2-pill htv2-pill-connected"><span className="htv2-pill-dot" />Connected</span>
      {s.batteryPercent !== null ? (
        <span className="htv2-pill">
          {charging ? <BatteryCharging size={16} strokeWidth={1.8} /> : <Battery size={16} strokeWidth={1.8} />}
          {s.batteryPercent}%
        </span>
      ) : null}
      {s.dpi > 0 ? <span className="htv2-pill"><Crosshair size={14} strokeWidth={1.8} />{s.dpi.toLocaleString()} DPI</span> : null}
      {s.pollingRateHz ? <span className="htv2-pill"><Activity size={14} strokeWidth={1.8} />{s.pollingRateHz} Hz</span> : null}
    </div>
  );
}

/** Mouse render panel (shared left column on Performance / Lighting / Advanced). */
function MousePanel({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const s = snapshot.status!;
  const device = control.getActiveDevice();
  return (
    <div className="htv2-mouse htv2-mouse-tall">
      <div className="htv2-mouse-glow" aria-hidden="true" />
      <img className="htv2-mouse-img" src={deviceImage(device, s.name)} alt="" draggable={false}
        onError={(e) => { e.currentTarget.src = "/v2/empty-mouse.png"; }} />
    </div>
  );
}

/** The device's configurable cards for a section, laid out as a vertical stack.
    The cards come from the shared builder and carry their own controls. */
function CardStack({ cards, wide = false }: { cards: ReactNode[]; wide?: boolean }): ReactNode {
  return <div className={`htv2-cards${wide ? " htv2-cards-wide" : ""}`}>{cards}</div>;
}

/** Performance — mouse hero + the DPI / polling / sensor / processing cards. */
function PerformanceBody({ snapshot, cards }: { snapshot: ControlSnapshot; cards: ReactNode[] }): ReactNode {
  return (
    <div className="htv2-dbody">
      <div className="htv2-dcol-left"><MousePanel snapshot={snapshot} /></div>
      <div className="htv2-dcol-right">
        {cards.length > 0
          ? <CardStack cards={cards} />
          : <div className="htv2-section-ph">This mouse has no performance settings.</div>}
      </div>
    </div>
  );
}

/** Lighting — mouse hero + the RGB cards (effects, brightness, colour, zones). */
function LightingBody({ snapshot, cards }: { snapshot: ControlSnapshot; cards: ReactNode[] }): ReactNode {
  if (cards.length === 0) return <div className="htv2-section-ph">This device has no RGB lighting.</div>;
  return (
    <div className="htv2-dbody">
      <div className="htv2-dcol-left"><MousePanel snapshot={snapshot} /></div>
      <div className="htv2-dcol-right"><CardStack cards={cards} /></div>
    </div>
  );
}

/** Advanced — mouse hero + the power / timing / mode / brand-specific cards. */
function AdvancedBody({ snapshot, cards }: { snapshot: ControlSnapshot; cards: ReactNode[] }): ReactNode {
  return (
    <div className="htv2-dbody">
      <div className="htv2-dcol-left"><MousePanel snapshot={snapshot} /></div>
      <div className="htv2-dcol-right">
        {cards.length > 0
          ? <CardStack cards={cards} />
          : <div className="htv2-section-ph">This mouse has no advanced settings.</div>}
      </div>
    </div>
  );
}

/** Buttons — the remap / debounce cards, full width (they are wide editors). */
function ButtonsBody({ cards }: { cards: ReactNode[] }): ReactNode {
  if (cards.length === 0) {
    return <div className="htv2-section-ph">This mouse doesn’t report remappable buttons.</div>;
  }
  return <CardStack cards={cards} wide />;
}

/** Profiles — native onboard / software profile cards, full width. */
function ProfilesBody({ cards }: { cards: ReactNode[] }): ReactNode {
  if (cards.length === 0) return <div className="htv2-section-ph">This mouse has no profiles.</div>;
  return <CardStack cards={cards} wide />;
}

// ── Mouse Test section (Figma "Mouse - Mouse Test") ───────────────────────
// A live tester driven by browser input: polling-rate reading + waveform on top,
// per-button click counts + scroll + a mouse glyph that lights the pressed
// button below. Self-contained — it measures what the browser receives, so it
// needs no device client and works in the fixture preview too.
type TestCounts = { left: number; right: number; middle: number; back: number; forward: number };
const ZERO_COUNTS: TestCounts = { left: 0, right: 0, middle: 0, back: 0, forward: 0 };

function testButtonName(b: number): keyof TestCounts | null {
  return b === 0 ? "left" : b === 1 ? "middle" : b === 2 ? "right" : b === 3 ? "back" : b === 4 ? "forward" : null;
}

function TestStat({ label, value, feature = false }: { label: string; value: string; feature?: boolean }): ReactNode {
  return (
    <div className={`htv2-test-stat${feature ? " is-feature" : ""}`}>
      <span className="htv2-test-stat-label">{label}</span>
      <span className="htv2-test-stat-value">{value}</span>
    </div>
  );
}

type TestPhase = "idle" | "sampling" | "done";

function MouseTestBody(): ReactNode {
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [duration, setDuration] = useState<5 | 8 | 10>(8);
  const [elapsed, setElapsed] = useState(0);
  const [liveHz, setLiveHz] = useState(0);
  const [results, setResults] = useState<TestResults | null>(null);
  const [chart, setChart] = useState<number[]>([]);
  const [counts, setCounts] = useState<TestCounts>(ZERO_COUNTS);
  const [scroll, setScroll] = useState<{ up: number; down: number }>({ up: 0, down: 0 });
  const [pressed, setPressed] = useState<keyof TestCounts | null>(null);
  const [wheelDir, setWheelDir] = useState<"up" | "down" | null>(null);

  const intervalsRef = useRef<number[]>([]);
  const lastTimeRef = useRef(0);
  const phaseRef = useRef<TestPhase>("idle");
  const startedRef = useRef(0);
  const timerRef = useRef(0);
  const wheelTimerRef = useRef(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Live input: button/wheel check (always on) + the polling sampler feeds the
  // interval buffer only while a timed run is sampling.
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      const n = testButtonName(e.button);
      if (!n) return;
      // Don't count clicks that operate the tester's own controls (Start, the
      // duration buttons, Run again, the tab bar) — only real presses on the
      // page/test surface are the mouse under test.
      if ((e.target as Element | null)?.closest('button, a, input, select, textarea, [role="tab"]')) return;
      setCounts((c) => { const next = { ...c }; next[n] = c[n] + 1; return next; });
      setPressed(n);
    };
    const onUp = (): void => setPressed(null);
    const onWheel = (e: WheelEvent): void => {
      setScroll((s) => (e.deltaY < 0 ? { ...s, up: s.up + 1 } : { ...s, down: s.down + 1 }));
      setWheelDir(e.deltaY < 0 ? "up" : "down");
      window.clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = window.setTimeout(() => setWheelDir(null), 180);
    };
    const onMove = (e: PointerEvent): void => {
      if (phaseRef.current !== "sampling") return;
      const subs = typeof e.getCoalescedEvents === "function" && e.getCoalescedEvents().length > 0 ? e.getCoalescedEvents() : [e];
      for (const ev of subs) {
        const ts = ev.timeStamp;
        if (lastTimeRef.current > 0) {
          const d = ts - lastTimeRef.current;
          if (d >= 0.05 && d <= 1000) intervalsRef.current.push(d);
        }
        lastTimeRef.current = ts;
      }
      if (intervalsRef.current.length > 0) {
        setLiveHz(rollingLiveHz(intervalsRef.current));
        setChart(intervalsRef.current.slice(-180));
      }
    };
    const onCtx = (e: Event): void => e.preventDefault();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("contextmenu", onCtx);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("contextmenu", onCtx);
      window.clearTimeout(wheelTimerRef.current);
      window.clearInterval(timerRef.current);
    };
  }, []);

  const startTest = (): void => {
    intervalsRef.current = [];
    lastTimeRef.current = 0;
    setLiveHz(0);
    setResults(null);
    setChart([]);
    setElapsed(0);
    setPhase("sampling");
    startedRef.current = performance.now();
    timerRef.current = window.setInterval(() => {
      const el = performance.now() - startedRef.current;
      setElapsed(el / 1000);
      if (el >= duration * 1000) {
        window.clearInterval(timerRef.current);
        setResults(computeResults(intervalsRef.current, el));
        setPhase("done");
      }
    }, 50);
  };

  const reset = (): void => {
    window.clearInterval(timerRef.current);
    intervalsRef.current = [];
    lastTimeRef.current = 0;
    setPhase("idle");
    setLiveHz(0);
    setResults(null);
    setChart([]);
    setElapsed(0);
  };

  const W = 600, H = 160;
  const chartHz = chart.map((ms) => (ms > 0 ? 1000 / ms : 0));
  const chartMax = Math.max(1200, ...chartHz) * 1.08;
  const cstep = chartHz.length > 1 ? W / (chartHz.length - 1) : W;
  const cline = chartHz.map((h, i) => `${(i * cstep).toFixed(1)},${(H - Math.min(h / chartMax, 1) * (H - 26) - 13).toFixed(1)}`).join(" ");
  const ambient = Array.from({ length: 61 }, (_, i) => {
    const env = Math.sin((i / 60) * Math.PI);
    return `${i * 10},${(H / 2 - Math.sin(i * 0.5) * 20 * env).toFixed(1)}`;
  }).join(" ");
  const hasTrace = chartHz.length > 1;
  const resCards: Array<[string, string, string, string?]> = results ? [
    ["Average", formatHz(results.avgHz), "Hz"],
    ["Peak", formatHz(results.peakHz), "Hz"],
    ["Low 5%", formatHz(results.low5Hz), "Hz"],
    ["Stability", `${results.stability.toFixed(1)}%`, "", stabilityClass(results.stability)],
    ["Jitter", `${results.jitter.toFixed(1)}%`, ""],
    ["Dropouts", String(results.dropouts), ""],
    ["Events", results.events.toLocaleString(), ""],
    ["Avg interval", results.avgInterval.toFixed(2), "ms"],
  ] : [];

  return (
    <div className="htv2-test">
      <div className="htv2-test-rig">
        <span className="htv2-test-cable htv2-test-cable-l" aria-hidden="true"><i className="htv2-test-plug" /></span>
        <div className="htv2-test-wave">
          <span className="htv2-test-title">Mouse Polling Test</span>
          {phase === "sampling" ? (
            <span className="htv2-test-samples">{elapsed.toFixed(1)}s / {duration}s</span>
          ) : phase === "done" && results ? (
            <span className="htv2-test-samples">{results.events.toLocaleString()} samples</span>
          ) : null}
          <svg className="htv2-test-amb" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="htv2TestFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--v2-accent)" stopOpacity="0.26" />
                <stop offset="100%" stopColor="var(--v2-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {hasTrace ? (
              <>
                <polygon points={`0,${H} ${cline} ${W},${H}`} fill="url(#htv2TestFill)" />
                <polyline points={cline} fill="none" stroke="var(--v2-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </>
            ) : (
              <polyline points={ambient} fill="none" stroke="var(--v2-accent)" strokeWidth="2" strokeOpacity="0.45" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {phase === "idle" ? (
            <button type="button" className="htv2-test-start" onClick={startTest}>Start</button>
          ) : phase === "sampling" ? (
            <div className="htv2-test-reading"><b>{formatHz(liveHz)}</b><span>Hz</span></div>
          ) : results ? (
            <div className="htv2-test-reading htv2-test-avg"><b>{formatHz(results.avgHz)}</b><span>Average</span></div>
          ) : null}
          <span className="htv2-test-note">
            {phase === "sampling"
              ? "Keep the motion smooth and continuous while it samples."
              : phase === "done"
                ? "Move your mouse and run again to re-measure."
                : "Pick a duration, press “Start”, then move your mouse inside this box."}
          </span>
        </div>
        <span className="htv2-test-cable htv2-test-cable-r" aria-hidden="true"><i className="htv2-test-plug" /></span>
      </div>

      <div className="htv2-test-controls">
        {phase === "idle" ? (
          <div className="htv2-test-durs" role="group" aria-label="Test duration">
            {([5, 8, 10] as const).map((d) => (
              <button key={d} type="button" aria-pressed={duration === d} className={`htv2-test-dur${duration === d ? " is-on" : ""}`} onClick={() => setDuration(d)}>{d}s</button>
            ))}
          </div>
        ) : phase === "sampling" ? (
          <button type="button" className="htv2-test-run htv2-test-run-ghost" onClick={reset}>Cancel</button>
        ) : (
          <button type="button" className="htv2-test-run" onClick={reset}>Run again</button>
        )}
      </div>

      {results && results.events > 0 ? (
        <div className="htv2-test-results">
          {resCards.map(([label, value, unit, cls]) => (
            <div key={label} className="htv2-test-rescard">
              <span className="htv2-test-reslabel">{label}</span>
              <span className={`htv2-test-resvalue${cls ? ` ${cls}` : ""}`}>{value}{unit ? <i>{unit}</i> : null}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="htv2-test-row">
        <div className="htv2-test-group">
          <TestStat label="Left click" value={counts.left.toLocaleString()} feature />
          <div className="htv2-test-subs">
            <TestStat label="Right click" value={counts.right.toLocaleString()} />
            <TestStat label="Wheel click" value={counts.middle.toLocaleString()} />
          </div>
        </div>
        <div className="htv2-test-mouse-wrap">
          <MouseTestMouse
            buttons={{ left: pressed === "left", right: pressed === "right", middle: pressed === "middle", back: pressed === "back", forward: pressed === "forward" }}
            wheel={wheelDir}
          />
        </div>
        <div className="htv2-test-group">
          <TestStat label="Scroll" value={`↑ ${scroll.up}   ↓ ${scroll.down}`} feature />
          <div className="htv2-test-subs">
            <TestStat label="Back" value={counts.back.toLocaleString()} />
            <TestStat label="Forward" value={counts.forward.toLocaleString()} />
          </div>
        </div>
      </div>
      <p className="htv2-test-hint">Press any button or spin the wheel — it lights up on the diagram.</p>
    </div>
  );
}

const SECTIONS: Array<{ tab: WorkspaceTab; label: string }> = [
  { tab: "overview", label: "Overview" },
  { tab: "performance", label: "Performance" },
  { tab: "buttons", label: "Buttons" },
  { tab: "lighting", label: "Lighting" },
  { tab: "profiles", label: "Profiles" },
  { tab: "advanced", label: "Advanced" },
  { tab: "test", label: "Mouse test" },
];

/** Overview, Performance and Mouse Test always show; the rest only appear once
    the connected device has at least one card for them — matching the standalone
    web shell, and avoiding empty tabs. */
function tabHasContent(tab: WorkspaceTab, cards: DeviceCardSets): boolean {
  switch (tab) {
    case "lighting": return cards.lighting.length > 0;
    case "buttons": return cards.buttons.length > 0;
    case "profiles": return cards.profiles.length > 0;
    case "advanced": return cards.advanced.length > 0;
    default: return true;
  }
}

/** Horizontal top tab bar (Figma v2 — replaces the old dropdown switcher). */
function TabBar({ cards, active }: { cards: DeviceCardSets; active: WorkspaceTab }): ReactNode {
  const tabs = SECTIONS.filter((sec) => tabHasContent(sec.tab, cards));
  return (
    <nav className="htv2-tabs" aria-label="Mouse control sections">
      {tabs.map((sec) => (
        <button
          key={sec.tab}
          type="button"
          className={`htv2-tab${sec.tab === active ? " is-on" : ""}`}
          aria-current={sec.tab === active ? "page" : undefined}
          onClick={() => control.setWorkspaceTab(sec.tab)}
        >
          {sec.label}
        </button>
      ))}
    </nav>
  );
}

function OvRow({ label, value, sub }: { label: string; value: ReactNode; sub?: string | null }): ReactNode {
  return (
    <div className="htv2-ov-row">
      <span className="htv2-ov-row-label">{label}</span>
      <span className="htv2-ov-row-value">{value}{sub ? <span className="htv2-ov-row-sub">{sub}</span> : null}</span>
    </div>
  );
}

/** Overview tab — device hero + DPI/Polling stat cards + Status / Device Info. */
function OverviewBody({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const s = snapshot.status!;
  const device = control.getActiveDevice();
  const charging = isCharging(s.batteryState);
  const fw = s.firmware;
  // A device can report activeProfile without any switchable profile feature
  // behind it (base Pulsar just reads which onboard slot is active) — showing
  // "Profile 1" there is misleading. Only show the native profile when it's
  // really managed; otherwise fall back to the software profile the user picked.
  const hasNativeProfiles = hasNativeProfileManagement(cardAvailability(snapshot));
  const activeSoftware = !hasNativeProfiles && device
    ? activeSoftwareProfile(control.deviceStorageKey(device))
    : null;
  const activeProfile = hasNativeProfiles && s.activeProfile !== null
    ? (s.onboardProfileFormat?.name
      ? `Profile ${s.activeProfile} (${s.onboardProfileFormat.name})`
      : `Profile ${s.activeProfile}`)
    : activeSoftware?.name ?? null;
  return (
    <div className="htv2-ov">
      <div className="htv2-ov-hero">
        <img src={deviceImage(device, s.name)} alt="" draggable={false}
          onError={(e) => { e.currentTarget.src = "/v2/empty-mouse.png"; }} />
      </div>
      <div className="htv2-ov-main">
        <h3 className="htv2-ov-h">Status</h3>
        <div className="htv2-ov-stats">
          <div className="htv2-ov-stat">
            <span className="htv2-ov-stat-top"><Crosshair size={15} strokeWidth={1.8} />DPI</span>
            <span className="htv2-ov-stat-n">{s.dpi > 0 ? s.dpi.toLocaleString() : "—"}<em>DPI</em></span>
            <span className="htv2-ov-ticks" aria-hidden="true" />
          </div>
          <div className="htv2-ov-stat">
            <span className="htv2-ov-stat-top"><Activity size={15} strokeWidth={1.8} />Polling rate</span>
            <span className="htv2-ov-stat-n">{s.pollingRateHz || "—"}<em>Hz</em></span>
            <span className="htv2-ov-ticks" aria-hidden="true" />
          </div>
        </div>
        <div className="htv2-ov-list">
          {s.batteryPercent !== null ? (
            <OvRow
              label="Battery"
              value={<>{charging ? <BatteryCharging size={15} strokeWidth={1.8} /> : <Battery size={15} strokeWidth={1.8} />}{s.batteryPercent}%</>}
              sub={s.batteryState !== "Unknown" ? String(s.batteryState) : null}
            />
          ) : null}
          {s.connectionType ? <OvRow label="Connection" value={s.connectionType} sub={s.connectionDetail ?? null} /> : null}
          {activeProfile ? <OvRow label="Active profile" value={activeProfile} /> : null}
        </div>
        <h3 className="htv2-ov-h">Device Info</h3>
        <div className="htv2-ov-list">
          <OvRow label="Manufacturer" value={s.brand} />
          {fw.length === 1 ? <OvRow label="Firmware" value={fw[0]!} /> : null}
          {fw.length >= 2 ? <OvRow label="Mouse firmware" value={fw[0]!} /> : null}
          {fw.length >= 2 ? <OvRow label="Dongle firmware" value={fw[1]!} /> : null}
          {s.profileCount ? <OvRow label="Onboard memory" value={`${s.profileCount} ${s.profileCount === 1 ? "profile" : "profiles"}`} /> : null}
        </div>
      </div>
    </div>
  );
}

/** AGPL attribution — OpenMouse, our source, the license. Required, and kept on
    every integrated screen since the native shell's own credit isn't ours. */
function DeviceLegal(): ReactNode {
  return (
    <div className="htv2-legal">
      <span>In partnership with <a href="https://github.com/OpenMouse-Project/mouse-protocol" target="_blank" rel="noreferrer noopener">OpenMouse</a></span>
      <span><a href="https://github.com/AJJBB/hypertune-mouse-control" target="_blank" rel="noreferrer noopener">Source</a>{" · "}<a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer noopener">AGPL-3.0</a></span>
    </div>
  );
}

export function DeviceDetail({ snapshot, onShareProfile }: { snapshot: ControlSnapshot; onShareProfile?: () => void }): ReactNode {
  const s = snapshot.status;
  const brand = (s?.brand ?? "").toUpperCase();
  const model = s?.name ?? "Device";
  const cards = deviceCards(snapshot);
  const requested = snapshot.workspaceTab;
  // If the requested tab has no content for this device (e.g. a mouse with no
  // RGB landing on a stale "lighting" tab), fall back to Overview rather than
  // showing an empty panel.
  const section = tabHasContent(requested, cards) ? requested : "overview";
  const showShare = (section === "overview" || section === "profiles") && onShareProfile;
  return (
    <div className="htv2-detail2">
      <TabBar cards={cards} active={section} />
      <header className="htv2-dhead2">
        <div className="htv2-dname2">
          <button type="button" className="htv2-dback2" onClick={() => control.showDeviceList()} aria-label="Back to mice">
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <span className="htv2-dname-col">
            {brand ? <span className="htv2-card-brand">{brand}</span> : null}
            <span className="htv2-dname-model">{model}</span>
          </span>
        </div>
        <div className="htv2-dhead-right">
          <StatusPills snapshot={snapshot} />
          <button type="button" className="htv2-dreport" onClick={() => control.openReportProblem()}>
            <Flag size={15} strokeWidth={1.8} />Report Problem
          </button>
          {showShare ? (
            <button type="button" className="htv2-dshare" onClick={onShareProfile}>
              <Share2 size={16} strokeWidth={1.8} />Share profile
            </button>
          ) : null}
        </div>
      </header>
      <div className="htv2-dview">
        {!s ? null
          : section === "overview" ? <OverviewBody snapshot={snapshot} />
          : section === "performance" ? <PerformanceBody snapshot={snapshot} cards={cards.performance} />
          : section === "lighting" ? <LightingBody snapshot={snapshot} cards={cards.lighting} />
          : section === "buttons" ? <ButtonsBody cards={cards.buttons} />
          : section === "advanced" ? <AdvancedBody snapshot={snapshot} cards={cards.advanced} />
          : section === "profiles" ? <ProfilesBody cards={cards.profiles} />
          : section === "test" ? <MouseTestBody />
          : null}
      </div>
      <DeviceLegal />
    </div>
  );
}
