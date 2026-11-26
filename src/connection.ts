// Immich Web Folders — a Safelight extension.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 or later;
// see LICENSE.

// The connection the person set up. Its server, account and name sit in the
// extension's settings store (where Safelight keeps every extension's settings,
// on this computer only); its API key is kept encrypted by the operating
// system's keychain (api.secrets), never in the settings. A connection counts
// once Test connection has passed: the key is kept first, then the rest, so the
// other windows never see half of a change. Disconnect forgets it but keeps the
// address, ready to connect again.

import type { SafelightAPI } from "./safelight";

export const EXTENSION_ID = "immich-web-folders";
/** The library source's id, under the extension's own. */
export const SOURCE_ID = `${EXTENSION_ID}.immich`;

/** The settings keys: the address as last typed, and the connection. */
export const SERVER_KEY = "server";
export const CONNECTION_KEY = "connection";
/** The keychain key the API key is kept under. */
export const API_KEY_SECRET = "api-key";

export interface SavedConnection {
  server: string;
  apiKey: string;
  userId: string;
  userName: string;
}

/** What the settings keep of a connection: everything but the key. */
export type StoredConnection = Omit<SavedConnection, "apiKey">;

type Settings = SafelightAPI["settings"];
type Stores = Pick<SafelightAPI, "settings" | "secrets">;

/** The address last typed in, connected or not. */
export function savedServer(settings: Settings): string {
  const value = settings.get<unknown>(SERVER_KEY, "");
  return typeof value === "string" ? value : "";
}

/** The connection the settings keep, or null. A stored value of any other
 *  shape counts as none. */
function storedConnection(settings: Settings): StoredConnection | null {
  const value = settings.get<unknown>(CONNECTION_KEY, null);
  if (typeof value !== "object" || value === null) return null;
  const { server, userId, userName } = value as Record<string, unknown>;
  if (typeof server !== "string" || typeof userId !== "string") return null;
  if (!server || !userId) return null;
  return { server, userId, userName: typeof userName === "string" ? userName : "" };
}

/** The connection Test connection last passed, or null: none, or no key kept. */
export async function savedConnection({ settings, secrets }: Stores): Promise<SavedConnection | null> {
  const stored = storedConnection(settings);
  if (!stored) return null;
  const apiKey = await secrets.get(API_KEY_SECRET).catch(() => null);
  return apiKey ? { ...stored, apiKey } : null;
}

/** Rejects where there is no keychain to keep the key in; nothing is saved. */
export async function saveConnection({ settings, secrets }: Stores, c: SavedConnection): Promise<void> {
  await secrets.set(API_KEY_SECRET, c.apiKey);
  settings.set(SERVER_KEY, c.server);
  settings.set(CONNECTION_KEY, { server: c.server, userId: c.userId, userName: c.userName });
}

export async function forgetConnection({ settings, secrets }: Stores): Promise<void> {
  settings.set(CONNECTION_KEY, null);
  await secrets.delete(API_KEY_SECRET).catch(() => {});
}

/** Move an API key an earlier version kept in the settings into the keychain.
 *  With no keychain to take it, it stays where it is. */
export async function migrateApiKey({ settings, secrets }: Stores): Promise<void> {
  const value = settings.get<unknown>(CONNECTION_KEY, null);
  if (typeof value !== "object" || value === null || !("apiKey" in value)) return;
  const { apiKey, ...rest } = value as Record<string, unknown>;
  if (typeof apiKey === "string" && apiKey) {
    try {
      await secrets.set(API_KEY_SECRET, apiKey);
    } catch {
      return;
    }
  }
  settings.set(CONNECTION_KEY, rest);
}

/** Which Immich library a connection shows: a server and an account. */
export const libraryOf = (c: SavedConnection): string => `${c.server}#${c.userId}`;
