// Immich Web Folders — a Safelight extension.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 or later;
// see LICENSE.

// A card over the Develop canvas, shown the first times a photo Safelight can't
// open (a HEIC, say) is open in Develop: what is edited there is Immich's JPEG
// rendering of it, not the original file. "Got it" puts it away for that photo
// for good. It reads only the catalogue and this extension's settings.

import { SOURCE_ID } from "./connection";
import { renderedFrom } from "./formats";
import { React, api } from "./rt";

/** The settings key: the Immich ids of the photos the notice was dismissed for. */
export const NOTICES_SEEN_KEY = "renditionNoticesSeen";

/** How many dismissals are remembered; past it the oldest are let go. */
const SEEN_KEPT = 2000;

function seenList(): string[] {
  const value = api.settings.get<unknown>(NOTICES_SEEN_KEY, []);
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function RenditionNotice() {
  const { Button, tokens } = api.ui;
  const open = api.library.useOpenSource();
  const photo = api.catalog.useActivePhoto();
  const [seen, setSeen] = React.useState(() => new Set(seenList()));

  const key = photo?.sourceKey;
  const rendition = open?.id === SOURCE_ID && photo ? renderedFrom(photo.filename) : null;
  if (!rendition || key === undefined || seen.has(key)) return null;

  const dismiss = () => {
    const next = [...seenList().filter((k) => k !== key), key].slice(-SEEN_KEPT);
    api.settings.set(NOTICES_SEEN_KEY, next);
    setSeen(new Set(next));
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: 440,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 6,
        background: tokens.surface2,
        border: `1px solid ${tokens.border}`,
        color: tokens.textPrimary,
        fontSize: 12,
        lineHeight: 1.45,
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
        pointerEvents: "auto",
      }}
    >
      <p role="status" style={{ margin: 0 }}>
        You're editing Immich's rendering of {rendition.original}, not the original file: Safelight can't open{" "}
        {rendition.format} files yet. Edits and exports start from this JPEG.
      </p>
      <Button size="sm" onClick={dismiss}>
        Got it
      </Button>
    </div>
  );
}
