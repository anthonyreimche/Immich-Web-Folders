// The library source Safelight opens: one folder per Immich album (owned and
// shared), its photos with their details, the server's preview for the grid,
// and the original only when Safelight reads the file.

import { describe, expect, it, vi } from "vitest";
import { CONNECTION_KEY, SOURCE_ID } from "../src/connection";
import { GB, ORIGINALS_LIMIT_KEY } from "../src/originals";
import { immichSource, syncSource } from "../src/source";
import { fakeApi } from "./support/fake-api";
import { SERVER, asset, mockImmich } from "./support/mock-immich";

const CONN = { server: SERVER, apiKey: "good-key", userId: "user-1", userName: "Anna" };
const signal = new AbortController().signal;

function rig() {
  const server = mockImmich({
    albums: [
      { id: "al1", albumName: "Summer", assets: [asset("a1", "IMG_1.JPG"), asset("v1", "clip.MOV", { type: "VIDEO" })] },
      { id: "al2", albumName: "Family", shared: true, assets: [asset("a2", "DSC_2.NEF", { exifInfo: { fileSizeInByte: 7 } })] },
      { id: "al3", albumName: "Phone", shared: true, assets: [asset("h1", "IMG_0001.HEIC", { originalMimeType: "image/heic" })] },
    ],
  });
  return { server, source: immichSource(server.fetch, CONN, 10 * GB) };
}

describe("the Immich library source", () => {
  it("is named Immich and keyed by the server and the account", () => {
    const { source } = rig();
    expect(source).toMatchObject({ id: SOURCE_ID, name: "Immich", library: `${SERVER}#user-1` });
  });

  it("lists each album as a folder of its photos", async () => {
    const { source } = rig();
    const listing = await source.list({ signal });
    expect(listing.folders?.map((f) => [f.name, f.items?.map((i) => i.name)])).toEqual([
      ["Summer", ["IMG_1.JPG"]],
      ["Family", ["DSC_2.NEF"]],
      ["Phone", ["IMG_0001.HEIC.jpg"]],
    ]);
  });

  it("names each folder by its album id, so albums of one name keep their folders", async () => {
    const { source } = rig();
    const listing = await source.list({ signal });
    expect(listing.folders?.map((f) => f.key)).toEqual(["al1", "al2", "al3"]);
  });

  it("reads the server's preview, and the original only when asked", async () => {
    const { server, source } = rig();
    const listing = await source.list({ signal });
    const raw = listing.folders![1].items![0];
    expect(server.calls.some((c) => c.path.endsWith("/original"))).toBe(false);
    expect(await (await source.readPreview(raw, { maxEdge: 768, signal })).text()).toBe("thumb:a2:preview");
    expect(await (await source.readOriginal(raw, { signal })).text()).toBe("original:a2");
  });

  it("reads the server's rendering, not the original, of a photo Safelight can't open", async () => {
    const { server, source } = rig();
    const listing = await source.list({ signal });
    const heic = listing.folders![2].items![0];
    expect(await (await source.readOriginal(heic, { signal })).text()).toBe("thumb:h1:fullsize");
    expect(server.calls.some((c) => c.path.endsWith("/original"))).toBe(false);
  });

  it("stops a preview read Safelight no longer wants", async () => {
    const { source } = rig();
    const listing = await source.list({ signal });
    const stop = new AbortController();
    stop.abort();
    await expect(source.readPreview(listing.folders![0].items![0], { maxEdge: 768, signal: stop.signal })).rejects.toThrow("Stopped.");
  });

  it("fails the listing with the reason when the server is down", async () => {
    const source = immichSource(mockImmich({ down: true }).fetch, CONN, 10 * GB);
    await expect(source.list({ signal })).rejects.toThrow(/Couldn't reach/);
  });
});

describe("the kept originals' limit", () => {
  const CONNECTED = { [CONNECTION_KEY]: CONN };

  it("is 10 GB unless the person chose another", () => {
    const rig = fakeApi(vi.fn(), CONNECTED);
    syncSource(rig.api);
    expect(rig.source()?.keptOriginalsLimit).toBe(10 * GB);
  });

  it("is the one chosen, or none", () => {
    const rig = fakeApi(vi.fn(), { ...CONNECTED, [ORIGINALS_LIMIT_KEY]: 50 });
    syncSource(rig.api);
    expect(rig.source()?.keptOriginalsLimit).toBe(50 * GB);
    rig.api.settings.set(ORIGINALS_LIMIT_KEY, null);
    syncSource(rig.api);
    expect(rig.source()?.keptOriginalsLimit).toBeNull();
  });

  it("is 10 GB when the stored choice isn't one", () => {
    const rig = fakeApi(vi.fn(), { ...CONNECTED, [ORIGINALS_LIMIT_KEY]: "lots" });
    syncSource(rig.api);
    expect(rig.source()?.keptOriginalsLimit).toBe(10 * GB);
  });
});
