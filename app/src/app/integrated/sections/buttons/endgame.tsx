// Buttons tab — Endgame Gear OP1 extras, ported from AdvancedCards:
//   eggSpdt    → EggSpdtCard   (GX switch mode per primary button)
//   eggButtons → EggButtonCard (the per-button multiclick filter; the mapping half is EggRemap)
import type { ReactNode } from "react";
import {
  EGG_BUTTON_NAMES,
  type EggButtonIndex,
  type EggSpdtMode,
} from "@openmouse/protocol/drivers/endgame/egg-op1-hid";
import * as control from "../../../../device/controller";
import type { ControlSnapshot } from "../../../../device/types";
import { Dropdown, NumberField, SectionHeader, SettingGroup, SettingRow, type DropOption } from "../../kit";

type Props = { snapshot: ControlSnapshot };

const GX_MODES: DropOption<EggSpdtMode>[] = (["Off", "GX Safe", "GX Speed"] as const).map((mode) => ({ value: mode, label: mode }));

export function EggGxMode({ snapshot }: Props): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  return (
    <div className="mk-btn-group">
      <SectionHeader title="GX switch mode" description="Reads both switch contacts, so clicks register without a debounce delay." />
      <SettingGroup>
        {(["left", "right"] as const).map((side) => {
          const title = side === "left" ? "Left button" : "Right button";
          return (
            <SettingRow key={side} title={title}
              control={(
                <Dropdown ariaLabel={`${title} GX mode`} options={GX_MODES}
                  value={(side === "left" ? status.leftSpdtMode : status.rightSpdtMode) ?? "Off"}
                  onChange={(mode) => control.applyEggSpdtMode(side, mode)} />
              )} />
          );
        })}
      </SettingGroup>
    </div>
  );
}

/**
 * Multiclick filter, 0–25 per button. The primary buttons can't change it
 * while their GX mode is on (the driver refuses), so those rows are Disabled
 * with the reason. Buttons the driver reports no filter for are left out.
 */
export function EggMulticlick({ snapshot }: Props): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const filters = status.eggMulticlickFilters;
  if (!filters || !status.eggButtonMappings) return null;
  const rows = EGG_BUTTON_NAMES
    .map((name, index) => ({ name, index: index as EggButtonIndex, value: filters[index] }))
    .filter((row): row is { name: typeof row.name; index: EggButtonIndex; value: number } => typeof row.value === "number");
  if (rows.length === 0) return null;
  return (
    <div className="mk-btn-group">
      <SectionHeader title="Multiclick filter" description="Ignores extra clicks that land too soon after a press (0–25)." />
      <SettingGroup>
        {rows.map((row) => {
          const gxActive = row.index === 0
            ? status.leftSpdtMode !== "Off"
            : row.index === 1 ? status.rightSpdtMode !== "Off" : false;
          return (
            <SettingRow key={row.name} title={row.name} disabled={gxActive}
              description={gxActive ? "Turn GX mode off for this button to change it." : undefined}
              control={(
                <NumberField ariaLabel={`${row.name} multiclick filter`} value={row.value} min={0} max={25} step={1}
                  grouping={false} disabled={gxActive}
                  onApply={(next) => control.applyEggMulticlick(row.index, next)} />
              )} />
          );
        })}
      </SettingGroup>
    </div>
  );
}
