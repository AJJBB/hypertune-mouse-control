// App-saved profiles — the fallback for mice with no native profile feature
// (hasNativeProfileManagement false). The logic of app/SoftwareProfiles.tsx
// (capture → save, apply → re-send, rename, delete; stored per device in the
// app), laid out as Ivan's "Profiles (in app)" screen: product render on the
// left; Current Settings with Save Current, then the Saved Profiles list.
import { useId, useState, type ReactNode } from "react";
import * as control from "../../../../device/controller";
import type { ControlSnapshot } from "../../../../device/types";
import { connectionText } from "../../../../i18n";
import {
  activeSoftwareProfileId,
  deleteSoftwareProfile,
  listSoftwareProfiles,
  markSoftwareProfileActive,
  renameSoftwareProfile,
  saveSoftwareProfile,
  type SoftwareProfile,
  type SoftwareProfileSettings,
} from "../../../../software-profiles";
import { Button, DiagnosticRow, IconButton, ProfileList, ProfileRow, StatusPill } from "../../kit";
import { MouseRender, SplitLayout } from "../layout";
import { Note, fmtDpi, fmtHz } from "./shared";

type Status = NonNullable<ControlSnapshot["status"]>;

/* captureSettings / applySavedSettings / summarize: app/SoftwareProfiles.tsx, unchanged. */

function captureSettings(status: Status): SoftwareProfileSettings {
  const settings: SoftwareProfileSettings = {};
  if (status.dpi > 0) settings.dpi = status.dpi;
  if (status.pollingRateHz) settings.pollingRateHz = status.pollingRateHz;
  if (status.liftOffDistance) settings.liftOffDistance = status.liftOffDistance;
  if (status.brand === "Pulsar") {
    if (status.debounceMs != null) settings.debounceMs = status.debounceMs;
    if (status.sleepTimeout != null) settings.sleepTimeout = status.sleepTimeout;
    if (status.motionSync != null) settings.motionSync = status.motionSync;
    if (status.angleSnapping != null) settings.angleSnapping = status.angleSnapping;
    if (status.rippleControl != null) settings.rippleControl = status.rippleControl;
    if (status.performanceMode != null) settings.performanceMode = status.performanceMode;
  }
  return settings;
}

function applySavedSettings(settings: SoftwareProfileSettings, isPulsar: boolean): void {
  if (settings.dpi !== undefined) control.applyDpiValue(settings.dpi);
  if (settings.pollingRateHz !== undefined) control.applyPollingRate(settings.pollingRateHz);
  if (settings.liftOffDistance !== undefined) control.applyLiftOffDistance(settings.liftOffDistance);
  if (!isPulsar) return;
  if (settings.debounceMs !== undefined) control.applyPulsarValue("debounce", settings.debounceMs);
  if (settings.sleepTimeout !== undefined) control.applyPulsarValue("sleep", settings.sleepTimeout);
  if (settings.motionSync !== undefined) control.applyPulsarToggle("motionSync", settings.motionSync);
  if (settings.angleSnapping !== undefined) control.applyPulsarToggle("angleSnapping", settings.angleSnapping);
  if (settings.rippleControl !== undefined) control.applyPulsarToggle("rippleControl", settings.rippleControl);
  if (settings.performanceMode !== undefined) control.applyPulsarToggle("performanceMode", settings.performanceMode);
}

function summarize(settings: SoftwareProfileSettings): string {
  const parts: string[] = [];
  if (settings.dpi !== undefined) parts.push(`${fmtDpi(settings.dpi)} DPI`);
  if (settings.pollingRateHz !== undefined) parts.push(`${settings.pollingRateHz} Hz`);
  if (settings.liftOffDistance !== undefined) parts.push(`${settings.liftOffDistance} lift-off`);
  return parts.length ? parts.join(" · ") : "No settings captured";
}

/** "Current Settings": what Save Current will capture, plus the link it's on. */
function CurrentSettings({ snapshot, onSave }: { snapshot: ControlSnapshot; onSave: () => void }): ReactNode {
  const status = snapshot.status;
  const titleId = useId();
  if (!status) return null;
  const locale = snapshot.preferences.locale;
  const type = status.connectionType ? connectionText(locale, status.connectionType) : null;
  const detail = status.connectionDetail?.trim() || null;
  // "Wireless · 2.4 GHz receiver", but "Wired USB" rather than "Wired · Wired USB".
  const connection = type && detail
    ? detail.toLowerCase().startsWith(type.toLowerCase()) ? detail : `${type} · ${detail}`
    : type ?? detail;
  return (
    <section className="mk-pf-current" aria-labelledby={titleId}>
      <div className="mk-pf-current__header">
        <h3 id={titleId} className="mk-pf-current__title mk-t-title16">Current Settings</h3>
        <Button size="medium" icon="save" label="Save Current" onClick={onSave} />
      </div>
      <div className="mk-pf-current__rows">
        {status.dpi > 0 ? <DiagnosticRow label="DPI" value={fmtDpi(status.dpi)} /> : null}
        {status.pollingRateHz ? <DiagnosticRow label="Polling rate" value={fmtHz(status.pollingRateHz)} /> : null}
        {status.liftOffDistance ? <DiagnosticRow label="Lift-off distance" value={status.liftOffDistance} /> : null}
        {connection ? <DiagnosticRow label="Connection" value={connection} /> : null}
        {status.motionSync != null ? <DiagnosticRow label="Motion sync" value={status.motionSync ? "On" : "Off"} /> : null}
      </div>
    </section>
  );
}

