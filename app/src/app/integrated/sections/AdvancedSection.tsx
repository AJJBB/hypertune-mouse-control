// Advanced tab of the integrated device page (Figma v2 · "Mouse - Advanced").
//
// Recipe (hypertune-mouse-components.md › Tab recipes): Signal strength on top,
// then groups of Setting rows — low power, auto sleep, debounce — and the brand
// extras (Finalmouse dongle/tournament, Incott receiver + rapid fire, ATK
// receiver + pairing, the MX Master wheel / haptics / name / Easy-Switch), with
// the Logitech HID++ details folded into a Collapsible section at the end.
//
// Parity: this tab owns the `signal`, `sleep`, `lowPower`, `debounce`,
// `finalmouse`, `incott`, `atkReceiver` and `logitechDetails` flags
// (sections/flags.ts) plus the MX Master detail cards (gated on reported fields).
// The logic is ported from the shared web-shell cards — AdvancedCards.tsx
// (Signal/Sleep/LowPower/Debounce/Finalmouse/Incott), AtkCards.tsx
// (AtkReceiverCard), MxMasterCards.tsx (MxMasterCards) and Diagnostics.tsx
// (LogitechDetails): same control.* calls, gating, disabled conditions, option
// lists and staging (every change queues in the pending bar).
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LOGITECH_HAPTIC_PRESETS,
  LOGITECH_SMART_SHIFT_OFF,
  type LogitechHapticPreset,
} from "@openmouse/protocol/logitech";
import * as control from "../../../device/controller";
import { PULSAR_SLEEP_OPTIONS } from "../../../device/controller";
import {
  selectableValues,
  sleepLabel,
  valuesWithCurrent,
  KEYCHRON_SLEEP_MAX_SECONDS,
  KEYCHRON_SLEEP_MIN_SECONDS,
} from "../../../device/options";
import type { ControlSnapshot } from "../../../device/types";
import { t, tp } from "../../../i18n";
import type { InterfaceLocale } from "../../../interface-preferences";
import { cardAvailability } from "../../cards/availability";
import {
  ArrowStepper, Button, CollapsibleSection, Dropdown, InfoRow, NumberField, SectionHeader, Segmented,
  SettingGroup, SettingRow, SettingValue, SignalStrength, Slider, StatusPill, TextInput, TimeStepper, Toggle,
  type DropOption, type SignalLevel,
} from "../kit";
import { EmptyNote, MouseRender, SplitLayout } from "./layout";
import "./advanced.css";

type Snap = ControlSnapshot;

/* ───────────────────────────── Signal strength ───────────────────────────── */

function signalWord(locale: InterfaceLocale, strength: number): string {
  const keys = ["adv.signal0", "adv.signal1", "adv.signal2", "adv.signal3", "adv.signal4"] as const;
  return keys[strength] ? t(locale, keys[strength]) : tp(locale, "adv.signalLevel", { n: strength });
}

/** The Signal chart's header (title · current reading · Signal strength pill). The drivers report a
    0–4 level only — no dBm and no history — so the chart itself has nothing honest to plot and the
    strength component stands alone (SignalCard). */
function SignalHead({ snapshot }: { snapshot: Snap }): ReactNode {
  const locale = snapshot.preferences.locale;
  const strength = snapshot.status?.signalStrength;
  const unavailable = strength === null || strength === undefined;
  const level = unavailable ? null : (Math.max(0, Math.min(4, Math.round(strength))) as SignalLevel);
  return (
    <section className="mk-adv-signal" aria-label="Signal strength">
      <div className="mk-adv-signal__heading">
        <h3 className="mk-adv-signal__title mk-t-title16">Signal strength</h3>
        {unavailable
          ? <span className="mk-adv-signal__note mk-t-body14">{t(locale, "adv.signalUnavailable")}</span>
          : <span className="mk-adv-signal__value mk-t-heading18" aria-live="polite">{signalWord(locale, strength)}</span>}
      </div>
      <SignalStrength level={level} showWord={false} />
    </section>
  );
}

/* ───────────────────────────── General: low power · auto sleep · debounce ───────────────────────────── */

