// Logitech onboard profiles (flag `profiles`) — the logic of app/Profiles.tsx
// (host mode + stored slots: open, rename, switch, enable; the Normal / G-Shift
// button-assignment editor and the keyboard-shortcut recorder), presented as
// Ivan's Profile cards with the opened profile's editor underneath. The editor
// also carries the opened profile's own DPI slots and report rates (the same
// controller state DpiCard's DpiSlots and PollingCard's per-profile rows edit),
// so opening a profile gives its whole stored contents in one place.
import { Fragment, useRef, useState, type ReactNode } from "react";
import {
  LOGITECH_BUTTON_ACTIONS,
  capabilitiesForFormat,
  reportRatesFor,
  stageLodLevel,
  type LogitechButtonAction,
  type OnboardProfile,
} from "@openmouse/protocol/drivers/logitech/onboard-profiles";
import * as control from "../../../../device/controller";
import type { ControlSnapshot, LiftOffLevel } from "../../../../device/types";
import { t, tp } from "../../../../i18n";
import type { InterfaceLocale } from "../../../../interface-preferences";
import {
  Button, ButtonRemapGrid, DpiStageRow, DpiStageTable, Dropdown, ProfileCard, ProfileStat, RemapRow,
  SectionHeader, Segmented, SettingGroup, SettingRow, SettingValue, Toggle,
  type DropOption, type RemapRowState,
} from "../../kit";
import { Actions, CardGrid, Editor, EditorColumns, Note, fmtDpi, fmtHz, revealEditor } from "./shared";
import { ShortcutRecorder, type RecorderTarget } from "./ShortcutRecorder";

type Layer = "primary" | "g-shift";

/** Physical control names by assignment index (app/Profiles.tsx). */
const BUTTON_NAMES = ["Left click", "Right click", "Wheel click", "Back", "Forward", "DPI Shift", "DPI up", "DPI down"];

const LOD_SHORT: Record<LiftOffLevel, string> = { Low: "L", Medium: "M", High: "H" };

function stageText(stage: { x: number; y: number } | undefined): string {
  if (!stage) return "—";
  return stage.x === stage.y ? fmtDpi(stage.x) : `${fmtDpi(stage.x)} / ${fmtDpi(stage.y)}`;
}

/** The action menu of one assignment: a preserved custom entry, the
    firmware actions, the keyboard recorder and the media keys. */
function assignmentOptions(locale: InterfaceLocale, action: string, raw: readonly number[]): DropOption<string>[] {
  const options: DropOption<string>[] = [];
  if (action === "Custom") {
    options.push({
      value: "Custom",
      label: raw[0] === 0x80 && raw[1] === 0x02 ? t(locale, "prof.keyboardShortcut") : t(locale, "prof.customPreserved"),
    });
  }
  for (const a of LOGITECH_BUTTON_ACTIONS) options.push({ value: a, label: a });
  options.push(
    { value: "keyboard", label: t(locale, "prof.keyboardOpt") },
    { value: "consumer:233", label: t(locale, "prof.volUp") },
    { value: "consumer:234", label: t(locale, "prof.volDown") },
    { value: "consumer:226", label: t(locale, "prof.mute") },
    { value: "consumer:205", label: t(locale, "prof.playPause") },
    { value: "consumer:181", label: t(locale, "prof.nextTrack") },
    { value: "consumer:182", label: t(locale, "prof.prevTrack") },
  );
  return options;
}

function ProfileStats({ profile, shared }: { profile: OnboardProfile; shared: boolean }): ReactNode {
  const stages = profile.dpiStages;
  const start = stages[Math.min(profile.defaultDpiIndex ?? 0, Math.max(0, stages.length - 1))];
  return (
    <>
      <ProfileStat label="DPI" value={stageText(start)} />
      <ProfileStat label="DPI stages" value={stages.length ? String(stages.length) : "None"} />
      {shared ? (
        <ProfileStat label="Polling rate" value={fmtHz(profile.reportRateWired ?? profile.reportRateWireless)} />
      ) : (
        <>
          <ProfileStat label="Wireless rate" value={fmtHz(profile.reportRateWireless)} />
          <ProfileStat label="Wired rate" value={fmtHz(profile.reportRateWired)} />
        </>
      )}
      {profile.crcValid ? null : <ProfileStat label="Checksum" value="Mismatch" />}
    </>
  );
}

