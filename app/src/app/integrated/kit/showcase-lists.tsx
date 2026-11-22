// Dev gallery for the lists group — every component in every variant/state, in the same
// order as the Figma component sets. ?app=1&kit=lists
import { useState, type CSSProperties, type ReactNode } from "react";
import { Dropdown, Segmented, type DropOption } from "./controls";
import {
  ButtonRemapGrid, CalloutLabel, DpiStageRow, DpiStageTable, ProfileCard, ProfileList, ProfileRow, ProfileStat, RemapRow,
  type RemapRowState,
} from "./lists";

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 className="mk-t-caption12m mk-c-tertiary" style={{ margin: 0, textTransform: "uppercase" }}>{title}</h2>
      {children}
    </section>
  );
}
const col = (gap: number, width?: number): CSSProperties => ({ display: "flex", flexDirection: "column", gap, width });
const row = (gap: number): CSSProperties => ({ display: "flex", alignItems: "flex-start", gap });

const ACTIONS = [
  "Left click", "Right click", "Middle click", "Back", "Forward", "Gesture button", "SmartShift toggle",
  "Ctrl + Z", "DPI up", "DPI down", "Not assigned",
];
const ACTION_OPTS: DropOption<string>[] = ACTIONS.map((a) => ({ value: a, label: a }));

type Btn = { id: string; name: string; def: string };
const BUTTONS: Btn[] = [
  { id: "left", name: "Left Click", def: "Left click" },
  { id: "right", name: "Right Click", def: "Right click" },
  { id: "middle", name: "Middle Click", def: "Middle click" },
  { id: "back", name: "Back", def: "Back" },
  { id: "forward", name: "Forward", def: "Forward" },
  { id: "gesture", name: "Gesture button", def: "Gesture button" },
  { id: "smartshift", name: "SmartShift button", def: "SmartShift toggle" },
];
const NORMAL_INIT: Record<string, string> = { left: "Left click", right: "Right click", middle: "Middle click", back: "Back", forward: "Forward", gesture: "Ctrl + Z", smartshift: "SmartShift toggle" };
const SHIFT_INIT: Record<string, string> = { left: "Left click", right: "Not assigned", middle: "Not assigned", back: "DPI down", forward: "Not assigned", gesture: "Not assigned", smartshift: "Not assigned" };

/** One interactive grid: owns its layer + mappings + which row is recording. */
function RemapGridDemo({ initialLayer, recordingId }: { initialLayer: "normal" | "gshift"; recordingId?: string }): ReactNode {
  const [layer, setLayer] = useState<string>(initialLayer);
  const [maps, setMaps] = useState<Record<string, Record<string, string>>>({ normal: { ...NORMAL_INIT }, gshift: { ...SHIFT_INIT } });
  const [recording, setRecording] = useState<string | null>(recordingId ?? null);
  const cur = maps[layer];
  const defaults = layer === "normal" ? Object.fromEntries(BUTTONS.map((b) => [b.id, b.def])) : SHIFT_INIT;
  const set = (id: string, v: string): void => setMaps((m) => ({ ...m, [layer]: { ...m[layer], [id]: v } }));
  return (
    <ButtonRemapGrid count={BUTTONS.length} layers={[{ id: "normal", label: "Normal" }, { id: "gshift", label: "G-Shift" }]}
      activeLayer={layer} onLayer={setLayer}
      onReset={() => setMaps((m) => ({ ...m, [layer]: layer === "normal" ? { ...NORMAL_INIT, gesture: "Gesture button" } : { ...SHIFT_INIT } }))}>
      {BUTTONS.map((b) => {
        const state: RemapRowState = b.id === "left" ? "disabled"
          : recording === b.id && layer === "gshift" ? "recording"
            : layer === "normal" && cur[b.id] !== defaults[b.id] ? "changed" : "default";
        return (
          <RemapRow key={b.id} button={b.name} state={state} defaultAction={defaults[b.id]}
            onReset={() => set(b.id, defaults[b.id])} onCancelRecording={() => setRecording(null)}
            control={<Dropdown options={ACTION_OPTS} value={cur[b.id]} onChange={(v) => set(b.id, v)}
              ariaLabel={`${b.name} action`} disabled={state === "disabled"} />} />
        );
      })}
    </ButtonRemapGrid>
  );
}