/** LowPowerCard: Razer's low-battery threshold. Disabled (not hidden) above the polling ceiling. */
function lowPowerRow(snapshot: Snap): ReactNode {
  const status = snapshot.status;
  const options = snapshot.capabilities?.razerLowPowerOptions;
  const percentages = options == null ? null : selectableValues(options, status?.lowBatteryWarning);
  if (!status || percentages === null) return null;
  const ceiling = snapshot.capabilities?.lowPowerPollingCeiling ?? Infinity;
  // The threshold still reads at any rate; the vendor software just refuses to
  // arm it above this one, so the control is disabled rather than hidden.
  const tooFast = status.pollingRateHz > ceiling;
  return (
    <SettingRow key="low-power" id="low-power-settings" title="Low power mode"
      description={tooFast
        ? `Only available at ${ceiling} Hz or lower.`
        : "Saves battery below this charge level."}
      disabled={tooFast}
      control={(
        <Dropdown ariaLabel="Low power mode" disabled={tooFast}
          options={percentages.map((value) => ({ value, label: `${value}%` }))}
          value={status.lowBatteryWarning ?? null}
          onChange={(value) => control.applyLowPowerThreshold(value)} />
      )} />
  );
}

/** SleepCard: option source per family, the optional enable toggle (direct-mode drivers that can
    disable sleep) and the Keychron H:M:S timer. */
function sleepRows(snapshot: Snap): ReactNode[] {
  const status = snapshot.status;
  if (!status) return [];
  const locale = snapshot.preferences.locale;
  const { traits, capabilities } = snapshot;
  const keychronSleep = status.ui?.family === "keychron-nape";

  let options: ReadonlyArray<readonly [number, string]> = PULSAR_SLEEP_OPTIONS.map(
    ([value]) => [value, sleepLabel(value * 10, locale)] as const,
  );
  // A driver that publishes its own timeouts wins over the Pulsar-unit default,
  // whether or not it is a direct-mode driver.
  if (!keychronSleep && (traits.directMode || capabilities?.sleepOptions)) {
    const offered = capabilities?.sleepOptions ?? [10, 30, 60, 300, 600, 1800];
    const seconds = selectableValues(offered, status.sleepTimeout) ?? offered;
    options = seconds.map((value) => [value, sleepLabel(value, locale)] as const);
  } else if (!keychronSleep && capabilities?.razerSleepOptions != null) {
    // Seconds throughout (Razer's Viper V3 protocol); hidden when the current value is out of range.
    const seconds = selectableValues(capabilities.razerSleepOptions, status.sleepTimeout);
    if (seconds === null) return [];
    options = seconds.map((value) => [value, sleepLabel(value, locale)] as const);
  } else if (!keychronSleep && traits.teevolution && capabilities?.teevolutionProfile && status.connectionType) {
    options = capabilities.teevolutionProfile.sleepOptions.map(
      (value) => [value, sleepLabel(value * 10, locale)] as const,
    );
  }

  const canDisable = traits.directMode && capabilities?.canDisableSleep === true;
  const asleep = status.sleepTimeout !== null && status.sleepTimeout !== undefined;

  const timer = keychronSleep && asleep ? (
    <TimeStepper ariaLabel={t(locale, "adv.sleepTimeout")} seconds={status.sleepTimeout!}
      min={KEYCHRON_SLEEP_MIN_SECONDS} max={KEYCHRON_SLEEP_MAX_SECONDS} disabled={snapshot.settingsPending}
      onChange={(total) => {
        if (total < KEYCHRON_SLEEP_MIN_SECONDS) {
          control.reportStatus(t(locale, "adv.sleepMin"));
          return;
        }
        if (total > KEYCHRON_SLEEP_MAX_SECONDS) return;
        control.applyPulsarValue("sleep", total);
      }} />
  ) : (
    <ArrowStepper ariaLabel={t(locale, "adv.sleepTimeout")} disabled={!asleep}
      options={options.map(([value, label]) => ({ value, label }))}
      value={status.sleepTimeout ?? null}
      onChange={(value) => control.applyPulsarValue("sleep", value)} />
  );

  if (canDisable) {
    return [
      <SettingRow key="sleep-toggle" id="sleep-settings" title="Auto sleep"
        description="Turns the mouse off when you stop using it."
        control={<Toggle ariaLabel={t(locale, "adv.autoSleep")} value={asleep} onChange={(next) => control.toggleSleep(next)} />} />,
      <SettingRow key="sleep-time" title="Sleep after"
        description={asleep ? "How long it waits before turning off." : "Turn on auto sleep to choose a time."}
        disabled={!asleep} control={timer} />,
    ];
  }
  return [
    <SettingRow key="sleep" id="sleep-settings" title="Auto sleep"
      description={asleep ? "Turns the mouse off when you stop using it." : "Auto sleep is turned off on the mouse."}
      disabled={!asleep} control={timer} />,
  ];
}