/** The opened profile's report rates (PollingCard's per-profile rows). */
function ProfileRates({ snapshot, entry }: { snapshot: ControlSnapshot; entry: OnboardProfile }): ReactNode {
  const status = snapshot.status;
  const locale = snapshot.preferences.locale;
  const format = snapshot.profileFormat;
  const rates = format ? capabilitiesForFormat(format.id).reportRates : null;
  const perProfile = rates !== null;
  const locked = format?.writable !== true;
  const shared = (format?.id ?? 6) < 6;
  // PollingCard: a locked format on a receiver keeps the live rate (Performance tab).
  const useProfileRateUi = perProfile && !(locked && status?.hidppDirectConnect === false);
  if (!useProfileRateUi || !rates) return null;
  const links = shared ? (["wired"] as const) : (["wireless", "wired"] as const);
  const note = shared
    ? tp(locale, "perf.sharedNote", { max: snapshot.profile.rateOptions.wired.at(-1) ?? "—" })
    : tp(locale, "perf.splitNote", {
      wireless: reportRatesFor(rates, "wireless").at(-1) ?? "—",
      wired: reportRatesFor(rates, "wired").at(-1) ?? "—",
    });
  return (
    <>
      {links.map((link, i) => {
        const options = snapshot.profile.rateOptions[link];
        if (!options.length) return null;
        const title = shared ? "Polling rate" : link === "wired" ? "Wired polling rate" : "Wireless polling rate";
        return (
          <Fragment key={link}>
            <SectionHeader title={title} description={i === 0 ? note : undefined} />
            <Segmented container="card" ariaLabel={shared ? t(locale, "perf.allConnections") : link === "wired" ? t(locale, "perf.wired") : t(locale, "perf.wireless")}
              options={options.map((hz) => ({ value: hz, label: String(hz) }))}
              value={snapshot.stagedProfileRates[link] ?? (link === "wired" ? entry.reportRateWired : entry.reportRateWireless)}
              disabled={locked || snapshot.settingInProgress}
              onChange={(hz) => control.setProfileReportRate(link, hz)} />
          </Fragment>
        );
      })}
    </>
  );
}

