// The Preferences section: the server address and API key, Test connection
// (which asks to reach the address, checks the server and the key, and then
// connects), its result in words, and Disconnect; once connected, the space
// downloaded originals may take, the space they take now, and clearing them
// after a confirmation in the app's own dialogue.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_KEY_SECRET, CONNECTION_KEY, SERVER_KEY, SOURCE_ID } from "../src/connection";
import { GB, ORIGINALS_LIMIT_KEY } from "../src/originals";
import { activate } from "../src/index";
import { React } from "../src/rt";
import { ImmichSettings } from "../src/Settings";
import { fakeApi, type Rig } from "./support/fake-api";
import { SERVER, mockImmich, type MockOptions } from "./support/mock-immich";

afterEach(cleanup);

const CONN = { server: SERVER, userId: "user-1", userName: "Anna" };
const KEY = { [API_KEY_SECRET]: "good-key" };

async function mount(opts: MockOptions = {}, initial: Record<string, unknown> = {}, kept: Record<string, string> = {}) {
  const server = mockImmich({ albums: [{ id: "a", albumName: "Trip", assets: [] }], ...opts });
  const rig = fakeApi(server.fetch, initial, kept);
  activate(rig.api);
  await act(async () => {
    render(<ImmichSettings />);
  });
  return { rig, server };
}

const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

