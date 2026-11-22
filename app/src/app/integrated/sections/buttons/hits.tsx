// Buttons tab — Logitech HITS (hall-effect) button tuning, ported from app/Superstrike.tsx.
// Step pickers edit the controller's local tuning draft (setAnalogTuningValue, as in v1);
// the group's Apply button stages it in the pending bar (applyLogitechAnalogButton[s]).
import type { ReactNode } from "react";
import * as control from "../../../../device/controller";
import type { AnalogTuning, ControlSnapshot } from "../../../../device/types";
import { Button, SectionHeader, Segmented, SettingGroup, SettingRow, StepPicker } from "../../kit";

type Props = { snapshot: ControlSnapshot };
type Group = "left" | "right" | "both";
type Limits = { maxActuation: number; maxRapidTrigger: number; maxHaptics: number };

function TuningGroup({ group, title, description, applyLabel, onApply, tuning, limits }: {
  group: Group;
  title: string;
  description?: string;
  applyLabel: string;
  onApply: () => void;
  tuning: AnalogTuning;
  limits: Limits;
}): ReactNode {
  const rows: Array<{ setting: keyof AnalogTuning; title: string; description: string; min: number; max: number }> = [
    { setting: "actuation", title: "Actuation point", description: `Where the click triggers: 1 short, ${limits.maxActuation} long.`, min: 1, max: limits.maxActuation },
    { setting: "rapidTrigger", title: "Rapid trigger", description: `How fast it resets: 1 fast, ${limits.maxRapidTrigger} slow.`, min: 1, max: limits.maxRapidTrigger },
    { setting: "haptics", title: "Click haptics", description: `How strong each click feels: 0 off, ${limits.maxHaptics} max.`, min: 0, max: limits.maxHaptics },
  ];
  return (
    <div className="mk-btn-group">
      <SectionHeader title={title} description={description} level={4}
        action={<Button label={applyLabel} icon="check" onClick={onApply} />} />
      <SettingGroup>
        {rows.map((row) => (
          <SettingRow key={row.setting} title={row.title} description={row.description}
            control={(
              <StepPicker ariaLabel={`${title}: ${row.title.toLowerCase()}`} count={row.max - row.min + 1} start={row.min}
                value={tuning[row.setting]}
                onChange={(next) => control.setAnalogTuningValue(group, row.setting, next)} />
            )} />
        ))}
      </SettingGroup>
    </div>
  );
}

export function HitsTuning({ snapshot }: Props): ReactNode {
  const tuning = snapshot.traits.logitech ? snapshot.status?.analogButtonTuning : undefined;
  if (!tuning || tuning.buttons.length !== 2) return null;
  const state = snapshot.analogTuning;
  return (
    <>
      <div className="mk-btn-group">
        <SectionHeader title="HITS tuning" description="Set how the hall-effect main buttons click, reset and feel." />
        <Segmented container="card" ariaLabel="HITS tuning mode" value={state.mode}
          options={[{ value: "both", label: "Both buttons" }, { value: "independent", label: "Independent" }]}
          onChange={(mode) => control.setAnalogTuningMode(mode)} />
      </div>
      {state.mode === "both" ? (
        <TuningGroup group="both" title="Both primary buttons" description="Apply the same values to the left and right buttons."
          applyLabel="Apply to both" onApply={control.applyLogitechAnalogButtons} tuning={state.both} limits={tuning} />
      ) : (
        <>
          <TuningGroup group="left" title="Left button" applyLabel="Apply left"
            onApply={() => control.applyLogitechAnalogButton(0)} tuning={state.left} limits={tuning} />
          <TuningGroup group="right" title="Right button" applyLabel="Apply right"
            onApply={() => control.applyLogitechAnalogButton(1)} tuning={state.right} limits={tuning} />
        </>
      )}
    </>
  );
}
