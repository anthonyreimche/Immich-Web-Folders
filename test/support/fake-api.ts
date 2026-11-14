// A stand-in Safelight API for unit tests, over real React. It has only what
// this extension uses: reading any other member throws, naming it, so a test
// shows what to add here when the extension starts using more.
//
// The settings store is a Map that tells its listeners of each write. The
// network goes to the test's mock Immich server, after an access dialogue the
// test answers with `allow`. The library keeps the registered source and the
// kept originals' count and bytes (`kept`), and the open project is whatever
// `openSource` says, its active photo `activePhoto`. Confirmation dialogues
// are kept in `confirms` and answered with `confirm`. The UI kit's controls are
// plain elements that keep their props' behaviour.

import * as React from "react";
import type {
  ButtonProps,
  CatalogPhoto,
  ConfirmDialogOptions,
  LibrarySourceContribution,
  NetworkRequestInit,
  RowProps,
  SafelightAPI,
  SelectProps,
  SettingsContribution,
  SlotContribution,
  StackProps,
  TextInputProps,
  UITokens,
} from "../../src/safelight";

type Fields = SafelightAPI["preferences"]["fields"];

/** The members of SafelightAPI this fake implements, typed against the real thing. */
type FakeMembers = Pick<
  SafelightAPI,
  "version" | "extensionId" | "react" | "registerSettings" | "registerSlot" | "settings"
> & {
  network: SafelightAPI["network"];
  library: Pick<
    SafelightAPI["library"],
    "registerSource" | "unregisterSource" | "useOpenSource" | "keptOriginals" | "clearKeptOriginals"
  >;
  catalog: Pick<SafelightAPI["catalog"], "useActivePhoto">;
  ui: Pick<SafelightAPI["ui"], "Button" | "TextInput" | "Select" | "Stack" | "Row" | "tokens" | "confirmDialog">;
  preferences: { fields: Pick<Fields, "Field"> };
  stores: { useProjectStore: { getState(): { closeProject(): void } } };
};

export interface Rig {
  api: SafelightAPI;
  settingsContributions: SettingsContribution[];
  slots: SlotContribution[];
  settings: Map<string, unknown>;
  /** The source registered now, or null. */
  source(): LibrarySourceContribution | null;
  /** Every access dialogue shown, by address asked for. */
  asked: string[];
  /** Addresses allowed now. */
  allowed: Set<string>;
  /** What the access dialogue answers. */
  allow: boolean;
  /** The open project's source id, or null. */
  openSource: string | null;
  closedProjects: number;
  /** The photo open in Develop. */
  activePhoto: CatalogPhoto | undefined;
  /** The originals the source's library keeps. */
  kept: { count: number; bytes: number };
  /** Of those, the ones in use, which Clear keeps. */
  inUse: number;
  /** Every confirmation dialogue shown, and what the next ones answer. */
  confirms: ConfirmDialogOptions[];
  confirm: boolean;
}

const origin = (url: string) => new URL(url).origin;

const TOKENS = new Proxy({} as UITokens, { get: (_t, key) => `var(--${String(key)})` });

