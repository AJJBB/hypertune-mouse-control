// Keychron Nape Pro onboard layers (flag `keychronNapeLayers`) — the logic of
// app/KeychronNapeLayers.tsx (open a layer to inspect it, switch the mouse to
// a layer, reload, and the per-layer orientation / six keys / wheel CW·CCW
// assignments, all staged through the pending bar), as layer cards plus a
// Button remap grid for the layer that's open.
import { useRef, type ReactNode } from "react";
import {
  KEYCHRON_NAPE_BUTTON_ACTIONS,
  KEYCHRON_NAPE_ORIENTATION_OPTIONS,
  keychronLayerDisplayIndex,
  keychronLayerLabel,
  type KeychronNapeButtonAction,
} from "@openmouse/protocol/keychron";
import * as control from "../../../../device/controller";
import type { ControlSnapshot, NapeAssignmentControl, StagedNapeAssignment } from "../../../../device/types";
import { layerLabel, t, tp } from "../../../../i18n";
import type { InterfaceLocale } from "../../../../interface-preferences";
import { Button, ButtonRemapGrid, Dropdown, ProfileCard, ProfileStat, RemapRow, SectionHeader, type DropOption } from "../../kit";
import { CardGrid, Editor, EditorColumns, Note, revealEditor } from "./shared";

/** Physical order of the six keys (app/KeychronNapeLayers.tsx KEY_ROWS). */
const KEY_ROWS = [
  { col: 2, name: "01" },
  { col: 3, name: "02" },
  { col: 0, name: "03" },
  { col: 1, name: "04" },
  { col: 4, name: "M1" },
  { col: 5, name: "M2" },
] as const;

function stagedFor(
  staged: readonly StagedNapeAssignment[],
  layer: number,
  target: NapeAssignmentControl,
): StagedNapeAssignment | undefined {
  return staged.find((entry) => {
    if (entry.layer !== layer) return false;
    if (entry.control.kind === "orientation" && target.kind === "orientation") return true;
    if (entry.control.kind === "key" && target.kind === "key") return entry.control.col === target.col;
    if (entry.control.kind === "wheel" && target.kind === "wheel") return entry.control.clockwise === target.clockwise;
    return false;
  });
}

function actionOptions(locale: InterfaceLocale, value: string): DropOption<string>[] {
  const options: DropOption<string>[] = value === "Custom" ? [{ value: "Custom", label: t(locale, "prof.customPreserved") }] : [];
  for (const action of KEYCHRON_NAPE_BUTTON_ACTIONS) options.push({ value: action, label: action });
  return options;
}

function AssignmentRow({ name, layer, target, action, keycode, staged, busy, locale }: {
  name: string;
  layer: number;
  target: NapeAssignmentControl;
  action: string;
  keycode: number;
  staged: StagedNapeAssignment | undefined;
  busy: boolean;
  locale: InterfaceLocale;
}): ReactNode {
  const value = staged?.action ?? action;
  return (
    <RemapRow button={name} state={staged ? "changed" : "default"}
      control={(
        <div className="mk-pf-fill" title={action === "Custom" ? `Unknown mapping: 0x${keycode.toString(16).padStart(4, "0")}` : undefined}>
          <Dropdown ariaLabel={`${name} action`} disabled={busy} options={actionOptions(locale, value)} value={value}
            onChange={(next) => {
              if (next === "Custom") return;
              control.applyNapeAssignment(layer, target, next as KeychronNapeButtonAction);
            }} />
        </div>
      )} />
  );
}

