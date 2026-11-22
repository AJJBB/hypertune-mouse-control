// Switch-only onboard banks:
//  - `onboardProfiles` — numbered profiles any driver exposes through
//    profileCount / activeProfile (AdvancedCards OnboardProfileCard), and the
//    Teevolution Terra Pro variant (cards/teevolution/ProfileCard), which adds
//    the active bank's button map;
//  - `atkProfile` — ATK / VXE R1 configuration banks (cards/AtkCards AtkProfileCard).
// Same control.* calls and gating as those cards, presented as Profile cards.
import { useRef, type ReactNode } from "react";
import * as control from "../../../../device/controller";
import type { ControlSnapshot } from "../../../../device/types";
import { t, tp } from "../../../../i18n";
import type { InterfaceLocale } from "../../../../interface-preferences";
import { ButtonRemapGrid, Dropdown, ProfileCard, ProfileStat, RemapRow, SectionHeader, type DropOption } from "../../kit";
import { CardGrid, Editor, EditorColumns, Note, fmtDpi, fmtHz, revealEditor } from "./shared";

function profileLabel(locale: InterfaceLocale, names: readonly string[] | undefined, index: number): string {
  return names?.[index] ?? tp(locale, "adv.profileOpt", { n: index + 1 });
}

/** Live figures for the bank the mouse is running; the others only say where they live. */
function RunningStats({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const stages = status.dpiStages ?? [];
  return (
    <>
      {status.dpi > 0 ? <ProfileStat label="DPI" value={fmtDpi(status.dpi)} /> : null}
      {stages.length > 0 ? <ProfileStat label="DPI stages" value={String(stages.length)} /> : null}
      {status.pollingRateHz ? <ProfileStat label="Polling rate" value={fmtHz(status.pollingRateHz)} /> : null}
    </>
  );
}

/** The Terra Pro's button map for the active bank (TeevolutionProfileCard). */
function BankButtonMap({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  const locale = snapshot.preferences.locale;
  const mappings = status?.buttonMappings;
  const options = status?.buttonOptions ?? [];
  if (!status || !mappings || options.length === 0) return null;
  const fixed = new Set((status as unknown as { fixedButtons?: readonly string[] }).fixedButtons ?? []);
  const busy = snapshot.settingInProgress;
  const entries = Object.entries(mappings);
  return (
    <ButtonRemapGrid title={t(locale, "prof.assign")} count={entries.length}>
      {entries.map(([button, assigned]) => {
        const known = options.includes(assigned);
        // A macro or an assignment this build can't name still shows.
        const menu: DropOption<string>[] = [
          ...(known ? [] : [{ value: "", label: assigned }]),
          ...options.map((option) => ({ value: option, label: option })),
        ];
        const locked = fixed.has(button);
        const changed = snapshot.pending.keys.includes(`button-${button}`);
        return (
          <RemapRow key={button} button={button} state={locked ? "disabled" : changed ? "changed" : "default"}
            control={(
              <Dropdown ariaLabel={`${button} action`} options={menu} value={known ? assigned : ""}
                disabled={locked || busy}
                onChange={(next) => { if (next !== "") control.applyDeviceButtonMapping(button, next); }} />
            )} />
        );
      })}
    </ButtonRemapGrid>
  );
}

/** Numbered onboard profiles (generic) — with the Terra Pro's button map when `buttons`. */
export function OnboardBanks({ snapshot, buttons }: { snapshot: ControlSnapshot; buttons: boolean }): ReactNode {
  const editorRef = useRef<HTMLDivElement>(null);
  const status = snapshot.status;
  if (!status || !status.profileCount || status.activeProfile == null) return null;
  const locale = snapshot.preferences.locale;
  const active = status.activeProfile;
  const count = status.profileCount;
  const names = status.profileNames;
  // The Terra Pro's map belongs to the bank it's running.
  const hasMap = buttons && !!status.buttonMappings && (status.buttonOptions?.length ?? 0) > 0;
  return (
    <>
      <CardGrid count={count} label={t(locale, "prof.onboardTitle")}>
        {Array.from({ length: count }, (_, index) => {
          const value = index + 1;
          const running = value === active;
          return (
            <ProfileCard key={value} name={profileLabel(locale, names, index)} slot={`#${value}`}
              state={running ? "active" : "default"}
              onActivate={running ? undefined : () => {
                // The Terra Pro card disables switching while a write is running.
                if (buttons && snapshot.settingInProgress) return;
                control.applyProfileSelection(value);
              }}
              onOpen={running && hasMap ? () => revealEditor(editorRef.current) : undefined}>
              {running ? <RunningStats snapshot={snapshot} /> : <ProfileStat label="Status" value="Stored on the mouse" />}
            </ProfileCard>
          );
        })}
      </CardGrid>
      <Editor editorRef={editorRef} label={t(locale, "prof.onboardTitle")}>
        {hasMap ? (
          <SectionHeader title={`Editing ${profileLabel(locale, names, active - 1)}`}
            description="Buttons are remapped on the profile the mouse is running." />
        ) : null}
        <EditorColumns main={(
          <>
            {hasMap ? <BankButtonMap snapshot={snapshot} /> : null}
            <Note>{t(locale, "prof.profileStores")}</Note>
          </>
        )} />
      </Editor>
    </>
  );
}

/** ATK / VXE R1 configuration banks: switch-only, written straight away. */
export function AtkBanks({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status || status.activeProfile === null || status.atkProfileCount === undefined) return null;
  const active = status.activeProfile;
  const count = status.atkProfileCount;
  return (
    <>
      <CardGrid count={count} label="Configuration banks">
        {Array.from({ length: count }, (_, index) => {
          const bank = index + 1;
          const running = bank === active;
          return (
            <ProfileCard key={bank} name={`Bank ${bank}`} slot={`#${bank}`} state={running ? "active" : "default"}
              onActivate={running ? undefined : () => {
                // AtkProfileCard disables the switch while a write is running.
                if (!snapshot.settingInProgress) void control.selectAtkR1Profile(bank);
              }}>
              {running ? <RunningStats snapshot={snapshot} /> : <ProfileStat label="Status" value="Stored on the mouse" />}
            </ProfileCard>
          );
        })}
      </CardGrid>
      <Editor label="Configuration banks">
        <Note>{`Bank ${active} of ${count} is active. Switching changes the active firmware-managed bank and requires readback from the mouse.`}</Note>
      </Editor>
    </>
  );
}
