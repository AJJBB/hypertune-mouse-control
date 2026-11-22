// Mouse test tab of the integrated device page (Figma v2 · "Mouse - Mouse Test"
// and "Mouse - Mouse Test - Active").
//
// A live tester driven by browser input, so it needs no device client and works
// in the fixture preview too:
//   • the polling rig — a cabled "screen" with Start; while a timed run samples
//     it shows the big live Hz reading over a waveform, and after the run the
//     results grid (average, peak, low 5 %, stability, jitter, dropouts, events,
//     average interval);
//   • a controls strip under the rig — test length (5 / 8 / 10 s) before a run,
//     progress + Cancel during it, sample count + Run again after it;
//   • the Button tester (kit) — per-button click counts + scroll, with the
//     mouse's own render in the middle that lights the pressed button.
//
// The polling tester itself is awaiting Ivan's redesign (brief: "Mouse test:
// Button tester. The polling tester is being redesigned"), so the rig follows
// the reference screens as closely as possible with kit pieces + tokens.
import { useState, useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import * as control from "../../../device/controller";
import type { ControlSnapshot } from "../../../device/types";
import { deviceImage } from "../../../ui/device-images";
import { computeResults, formatHz, rollingLiveHz, stabilityClass, type TestResults } from "../../../ui/polling-stats";
import { reportEvent } from "../../../telemetry";
import { Button, ButtonTester, Segmented, StatTile } from "../kit";
import { FullLayout } from "./layout";
import "./mouse-test.css";

type TestCounts = { left: number; right: number; middle: number; back: number; forward: number };
type TestButton = keyof TestCounts;
const ZERO_COUNTS: TestCounts = { left: 0, right: 0, middle: 0, back: 0, forward: 0 };

function testButtonName(b: number): TestButton | null {
  return b === 0 ? "left" : b === 1 ? "middle" : b === 2 ? "right" : b === 3 ? "back" : b === 4 ? "forward" : null;
}

type TestPhase = "idle" | "sampling" | "done";
type Duration = 5 | 8 | 10;
const DURATIONS: { value: Duration; label: string }[] = [
  { value: 5, label: "5 s" },
  { value: 8, label: "8 s" },
  { value: 10, label: "10 s" },
];

/** formatHz renders "--" for no reading; the kit's empty value is "–". */
const hzText = (hz: number): string => (hz > 0 ? formatHz(hz) : "–");

/* ───────────────────────── Rig screen drawing ───────────────────────── */

// The screen is 780×254 (Figma frame 2147227262). The live waveform lives in
// its bottom 115 (Figma "Icon" 780×115): line band ≈ y 35–83, fill to bottom.
const SW = 780, SH = 254;
const CW = 780, CH = 115, BAND_TOP = 32, BAND_BOTTOM = 86;
const TRACE_POINTS = 60;

/** The rig case (Figma "Rectangle 34625381", 843×350, r22): the 316-high body
    with the S-curved tab on top (300 at the base, 220 across, 34 high). */
const SHELL_PATH = "M22.5 34.5 H271.5 C292.5 34.5 290.5 0.5 311.5 0.5 H531.5 C552.5 0.5 550.5 34.5 571.5 34.5 H820.5 "
  + "A22 22 0 0 1 842.5 56.5 V327.5 A22 22 0 0 1 820.5 349.5 H22.5 A22 22 0 0 1 0.5 327.5 V56.5 A22 22 0 0 1 22.5 34.5 Z";

/** Idle ambient line: flat through the middle with the two soft bumps of the
    reference (left dip + crest, right crest), drawn in screen coordinates. */
const AMBIENT_PATH: string = (() => {
  const mid = SH / 2;
  const g = (x: number, c: number, w: number, a: number): number => a * Math.exp(-((x - c) ** 2) / (2 * w * w));
  const pts: string[] = [];
  for (let x = 0; x <= SW; x += 4) {
    const y = mid + g(x, 96, 18, 5) - g(x, 154, 22, 12) + g(x, 596, 26, 3) - g(x, 654, 34, 8);
    pts.push(`${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)}`);
  }
  return pts.join(" ");
})();

/** Live / frozen trace from the sampled intervals (ms): converted to Hz,
    bucketed to ≤ 60 points so it reads like the reference, scaled against a
    robust ceiling (95th percentile + 20 %) so one coalesced spike can't
    flatten the line. Returns [line, area] path data. */
function tracePaths(intervalsMs: number[]): [string, string] | null {
  const hz = intervalsMs.map((ms) => (ms > 0 ? 1000 / ms : 0));
  if (hz.length < 2) return null;
  const n = Math.min(TRACE_POINTS, hz.length);
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * hz.length) / n), b = Math.max(a + 1, Math.floor(((i + 1) * hz.length) / n));
    let sum = 0;
    for (let k = a; k < b; k++) sum += hz[k]!;
    pts.push(sum / (b - a));
  }
  const sorted = [...hz].sort((x, y) => x - y);
  const top = Math.max(50, (sorted[Math.floor(sorted.length * 0.95)] ?? 0) * 1.2);
  const step = CW / (n - 1);
  const line = pts.map((h, i) => {
    const y = BAND_BOTTOM - Math.min(h / top, 1) * (BAND_BOTTOM - BAND_TOP);
    return `${i ? "L" : "M"}${(i * step).toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return [line, `${line} L${CW} ${CH} L0 ${CH} Z`];
}

/* ───────────────────────── Tester art ───────────────────────── */

const FALLBACK_ART = "/v2/empty-mouse.png";
const ART_W = 129; // Figma render in the Button tester: 129 wide, top 33 above the tiles

/** Button zones on a top-down render, as fractions of the image (front up). */
const ZONES: Record<TestButton, [x0: number, y0: number, x1: number, y1: number]> = {
  left: [0, 0, 0.5, 0.42],
  right: [0.5, 0, 1, 0.42],
  middle: [0.4, 0.07, 0.6, 0.3],
  forward: [0, 0.33, 0.2, 0.45],
  back: [0, 0.45, 0.2, 0.58],
};

const cssUrl = (src: string): string => `url("${src.replace(/["\\]/g, "\\$&")}")`;

