// Immich Web Folders — a Safelight extension.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 or later;
// see LICENSE.

// A small client for the Immich REST API, as its OpenAPI spec describes it: an
// API key in the x-api-key header; albums from /api/albums (owned, then
// ?shared=true); an album's photos from POST /api/search/metadata, a page at a
// time, or from GET /api/albums/{id} on servers that predate album search; a
// preview from /api/assets/{id}/thumbnail, the file from
// /api/assets/{id}/original, and for a photo Safelight can't open the server's
// full-size rendering (thumbnail?size=fullsize, or the preview size on servers
// without one). Every request has a time limit. The key is never written
// anywhere but the request header.

import { renditionName } from "./formats";
import type { ExifData, LibrarySourceItem, NetworkRequestInit } from "./safelight";

export type Fetcher = (url: string, init?: NetworkRequestInit) => Promise<Response>;

export interface Connection {
  /** The server's address as normalizeServer gives it. */
  server: string;
  apiKey: string;
}

export interface Account {
  userId: string;
  userName: string;
  version: string;
  albumCount: number;
}

export interface ImmichAlbum {
  id: string;
  albumName: string;
}

/** The fields of an Immich AssetResponseDto the extension reads. */
export interface ImmichAsset {
  id: string;
  type?: string;
  originalFileName: string;
  originalMimeType?: string;
  fileCreatedAt?: string;
  fileModifiedAt?: string;
  localDateTime?: string;
  isTrashed?: boolean;
  width?: number | null;
  height?: number | null;
  exifInfo?: ImmichExif | null;
}

interface ImmichExif {
  make?: string | null;
  model?: string | null;
  lensModel?: string | null;
  fNumber?: number | null;
  focalLength?: number | null;
  iso?: number | null;
  exposureTime?: string | null;
  dateTimeOriginal?: string | null;
  orientation?: string | number | null;
  exifImageWidth?: number | null;
  exifImageHeight?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  rating?: number | null;
  fileSizeInByte?: number | null;
}

/** Something the person can act on, in their words. */
export class ImmichError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ImmichError";
    this.status = status;
  }
}

const JSON_TIMEOUT_MS = 20_000;
const PREVIEW_TIMEOUT_MS = 30_000;
/** A full-size rendering is a JPEG of a few MB. */
const RENDITION_TIMEOUT_MS = 5 * 60_000;
const PAGE_SIZE = 1000;
const MOST_PAGES = 500;
/** Immich's "thumbnail" size is 250 px on its short edge by default; its
 *  "preview" about 1440 px. */
export const PREVIEW_SIZE_LIMIT = 250;

/** The address the person typed, as the client uses it: http(s), no user name
 *  or password, without a trailing slash or the /api the API sits under.
 *  An address typed without a scheme is taken as http, as Immich serves on a
 *  LAN by default. Null when it isn't a web address. */
