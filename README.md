# Immich Web Folders for Safelight

Open the albums on your self-hosted [Immich](https://immich.app) server in
Safelight as if they were folders on your computer.

- **Albums as folders:** your Immich albums, your own and those shared with
  you, show in the **Folders** panel the way a folder's subfolders do. Click
  **Immich** under the folder tree to open them; click an album to show its
  photos in the grid.
- **Edit as usual:** rate, flag, label, filter, open in Develop, edit and
  export the photos like any others.
- **Opens at once, however big:** an album shows in the grid straight away,
  even with tens of thousands of photos. Each photo's preview is downloaded
  when it first comes into view, a few at a time, and kept; leaving an album
  stops its downloads.
- **Downloads only what you open:** a photo's original, RAW included, is
  downloaded the first time you open it in Develop or export it, and kept on
  your computer for later, up to the space you allow (10 GB unless you choose
  otherwise). Past it, the originals used longest ago are removed and download
  again when needed; the photo open in Develop and an export under way keep
  theirs.
- **Nothing on the server changes:** ratings, edits and the catalogue are kept
  in Safelight's own data. Safelight never uploads, renames, moves or deletes
  anything on Immich.
- **Offline:** when the server can't be reached, your albums and photos stay
  in the grid as they were last time. Photos you opened before still open; the
  rest show their preview until the server is back.

## Setting up

1. In Immich, open **Account Settings ▸ API Keys** and create a key. Give it
   at least `user.read`, `album.read`, `asset.read`, `asset.view` and
   `asset.download`.
2. In Safelight, open **Preferences ▸ Extensions ▸ Immich Web Folders**.
3. Enter the address you open Immich at, such as `http://192.168.1.20:2283`,
   and the key.
4. Click **Test connection**. Safelight asks whether the extension may connect
   to that address; allow it. When the test passes you're connected.
5. Click **Immich** in the Folders panel.

**Disconnect** forgets the key and the permission to reach the server. Your
ratings and edits are kept for when you connect again with the same account.

The key is kept with Safelight's settings on this computer. Over a plain
`http://` address, anyone on the same network can read what is sent, the key
and photos included: use it on a network you trust, or put Immich behind
HTTPS.

In the same Preferences section, **Downloaded originals** sets how much space
downloaded originals may take and shows how much they take now, and **Clear
downloaded originals** removes them (your ratings and edits stay).

Photos in formats Safelight can't open yet, such as HEIC, show as
`IMG_0001.HEIC.jpg`: Safelight opens Immich's own full-size JPEG of them
instead of the original, and says so the first time you open each one in
Develop. Videos aren't shown.

Needs Safelight 3.2.4 or later.

## Development

```bash
npm ci
npm run check    # typecheck, build dist/index.js, then the tests
```

The tests run against a mocked Immich API (`test/support/mock-immich.ts`)
built from Immich's OpenAPI description; they never contact a server.
`src/safelight.d.ts` is Safelight's generated API types; `npm run
update-types` fetches the newest.

## Licence

GPL-3.0-or-later; see LICENSE. Copyright (C) 2026 Anthony Reimche.
