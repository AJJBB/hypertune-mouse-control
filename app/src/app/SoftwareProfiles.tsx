import { useState, type ReactNode } from "react";
import * as control from "../device/controller";
import type { ControlSnapshot } from "../device/types";
import {
  activeSoftwareProfileId,
  deleteSoftwareProfile,
  listSoftwareProfiles,
  markSoftwareProfileActive,
  renameSoftwareProfile,
  saveSoftwareProfile,
  type SoftwareProfile,
  type SoftwareProfileSettings,
} from "../software-profiles";

function captureSettings(status: NonNullable<ControlSnapshot["status"]>): SoftwareProfileSettings {
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
  if (settings.dpi !== undefined) parts.push(`${settings.dpi.toLocaleString()} DPI`);
  if (settings.pollingRateHz !== undefined) parts.push(`${settings.pollingRateHz} Hz`);
  if (settings.liftOffDistance !== undefined) parts.push(`${settings.liftOffDistance} lift-off`);
  return parts.length ? parts.join(" · ") : "No settings captured";
}

export function SoftwareProfiles({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  const device = control.getActiveDevice();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [, setVersion] = useState(0);
  const refresh = (): void => setVersion((value) => value + 1);

  if (!status || !device) return null;
  const deviceKey = control.deviceStorageKey(device);
  const profiles = listSoftwareProfiles(deviceKey);
  const activeId = activeSoftwareProfileId(deviceKey);
  const isPulsar = status.brand === "Pulsar";

  const startRename = (profile: SoftwareProfile): void => {
    setRenamingId(profile.id);
    setDraftName(profile.name);
  };

  const commitRename = (id: string): void => {
    const name = draftName.trim();
    if (name) renameSoftwareProfile(deviceKey, id, name);
    setRenamingId(null);
    refresh();
  };

  const commitCreate = (): void => {
    const name = newName.trim();
    if (!name) return;
    saveSoftwareProfile(deviceKey, name, captureSettings(status));
    setCreating(false);
    setNewName("");
    refresh();
  };

  return (
    <article id="software-profiles" className="setting-card">
      <div className="setting-heading compact">
        <div>
          <p>PROFILES</p>
          <h2>Saved profiles</h2>
        </div>
      </div>
      <p className="field-note">
        This mouse doesn't have switchable onboard memory Hypertune can drive yet, so profiles here live in the app
        and get re-applied to the mouse when you pick one.
      </p>

      {profiles.length === 0 ? (
        <p className="field-note">No saved profiles yet.</p>
      ) : (
        <ul className="software-profile-list">
          {profiles.map((profile) => (
            <li key={profile.id} className={`software-profile-row${profile.id === activeId ? " is-active" : ""}`}>
              <div className="software-profile-name">
                {renamingId === profile.id ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(event) => setDraftName(event.currentTarget.value)}
                    onBlur={() => commitRename(profile.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") { setRenamingId(null); refresh(); }
                    }}
                  />
                ) : (
                  <button type="button" onDblClick={() => startRename(profile)}>
                    {profile.name}
                    {profile.id === activeId ? <span className="software-profile-active-tag">Active</span> : null}
                  </button>
                )}
                <span className="software-profile-summary">{summarize(profile.settings)}</span>
              </div>
              <div className="software-profile-actions">
                <button
                  type="button"
                  onClick={() => {
                    applySavedSettings(profile.settings, isPulsar);
                    markSoftwareProfileActive(deviceKey, profile.id);
                    refresh();
                  }}
                >
                  Apply
                </button>
                <button type="button" onClick={() => startRename(profile)}>Rename</button>
                <button
                  type="button"
                  className="destructive"
                  onClick={() => { deleteSoftwareProfile(deviceKey, profile.id); refresh(); }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <div className="software-profile-create">
          <input
            autoFocus
            placeholder="Profile name"
            value={newName}
            onChange={(event) => setNewName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitCreate();
              if (event.key === "Escape") { setCreating(false); setNewName(""); }
            }}
          />
          <button type="button" onClick={commitCreate}>Save</button>
          <button type="button" onClick={() => { setCreating(false); setNewName(""); }}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="software-profile-add" onClick={() => setCreating(true)}>
          + Save current settings as a profile
        </button>
      )}
    </article>
  );
}