async function test(rig: Rig, address: string, key: string) {
  fireEvent.change(input("Server address"), { target: { value: address } });
  fireEvent.change(input("API key"), { target: { value: key } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Test connection" })));
  return rig;
}

describe("Test connection", () => {
  it("asks to reach the server, checks it, then connects and says so", async () => {
    const { rig } = await mount();
    await test(rig, "nas.local:2283/", "good-key");
    expect(rig.asked).toEqual([SERVER]);
    expect(screen.getByRole("status").textContent).toMatch(/Connected as Anna to Immich 2\.3\.1: 1 album\. Open “Immich” in the Folders panel/);
    expect(rig.settings.get(CONNECTION_KEY)).toEqual(CONN);
    expect(rig.secrets.get(API_KEY_SECRET)).toBe("good-key");
    expect(rig.settings.get(SERVER_KEY)).toBe(SERVER);
    expect(rig.source()?.id).toBe(SOURCE_ID);
    expect(input("API key").value).toBe("");
    expect(document.body.innerHTML).not.toContain("good-key");
  });

  it("says why when the key is refused, and connects nothing", async () => {
    const { rig } = await mount();
    await test(rig, SERVER, "wrong");
    expect(screen.getByRole("alert").textContent).toMatch(/refused the API key/);
    expect(rig.settings.get(CONNECTION_KEY)).toBeUndefined();
    expect(rig.secrets.size).toBe(0);
    expect(rig.source()).toBeNull();
  });

  it("stops when the person doesn't allow the address", async () => {
    const { rig, server } = await mount();
    rig.allow = false;
    await test(rig, SERVER, "good-key");
    expect(screen.getByRole("alert").textContent).toMatch(/wasn't allowed to connect to http:\/\/nas\.local:2283/);
    expect(server.calls).toEqual([]);
  });

  it("checks the address before asking anything", async () => {
    const { rig } = await mount();
    await test(rig, "ftp://nas", "good-key");
    expect(screen.getByRole("alert").textContent).toMatch(/Enter the server's address/);
    expect(rig.asked).toEqual([]);
  });

  it("needs a key", async () => {
    const { rig } = await mount();
    await test(rig, SERVER, "  ");
    expect(screen.getByRole("alert").textContent).toMatch(/Enter an API key/);
  });

  it("says so, and connects nothing, when this computer has no keychain to keep the key in", async () => {
    const { rig } = await mount();
    rig.keychain = false;
    await test(rig, SERVER, "good-key");
    expect(screen.getByRole("alert").textContent).toMatch(/no keychain/);
    expect(rig.settings.get(CONNECTION_KEY)).toBeUndefined();
    expect(rig.source()).toBeNull();
  });

  it("says when the server can't be reached", async () => {
    const { rig } = await mount({ down: true });
    await test(rig, SERVER, "good-key");
    expect(screen.getByRole("alert").textContent).toMatch(/Couldn't reach the server/);
  });

  it("tests a saved connection again with its kept key", async () => {
    const { rig, server } = await mount({}, { [CONNECTION_KEY]: CONN, [SERVER_KEY]: SERVER }, KEY);
    rig.allowed.add(SERVER);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Test connection" })));
    expect(screen.getByRole("status").textContent).toMatch(/Connected as Anna/);
    expect(server.calls.find((c) => c.path === "/api/users/me")?.headers["x-api-key"]).toBe("good-key");
  });
});

describe("a saved connection", () => {
  it("shows who it is connected as, without contacting the server", async () => {
    const { server } = await mount({}, { [CONNECTION_KEY]: CONN, [SERVER_KEY]: SERVER }, KEY);
    expect(input("Server address").value).toBe(SERVER);
    expect(input("API key").placeholder).toBe("Saved");
    expect(screen.getByRole("status").textContent).toMatch(/Connected as Anna/);
    expect(server.calls).toEqual([]);
  });

  it("disconnects: the key and the access are forgotten and an open Immich project closes", async () => {
    const server = mockImmich();
    const rig = fakeApi(server.fetch, { [CONNECTION_KEY]: CONN, [SERVER_KEY]: SERVER }, KEY);
    rig.allowed.add(SERVER);
    rig.openSource = SOURCE_ID;
    activate(rig.api);
    await act(async () => {
      render(<ImmichSettings />);
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Disconnect" })));
    expect(rig.settings.get(CONNECTION_KEY)).toBeNull();
    expect(rig.settings.get(SERVER_KEY)).toBe(SERVER);
    expect(rig.secrets.size).toBe(0);
    expect(rig.source()).toBeNull();
    expect(rig.allowed.has(SERVER)).toBe(false);
    expect(rig.closedProjects).toBe(1);
    expect(screen.getByRole("status").textContent).toMatch(/Disconnected/);
    expect(screen.queryByRole("button", { name: "Disconnect" })).toBeNull();
  });
});

describe("downloaded originals", () => {
  const SAVED = { [CONNECTION_KEY]: CONN, [SERVER_KEY]: SERVER };

  async function mountConnected(initial: Record<string, unknown> = {}, kept = { count: 0, bytes: 0 }) {
    const server = mockImmich();
    const rig = fakeApi(server.fetch, { ...SAVED, ...initial }, KEY);
    rig.kept = kept;
    activate(rig.api);
    await act(async () => {
      render(<ImmichSettings />);
    });
    return { rig, server };
  }

  const limit = () => screen.getByLabelText("Downloaded originals") as HTMLSelectElement;

  it("aren't offered before a connection is made", async () => {
    await mount();
    expect(screen.queryByLabelText("Downloaded originals")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear downloaded originals" })).toBeNull();
  });

  it("show the limit, 10 GB at first, and the space they take, without contacting the server", async () => {
    const { server } = await mountConnected({}, { count: 84, bytes: 3.4 * GB });
    expect(limit().value).toBe("10");
    expect([...limit().options].map((o) => o.textContent)).toEqual(["2 GB", "5 GB", "10 GB", "25 GB", "50 GB", "100 GB", "No limit"]);
    expect(screen.getByText(/84 originals take 3.4 GB on this computer/)).toBeTruthy();
    expect(server.calls).toEqual([]);
  });

  it("keep the limit chosen, which the source takes at once", async () => {
    const { rig } = await mountConnected();
    await act(async () => fireEvent.change(limit(), { target: { value: "50" } }));
    expect(rig.settings.get(ORIGINALS_LIMIT_KEY)).toBe(50);
    expect(rig.source()?.keptOriginalsLimit).toBe(50 * GB);
    await act(async () => fireEvent.change(limit(), { target: { value: "none" } }));
    expect(rig.settings.get(ORIGINALS_LIMIT_KEY)).toBeNull();
    expect(rig.source()?.keptOriginalsLimit).toBeNull();
  });

  it("are cleared only once the person confirms, in the app's dialogue", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const { rig } = await mountConnected({}, { count: 3, bytes: 3 * GB });
    rig.confirm = false;
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Clear downloaded originals" })));
    expect(rig.confirms).toEqual([expect.objectContaining({ title: "Clear downloaded originals?", variant: "danger" })]);
    expect(rig.kept.count).toBe(3);

    rig.confirm = true;
    rig.inUse = 1;
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Clear downloaded originals" })));
    expect(rig.kept.count).toBe(1);
    expect(screen.getByText(/Cleared 2 originals. 1 in use .* was kept/)).toBeTruthy();
    expect(screen.getByText(/1 original takes 1.0 GB on this computer/)).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("can't be cleared when there are none", async () => {
    await mountConnected();
    expect((screen.getByRole("button", { name: "Clear downloaded originals" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/No originals are downloaded yet/)).toBeTruthy();
  });
});