function RemapRowsDemo(): ReactNode {
  const [a, setA] = useState("Gesture button");
  const [b, setB] = useState("Ctrl + Z");
  const [rec, setRec] = useState(true);
  return (
    <div style={col(10, 665)}>
      <RemapRow button="Gesture button" state={a === "Gesture button" ? "default" : "changed"} defaultAction="Gesture button"
        onReset={() => setA("Gesture button")}
        control={<Dropdown options={ACTION_OPTS} value={a} onChange={setA} ariaLabel="Gesture button action" />} />
      <RemapRow button="Gesture button" state={b === "Gesture button" ? "default" : "changed"} defaultAction="Gesture button"
        onReset={() => setB("Gesture button")}
        control={<Dropdown options={ACTION_OPTS} value={b} onChange={setB} ariaLabel="Gesture button action (changed)" />} />
      <RemapRow button="Gesture button" state={rec ? "recording" : "default"} onCancelRecording={() => setRec(false)}
        control={<Dropdown options={ACTION_OPTS} value="Gesture button" onChange={() => setRec(true)} ariaLabel="Gesture button action (recording)" />} />
      <RemapRow button="Gesture button" state="disabled"
        control={<Dropdown options={ACTION_OPTS} value="Gesture button" onChange={() => {}} ariaLabel="Gesture button action (locked)" disabled />} />
    </div>
  );
}

function CalloutDemo(): ReactNode {
  const [active, setActive] = useState(1);
  return (
    <div style={row(20)}>
      {[0, 1].map((i) => (
        <CalloutLabel key={i} button="Side button, rear" action="Space" active={active === i} onClick={() => setActive(i)} />
      ))}
    </div>
  );
}

const STATS = (
  <>
    <ProfileStat label="DPI" value="1,600" />
    <ProfileStat label="Polling rate" value="2000 Hz" />
    <ProfileStat label="Connection" value="Wireless · 8K dongle" />
    <ProfileStat label="Motion Sync" value="Off" />
    <ProfileStat label="Buttons" value="1 changed" />
  </>
);

function ProfileCardsDemo({ log }: { log: (s: string) => void }): ReactNode {
  return (
    <div style={row(20)}>
      <ProfileCard name="Profile 1" slot="#1" state="default" onRename={() => log("rename #1")} onOpen={() => log("open #1")}>{STATS}</ProfileCard>
      <ProfileCard name="Profile 1" slot="#1" state="active" onRename={() => log("rename #1")} onOpen={() => log("open #1")}>{STATS}</ProfileCard>
      <ProfileCard name="Profile 1" slot="#1" state="factory" onRename={() => log("rename #1")} onOpen={() => log("open #1")}>{STATS}</ProfileCard>
    </div>
  );
}

function ProfileCardsSwitchDemo(): ReactNode {
  const [active, setActive] = useState(0);
  const names = ["Profile 1", "Valorant", "Profile 3", "Profile 4"];
  return (
    <div style={{ ...row(10), alignItems: "stretch" }}>
      {names.map((n, i) => (
        <ProfileCard key={i} name={n} slot={`#${i + 1}`} state={i === active ? "active" : i === 3 ? "factory" : "default"}
          onActivate={() => setActive(i)} onOpen={() => {}} onReset={() => {}} onRename={() => {}}>{STATS}</ProfileCard>
      ))}
    </div>
  );
}

type Prof = { id: number; name: string; summary: string };
const PROFILES: Prof[] = [
  { id: 1, name: "Everyday", summary: "1,600 DPI · 1000 Hz" },
  { id: 2, name: "Professional", summary: "2,000 DPI · 1200 Hz" },
  { id: 3, name: "Gaming", summary: "3,200 DPI · 1600 Hz" },
  { id: 4, name: "Design", summary: "4,000 DPI · 2000 Hz" },
];

