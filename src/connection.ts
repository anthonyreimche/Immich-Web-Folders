// Immich Web Folders — a Safelight extension.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 or later;
// see LICENSE.

// The connection the person set up, kept in the extension's settings store
// (where Safelight keeps every extension's settings, on this computer only).
// A connection counts once Test connection has passed: then the server, the
// key and the account it belongs to are kept together, as one value, so the
// other windows never see half of a change. Disconnect forgets it but keeps
// the address, ready to connect again.

import type { SafelightAPI } from "./safelight";

export const EXTENSION_ID = "immich-web-folders";
/** The library source's id, under the extension's own. */
export const SOURCE_ID = `${EXTENSION_ID}.immich`;

/** The settings keys: the address as last typed, and the connection. */
export const SERVER_KEY = "server";
export const CONNECTION_KEY = "connection";

export interface SavedConnection {
  server: string;
  apiKey: string;
  userId: string;
  userName: string;
}

type Settings = SafelightAPI["settings"];

/** The address last typed in, connected or not. */
export function savedServer(settings: Settings): string {
  const value = settings.get<unknown>(SERVER_KEY, "");
  return typeof value === "string" ? value : "";
}

/** The connection Test connection last passed, or null. A stored value of any
 *  other shape counts as none. */
export function savedConnection(settings: Settings): SavedConnection | null {
  const value = settings.get<unknown>(CONNECTION_KEY, null);
  if (typeof value !== "object" || value === null) return null;
  const { server, apiKey, userId, userName } = value as Record<string, unknown>;
  if (typeof server !== "string" || typeof apiKey !== "string" || typeof userId !== "string") return null;
  if (!server || !apiKey || !userId) return null;
  return { server, apiKey, userId, userName: typeof userName === "string" ? userName : "" };
}

export function saveConnection(settings: Settings, c: SavedConnection): void {
  settings.set(SERVER_KEY, c.server);
  settings.set(CONNECTION_KEY, { server: c.server, apiKey: c.apiKey, userId: c.userId, userName: c.userName });
}

export function forgetConnection(settings: Settings): void {
  settings.set(CONNECTION_KEY, null);
}

/** Which Immich library a connection shows: a server and an account. */
export const libraryOf = (c: SavedConnection): string => `${c.server}#${c.userId}`;
