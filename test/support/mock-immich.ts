// A stand-in Immich server for the tests, answering the REST endpoints the
// extension uses as Immich's OpenAPI spec describes them (x-api-key auth,
// /api/albums, /api/search/metadata pages, /api/assets/{id}/thumbnail and
// /original). No test reaches a real server.

import type { NetworkRequestInit } from "../../src/safelight";

export interface MockAsset {
  id: string;
  type?: "IMAGE" | "VIDEO";
  originalFileName: string;
  originalMimeType?: string;
  fileCreatedAt?: string;
  fileModifiedAt?: string;
  localDateTime?: string;
  isTrashed?: boolean;
  width?: number | null;
  height?: number | null;
  exifInfo?: Record<string, unknown>;
  bytes?: string;
}

export interface MockAlbum {
  id: string;
  albumName: string;
  shared?: boolean;
  assets: MockAsset[];
}

export interface MockOptions {
  key?: string;
  albums?: MockAlbum[];
  /** Results per search page. */
  pageSize?: number;
  /** Answer search with 400, as a server older than album search does. */
  noSearch?: boolean;
  /** Answer the shared-album listing with 400. */
  noSharedFilter?: boolean;
  /** Every request fails as an unreachable server does. */
  down?: boolean;
  /** Keys refused with 403 (missing permissions). */
  limitedKeys?: string[];
  /** Answer size=fullsize with 400, as a server older than full-size renderings does. */
  noFullsize?: boolean;
}

export interface Call {
  method: string;
  path: string;
  query: string;
  headers: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export const SERVER = "http://nas.local:2283";

export function mockImmich(opts: MockOptions = {}) {
  const key = opts.key ?? "good-key";
  const albums = opts.albums ?? [];
  const calls: Call[] = [];
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
  const allAssets = () => albums.flatMap((a) => a.assets);

  const fetch = async (url: string, init: NetworkRequestInit = {}): Promise<Response> => {
    const u = new URL(url);
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ method, path: u.pathname, query: u.search, headers: init.headers ?? {}, body, timeoutMs: init.timeoutMs });
    if (init.signal?.aborted) throw new DOMException("stopped", "AbortError");
    if (opts.down) throw new TypeError("fetch failed (ECONNREFUSED)");
    if (u.origin !== SERVER) throw new TypeError("fetch failed (ENOTFOUND)");
    const path = u.pathname;
    if (path === "/api/server/ping") return json({ res: "pong" });
    if (path === "/api/server/version") return json({ major: 2, minor: 3, patch: 1, prerelease: null, featureLevel: 1 });
    if (!path.startsWith("/api/")) return new Response("<html>not here</html>", { status: 404 });
    const given = init.headers?.["x-api-key"];
    if (given !== key && !(opts.limitedKeys ?? []).includes(given ?? "")) return json({ message: "Invalid API key" }, 401);
    if ((opts.limitedKeys ?? []).includes(given ?? "")) return json({ message: "Missing required permission" }, 403);

    if (path === "/api/users/me") return json({ id: "user-1", name: "Anna", email: "anna@example.com" });
    if (path === "/api/albums" && method === "GET") {
      const shared = u.searchParams.get("shared");
      if (shared !== null && opts.noSharedFilter) return json({ message: "bad" }, 400);
      const list = albums.filter((a) => (shared === "true" ? a.shared : !a.shared));
      return json(list.map((a) => ({ id: a.id, albumName: a.albumName, assetCount: a.assets.length, shared: !!a.shared })));
    }
    const albumMatch = /^\/api\/albums\/([^/]+)$/.exec(path);
    if (albumMatch) {
      const album = albums.find((a) => a.id === albumMatch[1]);
      return album ? json({ id: album.id, albumName: album.albumName, assets: album.assets }) : json({}, 404);
    }
    if (path === "/api/search/metadata" && method === "POST") {
      if (opts.noSearch) return json({ message: "property albumIds should not exist" }, 400);
      const b = body as { albumIds?: string[]; page?: number; size?: number; cursor?: string };
      const album = albums.find((a) => a.id === b.albumIds?.[0]);
      const items = album?.assets ?? [];
      const size = opts.pageSize ?? b.size ?? 250;
      const page = b.cursor ? Number(b.cursor) : (b.page ?? 1);
      const slice = items.slice((page - 1) * size, page * size);
      const more = page * size < items.length;
      return json({
        albums: { items: [], count: 0, total: 0, facets: [], nextPage: null },
        assets: {
          items: slice,
          count: slice.length,
          total: items.length,
          facets: [],
          nextPage: more ? String(page + 1) : null,
          nextCursor: null,
        },
      });
    }
    const asset = /^\/api\/assets\/([^/]+)\/(thumbnail|original)$/.exec(path);
    if (asset) {
      const found = allAssets().find((a) => a.id === asset[1]);
      if (!found) return json({ message: "Not found" }, 404);
      if (asset[2] === "thumbnail") {
        const size = u.searchParams.get("size");
        if (size === "fullsize" && opts.noFullsize) return json({ message: "size must be one of thumbnail, preview" }, 400);
        return new Response(`thumb:${found.id}:${size}`, { headers: { "content-type": "image/jpeg" } });
      }
      return new Response(found.bytes ?? `original:${found.id}`, { headers: { "content-type": "application/octet-stream" } });
    }
    return json({ message: "Not found" }, 404);
  };

  return { fetch, calls, key };
}

export const asset = (id: string, name: string, extra: Partial<MockAsset> = {}): MockAsset => ({
  id,
  type: "IMAGE",
  originalFileName: name,
  originalMimeType: "image/jpeg",
  fileCreatedAt: "2024-06-01T10:00:00.000Z",
  fileModifiedAt: "2024-06-02T10:00:00.000Z",
  localDateTime: "2024-06-01T12:00:00.000Z",
  isTrashed: false,
  ...extra,
});
