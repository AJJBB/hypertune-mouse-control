import type { LiftOffLevel } from "./device/types";

/**
 * Settings a software profile can capture. Kept to the handful of controls
 * that are both near-universal (DPI, polling, lift-off) and have a single
 * generic setter, plus the Pulsar-family toggles/values — the one brand this
 * app currently has no onboard profile switch for (see hasNativeProfileManagement).
 */
export interface SoftwareProfileSettings {
  dpi?: number;
  pollingRateHz?: number;
  liftOffDistance?: LiftOffLevel;
  debounceMs?: number;
  sleepTimeout?: number;
  motionSync?: boolean;
  angleSnapping?: boolean;
  rippleControl?: boolean;
  performanceMode?: boolean;
}

export interface SoftwareProfile {
  id: string;
  name: string;
  settings: SoftwareProfileSettings;
}

interface StoredDeviceProfiles {
  profiles: SoftwareProfile[];
  activeProfileId: string | null;
}

const STORAGE_PREFIX = "hypertune.software-profiles.";
const MAX_PROFILES_PER_DEVICE = 8;
const EMPTY_STORE: StoredDeviceProfiles = { profiles: [], activeProfileId: null };

function readStore(deviceKey: string): StoredDeviceProfiles {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + deviceKey);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<StoredDeviceProfiles> | null;
    return {
      profiles: Array.isArray(parsed?.profiles) ? parsed.profiles : [],
      activeProfileId: typeof parsed?.activeProfileId === "string" ? parsed.activeProfileId : null,
    };
  } catch {
    return EMPTY_STORE;
  }
}

function writeStore(deviceKey: string, store: StoredDeviceProfiles): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + deviceKey, JSON.stringify(store));
  } catch {
  }
}

export function listSoftwareProfiles(deviceKey: string): SoftwareProfile[] {
  return readStore(deviceKey).profiles;
}

export function activeSoftwareProfileId(deviceKey: string): string | null {
  return readStore(deviceKey).activeProfileId;
}

export function activeSoftwareProfile(deviceKey: string): SoftwareProfile | null {
  const store = readStore(deviceKey);
  return store.profiles.find((profile) => profile.id === store.activeProfileId) ?? null;
}

export function saveSoftwareProfile(deviceKey: string, name: string, settings: SoftwareProfileSettings): SoftwareProfile {
  const store = readStore(deviceKey);
  const profile: SoftwareProfile = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    settings,
  };
  const profiles = [...store.profiles, profile].slice(-MAX_PROFILES_PER_DEVICE);
  writeStore(deviceKey, { profiles, activeProfileId: profile.id });
  return profile;
}

export function renameSoftwareProfile(deviceKey: string, id: string, name: string): void {
  const store = readStore(deviceKey);
  writeStore(deviceKey, {
    ...store,
    profiles: store.profiles.map((profile) => (profile.id === id ? { ...profile, name } : profile)),
  });
}

export function deleteSoftwareProfile(deviceKey: string, id: string): void {
  const store = readStore(deviceKey);
  writeStore(deviceKey, {
    profiles: store.profiles.filter((profile) => profile.id !== id),
    activeProfileId: store.activeProfileId === id ? null : store.activeProfileId,
  });
}

export function markSoftwareProfileActive(deviceKey: string, id: string): void {
  writeStore(deviceKey, { ...readStore(deviceKey), activeProfileId: id });
}
