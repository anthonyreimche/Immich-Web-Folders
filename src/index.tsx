// Immich Web Folders — a Safelight extension.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 or later;
// see LICENSE.

// The entry point. Safelight imports dist/index.js (built from this file) and
// calls activate() once with the API, scoped to this extension. It registers
// the Preferences section and, while a connection is saved, the Immich library
// source the Folders panel opens. Nothing reaches the server until Safelight
// opens the source or the person tests the connection.

import { CONNECTION_KEY, EXTENSION_ID, migrateApiKey } from "./connection";
import { ORIGINALS_LIMIT_KEY } from "./originals";
import { RenditionNotice } from "./RenditionNotice";
import { initRuntime } from "./rt";
import type { SafelightAPI } from "./safelight";
import { ImmichSettings } from "./Settings";
import { syncSource } from "./source";

export function activate(host: SafelightAPI): void {
  initRuntime(host);
  host.registerSettings({
    component: ImmichSettings,
    fields: [],
    keywords: ["Immich", "API key", "server", "web folders", "albums"],
  });
  host.registerSlot({ id: `${EXTENSION_ID}.rendition-notice`, slot: "develop-canvas-overlay", component: RenditionNotice });
  void migrateApiKey(host).then(() => syncSource(host));
  host.settings.onChange((key) => {
    if (key === CONNECTION_KEY || key === ORIGINALS_LIMIT_KEY) void syncSource(host);
  });
}
