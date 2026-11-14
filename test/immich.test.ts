// The Immich client against a mocked server: the address the person types,
// the key on every request, the albums (owned and shared), each album's
// photos page by page (or from the album itself on an older server), and the
// words the person sees when something is wrong.

import { describe, expect, it } from "vitest";
import {
  ImmichError,
  immichClient,
  itemOf,
  normalizeServer,
  originalTimeoutMs,
  PREVIEW_SIZE_LIMIT,
} from "../src/immich";
import { SERVER, asset, mockImmich } from "./support/mock-immich";

const conn = { server: SERVER, apiKey: "good-key" };

describe("normalizeServer", () => {
  it("takes the address as typed, without the API path or a trailing slash", () => {
    expect(normalizeServer("http://nas.local:2283/")).toBe("http://nas.local:2283");
    expect(normalizeServer(" https://photos.example.com/api ")).toBe("https://photos.example.com");
    expect(normalizeServer("https://example.com/immich/api/")).toBe("https://example.com/immich");
  });

  it("assumes http for an address typed without one, as Immich serves on the LAN", () => {
    expect(normalizeServer("192.168.1.20:2283")).toBe("http://192.168.1.20:2283");
  });

  it("refuses what isn't a web address", () => {
    for (const bad of ["", "   ", "ftp://x", "http://user:pw@nas:2283", "file:///C:/x", "http://"]) expect(normalizeServer(bad)).toBeNull();
  });
});

