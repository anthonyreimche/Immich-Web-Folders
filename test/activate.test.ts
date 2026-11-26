// What activate() registers: the Preferences section always, and the Immich
// library source once a connection is saved, following the connection as any
// window changes it. Nothing reaches the network at start.

import { describe, expect, it, vi } from "vitest";
import manifest from "../safelight.json";
import { API_KEY_SECRET, CONNECTION_KEY, EXTENSION_ID, SOURCE_ID } from "../src/connection";
import { activate } from "../src/index";
import { ImmichSettings } from "../src/Settings";
import { fakeApi } from "./support/fake-api";
import { SERVER } from "./support/mock-immich";

const STORED = { server: SERVER, userId: "user-1", userName: "Anna" };
const LEGACY = { ...STORED, apiKey: "good-key" };
const KEY = { [API_KEY_SECRET]: "good-key" };

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

  it("registers the source of a saved connection without contacting the server", async () => {
    const fetch = vi.fn();
    const rig = fakeApi(fetch, { [CONNECTION_KEY]: STORED }, KEY);
    activate(rig.api);
    await vi.waitFor(() => expect(rig.source()).not.toBeNull());
    expect(rig.source()).toMatchObject({ id: SOURCE_ID, name: "Immich", library: `${SERVER}#user-1` });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("follows a connection made or dropped in any window", async () => {
    const rig = fakeApi(vi.fn(), {}, KEY);
    activate(rig.api);
    rig.api.settings.set(CONNECTION_KEY, STORED);
    await vi.waitFor(() => expect(rig.source()?.id).toBe(SOURCE_ID));
    rig.api.settings.set(CONNECTION_KEY, null);
    await vi.waitFor(() => expect(rig.source()).toBeNull());
  });

  it("registers no source when the connection has no key kept", async () => {
    const rig = fakeApi(vi.fn(), { [CONNECTION_KEY]: STORED });
    activate(rig.api);
    await new Promise((done) => setTimeout(done, 10));
    expect(rig.source()).toBeNull();
  });

  it("moves an API key stored in the settings into the keychain, once", async () => {
    const rig = fakeApi(vi.fn(), { [CONNECTION_KEY]: LEGACY });
    activate(rig.api);
    await vi.waitFor(() => expect(rig.source()?.id).toBe(SOURCE_ID));
    expect(rig.secrets.get(API_KEY_SECRET)).toBe("good-key");
    expect(rig.settings.get(CONNECTION_KEY)).toEqual(STORED);
  });

  it("keeps a settings key where it is when there is no keychain to move it to", async () => {
    const rig = fakeApi(vi.fn(), { [CONNECTION_KEY]: LEGACY });
    rig.keychain = false;
    activate(rig.api);
    await new Promise((done) => setTimeout(done, 10));
    expect(rig.settings.get(CONNECTION_KEY)).toEqual(LEGACY);
    expect(rig.secrets.size).toBe(0);
  });

  it("names its contributions under the manifest's id", () => {
    expect(EXTENSION_ID).toBe(manifest.id);
    expect(SOURCE_ID.startsWith(`${manifest.id}.`)).toBe(true);
    expect(manifest.permissions.userOrigins).toBe(true);
  });
});