/** DebounceCard: the driver's own option list (an unwritable current value stays visible but can't
    be chosen), else 0…max ms. */
function debounceRow(snapshot: Snap): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const max = snapshot.traits.directMode
    ? snapshot.capabilities?.debounceMaxMs ?? 20
    : snapshot.capabilities?.teevolutionProfile?.debounce.max ?? 20;
  const offered = snapshot.capabilities?.debounceOptions;
  const values = offered
    ? valuesWithCurrent([...offered], status.debounceMs)
    : Array.from({ length: max + 1 }, (_, ms) => ms);
  const unknown = status.debounceMs === null || status.debounceMs === undefined;
  const options: DropOption<number>[] = values.map((ms) => ({
    value: ms, label: `${ms} ms`, disabled: offered != null && !offered.includes(ms),
  }));
  return (
    <SettingRow key="debounce" id="debounce-settings" title="Debounce time"
      description="How long a click waits before it counts." disabled={unknown}
      control={(
        <ArrowStepper ariaLabel="Debounce time" options={options} value={status.debounceMs ?? null} disabled={unknown}
          onChange={(ms) => control.applyPulsarValue("debounce", ms)} />
      )} />
  );
}

/* ───────────────────────────── Brand extras ───────────────────────────── */

/** FinalmouseCard: dongle LED, tournament scroll and its passthrough window. */
function finalmouseGroup(snapshot: Snap): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const locale = snapshot.preferences.locale;
  return (
    <Group key="finalmouse" id="finalmouse-settings" title={t(locale, "adv.dongleTournament")}>
      <SettingRow title={t(locale, "adv.dongleLed")} description="What the receiver's light shows."
        control={(
          <Dropdown ariaLabel={t(locale, "adv.dongleLed")} value={status.finalmouseDongleLedMode ?? 0}
            options={[
              { value: 0, label: t(locale, "adv.ledOff") },
              { value: 1, label: t(locale, "adv.batteryIndicator") },
              { value: 2, label: t(locale, "adv.solidWhite") },
            ]}
            onChange={(value) => control.applyFinalmouseSetting("dongleLed", value)} />
        )} />
      <SettingRow title={t(locale, "adv.tournamentScroll")} description="Which scroll directions tournament mode covers."
        control={(
          <Dropdown ariaLabel={t(locale, "adv.tournamentScroll")} value={status.finalmouseTournamentScrollMode ?? 0}
            options={[
              { value: 0, label: t(locale, "adv.ledOff") },
              { value: 1, label: t(locale, "adv.scrollUp") },
              { value: 2, label: t(locale, "adv.scrollDown") },
              { value: 3, label: t(locale, "adv.bothDirections") },
            ]}
            onChange={(value) => control.applyFinalmouseSetting("tournamentScroll", value)} />
        )} />
      <SettingRow title={t(locale, "adv.passthrough")} description="Timing window for tournament scroll."
        control={(
          <Dropdown ariaLabel={t(locale, "adv.passthrough")} value={status.finalmouseTournamentScrollTimeoutMs ?? 100}
            options={[
              { value: 100, label: "100 ms" },
              { value: 500, label: "500 ms" },
              { value: 1000, label: t(locale, "adv.oneSecond") },
              { value: 1500, label: t(locale, "adv.halfSeconds") },
            ]}
            onChange={(value) => control.applyFinalmouseSetting("tournamentTimeout", value)} />
        )} />
    </Group>
  );
}

/** IncottCard: receiver LED (absent over the cable) and the rapid-fire key — both halves of the
    fire-key command ride together, so each control sends the other's current value. */
