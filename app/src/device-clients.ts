import {
  eggWeMergeLogicalDevices,
} from "@openmouse/protocol/drivers/endgame/egg-we-control";
import { collapseBoltPeers } from "@openmouse/protocol/drivers/logitech/bolt";
import { KeychronNapeHidClient } from "@openmouse/protocol/drivers/keychron/nape-hid";
import { WallhackKeyboardHidClient } from "@openmouse/protocol/drivers/wallhack/keyboard-hid";
import { WootingHidClient } from "@openmouse/protocol/drivers/wooting/hid";
import {
  clientSupportScore,
  createSupportedClient,
  deviceBrand,
  type PulsarClient,
  type SupportedClient,
} from "@openmouse/protocol/drivers/registry";
export { describeHidDevice } from "./hid-diagnostics";
export { clientSupportScore, createSupportedClient, deviceBrand, type PulsarClient, type SupportedClient };

// TODO(hypertune): this app is mouse-only for now — supported keyboards
// (Wooting, Keychron Nape, Wallhack) have no settings UI built for them yet,
// so they're excluded rather than showing an empty device tile. Drop this
// check (and the three imports above) once keyboard support gets a real UI.
export function isKeyboardClient(client: SupportedClient): boolean {
  return client instanceof KeychronNapeHidClient
    || client instanceof WootingHidClient
    || client instanceof WallhackKeyboardHidClient;
}

/** Supported *mouse* devices for the sidebar; multi-path drivers collapse via
    their module. Every caller downstream (sidebarEntries in particular)
    assumes createSupportedClient() succeeds for everything this returns —
    so any HID device the browser has ever been granted (a webcam, an
    unrelated keyboard) needs to be filtered out here, not just used as a
    merge hint. */
export function listLogicalDevices(devices: HIDDevice[] = []): HIDDevice[] {
  const afterEgg = eggWeMergeLogicalDevices(devices, (device) => createSupportedClient(device) !== null);
  return collapseBoltPeers(afterEgg).filter((device) => {
    const client = createSupportedClient(device);
    return client !== null && !isKeyboardClient(client);
  });
}
