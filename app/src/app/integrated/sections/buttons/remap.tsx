// Buttons tab — the remap lists (Figma "Buttons (list)" + library Button remap grid / Remap row).
// One list per driver family, each a straight port of its v1 card's logic:
//   buttonMapping   → AdvancedCards ButtonMappingCard (+ the Teevolution profile card's copy of it)
//   razerButtons    → AdvancedCards RazerButtonCard
//   mxMasterButtons → MxMasterCards MxMasterButtonsCard
//   atkButtons      → AtkCards AtkButtonCard (read-only)
//   eggButtons      → AdvancedCards EggButtonCard (the mapping half; multiclick is in endgame.tsx)
// Every change goes through the same control.* call as before, so it stages in the pending bar.
import type { ReactNode } from "react";
import {
  EGG_BUTTON_MAPPINGS,
  EGG_BUTTON_NAMES,
  type EggButtonIndex,
  type EggButtonMapping,
} from "@openmouse/protocol/drivers/endgame/egg-op1-hid";
import {
  RAZER_BUTTON_CONTROLS,
  RAZER_BUTTON_CONTROL_LABEL,
  RAZER_BUTTON_MAPPINGS,
  RAZER_LOCKED_BUTTON_CONTROL,
  RAZER_TOGGLE_CONTROLS,
  RAZER_TOGGLE_CONTROL_INFO,
  type RazerButtonMapping,
} from "@openmouse/protocol/razer";
import * as control from "../../../../device/controller";
import type { ControlSnapshot } from "../../../../device/types";
import { Button, ButtonRemapGrid, Dropdown, RemapRow, SettingRow, type DropOption, type RemapRowState } from "../../kit";
import { actionOptions, GroupNote, lockedOption, RemapValue } from "./shared";

type Props = { snapshot: ControlSnapshot };

/** Drivers whose option list carries this restore the button's factory function with it
    (Keychron, MCHOSE, SteelSeries…) — that is what makes their list resettable. */
const DEFAULT_ACTION = "Default";

const nothingToReset = (): void => control.pushToast("info", "Buttons are already at their defaults");

/** "A", "A and B", "A, B and C". */
const listNames = (names: string[]): string =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/* ───────────── buttonMapping: the brand-agnostic name → action map ───────────── */

export function GenericRemap({ snapshot }: Props): ReactNode {
  const status = snapshot.status;
  if (!status?.buttonMappings || !status.buttonOptions?.length) return null;
  const options = status.buttonOptions;
  // fixedButtons: buttons the device reported in an encoding it can't rewrite.
  const fixed = new Set((status as unknown as { fixedButtons?: readonly string[] }).fixedButtons ?? []);
  // On Teevolution this list edits the active onboard bank; its v1 home (the
  // profile card) also locks the selects while a write is in flight.
  const teevolution = snapshot.traits.teevolution;
  const busy = teevolution && snapshot.settingInProgress;
  const resettable = options.includes(DEFAULT_ACTION);
  const entries = Object.entries(status.buttonMappings);
  // Some drivers (Keychron) read a factory-fresh button back as its real action
  // ("Left Click"), never as "Default" — they publish that factory action in
  // buttonDefaults, so "changed" means it differs from both.
  const defaults = status.buttonDefaults ?? {};
  const isChanged = (button: string, assigned: string): boolean =>
    resettable && !fixed.has(button) && assigned !== DEFAULT_ACTION && assigned !== defaults[button];
  const changed = entries.filter(([button, assigned]) => isChanged(button, assigned));
  const resetAll = (): void => {
    if (changed.length === 0) { nothingToReset(); return; }
    for (const [button] of changed) control.applyDeviceButtonMapping(button, DEFAULT_ACTION);
  };
  const activeProfile = teevolution && status.activeProfile != null
    ? status.profileNames?.[status.activeProfile - 1] ?? `Profile ${status.activeProfile}`
    : null;
  return (
    <div className="mk-btn-group">
      <ButtonRemapGrid count={entries.length} onReset={resettable ? resetAll : undefined}>
        {entries.map(([button, assigned]) => {
          const locked = fixed.has(button);
          const state: RemapRowState = locked ? "disabled" : isChanged(button, assigned) ? "changed" : "default";
          return (
            <RemapRow key={button} button={button} state={state} defaultAction={defaults[button]}
              onReset={() => control.applyDeviceButtonMapping(button, DEFAULT_ACTION)}
              control={(
                <Dropdown ariaLabel={`${button} action`} value={assigned} disabled={locked || busy}
                  options={locked ? lockedOption(assigned) : actionOptions(options, assigned)}
                  onChange={(next) => control.applyDeviceButtonMapping(button, next)} />
              )} />
          );
        })}
      </ButtonRemapGrid>
      {activeProfile ? <GroupNote>Saved to the active onboard profile ({activeProfile}).</GroupNote> : null}
      {resettable ? <GroupNote>“Default” restores a button’s factory function.</GroupNote> : null}
    </div>
  );
}

