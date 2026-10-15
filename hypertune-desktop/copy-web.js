// Copies the built web app (app/dist) into ./web so electron-builder can
// package it. A plain Node script rather than a shell one-liner so
// `npm run dist` works the same on Windows and Unix.
const fs = require("node:fs");
const path = require("node:path");

const src = path.join(__dirname, "..", "app", "dist");
const dest = path.join(__dirname, "web");

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Copied ${src} -> ${dest}`);
