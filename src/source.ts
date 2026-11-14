// Immich Web Folders — a Safelight extension.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 or later;
// see LICENSE.

// Immich as a Safelight library source: each album a folder of its photos.
// Safelight keeps the catalogue, the previews and the originals it reads, within
// the limit the person chose; this only answers what it asks for. A photo
// Safelight can't open is read as the server's rendering of it (formats.ts).

import { SOURCE_ID, libraryOf, savedConnection, type SavedConnection } from "./connection";
import { renderedFrom } from "./formats";
import { immichClient, itemOf, type Fetcher } from "./immich";
import { originalsLimit } from "./originals";
import type { LibrarySourceContribution, LibrarySourceFolder, SafelightAPI } from "./safelight";

/** How many albums are listed at once. */
const ALBUMS_AT_ONCE = 4;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export function immichSource(
  fetcher: Fetcher,
  conn: SavedConnection,
  keptOriginalsLimit: number | null,
): LibrarySourceContribution {
  const client = immichClient(fetcher, conn);
  return {
    id: SOURCE_ID,
    name: "Immich",
    library: libraryOf(conn),
    keptOriginalsLimit,
    async list({ signal }) {
      const albums = await client.albums(signal);
      const folders = await mapLimit(
        albums,
        ALBUMS_AT_ONCE,
        async (album): Promise<LibrarySourceFolder> => ({
          name: album.albumName,
          key: album.id,
          items: (await client.albumAssets(album.id, signal)).flatMap((a) => itemOf(a) ?? []),
        }),
      );
      return { folders };
    },
    readPreview: (item, { maxEdge, signal }) => client.preview(item.key, maxEdge, signal),
    readOriginal: (item, { signal }) =>
      renderedFrom(item.name) ? client.rendition(item.key, signal) : client.original(item.key, item.size, signal),
  };
}

/** Register the source of the saved connection, with the kept originals' limit,
 *  or none without one. A new account or server is another library, which
 *  Safelight opens as another catalogue. */
export function syncSource(api: SafelightAPI): void {
  const conn = savedConnection(api.settings);
  if (conn)
    api.library.registerSource(
      immichSource((url, init) => api.network.fetch(url, init), conn, originalsLimit(api.settings)),
    );
  else api.library.unregisterSource(SOURCE_ID);
}
