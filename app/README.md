# Hypertune Mouse Control

Hypertune Mouse Control is a browser-based control panel for supported gaming mice.

Connect a mouse, view its information, and change supported settings such as DPI
and polling rate — no separate app for every brand.

## Development

```bash
npm install
npm run dev
```

Run the full local check before pushing changes:

```bash
npm run check
```

## Architecture

The control panel is organized by responsibility: `control.tsx` coordinates the
application, while the template, events, DOM helpers, persisted preferences,
battery history, device selection, and rendering live in focused modules under
`src/`.

Packet codecs and WebHID drivers live in the standalone `@openmouse/protocol`
library (see the sibling `mouse-protocol-source` project). Its codec entry
points remain transport-independent, while its `drivers` entry points own
discovery filters, device clients, retries, and application-facing status
conversion.

## Adding a vendor

Codec and driver contributions belong in the `mouse-protocol-source` project.

1. Add transport-independent packet definitions and codecs under the vendor's
   `src/<vendor>/` folder.
2. Add the WebHID implementation under `src/drivers/<vendor>/`.
3. Register the driver and browser filters in the shared driver layer.
4. Add or extend codec and driver tests, state which product IDs were verified
   on hardware, and run the checks in both projects.

This app should only need changes when a driver introduces a genuinely new UI
capability — the control UI otherwise discovers supported clients through the
library registry automatically.

## License

[GNU AGPL-3.0](LICENSE). Contributions are accepted under the same license.

Built on the OpenMouse `@openmouse/protocol` library, Copyright (C) the OpenMouse
Project, licensed under AGPL-3.0-or-later —
https://github.com/OpenMouse-Project/mouse-protocol