/** The mouse's own render (as on the reference) in the Button tester's centre.
    The pressed button's zone lights up: an accent wash masked by the render
    itself, so it follows the mouse's silhouette. */
function TesterArt({ snapshot, pressed, wheel }: { snapshot: ControlSnapshot; pressed: TestButton | null; wheel: "up" | "down" | null }): ReactNode {
  const primary = deviceImage(control.getActiveDevice(), snapshot.status?.name ?? "");
  const [art, setArt] = useState<{ src: string; aspect: number } | null>(null);
  useEffect(() => {
    let live = true;
    const load = (url: string): void => {
      const img = new Image();
      img.onload = () => { if (live && img.naturalWidth > 0) setArt({ src: url, aspect: img.naturalHeight / img.naturalWidth }); };
      img.onerror = () => { if (live && url !== FALLBACK_ART) load(FALLBACK_ART); };
      img.src = url;
    };
    load(primary);
    return () => { live = false; };
  }, [primary]);
  if (!art) return <span className="mk-mt-art" />;
  const imgH = ART_W * art.aspect;
  const lit = (b: TestButton): boolean => pressed === b || (b === "middle" && wheel !== null);
  return (
    <span className="mk-mt-art" style={{ backgroundImage: cssUrl(art.src) }}>
      {(Object.keys(ZONES) as TestButton[]).map((b) => {
        const [x0, y0, x1, y1] = ZONES[b];
        const style: CSSProperties = {
          WebkitMaskImage: cssUrl(art.src),
          maskImage: cssUrl(art.src),
          clipPath: `inset(${(y0 * imgH).toFixed(1)}px ${((1 - x1) * ART_W).toFixed(1)}px calc(100% - ${(y1 * imgH).toFixed(1)}px) ${(x0 * ART_W).toFixed(1)}px round 6px)`,
        };
        return <span key={b} className={`mk-mt-art__lit${lit(b) ? " is-on" : ""}`} style={style} />;
      })}
    </span>
  );
}

/* ───────────────────────── Section ───────────────────────── */

