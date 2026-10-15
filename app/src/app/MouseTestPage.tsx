import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import type { ControlSnapshot } from "../device/types";
import { t } from "../i18n";
import { computeResults, formatHz, rollingLiveHz, stabilityClass, type TestResults } from "../ui/polling-stats";
import { MouseTestMouse } from "./MouseTestMouse";

type TestPhase = "idle" | "countdown" | "sampling" | "done";

interface ButtonState {
  left: boolean;
  right: boolean;
  middle: boolean;
  back: boolean;
  forward: boolean;
}

const SAMPLE_WINDOW = 200;
const DURATION_OPTIONS = [5, 8, 10] as const;

function drawChart(canvas: HTMLCanvasElement, intervals: number[], targetHz: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 600;
  const h = canvas.clientHeight || 160;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pad = { top: 16, bottom: 24, left: 40, right: 12 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const styles = getComputedStyle(canvas);
  const color = (name: string, fallback: string): string => styles.getPropertyValue(name).trim() || fallback;
  const lineSoft = color("--line-soft", "#25292e");
  const dim = color("--dim", "#6c727b");
  const info = color("--ui-accent", "#29cc6a");
  const infoSoft = `${info}28`;
  const infoFaint = "transparent";

  ctx.clearRect(0, 0, w, h);

  const recent = intervals.slice(-SAMPLE_WINDOW);
  if (recent.length < 2) {
    ctx.clearRect(0, 0, w, h);
    return;
  }

  const hzValues = recent.map((ms) => (ms > 0 ? Math.min(1000 / ms, Math.max(targetHz * 2, 250)) : 0));
  const maxHz = Math.max(targetHz * 1.5, ...hzValues) * 1.1;
  const minHz = 0;

  const gridLines = 4;
  ctx.strokeStyle = lineSoft;
  ctx.lineWidth = 0.5;
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillStyle = dim;
  ctx.textAlign = "right";
  for (let i = 0; i <= gridLines; i++) {
    const y = pad.top + (plotH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    const hzLabel = Math.round(maxHz - (maxHz - minHz) * (i / gridLines));
    ctx.fillText(`${hzLabel}`, pad.left - 6, y + 3);
  }

  if (targetHz > 0) {
    const targetY = pad.top + plotH * (1 - targetHz / maxHz);
    ctx.strokeStyle = infoSoft;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, targetY);
    ctx.lineTo(w - pad.right, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = infoSoft;
    ctx.textAlign = "left";
    ctx.fillText(`${targetHz} Hz target`, w - pad.right - 70, targetY - 4);
  }

  const step = plotW / (SAMPLE_WINDOW - 1);
  ctx.beginPath();
  ctx.strokeStyle = info;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  for (let i = 0; i < hzValues.length; i++) {
    const x = pad.left + i * step;
    const y = pad.top + plotH * (1 - (hzValues[i] ?? 0) / maxHz);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
  gradient.addColorStop(0, infoSoft);
  gradient.addColorStop(1, infoFaint);
  ctx.lineTo(pad.left + (hzValues.length - 1) * step, pad.top + plotH);
  ctx.lineTo(pad.left, pad.top + plotH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
}

export function MouseTestPage({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const locale = snapshot.preferences.locale;
  const status = snapshot.status;

  const [phase, setPhase] = useState<TestPhase>("idle");
  const [countdown, setCountdown] = useState(3);
  const [duration, setDuration] = useState<8 | 5 | 10>(8);
  const [elapsed, setElapsed] = useState(0);
  const [liveHz, setLiveHz] = useState(0);
  const [results, setResults] = useState<TestResults | null>(null);
  const [chartIntervals, setChartIntervals] = useState<number[]>([]);
  const [buttons, setButtons] = useState<ButtonState>({ left: false, right: false, middle: false, back: false, forward: false });
  const [wheelDir, setWheelDir] = useState<"up" | "down" | null>(null);

  const intervalsRef = useRef<number[]>([]);
  const lastTimeRef = useRef(0);
  const phaseRef = useRef<TestPhase>("idle");
  const startTimeRef = useRef(0);
  const timerRef = useRef<number>(0);
  const wheelTimerRef = useRef<number>(0);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (phaseRef.current !== "sampling") return;
    const subEvents =
      typeof e.getCoalescedEvents === "function" && e.getCoalescedEvents().length > 0
        ? e.getCoalescedEvents()
        : [e];
    for (const event of subEvents) {
      const t = event.timeStamp;
      if (lastTimeRef.current > 0) {
        const delta = t - lastTimeRef.current;
        if (delta >= 0.05 && delta <= 1000) {
          intervalsRef.current.push(delta);
        }
      }
      lastTimeRef.current = t;
    }
    if (intervalsRef.current.length > 0) {
      setLiveHz(rollingLiveHz(intervalsRef.current));
      setChartIntervals([...intervalsRef.current].slice(-SAMPLE_WINDOW));
    }
  }, []);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const key = e.button === 0 ? "left" : e.button === 1 ? "middle" : e.button === 2 ? "right" : e.button === 3 ? "back" : e.button === 4 ? "forward" : null;
    if (key) setButtons((prev) => ({ ...prev, [key]: true }));
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    const key = e.button === 0 ? "left" : e.button === 1 ? "middle" : e.button === 2 ? "right" : e.button === 3 ? "back" : e.button === 4 ? "forward" : null;
    if (key) setButtons((prev) => ({ ...prev, [key]: false }));
  }, []);

  const handleWheel = useCallback((e: JSX.TargetedWheelEvent<HTMLDivElement>) => {
    setWheelDir(e.deltaY < 0 ? "up" : "down");
    window.clearTimeout(wheelTimerRef.current);
    wheelTimerRef.current = window.setTimeout(() => setWheelDir(null), 180);
  }, []);

  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const redraw = () => drawChart(canvas, chartIntervals, status?.pollingRateHz ?? 1000);
    redraw();
    const ro = new ResizeObserver(redraw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [chartIntervals, status?.pollingRateHz]);

  const startTest = useCallback(() => {
    intervalsRef.current = [];
    lastTimeRef.current = 0;
    setLiveHz(0);
    setResults(null);
    setChartIntervals([]);
    setElapsed(0);
    setPhase("countdown");
    setCountdown(3);

    let count = 3;
    const countdownTimer = window.setInterval(() => {
      count--;
      if (count <= 0) {
        window.clearInterval(countdownTimer);
        setPhase("sampling");
        startTimeRef.current = performance.now();
        let elapsed = 0;
        timerRef.current = window.setInterval(() => {
          elapsed = performance.now() - startTimeRef.current;
          setElapsed(elapsed / 1000);
          if (elapsed >= duration * 1000) {
            window.clearInterval(timerRef.current);
            setResults(computeResults(intervalsRef.current, elapsed));
            setPhase("done");
          }
        }, 50);
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [duration]);

  const resetTest = useCallback(() => {
    window.clearInterval(timerRef.current);
    intervalsRef.current = [];
    lastTimeRef.current = 0;
    setPhase("idle");
    setLiveHz(0);
    setResults(null);
    setChartIntervals([]);
    setElapsed(0);
    setButtons({ left: false, right: false, middle: false, back: false, forward: false });
    setWheelDir(null);
  }, []);

  useEffect(() => {
    return () => {
      window.clearInterval(timerRef.current);
      window.clearTimeout(wheelTimerRef.current);
    };
  }, []);

  const targetHz = status?.pollingRateHz ?? 1000;

  return (
    <div className="mouse-test-page ht-diag">
      {!status ? (
        <div className="ht-diag-statbar ht-diag-statbar-empty">{t(locale, "test.noDevice")}</div>
      ) : null}

      <div className="mouse-test-main ht-diag-main">
          <div
            className={`mouse-test-area${phase === "sampling" ? " active" : ""}`}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="mouse-test-chip mouse-test-chip-left mouse-test-title-chip">
              {t(locale, "test.pollingTitle")}
            </div>
            <div className="mouse-test-chip mouse-test-chip-right">
              {phase === "idle" && "—"}
              {phase === "countdown" && `${countdown}`}
              {phase === "sampling" && `${elapsed.toFixed(1)}s / ${duration}s`}
              {phase === "done" && results && `${results.events} samples`}
            </div>

            <canvas ref={chartCanvasRef} className="mouse-test-chart" />

            {phase === "idle" && (
              <div className="mouse-test-idle">
                <div className="mouse-test-idle-icon">&#x1F5B1;</div>
                <p>{t(locale, "test.movePrompt")}</p>
              </div>
            )}
            {phase === "countdown" && (
              <div className="mouse-test-countdown">{countdown}</div>
            )}
            {phase === "sampling" && (
              <div className="mouse-test-live">
                <div className="mouse-test-live-hz">{formatHz(liveHz)}</div>
                <div className="mouse-test-live-label">Hz</div>
                <div className="mouse-test-live-bar">
                  <div
                    className="mouse-test-live-bar-fill"
                    style={{ width: `${Math.min(100, (liveHz / Math.max(targetHz * 1.5, 1)) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {phase === "done" && results && (
              <div className="mouse-test-done">
                <div className="mouse-test-done-hz">{formatHz(results.avgHz)}</div>
                <div className="mouse-test-done-label">{t(locale, "test.avgHz")}</div>
              </div>
            )}

            <div className="mouse-test-area-note">{t(locale, "test.areaNote")}</div>
          </div>

          <div className="mouse-test-controls">
            {phase === "idle" && (
              <div className="mouse-test-duration-picker">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    className={`mouse-test-duration-btn${duration === d ? " active" : ""}`}
                    type="button"
                    onClick={() => setDuration(d as 5 | 8 | 10)}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            )}
            {phase === "idle" && (
              <button className="mouse-test-start-btn" type="button" onClick={startTest}>
                {t(locale, "test.start")}
              </button>
            )}
            {phase === "done" && (
              <button className="mouse-test-reset-btn" type="button" onClick={resetTest}>
                {t(locale, "test.reset")}
              </button>
            )}
          </div>

          {results && results.events > 0 && (
            <div className="mouse-test-results">
              <div className="mouse-test-result-card">
                <span className="mouse-test-result-label">{t(locale, "test.avgHz")}</span>
                <span className="mouse-test-result-value">{formatHz(results.avgHz)}</span>
                <span className="mouse-test-result-unit">Hz</span>
              </div>
              <div className="mouse-test-result-card">
                <span className="mouse-test-result-label">{t(locale, "test.peakHz")}</span>
                <span className="mouse-test-result-value">{formatHz(results.peakHz)}</span>
                <span className="mouse-test-result-unit">Hz</span>
              </div>
              <div className="mouse-test-result-card">
                <span className="mouse-test-result-label">{t(locale, "test.low5")}</span>
                <span className="mouse-test-result-value">{formatHz(results.low5Hz)}</span>
                <span className="mouse-test-result-unit">Hz</span>
              </div>
              <div className="mouse-test-result-card">
                <span className="mouse-test-result-label">{t(locale, "test.stability")}</span>
                <span className={`mouse-test-result-value mouse-test-stability ${stabilityClass(results.stability)}`}>
                  {results.stability.toFixed(1)}%
                </span>
              </div>
              <div className="mouse-test-result-card">
                <span className="mouse-test-result-label">{t(locale, "test.jitter")}</span>
                <span className="mouse-test-result-value">{results.jitter.toFixed(1)}%</span>
              </div>
              <div className="mouse-test-result-card">
                <span className="mouse-test-result-label">{t(locale, "test.dropouts")}</span>
                <span className="mouse-test-result-value">{results.dropouts}</span>
              </div>
              <div className="mouse-test-result-card">
                <span className="mouse-test-result-label">{t(locale, "test.events")}</span>
                <span className="mouse-test-result-value">{results.events}</span>
              </div>
              <div className="mouse-test-result-card">
                <span className="mouse-test-result-label">{t(locale, "test.avgInterval")}</span>
                <span className="mouse-test-result-value">{results.avgInterval.toFixed(2)}</span>
                <span className="mouse-test-result-unit">ms</span>
              </div>
            </div>
          )}
        </div>

      <div
        className="ht-diag-buttoncheck"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="ht-diag-buttoncheck-copy">
          <h3 className="mouse-test-device-title">{t(locale, "test.buttonTest")}</h3>
          <p className="mouse-test-button-hint">{t(locale, "test.buttonHint")}</p>
        </div>
        <div className="ht-diag-buttoncheck-mouse">
          <MouseTestMouse buttons={buttons} wheel={wheelDir} />
        </div>
      </div>
    </div>
  );
}
