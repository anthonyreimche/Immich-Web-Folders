// Immich Web Folders — a Safelight extension.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 or later;
// see LICENSE.

// The section in Preferences ▸ Extensions: the server's address and an API
// key, Test connection and Disconnect. Test connection asks Safelight to allow
// the address (the person answers its dialogue), checks the server, the key and
// the account, and only then keeps the connection, which registers the source.
// The key is never shown again once kept, nor logged. Once connected: how much
// space downloaded originals may take, how much they take now, and Clear.

import {
  SOURCE_ID,
  forgetConnection,
  saveConnection,
  savedConnection,
  savedServer,
  type SavedConnection,
} from "./connection";
import { ImmichError, immichClient, normalizeServer, type Account } from "./immich";
import { LIMIT_CHOICES, ORIGINALS_LIMIT_KEY, savedLimitGB, sizeText } from "./originals";
import { React, api } from "./rt";
import { syncSource } from "./source";

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "ok"; text: string } | { kind: "error"; text: string };

const connectedText = (c: SavedConnection) => `Connected as ${c.userName || "your Immich account"} at ${c.server}.`;

function accountText(account: Account): string {
  const albums = `${account.albumCount} album${account.albumCount === 1 ? "" : "s"}`;
  return (
    `Connected as ${account.userName} to Immich ${account.version}: ${albums}. ` +
    `Open “Immich” in the Folders panel to see them.`
  );
}

const originalsText = (n: number) => `${n} original${n === 1 ? "" : "s"}`;

function usageText({ count, bytes }: { count: number; bytes: number }): string {
  if (count === 0) return "No originals are downloaded yet.";
  return `${originalsText(count)} ${count === 1 ? "takes" : "take"} ${sizeText(bytes)} on this computer.`;
}

/** The space downloaded originals may take, the space they take now, and Clear.
 *  Reads only this computer's disk. */