function NapeAssignments({ snapshot, layer }: { snapshot: ControlSnapshot; layer: number }): ReactNode {
  const locale = snapshot.preferences.locale;
  const map = snapshot.napeKeymap;
  const busy = snapshot.settingInProgress;
  const ready = map != null && map.layer === layer;
  if (!ready || !map) {
    return <Note live>{tp(locale, "key.reading", { label: layerLabel(locale, keychronLayerLabel(layer)) })}</Note>;
  }
  const orientationTarget: NapeAssignmentControl = { kind: "orientation" };
  const stagedOrientation = stagedFor(snapshot.stagedNapeAssignments, layer, orientationTarget);
  const keys = KEY_ROWS.map((row) => ({ row, key: map.keys.find((entry) => entry.col === row.col) }))
    .filter((entry) => entry.key !== undefined);
  const wheel = [
    { clockwise: false, name: "Scroll wheel counter-clockwise", current: map.wheel.ccw },
    { clockwise: true, name: "Scroll wheel clockwise", current: map.wheel.cw },
  ] as const;
  return (
    <>
      <ButtonRemapGrid title={t(locale, "prof.assign")} count={1 + keys.length + wheel.length}>
        <RemapRow button="Orientation" state={stagedOrientation ? "changed" : "default"}
          control={(
            <Dropdown ariaLabel="Sensor orientation" disabled={busy}
              options={KEYCHRON_NAPE_ORIENTATION_OPTIONS.map((option) => ({ value: option.index, label: option.label }))}
              value={stagedOrientation?.keycode ?? map.orientationIndex}
              onChange={(index) => control.applyNapeOrientation(layer, index)} />
          )} />
        {keys.map(({ row, key }) => {
          const target: NapeAssignmentControl = { kind: "key", col: row.col };
          return (
            <AssignmentRow key={row.col} name={`Button ${row.name}`} layer={layer} target={target}
              action={key!.action} keycode={key!.keycode} busy={busy} locale={locale}
              staged={stagedFor(snapshot.stagedNapeAssignments, layer, target)} />
          );
        })}
        {wheel.map((row) => {
          const target: NapeAssignmentControl = { kind: "wheel", clockwise: row.clockwise };
          return (
            <AssignmentRow key={row.name} name={row.name} layer={layer} target={target}
              action={row.current.action} keycode={row.current.keycode} busy={busy} locale={locale}
              staged={stagedFor(snapshot.stagedNapeAssignments, layer, target)} />
          );
        })}
      </ButtonRemapGrid>
      <Note>{t(locale, "key.layerNote")}</Note>
    </>
  );
}

export function NapeLayers({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const editorRef = useRef<HTMLDivElement>(null);
  const status = snapshot.status;
  const count = status?.napeLayerCount;
  if (status == null || count == null || count < 1) return null;
  const locale = snapshot.preferences.locale;
  const activeLayer = status.napeLayer ?? 1;
  const editedLayer = snapshot.editedNapeLayer ?? activeLayer;
  const busy = snapshot.settingInProgress;
  const map = snapshot.napeKeymap;
  const label = (layer: number): string => layerLabel(locale, keychronLayerLabel(layer));

  return (
    <>
      <CardGrid count={count} label="Onboard layers">
        {Array.from({ length: count }, (_, index) => {
          const layer = index + 1;
          const opened = editedLayer === layer;
          const running = activeLayer === layer;
          const orientation = opened && map?.layer === layer
            ? KEYCHRON_NAPE_ORIENTATION_OPTIONS.find((option) => option.index === map.orientationIndex)?.label
            : undefined;
          return (
            <ProfileCard key={layer} name={label(layer)} slot={`#${keychronLayerDisplayIndex(layer)}`}
              state={running ? "active" : "default"}
              onActivate={running ? undefined : () => void control.switchNapeLayer(layer)}
              openLabel={opened ? "Editing" : "Open"}
              onOpen={() => {
                if (!opened) control.openNapeLayer(layer);
                revealEditor(editorRef.current);
              }}>
              <ProfileStat label="Status" value={running ? t(locale, "key.currentLayer") : t(locale, "key.storedLayer")} />
              {orientation ? <ProfileStat label="Orientation" value={orientation} /> : null}
            </ProfileCard>
          );
        })}
      </CardGrid>

      <Editor editorRef={editorRef} label="Layer editor">
        <SectionHeader title={`Editing ${label(editedLayer)}`}
          description={t(locale, "key.assignBody")}
          action={<Button label={t(locale, "key.reload")} icon="reset" disabled={busy} onClick={() => void control.reloadNapeLayers()} />} />
        <EditorColumns main={(
          <>
            <NapeAssignments snapshot={snapshot} layer={editedLayer} />
            <Note live>{snapshot.onboardStatus}</Note>
          </>
        )} />
      </Editor>
    </>
  );
}
