//#region src/connection.ts
var e = "immich-web-folders", t = `${e}.immich`, n = "server", r = "connection";
function i(e) {
	let t = e.get(n, "");
	return typeof t == "string" ? t : "";
}
function a(e) {
	let t = e.get(r, null);
	if (typeof t != "object" || !t) return null;
	let { server: n, apiKey: i, userId: a, userName: o } = t;
	return typeof n != "string" || typeof i != "string" || typeof a != "string" || !n || !i || !a ? null : {
		server: n,
		apiKey: i,
		userId: a,
		userName: typeof o == "string" ? o : ""
	};
}
function o(e, t) {
	e.set(n, t.server), e.set(r, {
		server: t.server,
		apiKey: t.apiKey,
		userId: t.userId,
		userName: t.userName
	});
}
function s(e) {
	e.set(r, null);
}
var c = (e) => `${e.server}#${e.userId}`, l = 1024 ** 3, u = "originalsLimitGB", d = [
	2,
	5,
	10,
	25,
	50,
	100,
	null
];
function f(e) {
	let t = e.get(u, 10);
	return t === null || typeof t == "number" && d.includes(t) ? t : 10;
}
function p(e) {
	let t = f(e);
	return t === null ? null : t * l;
}
function m(e) {
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
var h = /* @__PURE__ */ new Set(/* @__PURE__ */ "jpg.jpeg.png.webp.avif.tif.tiff.ppm.pgm.pbm.pnm.nef.nrw.cr2.cr3.crw.arw.srf.sr2.dng.orf.raf.pef.srw.rw2.iiq.3fr.fff.kdc.dcr.mos.mrw.erf.x3f.rwl.gpr.mef.raw.mdc".split(".")), g = (e) => {
	let t = e.lastIndexOf(".");
	return t > 0 && t < e.length - 1 ? e.slice(t + 1) : null;
};
function _(e) {
	let t = g(e);
	return t && !h.has(t.toLowerCase()) ? `${e}.jpg` : null;
}
var v = / \([A-Za-z0-9._-]{1,8}\)$/;
function y(e) {
	if (!/\.jpg$/i.test(e)) return null;
	let t = e.slice(0, -4).replace(v, ""), n = g(t);
	return n && _(t) ? {
		original: t,
		format: n.toUpperCase()
	} : null;
}
//#endregion
//#region src/rt.ts
var b, x;
function S(e) {
	x = e, b = e.react;
}
//#endregion
//#region src/RenditionNotice.tsx
var C = "renditionNoticesSeen";
function w() {
	let e = x.settings.get(C, []);
	return Array.isArray(e) ? e.filter((e) => typeof e == "string") : [];
}
function T() {
	let { Button: e, tokens: t } = x.ui, n = x.library.useOpenSource(), r = x.catalog.useActivePhoto(), [i, a] = b.useState(() => new Set(w())), o = r?.sourceKey, s = n?.id === "immich-web-folders.immich" && r ? y(r.filename) : null;
	return !s || o === void 0 || i.has(o) ? null : /* @__PURE__ */ b.createElement("div", { style: {
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
	} }, /* @__PURE__ */ b.createElement("p", {
		role: "status",
		style: { margin: 0 }
	}, "You're editing Immich's rendering of ", s.original, ", not the original file: Safelight can't open", " ", s.format, " files yet. Edits and exports start from this JPEG."), /* @__PURE__ */ b.createElement(e, {
		size: "sm",
		onClick: () => {
			let e = [...w().filter((e) => e !== o), o].slice(-2e3);
			x.settings.set(C, e), a(new Set(e));
		}
	}, "Got it"));
}
//#endregion
//#region src/immich.ts
var E = class extends Error {
	status;
	constructor(e, t) {
		super(e), this.name = "ImmichError", this.status = t;
	}
}, D = 2e4, O = 3e4, k = 3e5, A = 1e3, j = 500;
function M(e) {
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
function N(e) {
	return e ? Math.min(18e5, 6e4 + Math.ceil(e / 524288) * 1e3) : 6e5;
}
function P(e, t) {
	return e instanceof E ? e : e instanceof DOMException && e.name === "AbortError" ? new E("Stopped.") : e instanceof DOMException && e.name === "TimeoutError" ? new E(`The server at ${t} didn't answer in time.`) : new E(`Couldn't reach the server at ${t} (${e instanceof Error ? e.message : String(e)}). Check the address and that the server is running.`);
}
function F(e) {
	return e === 401 ? new E("Immich refused the API key. Check it, or create a new one.", e) : e === 403 ? new E("The API key is missing a permission Safelight needs: user.read, album.read, asset.read, asset.view and asset.download.", e) : new E(`The server answered with an error (${e}).`, e);
}
var I = () => new E("That address answered, but not as an Immich server. Check the address and port (Immich uses 2283 unless set otherwise).");
function L(e, t) {
	let n = (e) => `${t.server}/api${e}`, r = { "x-api-key": t.apiKey };
	async function i(r, i) {
		try {
			return await e(n(r), i);
		} catch (e) {
			throw P(e, t.server);
		}
	}
	async function a(e, t = {}) {
		let n = await i(e, {
			timeoutMs: D,
			...t,
			headers: {
				...r,
				accept: "application/json",
				...t.headers
			}
		});
		if (!n.ok) throw F(n.status);
		try {
			return await n.json();
		} catch {
			throw I();
		}
	}
	async function o(e) {
		let t = await a("/albums", { signal: e }), n = await a("/albums?shared=true", { signal: e }).catch((e) => {
			if (e instanceof E && e.status === 400) return [];
			throw e;
		}), r = /* @__PURE__ */ new Set();
		return [...t, ...n].filter((e) => !r.has(e.id) && r.add(e.id));
	}
	async function s(e, t) {
		let n = [], r = { page: 1 };
		try {
			for (let i = 0; r && i < j; i++) {
				let i = {
					albumIds: [e],
					withExif: !0,
					size: A,
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
			if (!(r instanceof E) || r.status !== 400 || n.length > 0) throw r;
			return (await a(`/albums/${encodeURIComponent(e)}`, { signal: t })).assets ?? [];
		}
	}
	return {
		async checkConnection(e) {
			let t = await i("/server/ping", {
				timeoutMs: D,
				signal: e
			});
			if ((t.ok ? await t.json().catch(() => null) : null)?.res !== "pong") throw I();
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
				timeoutMs: O,
				signal: n
			});
			if (!a.ok) throw F(a.status);
			return a.blob();
		},
		async rendition(e, t) {
			let n = (n) => i(`/assets/${encodeURIComponent(e)}/thumbnail?size=${n}`, {
				headers: r,
				timeoutMs: k,
				signal: t
			}), a = await n("fullsize");
			if (a.status === 400 && (a = await n("preview")), !a.ok) throw F(a.status);
			return a.blob();
		},
		async original(e, t, n) {
			let a = await i(`/assets/${encodeURIComponent(e)}/original`, {
				headers: r,
				timeoutMs: N(t),
				signal: n
			});
			if (!a.ok) throw F(a.status);
			return a.blob();
		}
	};
}
function R(e) {
	return Object.fromEntries(Object.entries(e).filter(([, e]) => e !== void 0));
}
var z = (e) => typeof e == "number" && Number.isFinite(e) ? e : void 0, B = (e) => typeof e == "string" && e.trim() ? e : void 0, V = (e) => {
	let t = typeof e == "string" ? Date.parse(e) : NaN;
	return Number.isFinite(t) ? t : void 0;
};
function H(e) {
	let t = V(e);
	if (t === void 0) return;
	let n = new Date(t), r = (e) => String(e).padStart(2, "0");
	return `${n.getUTCFullYear()}:${r(n.getUTCMonth() + 1)}:${r(n.getUTCDate())} ${r(n.getUTCHours())}:${r(n.getUTCMinutes())}:${r(n.getUTCSeconds())}`;
}
function U(e) {
	if (e.type && e.type !== "IMAGE" || e.isTrashed) return null;
	let t = e.exifInfo ?? {}, n = Number(t.orientation), r = {}, i = (e, t) => {
		t !== void 0 && (r[e] = t);
	};
	i("cameraMake", B(t.make)), i("cameraModel", B(t.model)), i("lens", B(t.lensModel)), i("aperture", z(t.fNumber)), i("focalLength", z(t.focalLength)), i("iso", z(t.iso)), i("shutterSpeed", B(t.exposureTime)), i("dateTimeOriginal", H(e.localDateTime)), i("orientation", Number.isInteger(n) && n >= 1 && n <= 8 ? n : void 0), i("gpsLatitude", z(t.latitude)), i("gpsLongitude", z(t.longitude)), i("imageDescription", B(t.description));
	let a = r.orientation !== void 0 && r.orientation >= 5, [o, s] = z(e.width) && z(e.height) ? [z(e.width), z(e.height)] : a ? [z(t.exifImageHeight), z(t.exifImageWidth)] : [z(t.exifImageWidth), z(t.exifImageHeight)], c = _(e.originalFileName);
	return c ? (delete r.orientation, {
		key: e.id,
		name: c,
		mimeType: "image/jpeg",
		...R({
			modified: V(e.fileModifiedAt),
			taken: V(t.dateTimeOriginal) ?? V(e.fileCreatedAt),
			width: o,
			height: s,
			rating: z(t.rating)
		}),
		exif: r
	}) : {
		key: e.id,
		name: e.originalFileName,
		...R({
			size: z(t.fileSizeInByte),
			modified: V(e.fileModifiedAt),
			taken: V(t.dateTimeOriginal) ?? V(e.fileCreatedAt),
			width: o,
			height: s,
			mimeType: B(e.originalMimeType),
			rating: z(t.rating)
		}),
		exif: r
	};
}
//#endregion
//#region src/source.ts
var W = 4;
async function G(e, t, n) {
	let r = Array(e.length), i = 0, a = Array.from({ length: Math.min(t, e.length) }, async () => {
		for (; i < e.length;) {
			let t = i++;
			r[t] = await n(e[t]);
		}
	});
	return await Promise.all(a), r;
}
function K(e, n, r) {
	let i = L(e, n);
	return {
		id: t,
		name: "Immich",
		library: c(n),
		keptOriginalsLimit: r,
		async list({ signal: e }) {
			return { folders: await G(await i.albums(e), W, async (t) => ({
				name: t.albumName,
				key: t.id,
				items: (await i.albumAssets(t.id, e)).flatMap((e) => U(e) ?? [])
			})) };
		},
		readPreview: (e, { maxEdge: t, signal: n }) => i.preview(e.key, t, n),
		readOriginal: (e, { signal: t }) => y(e.name) ? i.rendition(e.key, t) : i.original(e.key, e.size, t)
	};
}
function q(e) {
	let n = a(e.settings);
	n ? e.library.registerSource(K((t, n) => e.network.fetch(t, n), n, p(e.settings))) : e.library.unregisterSource(t);
}
//#endregion
//#region src/Settings.tsx
var J = (e) => `Connected as ${e.userName || "your Immich account"} at ${e.server}.`;
function Y(e) {
	let t = `${e.albumCount} album${e.albumCount === 1 ? "" : "s"}`;
	return `Connected as ${e.userName} to Immich ${e.version}: ${t}. Open “Immich” in the Folders panel to see them.`;
}
var X = (e) => `${e} original${e === 1 ? "" : "s"}`;
function Z({ count: e, bytes: t }) {
	return e === 0 ? "No originals are downloaded yet." : `${X(e)} ${e === 1 ? "takes" : "take"} ${m(t)} on this computer.`;
}
function Q() {
	let { Field: e } = x.preferences.fields, { Button: n, Select: r, Stack: i, tokens: a } = x.ui, [o, s] = b.useState(() => f(x.settings)), [c, l] = b.useState(null), [p, h] = b.useState(null), [g, _] = b.useState(!1), v = b.useCallback(async () => {
		l(await x.library.keptOriginals(t).catch(() => null));
	}, []);
	b.useEffect(() => {
		v();
	}, [v]);
	let y = (e) => {
		let t = e === "none" ? null : Number(e);
		s(t), x.settings.set(u, t), q(x), v();
	}, S = async () => {
		let e = c ?? {
			count: 0,
			bytes: 0
		};
		if (await x.ui.confirmDialog({
			title: "Clear downloaded originals?",
			message: `Safelight removes the ${X(e.count)} it downloaded from Immich (${m(e.bytes)}). Your ratings and edits stay. Each downloads again the next time you open or export its photo.`,
			confirmLabel: "Clear",
			variant: "danger"
		})) {
			_(!0);
			try {
				let { removed: e, kept: n } = await x.library.clearKeptOriginals(t);
				h(`Cleared ${X(e)}.` + (n ? ` ${n} in use (open in Develop or being exported) ${n === 1 ? "was" : "were"} kept.` : ""));
			} catch {
				h("The downloaded originals couldn't be cleared.");
			} finally {
				_(!1), await v();
			}
		}
	}, C = d.map((e) => e === null ? {
		value: "none",
		label: "No limit"
	} : {
		value: String(e),
		label: `${e} GB`
	}), w = {
		margin: 0,
		fontSize: 11,
		lineHeight: 1.45
	};
	return /* @__PURE__ */ b.createElement(i, { gap: 6 }, /* @__PURE__ */ b.createElement(e, {
		label: "Downloaded originals",
		hint: "The originals of photos you open or export are kept on this computer, up to this much space. Past it, the ones used longest ago are removed and download again when needed."
	}, /* @__PURE__ */ b.createElement(r, {
		ariaLabel: "Downloaded originals",
		value: o === null ? "none" : String(o),
		options: C,
		onChange: y
	})), c && /* @__PURE__ */ b.createElement("p", { style: {
		...w,
		color: a.textSecondary
	} }, Z(c)), /* @__PURE__ */ b.createElement("div", null, /* @__PURE__ */ b.createElement(n, {
		variant: "ghost",
		onClick: () => void S(),
		disabled: g || !c || c.count === 0
	}, "Clear downloaded originals")), p && /* @__PURE__ */ b.createElement("p", {
		role: "status",
		style: {
			...w,
			color: a.textSecondary
		}
	}, p));
}
function $() {
	let { Field: e } = x.preferences.fields, { Button: t, TextInput: n, Stack: r, Row: c, tokens: l } = x.ui, u = x.library.useOpenSource(), [d, f] = b.useState(() => i(x.settings)), [p, m] = b.useState(""), [h, g] = b.useState(() => a(x.settings)), [_, v] = b.useState(() => {
		let e = a(x.settings);
		return e ? {
			kind: "ok",
			text: J(e)
		} : { kind: "idle" };
	}), y = async () => {
		let e = M(d);
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
		else if (v({ kind: "busy" }), !await x.network.requestAccess(e)) v({
			kind: "error",
			text: `Safelight wasn't allowed to connect to ${new URL(e).origin}.`
		});
		else try {
			let n = await L((e, t) => x.network.fetch(e, t), {
				server: e,
				apiKey: t
			}).checkConnection(), r = {
				server: e,
				apiKey: t,
				userId: n.userId,
				userName: n.userName
			};
			o(x.settings, r), q(x), g(r), f(e), m(""), v({
				kind: "ok",
				text: Y(n)
			});
		} catch (e) {
			let t = e instanceof E ? e.message : "Something went wrong testing the connection.";
			v({
				kind: "error",
				text: t
			});
		}
	}, S = async () => {
		let e = h;
		s(x.settings), q(x), g(null), u?.id === "immich-web-folders.immich" && x.stores.useProjectStore.getState().closeProject(), e && await x.network.revokeAccess(e.server), v({
			kind: "ok",
			text: "Disconnected. Ratings and edits you made in Safelight are kept for when you connect again."
		});
	}, C = {
		margin: 0,
		fontSize: 11,
		lineHeight: 1.45
	};
	return /* @__PURE__ */ b.createElement(r, { gap: 8 }, /* @__PURE__ */ b.createElement(e, {
		label: "Server address",
		hint: "The address you open Immich at, such as http://192.168.1.20:2283."
	}, /* @__PURE__ */ b.createElement(n, {
		"aria-label": "Server address",
		value: d,
		placeholder: "http://192.168.1.20:2283",
		spellCheck: !1,
		onChange: f
	})), /* @__PURE__ */ b.createElement(e, {
		label: "API key",
		hint: "Create one in Immich under Account Settings ▸ API Keys, with user.read, album.read, asset.read, asset.view and asset.download. Safelight keeps it on this computer."
	}, /* @__PURE__ */ b.createElement(n, {
		"aria-label": "API key",
		type: "password",
		autoComplete: "off",
		value: p,
		placeholder: h ? "Saved" : "",
		onChange: m
	})), /* @__PURE__ */ b.createElement(c, { gap: 6 }, /* @__PURE__ */ b.createElement(t, {
		onClick: () => void y(),
		disabled: _.kind === "busy"
	}, _.kind === "busy" ? "Testing…" : "Test connection"), h && /* @__PURE__ */ b.createElement(t, {
		variant: "ghost",
		onClick: () => void S(),
		disabled: _.kind === "busy"
	}, "Disconnect")), _.kind === "ok" && /* @__PURE__ */ b.createElement("p", {
		role: "status",
		style: {
			...C,
			color: l.textSecondary
		}
	}, _.text), _.kind === "error" && /* @__PURE__ */ b.createElement("p", {
		role: "alert",
		style: {
			...C,
			color: l.labelRed
		}
	}, _.text), /* @__PURE__ */ b.createElement("p", { style: {
		...C,
		color: l.textMuted
	} }, "Your albums open as folders. Photos are downloaded from the server only when you open them in Develop or export them, then kept on this computer. Ratings and edits stay in Safelight; nothing on the server is changed."), h && /* @__PURE__ */ b.createElement(Q, null));
}
//#endregion
//#region src/index.tsx
function ee(t) {
	S(t), t.registerSettings({
		component: $,
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
		component: T
	}), q(t), t.settings.onChange((e) => {
		(e === "connection" || e === "originalsLimitGB") && q(t);
	});
}
//#endregion
export { ee as activate };

//# sourceMappingURL=index.js.map