export function MouseTestSection({ snapshot }: { snapshot: ControlSnapshot; onShareProfile?: () => void }): ReactNode {
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [duration, setDuration] = useState<Duration>(8);
  const [elapsed, setElapsed] = useState(0);
  const [liveHz, setLiveHz] = useState(0);
  const [results, setResults] = useState<TestResults | null>(null);
  const [chart, setChart] = useState<number[]>([]);
  const [counts, setCounts] = useState<TestCounts>(ZERO_COUNTS);
  const [scroll, setScroll] = useState<{ up: number; down: number }>({ up: 0, down: 0 });
  const [pressed, setPressed] = useState<TestButton | null>(null);
  const [wheelDir, setWheelDir] = useState<"up" | "down" | null>(null);

  const intervalsRef = useRef<number[]>([]);
  const lastTimeRef = useRef(0);
  const phaseRef = useRef<TestPhase>("idle");
  const startedRef = useRef(0);
  const timerRef = useRef(0);
  const wheelTimerRef = useRef(0);
  const gid = useId().replace(/:/g, "");

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
    reportEvent("mouse_test_started", duration);
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

  const trace = tracePaths(chart);
  const hasResults = phase === "done" && results !== null && results.events > 0;
  const resTiles: Array<{ label: string; value: string; tone?: string }> = hasResults ? [
    { label: "Average", value: `${hzText(results.avgHz)} Hz` },
    { label: "Peak", value: `${hzText(results.peakHz)} Hz` },
    { label: "Low 5%", value: `${hzText(results.low5Hz)} Hz` },
    { label: "Stability", value: `${results.stability.toFixed(1)}%`, tone: stabilityClass(results.stability) },
    { label: "Jitter", value: `${results.jitter.toFixed(1)}%` },
    { label: "Dropouts", value: String(results.dropouts) },
    { label: "Events", value: results.events.toLocaleString("en-US") },
    { label: "Avg interval", value: `${results.avgInterval.toFixed(2)} ms` },
  ] : [];

  // Big reading: live Hz while sampling; the run's average when a finished run
  // picked up no movement (the results grid replaces it otherwise).
  const reading = phase === "sampling" ? hzText(liveHz)
    : phase === "done" && !hasResults ? hzText(results?.avgHz ?? 0) : null;

  const note = phase === "sampling"
    ? "Keep the motion smooth and continuous while it samples."
    : phase === "done"
      ? (hasResults ? "Move your mouse and run again to re-measure." : "No movement was picked up. Move your mouse while it samples.")
      : "Pick a duration, press Start, then move your mouse inside this box.";

  return (
    <FullLayout scroll={false}>
      <div className="mk-mt">
        <div className="mk-mt__rig">
          <span className="mk-mt__cable" aria-hidden="true" />
          <div className="mk-mt__case">
            <svg className="mk-mt__shell" viewBox="0 0 843 350" aria-hidden="true">
              <defs>
                <radialGradient id={`${gid}-glow`} cx="421.5" cy="20" r="330" gradientTransform="matrix(1 0 0 0.45 0 11)" gradientUnits="userSpaceOnUse">
                  <stop offset="0" className="mk-mt__glow-0" />
                  <stop offset="1" className="mk-mt__glow-1" />
                </radialGradient>
                <linearGradient id={`${gid}-edge`} x1="0" y1="0" x2="843" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0.1" className="mk-mt__edge-0" />
                  <stop offset="0.5" className="mk-mt__edge-1" />
                  <stop offset="0.9" className="mk-mt__edge-0" />
                </linearGradient>
              </defs>
              <path d={SHELL_PATH} className="mk-mt__shell-fill" />
              <path d={SHELL_PATH} fill={`url(#${gid}-glow)`} />
              <path d={SHELL_PATH} className="mk-mt__shell-rim" />
              <path d={SHELL_PATH} className="mk-mt__shell-edge" stroke={`url(#${gid}-edge)`} />
            </svg>
            <span className="mk-mt__grille" aria-hidden="true" />
            <div className="mk-mt__body">
              <div className={`mk-mt__screen is-${phase}`} role="group" aria-label="Polling rate test">
                <span className="mk-mt__dots" aria-hidden="true" />
                <span className="mk-mt__sheen" aria-hidden="true" />
                {phase === "idle" ? (
                  <>
                    <span className="mk-mt__haze" aria-hidden="true" />
                    <svg className="mk-mt__ambient" viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none" aria-hidden="true">
                      <defs>
                        <linearGradient id={`${gid}-amb`} x1="0" y1="0" x2={SW} y2="0" gradientUnits="userSpaceOnUse">
                          <stop offset="0" className="mk-mt__stop-0" />
                          <stop offset="0.14" className="mk-mt__stop-1" />
                          <stop offset="0.5" className="mk-mt__stop-mid" />
                          <stop offset="0.86" className="mk-mt__stop-1" />
                          <stop offset="1" className="mk-mt__stop-0" />
                        </linearGradient>
                      </defs>
                      <path d={AMBIENT_PATH} className="mk-mt__ambient-glow" stroke={`url(#${gid}-amb)`} vectorEffect="non-scaling-stroke" />
                      <path d={AMBIENT_PATH} className="mk-mt__ambient-line" stroke={`url(#${gid}-amb)`} vectorEffect="non-scaling-stroke" />
                    </svg>
                    <div className="mk-mt__start-well">
                      <Button label="Start" size="large" variant="primary" className="mk-mt__start" onClick={startTest} />
                    </div>
                    <div className="mk-mt__durations">
                      <Segmented<Duration> options={DURATIONS} value={duration} onChange={setDuration} ariaLabel="Test duration" />
                    </div>
                  </>
                ) : (
                  <>
                    {trace ? (
                      <svg className={`mk-mt__trace${hasResults ? " is-frozen" : ""}`} viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" aria-hidden="true">
                        <defs>
                          <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2={CH} gradientUnits="userSpaceOnUse">
                            <stop offset="0" className="mk-mt__fill-top" />
                            <stop offset="1" className="mk-mt__fill-bottom" />
                          </linearGradient>
                        </defs>
                        <path d={trace[1]} fill={`url(#${gid}-fill)`} />
                        <path d={trace[0]} className="mk-mt__trace-line" vectorEffect="non-scaling-stroke" />
                      </svg>
                    ) : null}
                    {reading !== null ? (
                      <div className="mk-mt__reading" aria-live="polite">
                        <span className="mk-mt__hz mk-t-display64 mk-tnum">{reading}</span>
                        <span className="mk-mt__hz-unit">Hz</span>
                        {phase === "done" ? <span className="mk-sr-only">average</span> : null}
                      </div>
                    ) : null}
                    {hasResults ? (
                      <div className="mk-mt__results" role="group" aria-label="Test results">
                        {resTiles.map((t, i) => (
                          <StatTile key={t.label} label={t.label} value={t.value} state={i === 0 ? "active" : "counted"}
                            className={t.tone ? `mk-mt__tone mk-mt__tone--${t.tone}` : undefined} />
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
                {/* Status strip along the top of the screen: guidance, progress /
                    sample count, and Cancel (running) or Run again (finished). */}
                <div className="mk-mt__bar">
                  <span className="mk-mt__note mk-t-caption12">
                    {phase === "sampling" ? <b className="mk-tnum">{elapsed.toFixed(1)} s / {duration} s</b>
                      : hasResults ? <b className="mk-tnum">{results.events.toLocaleString("en-US")} samples</b> : null}
                    {note}
                  </span>
                  {phase === "sampling" ? (
                    <Button label="Cancel" size="medium" variant="neutral" onClick={reset} />
                  ) : phase === "done" ? (
                    <Button label="Run again" icon="reset" size="medium" variant="primary" onClick={reset} />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <span className="mk-mt__plug mk-mt__plug--l" aria-hidden="true" />
          <span className="mk-mt__plug mk-mt__plug--r" aria-hidden="true" />
        </div>

        <ButtonTester
          className="mk-mt__tester"
          counts={counts}
          scroll={scroll}
          pressed={pressed}
          wheel={wheelDir}
          art={<TesterArt snapshot={snapshot} pressed={pressed} wheel={wheelDir} />}
        />
      </div>
    </FullLayout>
  );
}
