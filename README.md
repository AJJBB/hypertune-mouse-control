# Hypertune Mouse Control

A browser-based control panel for configuring gaming mice (DPI, polling rate,
lift-off, buttons, lighting, profiles) across many brands, delivered as a hosted
web app and optionally wrapped in a thin desktop shell.

It is built on the open-source **OpenMouse** mouse-protocol library, which we use
as the driver engine so we can keep adding mouse support quickly rather than
re-implementing every vendor's wire protocol. Everything else — the native HID
bridge, the device-identity checks, custom DPI, packaging, and product features —
is built on top of that library.

## Repository layout

- **`mouse-protocol-source/`** — the mouse protocol/driver library. Per-brand
  packet codecs, checksums, device catalogs, and one WebHID driver class per
  brand. Based on OpenMouse's `@openmouse/protocol`, extended with more devices
  and fixes. Pure TypeScript, no UI. ~1,600 unit tests that assert exact bytes
  on the wire using fake HID devices.
- **`app/`** — the control app (React + TypeScript, built with Vite). Imports the
  protocol library as `@openmouse/protocol`. A single controller module owns
  device state, stages each change with an optimistic preview, writes through the
  driver, and reads back to verify.
- **`hypertune-desktop/`** — the Electron shell that packages the web app into a
  Windows executable. Includes a native `node-hid` bridge (exposed to the
  renderer over a narrow, vendor-ID-allowlisted IPC surface) for devices the
  browser's WebHID stack cannot reach — notably Razer's HyperSpeed wireless mice.

## Build

The control app imports the protocol library from its built `dist`, so build the
library first:

```
cd mouse-protocol-source && npm install && npm run build
cd ../app                 && npm install && npm run build
cd ../hypertune-desktop   && npm install && node copy-web.js
```

`app` links the library via `file:../mouse-protocol-source`, so the two folders
must stay side by side. The desktop app then packages `web/` into an asar (native
`.node` binaries kept unpacked) to produce the EXE.

## Tests

`npm test` (or `npm run check`) in `mouse-protocol-source` and `app`.

## License & attribution

Hypertune Mouse Control is licensed under the **GNU Affero General Public License
v3.0 or later (AGPL-3.0-or-later)** — see [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).

It is built on and includes the **OpenMouse** protocol library (`@openmouse/protocol`),
Copyright (C) the OpenMouse Project, also licensed under AGPL-3.0-or-later.
Upstream: https://github.com/OpenMouse-Project/mouse-protocol

Because the app is served to users over a network, the AGPL (section 13) requires
offering the complete Corresponding Source to those users. The running app links
to this repository from its UI, and the source is available here:
https://github.com/AJJBB/hypertune-mouse-control
