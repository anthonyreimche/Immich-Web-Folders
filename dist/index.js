//#region src/connection.ts
var e = "immich-web-folders", t = `${e}.immich`, n = "server", r = "connection", i = "api-key";
function a(e) {
	let t = e.get(n, "");
	return typeof t == "string" ? t : "";
}
function o(e) {
	let t = e.get(r, null);
	if (typeof t != "object" || !t) return null;
	let { server: n, userId: i, userName: a } = t;
	return typeof n != "string" || typeof i != "string" || !n || !i ? null : {
		server: n,
		userId: i,
		userName: typeof a == "string" ? a : ""
	};
}
async function s({ settings: e, secrets: t }) {
	let n = o(e);
	if (!n) return null;
	let r = await t.get(i).catch(() => null);
	return r ? {
		...n,
		apiKey: r
	} : null;
}
async function c({ settings: e, secrets: t }, a) {
	await t.set(i, a.apiKey), e.set(n, a.server), e.set(r, {
		server: a.server,
		userId: a.userId,
		userName: a.userName
	});
}
async function l({ settings: e, secrets: t }) {
	e.set(r, null), await t.delete(i).catch(() => {});
}
async function u({ settings: e, secrets: t }) {
	let n = e.get(r, null);
	if (typeof n != "object" || !n || !("apiKey" in n)) return;
	let { apiKey: a, ...o } = n;
	if (typeof a == "string" && a) try {
		await t.set(i, a);
	} catch {
		return;
	}
	e.set(r, o);
}
var d = (e) => `${e.server}#${e.userId}`, f = 1024 ** 3, p = "originalsLimitGB", m = [
	2,
	5,
	10,
	25,
	50,
	100,
	null
];
function h(e) {
	let t = e.get(p, 10);
	return t === null || typeof t == "number" && m.includes(t) ? t : 10;
}
function g(e) {
	let t = h(e);
	return t === null ? null : t * f;
}
function _(e) {
	if (e < 1024) return `${e} ${e === 1 ? "byte" : "bytes"}`;
	let t = [
		"KB",
		"MB",
		"GB",
		"TB"
	], n = e / 1024, r = 0;
	for (; n >= 1024 && r < t.length - 1;) n /= 1024, r++;
	return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${t[r]}`;
}
//#endregion
//#region src/formats.ts
var v = /* @__PURE__ */ new Set(/* @__PURE__ */ "jpg.jpeg.png.webp.avif.tif.tiff.ppm.pgm.pbm.pnm.nef.nrw.cr2.cr3.crw.arw.srf.sr2.dng.orf.raf.pef.srw.rw2.iiq.3fr.fff.kdc.dcr.mos.mrw.erf.x3f.rwl.gpr.mef.raw.mdc".split(".")), y = (e) => {
	let t = e.lastIndexOf(".");
	return t > 0 && t < e.length - 1 ? e.slice(t + 1) : null;
};
function b(e) {
	let t = y(e);
	return t && !v.has(t.toLowerCase()) ? `${e}.jpg` : null;
}
var x = / \([A-Za-z0-9._-]{1,8}\)$/;
function S(e) {
	if (!/\.jpg$/i.test(e)) return null;
	let t = e.slice(0, -4).replace(x, ""), n = y(t);
	return n && b(t) ? {
		original: t,
		format: n.toUpperCase()
	} : null;
}
//#endregion
//#region src/rt.ts
var C, w;
function T(e) {
	w = e, C = e.react;
}
//#endregion
//#region src/RenditionNotice.tsx
var E = "renditionNoticesSeen";
function D() {
	let e = w.settings.get(E, []);
	return Array.isArray(e) ? e.filter((e) => typeof e == "string") : [];
}
function O() {
	let { Button: e, tokens: t } = w.ui, n = w.library.useOpenSource(), r = w.catalog.useActivePhoto(), [i, a] = C.useState(() => new Set(D())), o = r?.sourceKey, s = n?.id === "immich-web-folders.immich" && r ? S(r.filename) : null;
	return !s || o === void 0 || i.has(o) ? null : /* @__PURE__ */ C.createElement("div", { style: {
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
		background: t.surface2,
		border: `1px solid ${t.border}`,
		color: t.textPrimary,
		fontSize: 12,
		lineHeight: 1.45,
		boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
		pointerEvents: "auto"
	} }, /* @__PURE__ */ C.createElement("p", {
		role: "status",
		style: { margin: 0 }
	}, "You're editing Immich's rendering of ", s.original, ", not the original file: Safelight can't open", " ", s.format, " files yet. Edits and exports start from this JPEG."), /* @__PURE__ */ C.createElement(e, {
		size: "sm",
		onClick: () => {
			let e = [...D().filter((e) => e !== o), o].slice(-2e3);
			w.settings.set(E, e), a(new Set(e));
		}
	}, "Got it"));
}
//#endregion
//#region src/immich.ts
var k = class extends Error {
	status;
	constructor(e, t) {
		super(e), this.name = "ImmichError", this.status = t;
	}
}, A = 2e4, j = 3e4, M = 3e5, N = 1e3, P = 500;
function F(e) {
	let t = e.trim();
	if (!t) return null;
	let n = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `http://${t}`, r;
	try {
		r = new URL(n);
	} catch {
		return null;
	}
	if (r.protocol !== "http:" && r.protocol !== "https:" || r.username || r.password || !r.hostname) return null;
	let i = r.pathname.replace(/\/+$/, "").replace(/\/api$/i, "");
	return `${r.origin}${i}`;
}
function I(e) {
	return e ? Math.min(18e5, 6e4 + Math.ceil(e / 524288) * 1e3) : 6e5;
}
function L(e, t) {
	return e instanceof k ? e : e instanceof DOMException && e.name === "AbortError" ? new k("Stopped.") : e instanceof DOMException && e.name === "TimeoutError" ? new k(`The server at ${t} didn't answer in time.`) : new k(`Couldn't reach the server at ${t} (${e instanceof Error ? e.message : String(e)}). Check the address and that the server is running.`);
}
function R(e) {
	return e === 401 ? new k("Immich refused the API key. Check it, or create a new one.", e) : e === 403 ? new k("The API key is missing a permission Safelight needs: user.read, album.read, asset.read, asset.view and asset.download.", e) : new k(`The server answered with an error (${e}).`, e);
}
var z = () => new k("That address answered, but not as an Immich server. Check the address and port (Immich uses 2283 unless set otherwise).");
function B(e, t) {
	let n = (e) => `${t.server}/api${e}`, r = { "x-api-key": t.apiKey };
	async function i(r, i) {
		try {
			return await e(n(r), i);
		} catch (e) {
			throw L(e, t.server);
		}
	}
	async function a(e, t = {}) {
		let n = await i(e, {
			timeoutMs: A,
			...t,
			headers: {
				...r,
				accept: "application/json",
				...t.headers
			}
		});
		if (!n.ok) throw R(n.status);
		try {
			return await n.json();
		} catch {
			throw z();
		}
	}
	async function o(e) {
		let t = await a("/albums", { signal: e }), n = await a("/albums?shared=true", { signal: e }).catch((e) => {
			if (e instanceof k && e.status === 400) return [];
			throw e;
		}), r = /* @__PURE__ */ new Set();
		return [...t, ...n].filter((e) => !r.has(e.id) && r.add(e.id));
	}
	async function s(e, t) {
		let n = [], r = { page: 1 };
		try {
			for (let i = 0; r && i < P; i++) {
				let i = {
					albumIds: [e],
					withExif: !0,
					size: N,
					...r
				}, o = await a("/search/metadata", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(i),
					signal: t
				});
				n.push(...o.assets.items);
				let { nextPage: s, nextCursor: c } = o.assets;
				r = s ? { page: Number(s) } : c ? { cursor: c } : null;
			}
			return n;
		} catch (r) {
			if (!(r instanceof k) || r.status !== 400 || n.length > 0) throw r;
			return (await a(`/albums/${encodeURIComponent(e)}`, { signal: t })).assets ?? [];
		}
	}
	return {
		async checkConnection(e) {
			let t = await i("/server/ping", {
				timeoutMs: A,
				signal: e
			});
			if ((t.ok ? await t.json().catch(() => null) : null)?.res !== "pong") throw z();
			let n = await a("/server/version", { signal: e }), r = await a("/users/me", { signal: e }), s = await o(e);
			return {
				userId: r.id,
				userName: r.name,
				version: `${n.major}.${n.minor}.${n.patch}`,
				albumCount: s.length
			};
		},
		albums: o,
		albumAssets: s,
		async preview(e, t, n) {
			let a = await i(`/assets/${encodeURIComponent(e)}/thumbnail?size=${t <= 250 ? "thumbnail" : "preview"}`, {
				headers: r,
				timeoutMs: j,
				signal: n
			});
			if (!a.ok) throw R(a.status);
			return a.blob();
		},
		async rendition(e, t) {
			let n = (n) => i(`/assets/${encodeURIComponent(e)}/thumbnail?size=${n}`, {
				headers: r,
				timeoutMs: M,
				signal: t
			}), a = await n("fullsize");
			if (a.status === 400 && (a = await n("preview")), !a.ok) throw R(a.status);
			return a.blob();
		},
		async original(e, t, n) {
			let a = await i(`/assets/${encodeURIComponent(e)}/original`, {
				headers: r,
				timeoutMs: I(t),
				signal: n
			});
			if (!a.ok) throw R(a.status);
			return a.blob();
		}
	};
}
function V(e) {
	return Object.fromEntries(Object.entries(e).filter(([, e]) => e !== void 0));
}
var H = (e) => typeof e == "number" && Number.isFinite(e) ? e : void 0, U = (e) => typeof e == "string" && e.trim() ? e : void 0, W = (e) => {
	let t = typeof e == "string" ? Date.parse(e) : NaN;
	return Number.isFinite(t) ? t : void 0;
};
function G(e) {
	let t = W(e);
	if (t === void 0) return;
	let n = new Date(t), r = (e) => String(e).padStart(2, "0");
	return `${n.getUTCFullYear()}:${r(n.getUTCMonth() + 1)}:${r(n.getUTCDate())} ${r(n.getUTCHours())}:${r(n.getUTCMinutes())}:${r(n.getUTCSeconds())}`;
}
function K(e) {
	if (e.type && e.type !== "IMAGE" || e.isTrashed) return null;
	let t = e.exifInfo ?? {}, n = Number(t.orientation), r = {}, i = (e, t) => {
		t !== void 0 && (r[e] = t);
	};
	i("cameraMake", U(t.make)), i("cameraModel", U(t.model)), i("lens", U(t.lensModel)), i("aperture", H(t.fNumber)), i("focalLength", H(t.focalLength)), i("iso", H(t.iso)), i("shutterSpeed", U(t.exposureTime)), i("dateTimeOriginal", G(e.localDateTime)), i("orientation", Number.isInteger(n) && n >= 1 && n <= 8 ? n : void 0), i("gpsLatitude", H(t.latitude)), i("gpsLongitude", H(t.longitude)), i("imageDescription", U(t.description));
	let a = r.orientation !== void 0 && r.orientation >= 5, [o, s] = H(e.width) && H(e.height) ? [H(e.width), H(e.height)] : a ? [H(t.exifImageHeight), H(t.exifImageWidth)] : [H(t.exifImageWidth), H(t.exifImageHeight)], c = b(e.originalFileName);
	return c ? (delete r.orientation, {
		key: e.id,
		name: c,
		mimeType: "image/jpeg",
		...V({
			modified: W(e.fileModifiedAt),
			taken: W(t.dateTimeOriginal) ?? W(e.fileCreatedAt),
			width: o,
			height: s,
			rating: H(t.rating)
		}),
		exif: r
	}) : {
		key: e.id,
		name: e.originalFileName,
		...V({
			size: H(t.fileSizeInByte),
			modified: W(e.fileModifiedAt),
			taken: W(t.dateTimeOriginal) ?? W(e.fileCreatedAt),
			width: o,
			height: s,
			mimeType: U(e.originalMimeType),
			rating: H(t.rating)
		}),
		exif: r
	};
}
//#endregion
//#region src/source.ts
var q = 4;
async function J(e, t, n) {
	let r = Array(e.length), i = 0, a = Array.from({ length: Math.min(t, e.length) }, async () => {
		for (; i < e.length;) {
			let t = i++;
			r[t] = await n(e[t]);
		}
	});
	return await Promise.all(a), r;
}
function Y(e, n, r) {
	let i = B(e, n);
	return {
		id: t,
		name: "Immich",
		library: d(n),
		keptOriginalsLimit: r,
		async list({ signal: e }) {
			return { folders: await J(await i.albums(e), q, async (t) => ({
				name: t.albumName,
				key: t.id,
				items: (await i.albumAssets(t.id, e)).flatMap((e) => K(e) ?? [])
			})) };
		},
		readPreview: (e, { maxEdge: t, signal: n }) => i.preview(e.key, t, n),
		readOriginal: (e, { signal: t }) => S(e.name) ? i.rendition(e.key, t) : i.original(e.key, e.size, t)
	};
}
async function X(e) {
	let n = await s(e);
	n ? e.library.registerSource(Y((t, n) => e.network.fetch(t, n), n, g(e.settings))) : e.library.unregisterSource(t);
}
//#endregion
//#region src/Settings.tsx
var Z = (e) => `Connected as ${e.userName || "your Immich account"} at ${e.server}.`;
function Q(e) {
	let t = `${e.albumCount} album${e.albumCount === 1 ? "" : "s"}`;
	return `Connected as ${e.userName} to Immich ${e.version}: ${t}. Open “Immich” in the Folders panel to see them.`;
}
var $ = (e) => `${e} original${e === 1 ? "" : "s"}`;
function ee({ count: e, bytes: t }) {
	return e === 0 ? "No originals are downloaded yet." : `${$(e)} ${e === 1 ? "takes" : "take"} ${_(t)} on this computer.`;
}
function te() {
	let { Field: e } = w.preferences.fields, { Button: n, Select: r, Stack: i, tokens: a } = w.ui, [o, s] = C.useState(() => h(w.settings)), [c, l] = C.useState(null), [u, d] = C.useState(null), [f, g] = C.useState(!1), v = C.useCallback(async () => {
		l(await w.library.keptOriginals(t).catch(() => null));
	}, []);
	C.useEffect(() => {
		v();
	}, [v]);
	let y = (e) => {
		let t = e === "none" ? null : Number(e);
		s(t), w.settings.set(p, t), X(w).then(v);
	}, b = async () => {
		let e = c ?? {
			count: 0,
			bytes: 0
		};
		if (await w.ui.confirmDialog({
			title: "Clear downloaded originals?",
			message: `Safelight removes the ${$(e.count)} it downloaded from Immich (${_(e.bytes)}). Your ratings and edits stay. Each downloads again the next time you open or export its photo.`,
			confirmLabel: "Clear",
			variant: "danger"
		})) {
			g(!0);
			try {
				let { removed: e, kept: n } = await w.library.clearKeptOriginals(t);
				d(`Cleared ${$(e)}.` + (n ? ` ${n} in use (open in Develop or being exported) ${n === 1 ? "was" : "were"} kept.` : ""));
			} catch {
				d("The downloaded originals couldn't be cleared.");
			} finally {
				g(!1), await v();
			}
		}
	}, x = m.map((e) => e === null ? {
		value: "none",
		label: "No limit"
	} : {
		value: String(e),
		label: `${e} GB`
	}), S = {
		margin: 0,
		fontSize: 11,
		lineHeight: 1.45
	};
	return /* @__PURE__ */ C.createElement(i, { gap: 6 }, /* @__PURE__ */ C.createElement(e, {
		label: "Downloaded originals",
		hint: "The originals of photos you open or export are kept on this computer, up to this much space. Past it, the ones used longest ago are removed and download again when needed."
	}, /* @__PURE__ */ C.createElement(r, {
		ariaLabel: "Downloaded originals",
		value: o === null ? "none" : String(o),
		options: x,
		onChange: y
	})), c && /* @__PURE__ */ C.createElement("p", { style: {
		...S,
		color: a.textSecondary
	} }, ee(c)), /* @__PURE__ */ C.createElement("div", null, /* @__PURE__ */ C.createElement(n, {
		variant: "ghost",
		onClick: () => void b(),
		disabled: f || !c || c.count === 0
	}, "Clear downloaded originals")), u && /* @__PURE__ */ C.createElement("p", {
		role: "status",
		style: {
			...S,
			color: a.textSecondary
		}
	}, u));
}
function ne() {
	let { Field: e } = w.preferences.fields, { Button: t, TextInput: n, Stack: r, Row: i, tokens: o } = w.ui, u = w.library.useOpenSource(), [d, f] = C.useState(() => a(w.settings)), [p, m] = C.useState(""), [h, g] = C.useState(null), [_, v] = C.useState({ kind: "idle" });
	C.useEffect(() => {
		let e = !0;
		return s(w).then((t) => {
			e && t && (g(t), v({
				kind: "ok",
				text: Z(t)
			}));
		}), () => {
			e = !1;
		};
	}, []);
	let y = async () => {
		let e = F(d);
		if (!e) {
			v({
				kind: "error",
				text: "Enter the server's address, such as http://192.168.1.20:2283."
			});
			return;
		}
		let t = p.trim() || (h?.server === e ? h.apiKey : "");
		if (!t) v({
			kind: "error",
			text: "Enter an API key. Create one in Immich under Account Settings ▸ API Keys."
		});
		else if (v({ kind: "busy" }), !await w.network.requestAccess(e)) v({
			kind: "error",
			text: `Safelight wasn't allowed to connect to ${new URL(e).origin}.`
		});
		else try {
			let n = await B((e, t) => w.network.fetch(e, t), {
				server: e,
				apiKey: t
			}).checkConnection(), r = {
				server: e,
				apiKey: t,
				userId: n.userId,
				userName: n.userName
			};
			try {
				await c(w, r);
			} catch {
				v({
					kind: "error",
					text: "This computer has no keychain to keep the API key in, so Safelight can't connect."
				});
				return;
			}
			await X(w), g(r), f(e), m(""), v({
				kind: "ok",
				text: Q(n)
			});
		} catch (e) {
			let t = e instanceof k ? e.message : "Something went wrong testing the connection.";
			v({
				kind: "error",
				text: t
			});
		}
	}, b = async () => {
		let e = h;
		await l(w), await X(w), g(null), u?.id === "immich-web-folders.immich" && w.stores.useProjectStore.getState().closeProject(), e && await w.network.revokeAccess(e.server), v({
			kind: "ok",
			text: "Disconnected. Ratings and edits you made in Safelight are kept for when you connect again."
		});
	}, x = {
		margin: 0,
		fontSize: 11,
		lineHeight: 1.45
	};
	return /* @__PURE__ */ C.createElement(r, { gap: 8 }, /* @__PURE__ */ C.createElement(e, {
		label: "Server address",
		hint: "The address you open Immich at, such as http://192.168.1.20:2283."
	}, /* @__PURE__ */ C.createElement(n, {
		"aria-label": "Server address",
		value: d,
		placeholder: "http://192.168.1.20:2283",
		spellCheck: !1,
		onChange: f
	})), /* @__PURE__ */ C.createElement(e, {
		label: "API key",
		hint: "Create one in Immich under Account Settings ▸ API Keys, with user.read, album.read, asset.read, asset.view and asset.download. Safelight keeps it on this computer."
	}, /* @__PURE__ */ C.createElement(n, {
		"aria-label": "API key",
		type: "password",
		autoComplete: "off",
		value: p,
		placeholder: h ? "Saved" : "",
		onChange: m
	})), /* @__PURE__ */ C.createElement(i, { gap: 6 }, /* @__PURE__ */ C.createElement(t, {
		onClick: () => void y(),
		disabled: _.kind === "busy"
	}, _.kind === "busy" ? "Testing…" : "Test connection"), h && /* @__PURE__ */ C.createElement(t, {
		variant: "ghost",
		onClick: () => void b(),
		disabled: _.kind === "busy"
	}, "Disconnect")), _.kind === "ok" && /* @__PURE__ */ C.createElement("p", {
		role: "status",
		style: {
			...x,
			color: o.textSecondary
		}
	}, _.text), _.kind === "error" && /* @__PURE__ */ C.createElement("p", {
		role: "alert",
		style: {
			...x,
			color: o.labelRed
		}
	}, _.text), /* @__PURE__ */ C.createElement("p", { style: {
		...x,
		color: o.textMuted
	} }, "Your albums open as folders. Photos are downloaded from the server only when you open them in Develop or export them, then kept on this computer. Ratings and edits stay in Safelight; nothing on the server is changed."), h && /* @__PURE__ */ C.createElement(te, null));
}
//#endregion
//#region src/index.tsx
function re(t) {
	T(t), t.registerSettings({
		component: ne,
		fields: [],
		keywords: [
			"Immich",
			"API key",
			"server",
			"web folders",
			"albums"
		]
	}), t.registerSlot({
		id: `${e}.rendition-notice`,
		slot: "develop-canvas-overlay",
		component: O
	}), u(t).then(() => X(t)), t.settings.onChange((e) => {
		(e === "connection" || e === "originalsLimitGB") && X(t);
	});
}
//#endregion
export { re as activate };

//# sourceMappingURL=index.js.map