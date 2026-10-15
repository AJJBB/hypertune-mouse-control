// A `navigator.hid` layer for the small set of devices the real WebHID API
// cannot reach at all — currently just the Razer Viper V3 Pro receiver,
// confirmed on real hardware: Chrome/Electron's WebHID refuses to write a
// feature report to its control collection under any Chromium version
// tried, while a native HID connection to the exact same collection
// round-trips cleanly. `window.nativeHid` (exposed by the Electron app's
// preload script, backed by node-hid in the main process) is the native
// side; this file wraps it in the same `HIDDevice`/`HID` shapes
// `@openmouse/protocol` drivers are already written against, so
// `RazerHidClient`, the registry's `isSupported()` auto-detection, and every
// card in the control panel work completely unchanged — see
// mouse-protocol-source's `nativeOnly` flag and `isNativeTransportDevice()`
// for the one place the driver package itself is aware this exists.
//
// Rather than replacing `navigator.hid` wholesale, this merges into it: the
// vast majority of supported mice work fine over real WebHID and should keep
// using it untouched. Only devices flagged `nativeOnly` — reachable here and
// nowhere else — come through this path.

interface NativeDeviceSummary {
  key: string;
  vendorId: number;
  productId: number;
  productName: string;
  collections: HIDCollectionInfo[];
}

interface NativeHidBridge {
  list(): Promise<NativeDeviceSummary[]>;
  open(key: string): Promise<boolean>;
  close(key: string): Promise<boolean>;
  sendFeatureReport(key: string, reportId: number, data: number[]): Promise<boolean>;
  receiveFeatureReport(key: string, reportId: number, length: number): Promise<number[]>;
}

/** Generous enough for every feature report this app currently sends
    natively (Razer's 90-byte packets); revisit if a longer one shows up. */
const NATIVE_FEATURE_REPORT_LENGTH = 256;

function toBytes(data: BufferSource): number[] {
  const bytes = data instanceof ArrayBuffer
    ? new Uint8Array(data)
    : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return [...bytes];
}

class NativeConnectionEvent extends Event {
  readonly device: HIDDevice;

  constructor(type: "connect" | "disconnect", device: HIDDevice) {
    super(type);
    this.device = device;
  }
}

/** Listener shape kept narrower than EventTarget's on purpose — WebHID
    declares its own narrower listener type that no EventTarget override
    can satisfy under strict mode. */
class NativeHidDevice implements HIDDevice {
  /** The one thing RazerHidClient.isSupported() checks to allow a nativeOnly
      product through — see isNativeTransportDevice() in hid.ts. Never set on
      a real browser HIDDevice. */
  readonly nativeTransport = true as const;
  readonly key: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  collections: readonly HIDCollectionInfo[];
  opened = false;

  #bridge: NativeHidBridge;

  constructor(bridge: NativeHidBridge, summary: NativeDeviceSummary) {
    this.#bridge = bridge;
    this.key = summary.key;
    this.vendorId = summary.vendorId;
    this.productId = summary.productId;
    this.productName = summary.productName;
    this.collections = summary.collections;
  }

  async open(): Promise<void> {
    if (this.opened) return;
    await this.#bridge.open(this.key);
    this.opened = true;
  }

  async close(): Promise<void> {
    if (!this.opened) return;
    this.opened = false;
    await this.#bridge.close(this.key);
  }

  async sendReport(): Promise<void> {
    throw new Error("This native HID device does not support output reports.");
  }

  async sendFeatureReport(reportId: number, data: BufferSource): Promise<void> {
    await this.#bridge.sendFeatureReport(this.key, reportId, toBytes(data));
  }

  async receiveFeatureReport(reportId: number): Promise<DataView> {
    // Ask for one extra byte: node-hid's raw reply carries the report id
    // back as its own leading byte (hidapi convention), which WebHID's
    // receiveFeatureReport contract does not include in what it returns.
    const raw = await this.#bridge.receiveFeatureReport(this.key, reportId, NATIVE_FEATURE_REPORT_LENGTH + 1);
    return new DataView(Uint8Array.from(raw.slice(1)).buffer);
  }

  addEventListener(): void {
    // No native device currently in use sends input reports the app needs —
    // Razer's control channel is feature-report request/response only. Kept
    // as a no-op rather than omitted so this class satisfies HIDDevice.
  }

  removeEventListener(): void {}
}