/** The active profile's row. Same anatomy as the kit Profile row (Active), but
    delete stays available: an app profile only lives in Hypertune, and saving
    one makes it active — so a lone saved profile could never be removed. */
function ActiveProfileRow({ profile, onApply, onRename, onDelete }: { profile: SoftwareProfile; onApply: () => void; onRename: () => void; onDelete: () => void }): ReactNode {
  return (
    <div className="mk-profile-row is-active">
      <div className="mk-profile-row__text">
        <span className="mk-profile-row__name">{profile.name}</span>
        <span className="mk-profile-row__summary">{summarize(profile.settings)}</span>
      </div>
      <div className="mk-profile-row__actions">
        <StatusPill type="active" label="Active" />
        {/* "Active" only marks the last one applied — settings may have changed
            since, so it must stay re-appliable (the old list allowed it). */}
        <Button size="medium" label="Re-apply" onClick={onApply} ariaLabel={`Re-apply ${profile.name}`} />
        <IconButton icon="edit" label={`Rename ${profile.name}`} onClick={onRename} />
        <IconButton icon="trash" danger label={`Delete ${profile.name}`} onClick={onDelete} />
      </div>
    </div>
  );
}

export function AppProfiles({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  const device = control.getActiveDevice();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [, setVersion] = useState(0);
  const refresh = (): void => setVersion((value) => value + 1);

  if (!status) return null;
  // A real connection always has a device object; the fixture preview does
  // not, so fall back to a status-derived key there (as SoftwareProfiles does).
  const deviceKey = device ? control.deviceStorageKey(device) : `preview:${status.name}`;
  const profiles = listSoftwareProfiles(deviceKey);
  const activeId = activeSoftwareProfileId(deviceKey);
  const isPulsar = status.brand === "Pulsar";

  const startCreate = (): void => { setCreating(true); setNewName(""); };
  const cancelCreate = (): void => { setCreating(false); setNewName(""); };
  const commitCreate = (value: string): void => {
    const name = value.trim();
    if (!name) return;
    saveSoftwareProfile(deviceKey, name, captureSettings(status));
    setCreating(false);
    setNewName("");
    refresh();
  };
  const startRename = (profile: SoftwareProfile): void => { setRenamingId(profile.id); setDraftName(profile.name); };
  const commitRename = (id: string, value: string): void => {
    const name = value.trim();
    if (name) renameSoftwareProfile(deviceKey, id, name);
    setRenamingId(null);
    refresh();
  };
  const remove = (id: string): void => {
    deleteSoftwareProfile(deviceKey, id);
    if (renamingId === id) setRenamingId(null);
    refresh();
  };
  const apply = (profile: SoftwareProfile): void => {
    applySavedSettings(profile.settings, isPulsar);
    markSoftwareProfileActive(deviceKey, profile.id);
    refresh();
  };

  return (
    <SplitLayout
      left={<MouseRender snapshot={snapshot} />}
      right={(
        <>
          <CurrentSettings snapshot={snapshot} onSave={startCreate} />
          <div className="mk-pf-saved">
            <ProfileList title="Saved Profiles">
              {creating ? (
                <ProfileRow name="new profile" state="renaming" renameValue={newName} renamePlaceholder="Name this profile"
                  onRenameChange={setNewName} onRenameConfirm={commitCreate} onRenameCancel={cancelCreate} />
              ) : null}
              {profiles.length === 0 && !creating ? (
                <ProfileRow name="" state="empty" emptyTitle="No saved profiles yet"
                  emptyNote="Save the current settings to switch back to them later." saveLabel="Save current" onSave={startCreate} />
              ) : null}
              {profiles.map((profile) => (
                renamingId === profile.id ? (
                  <ProfileRow key={profile.id} name={profile.name} state="renaming" renameValue={draftName}
                    onRenameChange={setDraftName} onRenameConfirm={(value) => commitRename(profile.id, value)}
                    onRenameCancel={() => { setRenamingId(null); refresh(); }} />
                ) : profile.id === activeId ? (
                  <ActiveProfileRow key={profile.id} profile={profile} onApply={() => apply(profile)} onRename={() => startRename(profile)} onDelete={() => remove(profile.id)} />
                ) : (
                  <ProfileRow key={profile.id} name={profile.name} summary={summarize(profile.settings)} state="default"
                    applyLabel="Apply" onApply={() => apply(profile)} onRename={() => startRename(profile)} onDelete={() => remove(profile.id)} />
                )
              ))}
            </ProfileList>
            <Note>Saved in Hypertune, not on the mouse. Applying one re-sends its settings to the mouse.</Note>
          </div>
        </>
      )}
    />
  );
}
