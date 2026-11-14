// Immich Web Folders — a Safelight extension.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 or later;
// see LICENSE.

// Which originals Safelight opens, and how a photo it can't (HEIC, JPEG XL, GIF
// and the like) is listed instead: as the server's rendering of it, a JPEG
// named after the original with ".jpg" added, so the grid, the Info panel and
// Develop all show what it is. The name is what tells a rendering apart again,
// in the source and in the catalogue.

/** The file types Safelight 3.2.4 opens: its standard images and the RAW
 *  formats it decodes (electron/photo-types.json). */
const OPENS = new Set([
  "jpg", "jpeg", "png", "webp", "avif", "tif", "tiff", "ppm", "pgm", "pbm", "pnm",
  "nef", "nrw", "cr2", "cr3", "crw", "arw", "srf", "sr2", "dng", "orf", "raf", "pef", "srw", "rw2",
  "iiq", "3fr", "fff", "kdc", "dcr", "mos", "mrw", "erf", "x3f", "rwl", "gpr", "mef", "raw", "mdc",
]);

const typeOf = (name: string): string | null => {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1) : null;
};

/** The name the server's rendering of `originalName` is listed under, or null
 *  when Safelight opens the original itself (or it names no type at all, which
 *  Safelight passes over). */
export function renditionName(originalName: string): string | null {
  const type = typeOf(originalName);
  return type && !OPENS.has(type.toLowerCase()) ? `${originalName}.jpg` : null;
}

/** What Safelight adds before ".jpg" to tell two photos of one name apart: a
 *  space and up to 8 characters of the key in brackets. */
const TOLD_APART = / \([A-Za-z0-9._-]{1,8}\)$/;

/** The original's name and format ("IMG_0001.HEIC", "HEIC") when `name` is a
 *  rendering's, as listed or as the catalogue shows it, else null. */
export function renderedFrom(name: string): { original: string; format: string } | null {
  if (!/\.jpg$/i.test(name)) return null;
  const original = name.slice(0, -4).replace(TOLD_APART, "");
  const type = typeOf(original);
  return type && renditionName(original) ? { original, format: type.toUpperCase() } : null;
}