export function normalizeServer(input: string): string | null {
  const typed = input.trim();
  if (!typed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(typed) ? typed : `http://${typed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password || !url.hostname) return null;
  const path = url.pathname.replace(/\/+$/, "").replace(/\/api$/i, "");
  return `${url.origin}${path}`;
}

/** How long an original of `size` bytes may take: a minute, plus a second for
 *  every 512 KiB, within 30 minutes; ten minutes when the size isn't known. */
export function originalTimeoutMs(size: number | undefined): number {
  if (!size) return 10 * 60_000;
  return Math.min(30 * 60_000, 60_000 + Math.ceil(size / (512 * 1024)) * 1000);
}

function failureOf(error: unknown, server: string): ImmichError {
  if (error instanceof ImmichError) return error;
  if (error instanceof DOMException && error.name === "AbortError") return new ImmichError("Stopped.");
  if (error instanceof DOMException && error.name === "TimeoutError")
    return new ImmichError(`The server at ${server} didn't answer in time.`);
  const why = error instanceof Error ? error.message : String(error);
  return new ImmichError(`Couldn't reach the server at ${server} (${why}). Check the address and that the server is running.`);
}

function statusError(status: number): ImmichError {
  if (status === 401) return new ImmichError("Immich refused the API key. Check it, or create a new one.", status);
  if (status === 403)
    return new ImmichError(
      "The API key is missing a permission Safelight needs: user.read, album.read, asset.read, asset.view and asset.download.",
      status,
    );
  return new ImmichError(`The server answered with an error (${status}).`, status);
}

const notImmich = () =>
  new ImmichError(
    "That address answered, but not as an Immich server. Check the address and port (Immich uses 2283 unless set otherwise).",
  );

export function immichClient(fetcher: Fetcher, conn: Connection) {
  const url = (path: string) => `${conn.server}/api${path}`;
  const keyed = { "x-api-key": conn.apiKey };

  async function send(path: string, init: NetworkRequestInit): Promise<Response> {
    try {
      return await fetcher(url(path), init);
    } catch (error) {
      throw failureOf(error, conn.server);
    }
  }

  async function json<T>(path: string, init: NetworkRequestInit = {}): Promise<T> {
    const res = await send(path, {
      timeoutMs: JSON_TIMEOUT_MS,
      ...init,
      headers: { ...keyed, accept: "application/json", ...init.headers },
    });
    if (!res.ok) throw statusError(res.status);
    try {
      return (await res.json()) as T;
    } catch {
      throw notImmich();
    }
  }

  async function albums(signal?: AbortSignal): Promise<ImmichAlbum[]> {
    const owned = await json<ImmichAlbum[]>("/albums", { signal });
    const shared = await json<ImmichAlbum[]>("/albums?shared=true", { signal }).catch((error: unknown) => {
      if (error instanceof ImmichError && error.status === 400) return [];
      throw error;
    });
    const seen = new Set<string>();
    return [...owned, ...shared].filter((a) => !seen.has(a.id) && seen.add(a.id));
  }

  interface SearchPage {
    assets: { items: ImmichAsset[]; nextPage: string | null; nextCursor?: string | null };
  }

  async function albumAssets(albumId: string, signal?: AbortSignal): Promise<ImmichAsset[]> {
    const out: ImmichAsset[] = [];
    let next: { page: number } | { cursor: string } | null = { page: 1 };
    try {
      for (let n = 0; next && n < MOST_PAGES; n++) {
        const body = { albumIds: [albumId], withExif: true, size: PAGE_SIZE, ...next };
        const page: SearchPage = await json<SearchPage>("/search/metadata", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal,
        });
        out.push(...page.assets.items);
        const { nextPage, nextCursor } = page.assets;
        next = nextPage ? { page: Number(nextPage) } : nextCursor ? { cursor: nextCursor } : null;
      }
      return out;
    } catch (error) {
      if (!(error instanceof ImmichError) || error.status !== 400 || out.length > 0) throw error;
      const album = await json<{ assets?: ImmichAsset[] }>(`/albums/${encodeURIComponent(albumId)}`, { signal });
      return album.assets ?? [];
    }
  }

  return {
    /** Server, key and account, as Test connection checks them. */
    async checkConnection(signal?: AbortSignal): Promise<Account> {
      const ping = await send("/server/ping", { timeoutMs: JSON_TIMEOUT_MS, signal });
      const pong = ping.ok ? ((await ping.json().catch(() => null)) as { res?: string } | null) : null;
      if (pong?.res !== "pong") throw notImmich();
      const v = await json<{ major: number; minor: number; patch: number }>("/server/version", { signal });
      const me = await json<{ id: string; name: string }>("/users/me", { signal });
      const list = await albums(signal);
      return { userId: me.id, userName: me.name, version: `${v.major}.${v.minor}.${v.patch}`, albumCount: list.length };
    },
    albums,
    albumAssets,
    /** A preview at least `maxEdge` px where Immich has one that size. */
    async preview(assetId: string, maxEdge: number, signal?: AbortSignal): Promise<Blob> {
      const size = maxEdge <= PREVIEW_SIZE_LIMIT ? "thumbnail" : "preview";
      const res = await send(`/assets/${encodeURIComponent(assetId)}/thumbnail?size=${size}`, {
        headers: keyed,
        timeoutMs: PREVIEW_TIMEOUT_MS,
        signal,
      });
      if (!res.ok) throw statusError(res.status);
      return res.blob();
    },
    /** The server's own JPEG of the whole photo: full size where the server makes
     *  one, else its preview size. */
    async rendition(assetId: string, signal?: AbortSignal): Promise<Blob> {
      const read = (size: string) =>
        send(`/assets/${encodeURIComponent(assetId)}/thumbnail?size=${size}`, {
          headers: keyed,
          timeoutMs: RENDITION_TIMEOUT_MS,
          signal,
        });
      let res = await read("fullsize");
      if (res.status === 400) res = await read("preview");
      if (!res.ok) throw statusError(res.status);
      return res.blob();
    },
    async original(assetId: string, size: number | undefined, signal?: AbortSignal): Promise<Blob> {
      const res = await send(`/assets/${encodeURIComponent(assetId)}/original`, {
        headers: keyed,
        timeoutMs: originalTimeoutMs(size),
        signal,
      });
      if (!res.ok) throw statusError(res.status);
      return res.blob();
    },
  };
}