function incottGroup(snapshot: Snap): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const locale = snapshot.preferences.locale;
  const times = status.incottFireKeyTimes ?? 1;
  const interval = status.incottFireKeyIntervalMs ?? 0;
  return (
    <Group key="incott" id="incott-settings" title="Receiver and rapid fire">
      {status.incottReceiverLedMode != null ? (
        <SettingRow title={t(locale, "adv.dongleLed")} description="What the receiver's light shows."
          control={(
            <Dropdown ariaLabel={t(locale, "adv.dongleLed")} value={status.incottReceiverLedMode}
              options={[
                { value: 0, label: t(locale, "adv.ledConnectRate") },
                { value: 1, label: t(locale, "adv.ledBatteryStatus") },
                { value: 2, label: t(locale, "adv.ledBatteryWarning") },
              ]}
              onChange={(value) => control.applyIncottReceiverLed(value)} />
          )} />
      ) : null}
      {status.incottFireKeyTimes != null ? (
        <>
          <SettingRow title={t(locale, "adv.fireKeyTimes")} description="Clicks sent each time you press the fire key."
            control={(
              <Dropdown ariaLabel={t(locale, "adv.fireKeyTimes")} value={times}
                options={[
                  // 0 is not "off": it fires continuously while the button is held.
                  { value: 0, label: t(locale, "adv.fireKeyHold") },
                  { value: 1, label: "1" },
                  { value: 2, label: "2" },
                  { value: 3, label: "3" },
                ]}
                onChange={(value) => control.applyIncottFireKey(value, interval)} />
            )} />
          <SettingRow title="Fire interval" description="Time between rapid-fire clicks."
            control={(
              <NumberField ariaLabel="Fire interval" unit="ms" value={interval} min={0} max={255} step={1}
                grouping={false} onApply={(value) => control.applyIncottFireKey(times, value)} />
            )} />
        </>
      ) : null}
    </Group>
  );
}

/** AtkReceiverCard: receiver telemetry + the VXE R1 SE+ pairing flow (prepare → start / cancel). */
function AtkReceiver({ snapshot }: { snapshot: Snap }): ReactNode {
  const [pairingPrepared, setPairingPrepared] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pairingPrepared) groupRef.current?.querySelector<HTMLButtonElement>(".mk-adv-pair-start")?.focus();
  }, [pairingPrepared]);
  const closePreparation = (): void => {
    setPairingPrepared(false);
    window.requestAnimationFrame(() => groupRef.current?.focus());
  };
  const startPairing = (): void => {
    closePreparation();
    void control.pairAtkR1SePlusReceiver();
  };
  const receiver = snapshot.status?.atkReceiver;
  if (!receiver) return null;
  const busy = snapshot.settingInProgress;
  const pairing = receiver.pairingStatus === null
    ? "Unavailable"
    : receiver.pairingSecondsRemaining
      ? `Status ${receiver.pairingStatus} · ${receiver.pairingSecondsRemaining}s remaining`
      : `Status ${receiver.pairingStatus}`;

  let pairRow: ReactNode;
  if (!snapshot.atkR1SePlusPairingAvailable) {
    pairRow = (
      <SettingRow title="Pairing" description="Pairing controls are unavailable on this receiver model."
        controlWidth="hug" control={<SettingValue>Unavailable</SettingValue>} />
    );
  } else if (pairingPrepared) {
    pairRow = (
      <SettingRow title="Get ready to pair"
        description="Unplug the mouse cable and select 2.4 GHz mode. After starting, hold left click, wheel click, and right click until the indicator flashes, then release."
        control={(
          <div className="mk-adv-actions">
            <Button size="medium" label="Cancel" disabled={busy} onClick={closePreparation} />
            <Button size="medium" variant="primary" label="Start pairing" ariaLabel="Ready, start pairing"
              disabled={busy} onClick={startPairing} className="mk-adv-pair-start" />
          </div>
        )} />
    );
  } else {
    pairRow = (
      <SettingRow title="Pair R1 SE+" description="Pairing is verified for the VXE R1 SE+ (CID 02, MID 20)."
        controlWidth="hug"
        control={<Button size="medium" label="Pair" ariaLabel="Pair R1 SE+" disabled={busy} onClick={() => setPairingPrepared(true)} />} />
    );
  }
  return (
    <div ref={groupRef} className="mk-adv-group" id="atk-receiver-status" tabIndex={-1}>
      <SectionHeader title="Receiver"
        action={<StatusPill type={receiver.online ? "active" : "warning"} label={receiver.online ? "Mouse online" : "Mouse offline"} />} />
      <SettingGroup dense>
        <InfoRow label="RF identifier" value={receiver.rfId} />
        <InfoRow label="Pairing state" value={pairing} />
      </SettingGroup>
      <SettingGroup>{pairRow}</SettingGroup>
    </div>
  );
}

/* ───────────────────────────── MX Master details ───────────────────────────── */