/** The opened profile's DPI slots (DpiCard's DpiSlots). */
function ProfileDpiSlots({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const locale = snapshot.preferences.locale;
  const limits = snapshot.profile.slotLimits;
  const plan = snapshot.dpiSlotPlan;
  const locked = snapshot.profile.slotsLocked;
  const levels = snapshot.profile.lodLevels as readonly LiftOffLevel[];
  const hasLod = levels.length > 0;
  if (!snapshot.profile.slotsAvailable || !limits || !plan) return null;
  return (
    <>
      <DpiStageTable count={plan.stages.length} maxCount={limits.maxStages} locked={locked}
        onCount={(n) => control.setDpiSlotCount(n)} showLiftOff={hasLod} showColor={false}>
        {plan.stages.map((stage, index) => (
          <DpiStageRow key={index} stage={index + 1} active={index === plan.defaultIndex} currentLabel="Default"
            x={stage.x} y={stage.y} linked={snapshot.dpiAxisLocks[index] ?? true} locked={locked}
            min={limits.minDpi} max={limits.maxDpi} step={limits.stepDpi}
            onLink={(linked) => control.setDpiAxisLock(index, linked)}
            onX={(v) => control.setDpiSlotAxis(index, "x", v)}
            onY={(v) => control.setDpiSlotAxis(index, "y", v)}
            onActivate={() => control.setDpiSlotDefault(index)}
            liftOff={hasLod ? (
              <Segmented ariaLabel={tp(locale, "dpi.slotLiftOff", { n: index + 1 })} disabled={locked}
                options={levels.map((level) => ({ value: level, label: LOD_SHORT[level] ?? level }))}
                value={stageLodLevel(stage.lod)} onChange={(level) => control.setDpiSlotLod(index, level)} />
            ) : undefined} />
        ))}
      </DpiStageTable>
      <Note>
        {locked
          ? t(locale, "dpi.slotReadonly")
          : tp(locale, "dpi.slotNote", { min: fmtDpi(limits.minDpi), max: fmtDpi(limits.maxDpi), step: limits.stepDpi })}
      </Note>
    </>
  );
}

/** Normal / G-Shift assignments of the opened profile (app/Profiles.tsx). */
function AssignmentGrid({ snapshot, profile, layer, onLayer, onRecord }: {
  snapshot: ControlSnapshot;
  profile: OnboardProfile;
  layer: Layer;
  onLayer: (layer: Layer) => void;
  onRecord: (target: RecorderTarget) => void;
}): ReactNode {
  const locale = snapshot.preferences.locale;
  const assignments = layer === "primary" ? profile.buttonAssignments : profile.gShiftAssignments;
  return (
    <>
      <ButtonRemapGrid title={t(locale, "prof.assign")} count={assignments.length}
        layers={[{ id: "primary", label: t(locale, "prof.normalTab") }, { id: "g-shift", label: "G-Shift" }]}
        activeLayer={layer} onLayer={(id) => onLayer(id as Layer)}>
        {assignments.map((assignment) => {
          const name = `G${assignment.button + 1} · ${BUTTON_NAMES[assignment.button] ?? `Button ${assignment.button + 1}`}`;
          const staged = snapshot.stagedProfileButtonAssignments.find(
            (entry) => entry.layer === layer && entry.button === assignment.button,
          );
          const primaryLocked = layer === "primary" && assignment.button <= 1;
          const state: RemapRowState = primaryLocked ? "disabled" : staged ? "changed" : "default";
          const raw = assignment.action === "Custom"
            ? `Unknown mapping: ${assignment.raw.map((byte) => byte.toString(16).padStart(2, "0")).join(" ")}`
            : undefined;
          return (
            <RemapRow key={`${layer}-${assignment.button}`} button={name} state={state}
              control={(
                <div className="mk-pf-fill" title={primaryLocked
                  ? "Primary click buttons cannot be remapped to prevent losing control of the mouse."
                  : raw}>
                  <Dropdown ariaLabel={`${name} action`} disabled={snapshot.settingInProgress || primaryLocked}
                    options={assignmentOptions(locale, assignment.action, assignment.raw)}
                    value={staged?.value ?? assignment.action}
                    onChange={(value) => {
                      if (value === "keyboard") {
                        onRecord({ layer, button: assignment.button, name });
                        return;
                      }
                      // A preserved custom record can't be re-encoded; picking it is a no-op.
                      if (value === "Custom") return;
                      if (value.startsWith("consumer:")) control.applyLogitechConsumerAssignment(layer, assignment.button, Number(value.slice(9)));
                      else void control.applyLogitechButtonAssignment(layer, assignment.button, value as LogitechButtonAction);
                    }} />
                </div>
              )} />
          );
        })}
      </ButtonRemapGrid>
      <Note>Changes are stored in this onboard profile. Existing custom macros are preserved byte-for-byte.</Note>
    </>
  );
}

export function LogitechProfiles({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const [recorder, setRecorder] = useState<RecorderTarget | null>(null);
  const [layer, setLayer] = useState<Layer>("primary");
  const editorRef = useRef<HTMLDivElement>(null);
  const status = snapshot.status;
  const locale = snapshot.preferences.locale;
  const profiles = snapshot.onboardProfiles;
  const hostOpened = snapshot.editedProfile === "host";
  const hostRunning = snapshot.deviceMode === "Host";
  const format = snapshot.profileFormat;
  const layoutVerified = format?.verified === true;
  const contentsWritable = format?.writable === true;
  const nameLimit = format ? capabilitiesForFormat(format.id).maxNameLength : null;
  const shared = (format?.id ?? 6) < 6;
  const openedProfile = typeof snapshot.editedProfile === "number"
    ? profiles?.find((profile) => profile.sector === snapshot.editedProfile) ?? null
    : null;
  const locked = !layoutVerified;

  // Opening the profile that's already open would drop its staged edits
  // (openOnboardProfile resets them), so that only scrolls to the editor.
  const open = (target: number | "host"): void => {
    if (snapshot.editedProfile !== target) control.openOnboardProfile(target);
    revealEditor(editorRef.current);
  };

  const headerActions = (
    <Actions>
      <Button label={t(locale, "prof.reload")} icon="reset" onClick={() => void control.reloadOnboardProfiles()} />
      {snapshot.resetProfilesAvailable ? (
        <Button label="Reset all profiles" icon="trash" variant="danger" disabled={snapshot.settingInProgress}
          ariaLabel={t(locale, "prof.deleteReset")} title={t(locale, "prof.restoreDefaults")}
          onClick={() => void control.resetLogitechProfiles()} />
      ) : null}
    </Actions>
  );

  if (profiles === null) {
    return (
      <Editor label="Onboard profiles">
        <SectionHeader title="Onboard profiles" description="The profiles stored on the mouse haven't been read yet." action={headerActions} />
        <Note live>{snapshot.onboardStatus}</Note>
      </Editor>
    );
  }

  const openedName = openedProfile
    ? snapshot.stagedProfileName || openedProfile.name || `Profile ${openedProfile.sector}`
    : null;

  return (
    <>
      <CardGrid count={profiles.length + 1} label="Onboard profiles">
        <ProfileCard name={t(locale, "prof.hostName")} slot="Live" state={hostRunning ? "active" : "default"}
          onActivate={hostRunning ? undefined : () => void control.applyOnboardMode("Host")}
          openLabel={hostOpened ? "Editing" : "Open"} onOpen={() => open("host")}>
          {hostRunning && status ? (
            <>
              <ProfileStat label="DPI" value={status.dpi > 0 ? fmtDpi(status.dpi) : "—"} />
              <ProfileStat label="Polling rate" value={fmtHz(status.pollingRateHz)} />
            </>
          ) : null}
          <ProfileStat label="Settings" value="Live from Hypertune" />
          <ProfileStat label="Stored on the mouse" value="No" />
        </ProfileCard>
        {profiles.map((profile) => {
          const opened = snapshot.editedProfile === profile.sector;
          const running = profile.isCurrent && !hostRunning;
          const renameDisabled = locked || nameLimit === null || !contentsWritable;
          const activateDisabled = locked || running || !profile.enabled;
          const name = (opened && snapshot.stagedProfileName) || profile.name || `Profile ${profile.sector}`;
          return (
            <ProfileCard key={profile.sector} name={name} slot={`#${profile.sector}`}
              state={running ? "active" : profile.enabled ? "default" : "factory"} factoryLabel="Disabled"
              onRename={renameDisabled ? undefined : () => control.renameOnboardProfile(profile.sector)}
              onActivate={activateDisabled ? undefined : () => void control.selectOnboardProfile(profile.sector)}
              openLabel={opened ? "Editing" : "Open"} onOpen={locked ? undefined : () => open(profile.sector)}>
              <ProfileStats profile={profile} shared={shared} />
            </ProfileCard>
          );
        })}
      </CardGrid>

      <Editor editorRef={editorRef} label="Profile editor">
        {openedProfile && openedName ? (
          <>
            <SectionHeader title={`Editing ${openedName}`}
              description={locked ? snapshot.onboardStatus || t(locale, "prof.layoutUnverified") : "Changes wait for Apply, then they're written to this profile on the mouse."}
              action={headerActions} />
            <EditorColumns
              main={(
                <>
                  <SettingGroup>
                    <SettingRow title="Name"
                      description={locked ? t(locale, "prof.layoutUnverified")
                        : nameLimit === null ? t(locale, "prof.noNameField")
                          : !contentsWritable ? t(locale, "prof.contentUnverified")
                            : `Stored on the mouse, up to ${nameLimit} characters.`}
                      controlWidth="hug"
                      control={(
                        <div className="mk-pf-inline">
                          <SettingValue>{openedName}</SettingValue>
                          <Button size="medium" icon="edit" label="Rename"
                            disabled={locked || nameLimit === null || !contentsWritable}
                            title={t(locale, "prof.renameProfile")} ariaLabel={`Rename profile ${openedProfile.sector}`}
                            onClick={() => control.renameOnboardProfile(openedProfile.sector)} />
                        </div>
                      )} />
                    <SettingRow title="Enabled" disabled={locked}
                      description={locked ? t(locale, "prof.layoutUnverified") : "A disabled profile can't be switched to."}
                      control={(
                        <Toggle ariaLabel={`Profile ${openedProfile.sector} enabled`}
                          value={openedProfile.enabled} disabled={locked}
                          onChange={(enabled) => void control.toggleOnboardProfileEnabled(openedProfile.sector, enabled)} />
                      )} />
                  </SettingGroup>
                  <ProfileRates snapshot={snapshot} entry={openedProfile} />
                  <ProfileDpiSlots snapshot={snapshot} />
                  <Note live>{locked ? null : snapshot.onboardStatus}</Note>
                </>
              )}
              side={contentsWritable
                ? <AssignmentGrid snapshot={snapshot} profile={openedProfile} layer={layer} onLayer={setLayer} onRecord={setRecorder} />
                : undefined} />
          </>
        ) : (
          <>
            <SectionHeader title={hostOpened ? "Host mode" : "Onboard profiles"} action={headerActions}
              description={hostOpened
                ? "Settings applied by Hypertune, not stored on the mouse. They're lost when it powers off."
                : "Open a profile to edit what's stored in it."} />
            {hostOpened ? (
              <EditorColumns main={(
                <SettingGroup>
                  <SettingRow title="Live settings" description="DPI and polling for host mode are on the Performance tab."
                    controlWidth="hug"
                    control={<Button size="medium" label="Open Performance" onClick={() => control.setWorkspaceTab("performance")} />} />
                </SettingGroup>
              )} />
            ) : null}
            <Note live>{snapshot.onboardStatus}</Note>
          </>
        )}
      </Editor>

      {recorder ? <ShortcutRecorder key={`${recorder.layer}-${recorder.button}`} target={recorder} locale={locale} onClose={() => setRecorder(null)} /> : null}
    </>
  );
}