function ProfileListDemo(): ReactNode {
  const [list, setList] = useState(PROFILES);
  const [active, setActive] = useState(1);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  return (
    <div style={{ width: 665 }}>
      <ProfileList onSaveCurrent={() => setList((l) => [...l, { id: Date.now(), name: `Profile ${l.length + 1}`, summary: "1,600 DPI · 1000 Hz" }])}>
        {list.map((p) => (
          <ProfileRow key={p.id} name={p.name} summary={p.summary}
            state={renaming === p.id ? "renaming" : p.id === active ? "active" : "default"}
            onApply={() => setActive(p.id)} onOpen={() => {}}
            onRename={() => { setRenaming(p.id); setDraft(p.name); }}
            onDelete={() => setList((l) => l.filter((x) => x.id !== p.id))}
            renameValue={draft} onRenameChange={setDraft}
            onRenameConfirm={(v) => { setList((l) => l.map((x) => (x.id === p.id ? { ...x, name: v.trim() || x.name } : x))); setRenaming(null); }}
            onRenameCancel={() => setRenaming(null)} />
        ))}
      </ProfileList>
    </div>
  );
}

function ProfileRowsDemo(): ReactNode {
  const [name, setName] = useState("Everyday");
  return (
    <div style={col(10, 665)}>
      <ProfileRow name="Everyday" summary="1,600 DPI · 1000 Hz" state="default" onApply={() => {}} onOpen={() => {}} onRename={() => {}} onDelete={() => {}} />
      <ProfileRow name="Everyday" summary="1,600 DPI · 1000 Hz" state="active" onApply={() => {}} onOpen={() => {}} onRename={() => {}} onDelete={() => {}} />
      <ProfileRow name="Everyday" state="renaming" renameValue={name} onRenameChange={setName} onRenameConfirm={() => {}} onRenameCancel={() => setName("Everyday")} />
      <ProfileRow name="" state="empty" onSave={() => {}} />
      <ProfileRow name="Everyday" slot="#1" summary="1,600 DPI · 1000 Hz" state="default" onApply={() => {}} onOpen={() => {}} onRename={() => {}} onDelete={() => {}} />
    </div>
  );
}

type Lift = "L" | "M" | "H";
const LIFT_OPTS = [{ value: "L" as Lift, label: "L" }, { value: "M" as Lift, label: "M" }, { value: "H" as Lift, label: "H" }];
type Stage = { x: number; y: number; linked: boolean; lift: Lift; color: string };
const STAGE_COLORS = ["#ff4d4d", "#13f287", "#4c7dff", "#ffb02e", "#c46bff"];
const STAGES_INIT: Stage[] = [
  { x: 800, y: 800, linked: true, lift: "M", color: STAGE_COLORS[0] },
  { x: 1600, y: 1600, linked: true, lift: "M", color: STAGE_COLORS[1] },
  { x: 3200, y: 3200, linked: false, lift: "M", color: STAGE_COLORS[2] },
  { x: 6400, y: 6400, linked: true, lift: "M", color: STAGE_COLORS[3] },
  { x: 12800, y: 12800, linked: true, lift: "M", color: STAGE_COLORS[4] },
];

function DpiTableDemo(): ReactNode {
  const [stages, setStages] = useState(STAGES_INIT);
  const [count, setCount] = useState(4);
  const [active, setActive] = useState(1);
  const upd = (i: number, p: Partial<Stage>): void => setStages((s) => s.map((st, k) => (k === i ? { ...st, ...p } : st)));
  return (
    <div style={{ width: 665 }}>
      <DpiStageTable count={count} maxCount={5} onCount={(n) => { setCount(n); if (active >= n) setActive(n - 1); }}
        onReset={() => { setStages(STAGES_INIT); setCount(4); setActive(1); }}>
        {stages.slice(0, count).map((s, i) => (
          <DpiStageRow key={i} stage={i + 1} active={i === active} x={s.x} y={s.y} linked={s.linked}
            onLink={(l) => upd(i, l ? { linked: true, y: s.x } : { linked: false })}
            onX={(v) => upd(i, s.linked ? { x: v, y: v } : { x: v })} onY={(v) => upd(i, { y: v })}
            onActivate={() => setActive(i)} min={100} max={32000} step={50}
            liftOff={<Segmented options={LIFT_OPTS} value={s.lift} onChange={(v) => upd(i, { lift: v })} ariaLabel={`Stage ${i + 1} lift-off`} />}
            color={s.color} onColor={(hex) => upd(i, { color: hex })}
            onRemove={count > 1 ? () => { setStages((st) => [...st.filter((_, k) => k !== i), st[i]]); setCount((c) => c - 1); if (active >= count - 1) setActive(count - 2); } : undefined} />
        ))}
      </DpiStageTable>
    </div>
  );
}