/** HapticsCard (MX Master 4). */
function mxHapticsGroup(snapshot: Snap): ReactNode {
  const status = snapshot.status;
  if (!status || status.hapticIntensity == null) return null;
  const locale = snapshot.preferences.locale;
  const presets = Object.keys(LOGITECH_HAPTIC_PRESETS) as LogitechHapticPreset[];
  const preset = presets.find((name) => LOGITECH_HAPTIC_PRESETS[name] === status.hapticIntensity);
  // An intensity set elsewhere (Options+) may sit between presets: start the
  // stepper from the nearest one so both arrows work, as the old Segmented did.
  const intensity = status.hapticIntensity;
  const nearest = preset ?? presets.reduce<LogitechHapticPreset | null>((best, name) =>
    best === null || Math.abs(LOGITECH_HAPTIC_PRESETS[name] - intensity) < Math.abs(LOGITECH_HAPTIC_PRESETS[best] - intensity) ? name : best, null);
  const off = status.hapticEnabled !== true;
  return (
    <Group key="mx-haptics" title={t(locale, "mx.haptics")}
      count={status.hapticEnabled ? preset ?? status.hapticIntensity : t(locale, "common.off")}>
      {status.hapticEnabled != null ? (
        <SettingRow title={t(locale, "mx.hapticFeedback")} description="Small vibrations you feel as you use the mouse."
          control={<Toggle ariaLabel={t(locale, "mx.hapticFeedback")} value={status.hapticEnabled} onChange={control.applyHapticEnabled} />} />
      ) : null}
      <SettingRow title={t(locale, "mx.hapticStrength")}
        description={off ? "Turn on haptic feedback to change this." : "How strong the vibrations feel."}
        disabled={off}
        control={(
          // Four ordered presets: an Arrow stepper (labels are too long for a 4-way Segmented).
          <ArrowStepper ariaLabel={t(locale, "mx.hapticStrength")} value={nearest} disabled={off}
            options={presets.map((value) => ({ value, label: value }))}
            onChange={control.applyHapticIntensity} />
        )} />
      {status.hapticBatterySaving != null ? (
        <SettingRow title={t(locale, "mx.batterySaving")} description="Eases off the vibrations to save battery."
          control={<Toggle ariaLabel={t(locale, "mx.batterySaving")} value={status.hapticBatterySaving} onChange={control.applyHapticBatterySaving} />} />
      ) : null}
    </Group>
  );
}

/** WheelCard: MagSpeed wheel mode, SmartShift (+ threshold), hi-res and the invert switches. */
function mxWheelGroup(snapshot: Snap): ReactNode {
  const status = snapshot.status;
  if (!status || (status.wheelMode == null && status.hiResScroll == null)) return null;
  const locale = snapshot.preferences.locale;
  const smartShiftOn = status.smartShiftThreshold != null
    && status.smartShiftThreshold !== LOGITECH_SMART_SHIFT_OFF;
  const engaged = status.wheelRatchetEngaged == null
    ? undefined
    : status.wheelRatchetEngaged ? t(locale, "mx.ratcheted") : t(locale, "mx.freeSpinning");
  const threshold = status.smartShiftThreshold ?? 50;
  return (
    <Group key="mx-wheel" title="MagSpeed wheel" count={engaged}>
      {status.wheelMode != null ? (
        <SettingRow title={t(locale, "mx.wheelMode")} description="Clicks in steps, or spins freely."
          control={(
            <Segmented ariaLabel={t(locale, "mx.wheelMode")} value={status.wheelMode}
              options={[{ value: "Ratchet", label: t(locale, "mx.ratchet") }, { value: "Freespin", label: t(locale, "mx.freespin") }]}
              onChange={control.applyWheelMode} />
          )} />
      ) : null}
      {status.smartShiftThreshold != null ? (
        <SettingRow title="SmartShift" description="Switches to free-spin when you flick the wheel."
          control={(
            <Toggle ariaLabel="SmartShift" value={smartShiftOn}
              onChange={(enabled) => control.applySmartShiftThreshold(enabled ? 50 : null)} />
          )} />
      ) : null}
      {status.smartShiftThreshold != null && smartShiftOn ? (
        <SettingRow title={t(locale, "mx.switchThreshold")} description="How fast you flick before it switches."
          control={(
            <div className="mk-adv-range">
              <Slider ariaLabel={t(locale, "mx.switchThreshold")} min={1} max={100} value={threshold}
                valueText={String(threshold)}
                onChange={(value) => control.applySmartShiftThreshold(value)} />
              <output className="mk-adv-range__value mk-t-label14" aria-hidden="true">{status.smartShiftThreshold}</output>
            </div>
          )} />
      ) : null}
      {status.hiResScroll != null ? (
        <SettingRow title={t(locale, "mx.hiRes")} description="Smoother, finer scrolling in apps that support it."
          control={<Toggle ariaLabel={t(locale, "mx.hiRes")} value={status.hiResScroll} onChange={control.applyHiResScroll} />} />
      ) : null}
      {status.supportsInvertScroll === true && status.invertScroll != null ? (
        <SettingRow title={t(locale, "mx.invertVertical")} description="Scrolls pages the other way."
          control={<Toggle ariaLabel={t(locale, "mx.invertVertical")} value={status.invertScroll} onChange={control.applyInvertScroll} />} />
      ) : null}
      {status.supportsThumbWheelInvert === true && status.thumbWheelInverted != null ? (
        <SettingRow title={t(locale, "mx.invertThumb")} description="Turns the side wheel the other way."
          control={<Toggle ariaLabel={t(locale, "mx.invertThumb")} value={status.thumbWheelInverted} onChange={control.applyThumbWheelInverted} />} />
      ) : null}
    </Group>
  );
}