export type ImmichClient = ReturnType<typeof immichClient>;

/** `fields` without the ones left undefined. */
function defined<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as Partial<T>;
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const text = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const time = (v: unknown): number | undefined => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : undefined;
};

/** Immich's localDateTime is the wall-clock time where the photo was taken,
 *  written as if it were UTC; EXIF writes that time as "YYYY:MM:DD HH:MM:SS". */
function exifDate(local: string | undefined): string | undefined {
  const t = time(local);
  if (t === undefined) return undefined;
  const d = new Date(t);
  const two = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}:${two(d.getUTCMonth() + 1)}:${two(d.getUTCDate())} ` +
    `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}`
  );
}

/** The photo as a library source lists it; null for a video, or a photo in the
 *  trash. Sizes are upright: Immich's own width and height are, the EXIF ones
 *  are the sensor's and are turned by the orientation. A photo Safelight can't
 *  open is listed as the server's rendering of it (see formats.ts): a JPEG,
 *  upright already, of a size nobody knows ahead. */
export function itemOf(asset: ImmichAsset): LibrarySourceItem | null {
  if ((asset.type && asset.type !== "IMAGE") || asset.isTrashed) return null;
  const e = asset.exifInfo ?? {};
  const orientation = Number(e.orientation);
  const exif: ExifData = {};
  const set = <K extends keyof ExifData>(key: K, value: ExifData[K] | undefined) => {
    if (value !== undefined) exif[key] = value;
  };
  set("cameraMake", text(e.make));
  set("cameraModel", text(e.model));
  set("lens", text(e.lensModel));
  set("aperture", num(e.fNumber));
  set("focalLength", num(e.focalLength));
  set("iso", num(e.iso));
  set("shutterSpeed", text(e.exposureTime));
  set("dateTimeOriginal", exifDate(asset.localDateTime));
  set("orientation", Number.isInteger(orientation) && orientation >= 1 && orientation <= 8 ? orientation : undefined);
  set("gpsLatitude", num(e.latitude));
  set("gpsLongitude", num(e.longitude));
  set("imageDescription", text(e.description));

  const turned = exif.orientation !== undefined && exif.orientation >= 5;
  const [w, h] =
    num(asset.width) && num(asset.height)
      ? [num(asset.width), num(asset.height)]
      : turned
        ? [num(e.exifImageHeight), num(e.exifImageWidth)]
        : [num(e.exifImageWidth), num(e.exifImageHeight)];

  const rendition = renditionName(asset.originalFileName);
  if (rendition) {
    delete exif.orientation;
    return {
      key: asset.id,
      name: rendition,
      mimeType: "image/jpeg",
      ...defined({
        modified: time(asset.fileModifiedAt),
        taken: time(e.dateTimeOriginal) ?? time(asset.fileCreatedAt),
        width: w,
        height: h,
        rating: num(e.rating),
      }),
      exif,
    };
  }
  return {
    key: asset.id,
    name: asset.originalFileName,
    ...defined({
      size: num(e.fileSizeInByte),
      modified: time(asset.fileModifiedAt),
      taken: time(e.dateTimeOriginal) ?? time(asset.fileCreatedAt),
      width: w,
      height: h,
      mimeType: text(asset.originalMimeType),
      rating: num(e.rating),
    }),
    exif,
  };
}