function DpiRowsDemo(): ReactNode {
  const variants: { active: boolean; linked: boolean }[] = [
    { active: false, linked: true }, { active: false, linked: false }, { active: true, linked: true }, { active: true, linked: false },
  ];
  const [vals, setVals] = useState(variants.map((v) => ({ x: 1600, y: 1600, linked: v.linked, lift: "M" as Lift })));
  return (
    <div style={col(10, 645)}>
      {variants.map((v, i) => {
        const s = vals[i];
        const upd = (p: Partial<typeof s>): void => setVals((a) => a.map((o, k) => (k === i ? { ...o, ...p } : o)));
        return (
          <DpiStageRow key={i} stage={1} active={v.active} x={s.x} y={s.y} linked={s.linked}
            onLink={(l) => upd(l ? { linked: true, y: s.x } : { linked: false })}
            onX={(x) => upd(s.linked ? { x, y: x } : { x })} onY={(y) => upd({ y })} onActivate={() => {}}
            liftOff={<Segmented options={LIFT_OPTS} value={s.lift} onChange={(lift) => upd({ lift })} ariaLabel="Lift-off" />}
            color={STAGE_COLORS[1]} onColor={() => {}} onRemove={() => {}} />
        );
      })}
    </div>
  );
}

export default function ShowcaseLists(): ReactNode {
  const [log, setLog] = useState("—");
  return (
    <div style={col(40)}>
      <p className="mk-t-caption12 mk-c-secondary" style={{ margin: 0 }}>Last action: {log}</p>

      <Section title="Button remap grid — Layer Normal / G-Shift">
        <div style={row(20)}>
          <div style={{ width: 665 }}><RemapGridDemo initialLayer="normal" /></div>
          <div style={{ width: 665 }}><RemapGridDemo initialLayer="gshift" recordingId="forward" /></div>
        </div>
      </Section>

      <Section title="Button remap grid — no shift layer (tabs hidden)">
        <div style={{ width: 665 }}>
          <ButtonRemapGrid count={2}>
            <RemapRow button="Back" control={<Dropdown options={ACTION_OPTS} value="Back" onChange={() => {}} ariaLabel="Back action" />} />
            <RemapRow button="Forward" control={<Dropdown options={ACTION_OPTS} value="Forward" onChange={() => {}} ariaLabel="Forward action" />} />
          </ButtonRemapGrid>
        </div>
      </Section>

      <Section title="Remap row — Default / Changed / Recording / Disabled">
        <RemapRowsDemo />
      </Section>

      <Section title="Callout label — Default / Active">
        <CalloutDemo />
      </Section>

      <Section title="Profile card — Default / Active / Factory">
        <ProfileCardsDemo log={setLog} />
      </Section>

      <Section title="Profile card — interactive (Activate · Open · reset)">
        <ProfileCardsSwitchDemo />
      </Section>

      <Section title="Profile list">
        <ProfileListDemo />
      </Section>

      <Section title="Profile row — Default / Active / Renaming / Empty (+ Show slot)">
        <ProfileRowsDemo />
      </Section>

      <Section title="DPI stage table">
        <DpiTableDemo />
      </Section>

      <Section title="DPI stage row — Default·Linked / Default·Unlinked / Active·Linked / Active·Unlinked">
        <DpiRowsDemo />
      </Section>
    </div>
  );
}