/** DeviceNameCard + EasySwitchCard. */
function MxDevice({ snapshot }: { snapshot: Snap }): ReactNode {
  const status = snapshot.status!;
  const locale = snapshot.preferences.locale;
  const [name, setName] = useState(status.friendlyName ?? "");
  useEffect(() => setName(status.friendlyName ?? ""), [status.friendlyName]);
  const [pending, setPending] = useState<number | null>(null);

  const hasName = status.friendlyName != null && status.friendlyNameMaxLength != null;
  const hasHosts = status.hostCount != null && status.currentHost != null;
  if (!hasName && !hasHosts) return null;
  const valid = name.trim().length > 0 && name.trim() !== status.friendlyName;
  const dirty = name !== (status.friendlyName ?? "");

  return (
    <Group title="Device">
      {hasName ? (
        <SettingRow title="Device name"
          description={`The name your computers see. ${tp(locale, "mx.chars", { n: name.length, max: status.friendlyNameMaxLength! })}.`}
          control={(
            <TextInput ariaLabel={t(locale, "mx.friendlyNameAria")} value={name} maxLength={status.friendlyNameMaxLength!}
              onChange={setName} showActions={dirty}
              error={dirty && name.trim().length === 0}
              onConfirm={() => { if (valid) control.applyFriendlyName(name); }}
              onCancel={() => setName(status.friendlyName ?? "")} />
          )} />
      ) : null}
      {hasHosts ? (
        <SettingRow title="Easy-Switch"
          description={`Which paired computer it's on: ${tp(locale, "mx.hostOf", { a: status.currentHost! + 1, b: status.hostCount! })}.`}
          control={(
            <Segmented ariaLabel={t(locale, "mx.pairedComputers")} value={status.currentHost!}
              options={Array.from({ length: status.hostCount! }, (_, slot) => ({
                value: slot,
                label: String(slot + 1),
                // Only a paired computer other than the current one can be switched to.
                disabled: slot !== status.currentHost && status.hostSlotsPaired?.[slot] !== true,
              }))}
              onChange={(slot) => setPending(slot)} />
          )} />
      ) : null}
      {hasHosts && pending !== null ? (
        <SettingRow title={`Switch to computer ${pending + 1}?`}
          description="The mouse will disconnect immediately. Use its underside button to bring it back."
          control={(
            <div className="mk-adv-actions">
              <Button size="medium" label={t(locale, "common.cancel")} onClick={() => setPending(null)} />
              <Button size="medium" variant="primary" label={t(locale, "mx.switch")}
                onClick={() => { const slot = pending; setPending(null); void control.requestHostSwitch(slot); }} />
            </div>
          )} />
      ) : null}
    </Group>
  );
}

/* ───────────────────────────── Logitech HID++ details ───────────────────────────── */

/** LogitechDetails (Diagnostics.tsx): read-only HID++ facts, folded by default like the web shell
    (opens with the "expand sections" preference). When it is the only thing on the tab (a G-series
    mouse) it starts open, so the tab isn't a single folded row. */