describe("the client", () => {
  it("checks the connection: server, key, account and albums", async () => {
    const server = mockImmich({ albums: [{ id: "al1", albumName: "Trip", assets: [] }] });
    const account = await immichClient(server.fetch, conn).checkConnection();
    expect(account).toEqual({ userId: "user-1", userName: "Anna", version: "2.3.1", albumCount: 1 });
    const keyed = server.calls.filter((c) => c.path !== "/api/server/ping" && c.path !== "/api/server/version");
    expect(keyed.every((c) => c.headers["x-api-key"] === "good-key")).toBe(true);
    expect(server.calls.every((c) => typeof c.timeoutMs === "number")).toBe(true);
  });

  it("says plainly what is wrong", async () => {
    const check = (fetch: ReturnType<typeof mockImmich>["fetch"], c = conn) => immichClient(fetch, c).checkConnection();
    await expect(check(mockImmich().fetch, { ...conn, apiKey: "bad" })).rejects.toThrow(/refused the API key/);
    await expect(check(mockImmich({ limitedKeys: ["weak"] }).fetch, { ...conn, apiKey: "weak" })).rejects.toThrow(
      /asset\.download/,
    );
    await expect(check(mockImmich({ down: true }).fetch)).rejects.toThrow(/Couldn't reach .*ECONNREFUSED/);
    await expect(check(mockImmich().fetch, { ...conn, server: "http://nas.local:2283/wrong" })).rejects.toThrow(
      /not as an Immich server/,
    );
    await expect(check(mockImmich({ down: true }).fetch)).rejects.toBeInstanceOf(ImmichError);
  });

  it("lists owned and shared albums once each", async () => {
    const server = mockImmich({
      albums: [
        { id: "a", albumName: "Mine", assets: [] },
        { id: "b", albumName: "Shared with me", shared: true, assets: [] },
      ],
    });
    const albums = await immichClient(server.fetch, conn).albums();
    expect(albums.map((a) => a.albumName)).toEqual(["Mine", "Shared with me"]);
  });

  it("lists owned albums when the server won't filter shared ones", async () => {
    const server = mockImmich({ noSharedFilter: true, albums: [{ id: "a", albumName: "Mine", assets: [] }] });
    expect((await immichClient(server.fetch, conn).albums()).map((a) => a.id)).toEqual(["a"]);
  });

  it("reads an album's photos page by page", async () => {
    const assets = Array.from({ length: 5 }, (_, i) => asset(`x${i}`, `IMG_${i}.JPG`));
    const server = mockImmich({ pageSize: 2, albums: [{ id: "al", albumName: "Big", assets }] });
    const got = await immichClient(server.fetch, conn).albumAssets("al");
    expect(got.map((a) => a.id)).toEqual(["x0", "x1", "x2", "x3", "x4"]);
    const searches = server.calls.filter((c) => c.path === "/api/search/metadata");
    expect(searches.map((c) => (c.body as { page: number }).page)).toEqual([1, 2, 3]);
    expect(searches[0].body).toMatchObject({ albumIds: ["al"], withExif: true });
  });

  it("reads them from the album itself on a server without album search", async () => {
    const server = mockImmich({ noSearch: true, albums: [{ id: "al", albumName: "Old", assets: [asset("o1", "a.jpg")] }] });
    expect((await immichClient(server.fetch, conn).albumAssets("al")).map((a) => a.id)).toEqual(["o1"]);
  });

  it("asks for the smallest preview that covers the grid's size", async () => {
    const server = mockImmich({ albums: [{ id: "al", albumName: "A", assets: [asset("p", "p.jpg")] }] });
    const client = immichClient(server.fetch, conn);
    expect(await (await client.preview("p", 200)).text()).toBe("thumb:p:thumbnail");
    expect(await (await client.preview("p", 768)).text()).toBe("thumb:p:preview");
    expect(PREVIEW_SIZE_LIMIT).toBe(250);
  });

  it("reads the server's full-size rendering of a photo", async () => {
    const server = mockImmich({ albums: [{ id: "al", albumName: "A", assets: [asset("h", "IMG_1.HEIC")] }] });
    expect(await (await immichClient(server.fetch, conn).rendition("h")).text()).toBe("thumb:h:fullsize");
    expect(server.calls.some((c) => c.path.endsWith("/original"))).toBe(false);
  });

  it("reads its preview-sized rendering from a server without full-size ones", async () => {
    const server = mockImmich({ noFullsize: true, albums: [{ id: "al", albumName: "A", assets: [asset("h", "IMG_1.HEIC")] }] });
    expect(await (await immichClient(server.fetch, conn).rendition("h")).text()).toBe("thumb:h:preview");
  });

  it("downloads an original with a time limit fitted to its size", async () => {
    const server = mockImmich({ albums: [{ id: "al", albumName: "A", assets: [asset("r", "r.NEF", { bytes: "RAWDATA" })] }] });
    const blob = await immichClient(server.fetch, conn).original("r", 50_000_000);
    expect(await blob.text()).toBe("RAWDATA");
    const call = server.calls.find((c) => c.path === "/api/assets/r/original")!;
    expect(call.timeoutMs).toBe(originalTimeoutMs(50_000_000));
    expect(originalTimeoutMs(undefined)).toBe(10 * 60_000);
    expect(originalTimeoutMs(50_000_000)).toBeGreaterThan(60_000);
    expect(originalTimeoutMs(10 ** 12)).toBe(30 * 60_000);
  });
});

describe("every request", () => {
  it("has a time limit", async () => {
    const assets = [asset("p", "p.jpg"), asset("h", "h.HEIC")];
    const server = mockImmich({ albums: [{ id: "al", albumName: "A", assets }] });
    const client = immichClient(server.fetch, conn);
    await client.checkConnection();
    await client.albumAssets("al");
    await client.preview("p", 768);
    await client.rendition("h");
    await client.original("p", 4);
    expect(server.calls.length).toBeGreaterThan(6);
    expect(server.calls.filter((c) => !(typeof c.timeoutMs === "number" && c.timeoutMs > 0))).toEqual([]);
  });

  it("says plainly when the server doesn't answer in time", async () => {
    const late = async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    };
    await expect(immichClient(late, conn).albums()).rejects.toThrow("The server at http://nas.local:2283 didn't answer in time.");
    await expect(immichClient(late, conn).preview("p", 768)).rejects.toThrow(/didn't answer in time/);
  });
});

describe("itemOf", () => {
  it("lists a photo with what Immich knows of it", () => {
    const item = itemOf(
      asset("id1", "IMG_0001.CR3", {
        originalMimeType: "image/x-canon-cr3",
        fileModifiedAt: "2024-06-02T10:00:00.000Z",
        localDateTime: "2024-06-01T08:26:40.000Z",
        exifInfo: {
          make: "Canon",
          model: "EOS R5",
          lensModel: "RF24-70mm F2.8 L IS USM",
          fNumber: 2.8,
          focalLength: 50,
          iso: 400,
          exposureTime: "1/250",
          dateTimeOriginal: "2024-06-01T06:26:40.000Z",
          orientation: "6",
          exifImageWidth: 8192,
          exifImageHeight: 5464,
          latitude: 49.28,
          longitude: -123.12,
          description: "Harbour",
          rating: 4,
          fileSizeInByte: 45_000_000,
        },
      }),
    );
    expect(item).toEqual({
      key: "id1",
      name: "IMG_0001.CR3",
      size: 45_000_000,
      modified: Date.parse("2024-06-02T10:00:00.000Z"),
      taken: Date.parse("2024-06-01T06:26:40.000Z"),
      width: 5464,
      height: 8192,
      mimeType: "image/x-canon-cr3",
      rating: 4,
      exif: {
        cameraMake: "Canon",
        cameraModel: "EOS R5",
        lens: "RF24-70mm F2.8 L IS USM",
        aperture: 2.8,
        focalLength: 50,
        iso: 400,
        shutterSpeed: "1/250",
        dateTimeOriginal: "2024:06:01 08:26:40",
        orientation: 6,
        gpsLatitude: 49.28,
        gpsLongitude: -123.12,
        imageDescription: "Harbour",
      },
    });
  });

  it("takes the asset's own size, which Immich gives upright, before the EXIF one", () => {
    expect(itemOf(asset("a", "a.jpg", { width: 4000, height: 3000, exifInfo: { orientation: "6" } }))).toMatchObject({
      width: 4000,
      height: 3000,
    });
  });

  it("lists a photo Safelight can't open as the server's rendering of it, upright and of no known size", () => {
    const item = itemOf(
      asset("h1", "IMG_0001.HEIC", {
        originalMimeType: "image/heic",
        width: 3024,
        height: 4032,
        exifInfo: { make: "Apple", orientation: "6", fileSizeInByte: 2_000_000 },
      }),
    );
    expect(item).toMatchObject({ key: "h1", name: "IMG_0001.HEIC.jpg", mimeType: "image/jpeg", width: 3024, height: 4032 });
    expect(item?.size).toBeUndefined();
    expect(item?.exif).toMatchObject({ cameraMake: "Apple" });
    expect(item?.exif?.orientation).toBeUndefined();
  });

  it("leaves out videos and photos in the trash", () => {
    expect(itemOf(asset("v", "clip.MOV", { type: "VIDEO" }))).toBeNull();
    expect(itemOf(asset("t", "gone.jpg", { isTrashed: true }))).toBeNull();
  });

  it("keeps a photo whose EXIF Immich hasn't read", () => {
    expect(itemOf(asset("n", "new.jpg", { exifInfo: undefined }))).toMatchObject({ key: "n", name: "new.jpg", exif: {} });
  });
});
