// The card over the Develop canvas that tells the person, once per photo, that
// what they are editing is Immich's rendering of a photo Safelight can't open
// (a HEIC, say), not the original file. Nothing about it reaches the server.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONNECTION_KEY, SOURCE_ID } from "../src/connection";
import { activate } from "../src/index";
import { NOTICES_SEEN_KEY, RenditionNotice } from "../src/RenditionNotice";
import { React } from "../src/rt";
import type { CatalogPhoto } from "../src/safelight";
import { fakeApi } from "./support/fake-api";
import { SERVER } from "./support/mock-immich";

afterEach(cleanup);

const CONN = { server: SERVER, apiKey: "good-key", userId: "user-1", userName: "Anna" };

const photo = (filename: string, sourceKey?: string) =>
  ({ id: `p-${filename}`, filename, sourceKey }) as CatalogPhoto;

function mount(active: CatalogPhoto | undefined, open: string | null = SOURCE_ID, initial: Record<string, unknown> = {}) {
  const fetch = vi.fn();
  const rig = fakeApi(fetch, { [CONNECTION_KEY]: CONN, ...initial });
  activate(rig.api);
  rig.openSource = open;
  rig.activePhoto = active;
  const view = render(<RenditionNotice />);
  return { rig, fetch, view };
}

describe("the rendering notice", () => {
  it("is drawn over the Develop canvas", () => {
    const rig = fakeApi(vi.fn());
    activate(rig.api);
    expect(rig.slots).toEqual([expect.objectContaining({ slot: "develop-canvas-overlay", component: RenditionNotice })]);
  });

  it("says plainly that the photo is the server's rendering, not the original", () => {
    const { fetch } = mount(photo("IMG_0001.HEIC.jpg", "h1"));
    const text = screen.getByRole("status").textContent ?? "";
    expect(text).toMatch(/Immich's rendering of IMG_0001\.HEIC, not the original file/);
    expect(text).toMatch(/can't open HEIC/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("is told once per photo: dismissed, it stays away for that photo", () => {
    const { rig, view } = mount(photo("IMG_0001.HEIC.jpg", "h1"));
    act(() => fireEvent.click(screen.getByRole("button", { name: "Got it" })));
    expect(screen.queryByRole("status")).toBeNull();
    expect(rig.settings.get(NOTICES_SEEN_KEY)).toEqual(["h1"]);

    rig.activePhoto = photo("IMG_0002.HEIC.jpg", "h2");
    view.rerender(<RenditionNotice />);
    expect(screen.getByRole("status")).toBeTruthy();

    cleanup();
    mount(photo("IMG_0001.HEIC.jpg", "h1"), SOURCE_ID, { [NOTICES_SEEN_KEY]: ["h1"] });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("knows the photo under the name the catalogue gives a second photo of its name", () => {
    mount(photo("IMG_0001.HEIC (3f2a9c1d).jpg", "h3"));
    expect(screen.getByRole("status").textContent).toMatch(/rendering of IMG_0001\.HEIC/);
  });

  it("isn't shown for an original, nor outside Immich", () => {
    mount(photo("IMG_0001.JPG", "j1"));
    expect(screen.queryByRole("status")).toBeNull();
    cleanup();
    mount(photo("IMG_0001.HEIC.jpg"), null);
    expect(screen.queryByRole("status")).toBeNull();
    cleanup();
    mount(undefined);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps a bounded list of the photos it was dismissed for", () => {
    const seen = Array.from({ length: 2000 }, (_, i) => `k${i}`);
    const { rig } = mount(photo("IMG_0001.HEIC.jpg", "h1"), SOURCE_ID, { [NOTICES_SEEN_KEY]: seen });
    act(() => fireEvent.click(screen.getByRole("button", { name: "Got it" })));
    const kept = rig.settings.get(NOTICES_SEEN_KEY) as string[];
    expect(kept).toHaveLength(2000);
    expect(kept.at(-1)).toBe("h1");
    expect(kept[0]).toBe("k1");
  });
});