/* ───────────── razerButtons ───────────── */

interface RazerRow {
  key: string;
  name: string;
  current: string;
  options: readonly string[];
  /** Factory action: a button's own label, a toggle control's enabled label. */
  factory: string;
  locked: boolean;
  apply: (value: string) => void;
}

/**
 * Two kinds of Razer control share the list (see RazerButtonCard): the four
 * buttons are cross-assignable to each other's action or Disabled; the toggle
 * controls only switch between their own factory action and Disabled. Left
 * Click is fixed on the Standard layer (the driver throws rather than send it).
 */
export function RazerRemap({ snapshot }: Props): ReactNode {
  const mappings = snapshot.status?.razerButtonMappings;
  if (!mappings) return null;
  const busy = snapshot.settingInProgress;
  const rows: RazerRow[] = [];
  for (const con of RAZER_BUTTON_CONTROLS) {
    const current = mappings[con];
    if (!current) continue;
    rows.push({
      key: `razer-button-${con}`,
      name: RAZER_BUTTON_CONTROL_LABEL[con],
      current,
      options: RAZER_BUTTON_MAPPINGS,
      factory: RAZER_BUTTON_CONTROL_LABEL[con],
      locked: con === RAZER_LOCKED_BUTTON_CONTROL,
      apply: (value) => control.applyRazerButtonMapping(con, value as RazerButtonMapping),
    });
  }
  for (const con of RAZER_TOGGLE_CONTROLS) {
    const current = mappings[con];
    if (!current) continue;
    const info = RAZER_TOGGLE_CONTROL_INFO[con];
    rows.push({
      key: `razer-toggle-${con}`,
      name: info.label,
      current,
      options: [info.enabledLabel, "Disabled"],
      factory: info.enabledLabel,
      locked: false,
      apply: (value) => control.applyRazerToggleControl(con, value),
    });
  }
  if (rows.length === 0) return null;
  const changed = rows.filter((row) => !row.locked && row.current !== row.factory);
  const lockedName = rows.find((row) => row.locked)?.name;
  return (
    <div className="mk-btn-group">
      <ButtonRemapGrid count={rows.length}
        onReset={() => { if (changed.length === 0) nothingToReset(); else for (const row of changed) row.apply(row.factory); }}>
        {rows.map((row) => {
          const isChanged = !row.locked && row.current !== row.factory;
          return (
            <RemapRow key={row.key} button={row.name}
              state={row.locked ? "disabled" : isChanged ? "changed" : "default"}
              defaultAction={row.factory} onReset={() => row.apply(row.factory)}
              control={(
                <Dropdown ariaLabel={`${row.name} action`} value={row.current} disabled={row.locked || busy}
                  options={row.locked ? lockedOption(row.current) : actionOptions(row.options, row.current)}
                  onChange={row.apply} />
              )} />
          );
        })}
      </ButtonRemapGrid>
      {lockedName ? <GroupNote>{lockedName} is fixed on the Standard layer and can’t be reassigned or disabled.</GroupNote> : null}
    </div>
  );
}

/* ───────────── mxMasterButtons (Logitech reprogrammable controls) ───────────── */

/**
 * Only controls the device reports as reprogrammable get a dropdown, with the
 * targets from its own group mask; the primary clicks report an empty mask, so
 * they're listed locked. Virtual controls are left out. A control's factory
 * mapping is itself, so "changed" = pointing anywhere else (when it may point
 * back at itself). Restoring diverted buttons is immediate, as in v1.
 */