function LogitechDetails({ snapshot, alone }: { snapshot: Snap; alone: boolean }): ReactNode {
  const expand = snapshot.preferences.expandSections || alone;
  const [open, setOpen] = useState(expand);
  useEffect(() => setOpen(expand), [expand]);
  const status = snapshot.status;
  if (!status || status.brand !== "Logitech") return null;
  const locale = snapshot.preferences.locale;
  const transports = Object.entries(status.transportIds ?? {})
    .map(([name, id]) => `${name}: ${id}`)
    .join(" · ") || t(locale, "diag.notReported");
  const rates = status.supportedPollingRates
    ?.map((rate) => `${rate >= 1000 ? `${rate / 1000}K` : rate} Hz`)
    .join(", ") || t(locale, "diag.notReported");
  const items: Array<[string, string]> = [
    ["Mode", status.deviceMode ?? t(locale, "diag.unknown")],
    ["Active profile", status.activeProfile === null ? t(locale, "diag.noneHost") : tp(locale, "adv.profileOpt", { n: status.activeProfile })],
    ["Profile format", status.onboardProfileFormat
      ? `${status.onboardProfileFormat.id} · ${status.onboardProfileFormat.name} (base ${status.onboardProfileFormat.base})`
      : t(locale, "diag.notReported")],
    ["Model ID", status.modelId ?? t(locale, "diag.notReported")],
    ["Unit ID", status.unitId ?? t(locale, "diag.notReported")],
    ["Transport IDs", transports],
    ["Advertised polling", rates],
    ["DPI axes", status.supportsSeparateDpiAxes
      ? `X ${status.dpi} · Y ${status.dpiY ?? status.dpi}`
      : t(locale, "diag.linkedXY")],
  ];
  return (
    <div id="logitech-device-details" className="mk-adv-details">
      <CollapsibleSection title={t(locale, "diag.details")} summary="Logitech HID++" open={open} onToggle={setOpen}>
        {items.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}
      </CollapsibleSection>
    </div>
  );
}

/* ───────────────────────────── Layout helpers ───────────────────────────── */

/** Section header + a Setting group (gap 10). `count` shows as the header's plain pill. */
function Group({ title, count, id, children }: { title: string; count?: string | number; id?: string; children: ReactNode }): ReactNode {
  return (
    <div className="mk-adv-group" id={id}>
      <SectionHeader title={title} action={count !== undefined ? <StatusPill type="plain" label={String(count)} /> : undefined} />
      <SettingGroup>{children}</SettingGroup>
    </div>
  );
}

function hasMxMasterDetails(snapshot: Snap): boolean {
  const s = snapshot.status;
  return !!s && (s.hapticIntensity != null || s.wheelMode != null || s.friendlyName != null || s.hostCount != null);
}

/* ───────────────────────────── Section ───────────────────────────── */

export function AdvancedSection({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const has = cardAvailability(snapshot);
  const mx = hasMxMasterDetails(snapshot);

  // Same order on every mouse (the reference screen's): low power, auto sleep, debounce.
  const general: ReactNode[] = [
    has.lowPower ? lowPowerRow(snapshot) : null,
    ...(has.sleep ? sleepRows(snapshot) : []),
    has.debounce ? debounceRow(snapshot) : null,
  ].filter((node) => node !== null);

  const before: ReactNode[] = [
    has.signal ? <SignalHead key="signal" snapshot={snapshot} /> : null,
    general.length ? (
      <div key="general" className="mk-adv-group">
        <SectionHeader title="General" />
        <SettingGroup>{general}</SettingGroup>
      </div>
    ) : null,
    has.finalmouse ? finalmouseGroup(snapshot) : null,
    has.incott ? incottGroup(snapshot) : null,
    has.atkReceiver ? <AtkReceiver key="atk-receiver" snapshot={snapshot} /> : null,
    mx ? mxHapticsGroup(snapshot) : null,
    mx ? mxWheelGroup(snapshot) : null,
    mx ? <MxDevice key="mx-device" snapshot={snapshot} /> : null,
  ].filter((node) => node !== null);
  const blocks: ReactNode[] = has.logitechDetails
    ? [...before, <LogitechDetails key="logitech-details" snapshot={snapshot} alone={before.length === 0} />]
    : before;

  return (
    <SplitLayout
      left={<MouseRender snapshot={snapshot} />}
      right={(
        <div className="mk-adv">
          {blocks.length ? blocks : <EmptyNote>Nothing else to adjust on this mouse.</EmptyNote>}
        </div>
      )}
    />
  );
}