function DownloadedOriginals() {
  const { Field } = api.preferences.fields;
  const { Button, Select, Stack, tokens } = api.ui;
  const [limit, setLimit] = React.useState(() => savedLimitGB(api.settings));
  const [usage, setUsage] = React.useState<{ count: number; bytes: number } | null>(null);
  const [cleared, setCleared] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setUsage(await api.library.keptOriginals(SOURCE_ID).catch(() => null));
  }, []);
  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const choose = (value: string) => {
    const gb = value === "none" ? null : Number(value);
    setLimit(gb);
    api.settings.set(ORIGINALS_LIMIT_KEY, gb);
    // Registered with the new limit before the space is read again, which then
    // tells the space left once a lower limit has removed what it had to.
    syncSource(api);
    void refresh();
  };

  const clear = async () => {
    const shown = usage ?? { count: 0, bytes: 0 };
    const ok = await api.ui.confirmDialog({
      title: "Clear downloaded originals?",
      message:
        `Safelight removes the ${originalsText(shown.count)} it downloaded from Immich (${sizeText(shown.bytes)}). ` +
        "Your ratings and edits stay. Each downloads again the next time you open or export its photo.",
      confirmLabel: "Clear",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { removed, kept } = await api.library.clearKeptOriginals(SOURCE_ID);
      setCleared(
        `Cleared ${originalsText(removed)}.` +
          (kept ? ` ${kept} in use (open in Develop or being exported) ${kept === 1 ? "was" : "were"} kept.` : ""),
      );
    } catch {
      setCleared("The downloaded originals couldn't be cleared.");
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const options = LIMIT_CHOICES.map((gb) =>
    gb === null ? { value: "none", label: "No limit" } : { value: String(gb), label: `${gb} GB` },
  );
  const note = { margin: 0, fontSize: 11, lineHeight: 1.45 };
  return (
    <Stack gap={6}>
      <Field
        label="Downloaded originals"
        hint="The originals of photos you open or export are kept on this computer, up to this much space. Past it, the ones used longest ago are removed and download again when needed."
      >
        <Select
          ariaLabel="Downloaded originals"
          value={limit === null ? "none" : String(limit)}
          options={options}
          onChange={choose}
        />
      </Field>
      {usage && (
        <p style={{ ...note, color: tokens.textSecondary }}>{usageText(usage)}</p>
      )}
      <div>
        <Button variant="ghost" onClick={() => void clear()} disabled={busy || !usage || usage.count === 0}>
          Clear downloaded originals
        </Button>
      </div>
      {cleared && (
        <p role="status" style={{ ...note, color: tokens.textSecondary }}>
          {cleared}
        </p>
      )}
    </Stack>
  );
}

export function ImmichSettings() {
  const { Field } = api.preferences.fields;
  const { Button, TextInput, Stack, Row, tokens } = api.ui;
  const openSource = api.library.useOpenSource();
  const [server, setServer] = React.useState(() => savedServer(api.settings));
  const [key, setKey] = React.useState("");
  const [conn, setConn] = React.useState(() => savedConnection(api.settings));
  const [status, setStatus] = React.useState<Status>(() => {
    const saved = savedConnection(api.settings);
    return saved ? { kind: "ok", text: connectedText(saved) } : { kind: "idle" };
  });

  const testConnection = async () => {
    const address = normalizeServer(server);
    if (!address) {
      setStatus({ kind: "error", text: "Enter the server's address, such as http://192.168.1.20:2283." });
      return;
    }
    const apiKey = key.trim() || (conn?.server === address ? conn.apiKey : "");
    if (!apiKey) {
      setStatus({ kind: "error", text: "Enter an API key. Create one in Immich under Account Settings ▸ API Keys." });
      return;
    }
    setStatus({ kind: "busy" });
    if (!(await api.network.requestAccess(address))) {
      setStatus({ kind: "error", text: `Safelight wasn't allowed to connect to ${new URL(address).origin}.` });
      return;
    }
    try {
      const account = await immichClient((url, init) => api.network.fetch(url, init), { server: address, apiKey }).checkConnection();
      const next: SavedConnection = { server: address, apiKey, userId: account.userId, userName: account.userName };
      saveConnection(api.settings, next);
      syncSource(api);
      setConn(next);
      setServer(address);
      setKey("");
      setStatus({ kind: "ok", text: accountText(account) });
    } catch (error) {
      const text = error instanceof ImmichError ? error.message : "Something went wrong testing the connection.";
      setStatus({ kind: "error", text });
    }
  };

  const disconnect = async () => {
    const left = conn;
    forgetConnection(api.settings);
    syncSource(api);
    setConn(null);
    if (openSource?.id === SOURCE_ID) api.stores.useProjectStore.getState().closeProject();
    if (left) await api.network.revokeAccess(left.server);
    setStatus({
      kind: "ok",
      text: "Disconnected. Ratings and edits you made in Safelight are kept for when you connect again.",
    });
  };

  const note = { margin: 0, fontSize: 11, lineHeight: 1.45 };
  return (
    <Stack gap={8}>
      <Field label="Server address" hint="The address you open Immich at, such as http://192.168.1.20:2283.">
        <TextInput
          aria-label="Server address"
          value={server}
          placeholder="http://192.168.1.20:2283"
          spellCheck={false}
          onChange={setServer}
        />
      </Field>
      <Field
        label="API key"
        hint="Create one in Immich under Account Settings ▸ API Keys, with user.read, album.read, asset.read, asset.view and asset.download. Safelight keeps it on this computer."
      >
        <TextInput
          aria-label="API key"
          type="password"
          autoComplete="off"
          value={key}
          placeholder={conn ? "Saved" : ""}
          onChange={setKey}
        />
      </Field>
      <Row gap={6}>
        <Button onClick={() => void testConnection()} disabled={status.kind === "busy"}>
          {status.kind === "busy" ? "Testing…" : "Test connection"}
        </Button>
        {conn && (
          <Button variant="ghost" onClick={() => void disconnect()} disabled={status.kind === "busy"}>
            Disconnect
          </Button>
        )}
      </Row>
      {status.kind === "ok" && (
        <p role="status" style={{ ...note, color: tokens.textSecondary }}>
          {status.text}
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" style={{ ...note, color: tokens.labelRed }}>
          {status.text}
        </p>
      )}
      <p style={{ ...note, color: tokens.textMuted }}>
        Your albums open as folders. Photos are downloaded from the server only when you open
        them in Develop or export them, then kept on this computer. Ratings and edits stay in
        Safelight; nothing on the server is changed.
      </p>
      {conn && <DownloadedOriginals />}
    </Stack>
  );
}