export function MxRemap({ snapshot }: Props): ReactNode {
  const all = snapshot.buttons;
  if (!all || all.length === 0) return null;
  const controls = all.filter((button) => !button.virtual);
  if (controls.length === 0) return null;
  const diverted = controls.filter((button) => button.diverted);
  const firmwareLocked = controls.filter((button) => !button.reprogrammable);
  const busy = snapshot.settingInProgress;
  const nameOf = (controlId: number): string =>
    all.find((candidate) => candidate.controlId === controlId)?.name
    ?? `Control 0x${controlId.toString(16).padStart(4, "0").toUpperCase()}`;
  const rows = controls.map((button) => {
    const canRemap = button.reprogrammable && button.remappableTo.length > 0;
    const current = snapshot.stagedButtonMappings[button.controlId] ?? button.mappedTo;
    const resettable = canRemap && button.remappableTo.includes(button.controlId);
    return { button, canRemap, current, changed: resettable && current !== button.controlId };
  });
  const changed = rows.filter((row) => row.changed);
  // A diversion is state another app (Logi Options+) left in the mouse: the button is dead until cleared.
  const divertedText = diverted.length === 1
    ? `${diverted[0]!.name} does nothing until you restore it.`
    : `${listNames(diverted.map((button) => button.name))} do nothing until you restore them.`;
  return (
    <div className="mk-btn-group">
      <ButtonRemapGrid count={controls.length}
        onReset={() => {
          if (changed.length === 0) nothingToReset();
          else for (const row of changed) control.applyButtonMapping(row.button.controlId, row.button.controlId);
        }}>
        {diverted.length > 0 ? (
          <SettingRow title="Taken over by another app" description={divertedText} controlWidth="hug"
            control={(
              <Button size="medium" icon="reset" label="Restore hardware control" disabled={busy}
                onClick={() => void control.restoreDivertedButtons()} />
            )} />
        ) : null}
        {rows.map(({ button, canRemap, current, changed: isChanged }) => {
          if (!canRemap) {
            return (
              <RemapRow key={button.controlId} button={button.name} state="disabled"
                control={<Dropdown ariaLabel={`${button.name} action`} value={button.taskName} disabled
                  options={lockedOption(button.taskName)} onChange={() => undefined} />} />
            );
          }
          const options: DropOption<number>[] = button.remappableTo.map((target) => ({ value: target, label: nameOf(target) }));
          // A mapping outside the legal targets still shows rather than reading as the first target.
          if (!button.remappableTo.includes(current)) options.unshift({ value: current, label: nameOf(current), disabled: true });
          return (
            <RemapRow key={button.controlId} button={button.name} state={isChanged ? "changed" : "default"}
              defaultAction={button.name}
              onReset={() => control.applyButtonMapping(button.controlId, button.controlId)}
              control={(
                <Dropdown ariaLabel={`${button.name} action`} value={current} disabled={busy} options={options}
                  onChange={(target) => control.applyButtonMapping(button.controlId, target)} />
              )} />
          );
        })}
      </ButtonRemapGrid>
      {firmwareLocked.length > 0 ? (
        <GroupNote>
          {listNames(firmwareLocked.map((button) => button.name))}
          {firmwareLocked.length === 1 ? " is" : " are"} locked by the mouse’s firmware and can’t be remapped.
        </GroupNote>
      ) : null}
    </div>
  );
}

/* ───────────── atkButtons (read-only) ───────────── */

/** ATK assignments are read from the active bank; writes aren't validated yet, so the rows are values. */
export function AtkAssignments({ snapshot }: Props): ReactNode {
  const mappings = snapshot.status?.atkButtonMappings;
  if (!mappings?.length) return null;
  return (
    <div className="mk-btn-group">
      <ButtonRemapGrid title="Onboard assignments" count={mappings.length}>
        {mappings.map((mapping) => (
          <RemapRow key={mapping.id} button={mapping.name}
            control={(
              <RemapValue title={`EEPROM 0x${mapping.address.toString(16).padStart(4, "0")} · ${mapping.raw}`}>
                {mapping.checksumValid ? mapping.action : `Invalid checksum · ${mapping.raw}`}
              </RemapValue>
            )} />
        ))}
      </ButtonRemapGrid>
      <GroupNote>Read from the active bank. Changing assignments, shortcuts and macros stays locked until it’s verified safe.</GroupNote>
    </div>
  );
}

/* ───────────── eggButtons — mapping ───────────── */

export function EggRemap({ snapshot }: Props): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const filters = status.eggMulticlickFilters;
  const mappings = status.eggButtonMappings;
  if (!filters || !mappings) return null;
  const rows = EGG_BUTTON_NAMES
    .map((name, index) => ({ name, index: index as EggButtonIndex, current: mappings[index] }))
    .filter((row): row is { name: typeof row.name; index: EggButtonIndex; current: string } => row.current !== undefined);
  if (rows.length === 0) return null;
  return (
    <div className="mk-btn-group">
      <ButtonRemapGrid count={rows.length}>
        {rows.map((row) => (
          <RemapRow key={row.name} button={row.name}
            control={(
              <Dropdown ariaLabel={`${row.name} action`} value={row.current}
                options={actionOptions(EGG_BUTTON_MAPPINGS, row.current)}
                onChange={(next) => control.applyEggButtonMapping(row.index, next as EggButtonMapping)} />
            )} />
        ))}
      </ButtonRemapGrid>
    </div>
  );
}
