// What activate() registers: the Preferences section always, and the Immich
// library source once a connection is saved, following the connection as any
// window changes it. Nothing reaches the network at start.

import { describe, expect, it, vi } from "vitest";
import manifest from "../safelight.json";
import { CONNECTION_KEY, EXTENSION_ID, SOURCE_ID } from "../src/connection";
import { activate } from "../src/index";
import { ImmichSettings } from "../src/Settings";
import { fakeApi } from "./support/fake-api";
import { SERVER } from "./support/mock-immich";

const CONN = { server: SERVER, apiKey: "good-key", userId: "user-1", userName: "Anna" };

describe("activate", () => {
  it("registers its Preferences section", () => {
    const rig = fakeApi(vi.fn());
    activate(rig.api);
    expect(rig.settingsContributions).toEqual([expect.objectContaining({ component: ImmichSettings, fields: [] })]);
    expect(rig.settingsContributions[0].keywords).toEqual(expect.arrayContaining(["Immich", "API key"]));
  });

  it("registers no source until a connection is saved", () => {
    const rig = fakeApi(vi.fn());
    activate(rig.api);
    expect(rig.source()).toBeNull();
  });

  it("registers the source of a saved connection without contacting the server", () => {
    const fetch = vi.fn();
    const rig = fakeApi(fetch, { [CONNECTION_KEY]: CONN });
    activate(rig.api);
    expect(rig.source()).toMatchObject({ id: SOURCE_ID, name: "Immich", library: `${SERVER}#user-1` });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("follows a connection made or dropped in any window", () => {
    const rig = fakeApi(vi.fn());
    activate(rig.api);
    rig.api.settings.set(CONNECTION_KEY, CONN);
    expect(rig.source()?.id).toBe(SOURCE_ID);
    rig.api.settings.set(CONNECTION_KEY, null);
    expect(rig.source()).toBeNull();
  });

  it("names its contributions under the manifest's id", () => {
    expect(EXTENSION_ID).toBe(manifest.id);
    expect(SOURCE_ID.startsWith(`${manifest.id}.`)).toBe(true);
    expect(manifest.permissions.userOrigins).toBe(true);
  });
});