class NativeHid implements HID {
  #bridge: NativeHidBridge;
  #devices = new Map<string, NativeHidDevice>();
  #poll: ReturnType<typeof setInterval> | null = null;
  #listeners: Record<"connect" | "disconnect", Set<(event: HIDConnectionEvent) => void>> = {
    connect: new Set(),
    disconnect: new Set(),
  };

  constructor(bridge: NativeHidBridge) {
    this.#bridge = bridge;
  }

  async #reconcile(): Promise<NativeHidDevice[]> {
    const summaries = await this.#bridge.list();
    const seen = new Set(summaries.map((summary) => summary.key));
    for (const [key, device] of this.#devices) {
      if (seen.has(key)) continue;
      this.#devices.delete(key);
      this.#emit("disconnect", device);
    }
    const devices = summaries.map((summary) => {
      const existing = this.#devices.get(summary.key);
      if (existing) {
        existing.collections = summary.collections;
        return existing;
      }
      const device = new NativeHidDevice(this.#bridge, summary);
      this.#devices.set(summary.key, device);
      this.#emit("connect", device);
      return device;
    });
    this.#startPolling();
    return devices;
  }

  async getDevices(): Promise<HIDDevice[]> {
    return await this.#reconcile();
  }

  async requestDevice(options: { filters: HIDDeviceFilter[] }): Promise<HIDDevice[]> {
    const devices = await this.#reconcile();
    return devices.filter((device) => options.filters.some((filter) =>
      (filter.vendorId === undefined || filter.vendorId === device.vendorId)
      && (filter.productId === undefined || filter.productId === device.productId)));
  }

  addEventListener(type: "connect" | "disconnect", listener: (event: HIDConnectionEvent) => void): void {
    this.#listeners[type]?.add(listener);
  }

  removeEventListener(type: "connect" | "disconnect", listener: (event: HIDConnectionEvent) => void): void {
    this.#listeners[type]?.delete(listener);
  }

  #emit(type: "connect" | "disconnect", device: HIDDevice): void {
    const event = new NativeConnectionEvent(type, device);
    for (const listener of this.#listeners[type]) listener(event);
  }

  /** node-hid has no hot-plug event of its own; re-enumerate on an interval. */
  #startPolling(): void {
    if (this.#poll !== null) return;
    this.#poll = setInterval(() => {
      void this.#reconcile().catch(() => undefined);
    }, 2_000);
  }
}

/**
 * A `navigator.hid`-shaped merge of the real WebHID implementation (used
 * unchanged for everything it can reach) and this native layer (used only
 * for devices the native side actually offers — in practice, only the
 * products flagged `nativeOnly` in mouse-protocol-source ever surface here,
 * since window.nativeHid itself only lists a narrow, explicit vendor
 * allowlist — see hypertune-desktop/main.js).
 */
class HybridHid implements HID {
  #real: HID;
  #native: NativeHid;

  constructor(real: HID, bridge: NativeHidBridge) {
    this.#real = real;
    this.#native = new NativeHid(bridge);
  }

  async getDevices(): Promise<HIDDevice[]> {
    const [real, native] = await Promise.all([
      this.#real.getDevices(),
      this.#native.getDevices().catch(() => []),
    ]);
    // The native bridge lists every device on its vendor allowlist, but a
    // device WebHID can already reach (e.g. a wired Razer mouse) is offered by
    // both sides — which surfaced as two tiles for one mouse. Keep the real
    // WebHID device and drop the native duplicate; a genuinely native-only
    // device (a nativeOnly receiver WebHID never offers) has no real match and
    // stays.
    const realKeys = new Set(real.map((device) => `${device.vendorId}:${device.productId}`));
    const nativeOnly = native.filter((device) => !realKeys.has(`${device.vendorId}:${device.productId}`));
    return [...real, ...nativeOnly];
  }

  async requestDevice(options: { filters: HIDDeviceFilter[] }): Promise<HIDDevice[]> {
    const [real, native] = await Promise.all([
      this.#real.requestDevice(options).catch(() => []),
      this.#native.requestDevice(options).catch(() => []),
    ]);
    return [...real, ...native];
  }

  addEventListener(type: "connect" | "disconnect", listener: (event: HIDConnectionEvent) => void): void {
    this.#real.addEventListener(type, listener);
    this.#native.addEventListener(type, listener);
  }

  removeEventListener(type: "connect" | "disconnect", listener: (event: HIDConnectionEvent) => void): void {
    this.#real.removeEventListener(type, listener);
    this.#native.removeEventListener(type, listener);
  }
}

/**
 * Merges the native HID bridge into `navigator.hid` when the Electron
 * preload script has exposed one (see hypertune-desktop/preload.js). A no-op
 * everywhere else — a browser tab with no `window.nativeHid` just keeps its
 * real WebHID (or lack of it) exactly as before.
 */
export function installNativeHid(): void {
  const bridge = (window as unknown as { nativeHid?: NativeHidBridge }).nativeHid;
  if (!bridge || !navigator.hid) return;
  Object.defineProperty(navigator, "hid", { value: new HybridHid(navigator.hid, bridge), configurable: true });
}

/**
 * True only inside the Hypertune desktop shell, where the Electron preload has
 * exposed the native `node-hid` bridge. The plain hosted web app (any browser,
 * including the Chromium ones that have WebHID) returns false — it has no
 * native path, so Razer's protected control channel is out of reach there.
 */
export function isNativeBridgeAvailable(): boolean {
  return Boolean((window as unknown as { nativeHid?: NativeHidBridge }).nativeHid);
}