export function fakeApi(
  fetch: (url: string, init?: NetworkRequestInit) => Promise<Response>,
  initial: Record<string, unknown> = {},
): Rig {
  const settings = new Map(Object.entries(initial));
  const listeners = new Set<(key: string, value: unknown) => void>();
  const settingsContributions: SettingsContribution[] = [];
  const slots: SlotContribution[] = [];
  let registered: LibrarySourceContribution | null = null;

  const Button = ({ variant: _v, size: _s, active: _a, full: _f, ...rest }: ButtonProps) =>
    React.createElement("button", { type: "button", ...rest });
  const TextInput = ({ value, onChange, ...rest }: TextInputProps) =>
    React.createElement("input", {
      ...rest,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    });
  const Select = ({ value, onChange, options, ariaLabel, disabled }: SelectProps) =>
    React.createElement(
      "select",
      {
        value,
        disabled,
        "aria-label": ariaLabel,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value),
      },
      (options ?? []).map((o) => React.createElement("option", { key: o.value, value: o.value }, o.label)),
    );
  const Stack = ({ children }: StackProps) => React.createElement("div", null, children);
  const Row = ({ children }: RowProps) => React.createElement("div", null, children);
  const Field: Fields["Field"] = ({ label, hint, children }) =>
    React.createElement("label", { title: hint }, React.createElement("span", null, label), children);

  const state = {
    asked: [] as string[],
    allowed: new Set<string>(),
    allow: true,
    openSource: null as string | null,
    closedProjects: 0,
    activePhoto: undefined as CatalogPhoto | undefined,
    kept: { count: 0, bytes: 0 },
    inUse: 0,
    confirms: [] as ConfirmDialogOptions[],
    confirm: true,
  };
  const ownSource = (id: string) => {
    if (registered?.id !== id) throw new Error(`“${id}” isn't a source this extension registered`);
  };

  const members: FakeMembers = {
    version: 1,
    extensionId: "immich-web-folders",
    react: React,
    registerSettings: (c) => void settingsContributions.push(c),
    registerSlot: (c) => void slots.push(c),
    settings: {
      get: <T,>(key: string, fallback: T): T => (settings.has(key) ? (settings.get(key) as T) : fallback),
      set: (key, value) => {
        settings.set(key, value);
        for (const listener of listeners) listener(key, value);
      },
      onChange: (cb) => {
        listeners.add(cb);
        return () => void listeners.delete(cb);
      },
    },
    network: {
      requestAccess: async (url) => {
        if (state.allowed.has(origin(url))) return true;
        state.asked.push(url);
        if (state.allow) state.allowed.add(origin(url));
        return state.allow;
      },
      hasAccess: async (url) => state.allowed.has(origin(url)),
      revokeAccess: async (url) => void state.allowed.delete(origin(url)),
      fetch: async (url, init) => {
        if (!state.allowed.has(origin(url))) throw new TypeError(`not allowed: ${origin(url)}`);
        return fetch(url, init);
      },
    },
    library: {
      registerSource: (c) => {
        registered = c;
      },
      unregisterSource: (id) => {
        if (registered?.id === id) registered = null;
      },
      useOpenSource: () => (state.openSource ? { id: state.openSource, name: "Immich" } : null),
      keptOriginals: async (id) => {
        ownSource(id);
        return { ...state.kept };
      },
      clearKeptOriginals: async (id) => {
        ownSource(id);
        const removed = state.kept.count - state.inUse;
        const bytesEach = state.kept.count ? state.kept.bytes / state.kept.count : 0;
        state.kept = { count: state.inUse, bytes: state.inUse * bytesEach };
        return { removed, kept: state.inUse };
      },
    },
    catalog: { useActivePhoto: () => state.activePhoto },
    ui: {
      Button,
      TextInput,
      Select,
      Stack,
      Row,
      tokens: TOKENS,
      confirmDialog: async (options) => {
        state.confirms.push(options);
        return state.confirm;
      },
    },
    preferences: { fields: { Field } },
    stores: {
      useProjectStore: {
        getState: () => ({
          closeProject: () => {
            state.closedProjects++;
            state.openSource = null;
          },
        }),
      },
    },
  };

  return Object.assign(state, {
    api: strict(members, "api") as unknown as SafelightAPI,
    settingsContributions,
    slots,
    settings,
    source: () => registered,
  });
}

/** Wraps a plain object so reading a member it lacks throws, naming the member. */
function strict<T extends object>(target: T, path: string): T {
  return new Proxy(target, {
    get(obj, key, receiver) {
      if (typeof key === "symbol" || key === "then" || key === "toJSON") return Reflect.get(obj, key, receiver);
      if (!(key in obj)) throw new Error(`The fake API has no ${path}.${key}. Add it to test/support/fake-api.ts.`);
      const value: unknown = Reflect.get(obj, key, receiver);
      const isPlainObject =
        typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
      return isPlainObject && key !== "react" && key !== "tokens" ? strict(value, `${path}.${key}`) : value;
    },
  });
}
