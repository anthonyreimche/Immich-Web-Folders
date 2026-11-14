// Immich Web Folders — a Safelight extension.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 or later;
// see LICENSE.

// How much space the downloaded originals may take on this computer, as the
// person chose it in the extension's settings. Safelight keeps the originals
// and removes the ones used longest ago past the limit.

import type { SafelightAPI } from "./safelight";

export const GB = 1024 ** 3;

/** The settings key: a number of GB, or null for no limit. */
export const ORIGINALS_LIMIT_KEY = "originalsLimitGB";

export const DEFAULT_LIMIT_GB = 10;

/** The limits offered, in GB; null is "No limit". */
export const LIMIT_CHOICES: readonly (number | null)[] = [2, 5, 10, 25, 50, 100, null];

/** The chosen limit in GB, or null for none. A stored value that isn't one of
 *  the choices counts as the default. */
export function savedLimitGB(settings: SafelightAPI["settings"]): number | null {
  const value = settings.get<unknown>(ORIGINALS_LIMIT_KEY, DEFAULT_LIMIT_GB);
  return value === null || (typeof value === "number" && LIMIT_CHOICES.includes(value)) ? value : DEFAULT_LIMIT_GB;
}

/** The limit as Safelight takes it: bytes, or null for none. */
export function originalsLimit(settings: SafelightAPI["settings"]): number | null {
  const gb = savedLimitGB(settings);
  return gb === null ? null : gb * GB;
}

/** A byte count in words: "0 bytes", "820 KB", "3.4 GB". */
export function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
