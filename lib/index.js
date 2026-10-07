/**
 * dsh-plugin-canvas — host half.
 *
 * One job: an infinite-canvas warehouse for third-party plugins.
 *
 *  - Installed third-party plugins stay in the host library (global response).
 *  - Dragging one into the canvas detaches it from global response (dormant).
 *  - Composing a "workflow" (a named set of plugins on the canvas) and
 *    activating it re-attaches those plugins to global response.
 *  - Host packages (@deepseek-ai/*) are never offered, never switchable.
 *
 * Safety: this plugin never writes YAML or package.json. It only writes its own
 * state JSON, and every enable/disable is delegated to the host's pluginManager
 * (setBundleEnabled for bundle plugins, setPluginEnabled for entry-level rows).
 * The admission fence from the host's `connection.admit` guards every route.
 *
 * Zero runtime dependencies: `node:` builtins only.
 *
 * @module dsh-plugin-canvas
 */
import { readdirSync, readFileSync, renameSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const name = "dsh-plugin-canvas";
const inject = ["sessions"];
const API = "/api/plugins/dsh-plugin-canvas";
const STATE_VERSION = 2;
const MAX_BODY_BYTES = 1024 * 1024;

/* ─────────────────────────────── state ─────────────────────────────── */

/** Where this plugin keeps its one writable file. Never the profile's own files. */
export function stateDir(home = process.env.DSH_HOME || join(homedir(), ".dsh")) {
	return join(home, "plugin-canvas");
}

/**
 * Read the canvas state. `ok: false` means the file EXISTS but is unreadable or
 * malformed — distinct from "empty", so a damaged byte cannot silently wipe the
 * user's canvas.
 */
export function readState(dir = stateDir()) {
	const file = join(dir, "state.json");
	if (!existsSync(file)) return { workflows: [], ok: true };
	try {
		const text = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
		const parsed = JSON.parse(text);
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { workflows: [], ok: false };
		if (!Array.isArray(parsed.workflows)) return { workflows: [], ok: false };
		return { workflows: parsed.workflows.filter(isWorkflowShape), ok: true };
	} catch {
		return { workflows: [], ok: false };
	}
}

/** A workflow must be an object with a non-empty id and a pages array. */
function isWorkflowShape(row) {
	return row !== null && typeof row === "object"
		&& typeof row.id === "string" && row.id !== ""
		&& Array.isArray(row.pages);
}

/** Write the state atomically; false instead of throwing. */
export function writeState(state, dir = stateDir()) {
	try {
		mkdirSync(dir, { recursive: true });
		const file = join(dir, "state.json");
		const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
		writeFileSync(temp, `${JSON.stringify({ version: STATE_VERSION, workflows: state.workflows }, null, 2)}\n`, "utf8");
		renameSync(temp, file);
		return true;
	} catch {
		return false;
	}
}

/* ─────────────────────────── plugin scanning ─────────────────────────── */

/**
 * Every plugin-name a plugin's patch declares as a loader entry id.
 *
 * A bundle's cordis.patch.yml declares entries like:
 *   - insert:
 *       - id: tool-godot-bridge
 *         name: godot-bridge
 * The entry id is the dedup key — NOT the package name. Two different packages
 * can declare the same entry id, and a duplicate entry id crashes the host at
 * boot (`duplicate loader entry id`), so this is what /save must check.
 */
export function extractEntryIds(patchText) {
	const ids = [];
	const re = /^\s*- id:\s*["']?([^"'\s#]+)/gm;
	let m;
	while ((m = re.exec(patchText)) !== null) {
		const id = m[1];
		if (!ids.includes(id)) ids.push(id);
	}
	return ids;
}

/**
 * Scan the profile's node_modules for third-party plugins.
 *
 * Returns one row per package that:
 *  - has a `name` and a `dsh` field (it is a plugin, not an ordinary dep),
 *  - is not a host package (`@deepseek-ai/*` or `cordis:`),
 *  - is not this plugin itself.
 * Each row carries whether it is a bundle (has dsh.bundle.patch) and the entry
 * ids its patch declares (for duplicate detection).
 */
export function scanThirdParty(nodeModulesDir) {
	const found = [];
	const readManifest = (pkgDir) => {
		try {
			const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
			if (typeof manifest?.name !== "string" || manifest.name === "") return;
			if (manifest.name === name) return;
			if (manifest.name.startsWith("@deepseek-ai/") || manifest.name.startsWith("cordis:")) return;
			if (manifest.dsh === undefined || manifest.dsh === null) return;
			const patchPath = typeof manifest.dsh?.bundle?.patch === "string" ? manifest.dsh.bundle.patch : "";
			const isBundle = patchPath !== "";
			let entryIds = [];
			if (isBundle) {
				try {
					entryIds = extractEntryIds(readFileSync(join(pkgDir, patchPath), "utf8"));
				} catch {
					entryIds = [];
				}
			}
			found.push({ name: manifest.name, version: String(manifest.version ?? ""), isBundle, entryIds });
		} catch {}
	};
	let entries;
	try {
		entries = readdirSync(nodeModulesDir, { withFileTypes: true });
	} catch {
		return found;
	}
	for (const entry of entries) {
		if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
		if (entry.name === ".bin" || entry.name === ".pnpm") continue;
		const pkgDir = join(nodeModulesDir, entry.name);
		if (entry.name.startsWith("@")) {
			let scoped;
			try {
				scoped = readdirSync(pkgDir, { withFileTypes: true });
			} catch {
				continue;
			}
			for (const inner of scoped) {
				if (!inner.isDirectory() && !inner.isSymbolicLink()) continue;
				readManifest(join(pkgDir, inner.name));
			}
			continue;
		}
		readManifest(pkgDir);
	}
	return found.sort((a, b) => a.name.localeCompare(b.name));
}

/** Which packages the profile carries as bundles (mounted everywhere). */
export function readBundles(profileDir) {
	try {
		const manifest = JSON.parse(readFileSync(join(profileDir, "package.json"), "utf8"));
		const bundles = manifest?.dsh?.profile?.bundles;
		return new Set(Array.isArray(bundles) ? bundles.filter((e) => typeof e === "string") : []);
	} catch {
		return new Set();
	}
}

/** The plugin names inside one workflow (union across all pages). */
export function workflowPlugins(workflow) {
	const names = [];
	for (const page of Array.isArray(workflow?.pages) ? workflow.pages : []) {
		for (const node of Array.isArray(page?.nodes) ? page.nodes : []) {
			if (typeof node?.plugin === "string" && node.plugin !== "" && !names.includes(node.plugin)) names.push(node.plugin);
		}
	}
	return names;
}

/** The plugin names inside all workflows (union). */
export function canvasPlugins(workflows) {
	const names = [];
	for (const wf of workflows) for (const n of workflowPlugins(wf)) if (!names.includes(n)) names.push(n);
	return names;
}

/**
 * Find entry-id collisions among the plugins inside `workflows`.
 *
 * Returns a map entryId -> plugin names that declare it, for every entry id
 * declared by more than one plugin. A duplicate entry id crashes the host, so
 * /save must refuse a workflow that introduces one.
 */
export function findDuplicateEntryIds(workflows, scan) {
	const owners = new Map();
	const duplicates = new Map();
	const names = canvasPlugins(workflows);
	for (const pluginName of names) {
		const row = scan.find((p) => p.name === pluginName);
		if (row === undefined) continue;
		for (const id of row.entryIds) {
			if (!owners.has(id)) owners.set(id, []);
			owners.get(id).push(pluginName);
		}
	}
	for (const [id, list] of owners) if (list.length > 1) duplicates.set(id, list);
	return duplicates;
}

/* ─────────────────────────────── host switch ─────────────────────────────── */

/**
 * Interpret what the host's toggle actually did.
 *
 * The host produces five `application` values and only ONE means the switch is
 * live: `applied`. `restart-required` is saved but not live; `overridden` is
 * written but a higher-priority layer wins; `failed`/`cancelled` are refused.
 * An unrecognised value (including a future host's invention, or a result with
 * no `application` at all) is NOT success — it is reported as unknown.
 */
export function toggleOutcome(result) {
	const application = result?.application;
	if (application === "failed") {
		const code = result?.error?.code ?? result?.error?.message;
		return { ok: false, error: typeof code === "string" && code !== "" ? code : "the host refused the change", live: false };
	}
	if (application === "cancelled") return { ok: false, error: "the host cancelled the change", live: false };
	if (application === "overridden") return { ok: false, error: "overridden", live: false };
	if (application === "restart-required") return { ok: true, applied: "restart-required", live: false };
	if (application === "applied") return { ok: true, applied: "applied", live: true };
	return { ok: false, error: typeof application === "string" && application !== "" ? application : "unknown-outcome", live: false };
}

/**
 * Enable/disable one plugin through the host, choosing the right switch.
 *
 * Bundle plugins (with a cordis.patch.yml) use setBundleEnabled — a clean
 * append/remove on dsh.profile.bundles. Non-bundle plugins use setPluginEnabled
 * on their entry id (which writes a `disabled` marker, not a clean remove).
 * Both are POSITIONAL calls and both report failure by RETURN VALUE, not throw.
 */
export async function switchPluginByName(manager, plugin, enabled) {
	if (plugin.isBundle) {
		return toggleOutcome(await manager.setBundleEnabled(plugin.name, enabled));
	}
	if (plugin.entryIds.length === 0) {
		return { ok: false, error: "not-bundle-and-no-entry", live: false };
	}
	// A non-bundle plugin has no patch of its own; toggle its first entry id.
	const results = [];
	for (const entryId of plugin.entryIds) {
		results.push(toggleOutcome(await manager.setPluginEnabled(entryId, enabled)));
	}
	const failed = results.find((r) => !r.ok);
	return failed ?? results[0] ?? { ok: false, error: "unknown-outcome", live: false };
}

/* ─────────────────────────────── serving ─────────────────────────────── */

export async function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.length;
		if (size > maxBytes) throw new Error(`request body exceeds ${maxBytes} bytes`);
		chunks.push(chunk);
	}
	const text = Buffer.concat(chunks).toString("utf8");
	return text === "" ? {} : JSON.parse(text);
}

function send(res, status, payload) {
	res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
	res.end(JSON.stringify(payload));
}

/** Whether the host's own admission fence rejects this request. */
function admissionRejection(admit, req) {
	if (admit === undefined) return undefined;
	const admission = admit(req);
	return "rejection" in admission ? admission.rejection : undefined;
}

/**
 * The guard every route runs first. `webServer` matches the exact table before
 * any prefix, so without this check these routes would never meet the
 * authenticated `/api` prefix. Fail-open on a missing/erroring fence, because
 * those hosts have no fence to consult and refusing everything would break the
 * panel entirely.
 */
export function createFence(admitOf, log = undefined) {
	let warnedNoFence = false;
	return (req, res) => {
		const admit = admitOf();
		if (admit === undefined) {
			if (!warnedNoFence) {
				warnedNoFence = true;
				log?.(`${name}: no connection service; routes serving WITHOUT the host's admission fence`);
			}
			return false;
		}
		try {
			const rejection = admissionRejection(admit, req);
			if (rejection === undefined) return false;
			res.writeHead(rejection, { "Content-Type": "text/plain; charset=utf-8" });
			res.end(rejection === 401 ? "unauthorized" : "forbidden");
			return true;
		} catch (error) {
			log?.(`${name}: admission check failed (${String(error)})`);
			return false;
		}
	};
}

/** Host packages and this plugin are never offered nor switchable. */
export function isOfferable(plugin) {
	const moduleName = typeof plugin?.name === "string" ? plugin.name : "";
	if (moduleName === "") return false;
	if (moduleName.startsWith("@deepseek-ai/")) return false;
	if (moduleName.startsWith("cordis:")) return false;
	if (moduleName === name) return false;
	return true;
}

/** Look up a scanned plugin by name, returning a safe default. */
function scannedOr(scan, pluginName) {
	return scan.find((p) => p.name === pluginName)
		?? { name: pluginName, version: "", isBundle: false, entryIds: [] };
}

/* ─────────────────────────────── apply ─────────────────────────────── */

export function apply(ctx, pluginConfig = {}) {
	const logger = ctx.logger;
	const profileDir = (() => {
		try {
			return fileURLToPath(ctx.baseUrl ?? "");
		} catch {
			return process.cwd();
		}
	})();
	const nodeModulesDir = join(profileDir, "node_modules");

	ctx.inject(["webServer"], (webCtx) => {
		let admit;
		ctx.inject(["connection"], (connCtx) => {
			admit = (req) => connCtx.connection.admit(req);
		});
		const refused = createFence(() => admit, (message) => logger?.warn(message));

		let manager;
		ctx.inject(["pluginManager"], (pmCtx) => {
			manager = pmCtx.pluginManager;
		});

		/** Everything the panel needs in one round trip. */
		function snapshot() {
			const scan = scanThirdParty(nodeModulesDir);
			const bundles = readBundles(profileDir);
			const { workflows } = readState();
			const inCanvas = canvasPlugins(workflows);
			return {
				plugins: scan.map((p) => ({ ...p, inBundles: bundles.has(p.name), inCanvas: inCanvas.includes(p.name) })),
				workflows,
				bundles: [...bundles],
				duplicates: Object.fromEntries(findDuplicateEntryIds(workflows, scan))
			};
		}

		/** Persist the workflows array; returns the fresh snapshot or an error. */
		function persist(workflows) {
			if (!writeState({ workflows })) return { error: "could not write canvas state" };
			return {};
		}

		// ── GET /state ──
		webCtx.effect(() => webCtx.webServer.register({
			kind: "exact",
			path: `${API}/state`,
			handler: async (req, res) => {
				if (refused(req, res)) return;
				try {
					send(res, 200, snapshot());
				} catch (error) {
					send(res, 500, { error: String(error) });
				}
			}
		}));

		// ── POST /drag ── 拖入/移出画布 = 脱离/回到全局
		webCtx.effect(() => webCtx.webServer.register({
			kind: "exact",
			path: `${API}/drag`,
			handler: async (req, res) => {
				if (refused(req, res)) return;
				if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
				try {
					const body = await readJsonBody(req);
					const pluginName = typeof body.plugin === "string" ? body.plugin : "";
					const workflowId = typeof body.workflowId === "string" ? body.workflowId : "";
					const inCanvas = body.inCanvas === true;
					if (pluginName === "" || workflowId === "") return send(res, 400, { ok: false, error: "plugin and workflowId are required" });
					if (manager === undefined) return send(res, 503, { ok: false, error: "plugin manager unavailable" });

					const scan = scanThirdParty(nodeModulesDir);
					const plugin = scannedOr(scan, pluginName);
					// Re-validate against the disk scan: the browser cannot invent an
					// uninstalled plugin, and host packages are never switchable.
					if (scan.find((p) => p.name === pluginName) === undefined) {
						return send(res, 404, { ok: false, error: "not installed in this profile" });
					}
					if (!isOfferable(plugin)) {
						return send(res, 403, { ok: false, error: "the host's own packages cannot be moved from here" });
					}

					const { workflows } = readState();
					const workflow = workflows.find((w) => w.id === workflowId);
					if (workflow === undefined) return send(res, 404, { ok: false, error: "unknown workflow" });

					// Dragging in = detach from global response. Dragging out = re-attach.
					const result = await switchPluginByName(manager, plugin, !inCanvas);
					if (!result.ok) return send(res, 500, result);

					// inCanvas=true: add to the workflow's first page.
					// inCanvas=false: remove from EVERY workflow (fully out of the canvas).
					const next = workflows.map((w) => {
						if (inCanvas) {
							if (w.id !== workflowId) return w;
							const pages = w.pages.map((page, pi) => {
								if (pi !== 0) return page;
								const nodes = [...(page.nodes ?? []), {
									id: `n-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
									plugin: pluginName,
									x: typeof body.x === "number" ? body.x : 120,
									y: typeof body.y === "number" ? body.y : 80
								}];
								return { ...page, nodes };
							});
							return { ...w, pages };
						}
						const pages = w.pages.map((page) => ({
							...page,
							nodes: (page.nodes ?? []).filter((n) => n.plugin !== pluginName)
						}));
						return { ...w, pages };
					});
					const saved = persist(next);
					if (saved.error !== undefined) return send(res, 500, { ok: false, error: saved.error });
					send(res, 200, { ok: true, ...result, ...snapshot() });
				} catch (error) {
					send(res, 400, { ok: false, error: String(error) });
				}
			}
		}));

		// ── POST /activate ── 开启/关闭组合 = 组合内插件进入/退出全局
		webCtx.effect(() => webCtx.webServer.register({
			kind: "exact",
			path: `${API}/activate`,
			handler: async (req, res) => {
				if (refused(req, res)) return;
				if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
				try {
					const body = await readJsonBody(req);
					const workflowId = typeof body.workflowId === "string" ? body.workflowId : "";
					const active = body.active === true;
					if (workflowId === "") return send(res, 400, { ok: false, error: "workflowId is required" });
					if (manager === undefined) return send(res, 503, { ok: false, error: "plugin manager unavailable" });

					const scan = scanThirdParty(nodeModulesDir);
					const { workflows } = readState();
					const workflow = workflows.find((w) => w.id === workflowId);
					if (workflow === undefined) return send(res, 404, { ok: false, error: "unknown workflow" });

					// The set of plugins that should stay global after this toggle:
					// the union of plugins in OTHER active workflows. Plugins still
					// referenced elsewhere must not be detached.
					const keep = new Set();
					for (const w of workflows) {
						if (w.id === workflowId || w.active !== true) continue;
						for (const n of workflowPlugins(w)) keep.add(n);
					}
					const plugins = workflowPlugins(workflow);
					const results = [];
					for (const pluginName of plugins) {
						const plugin = scannedOr(scan, pluginName);
						if (!isOfferable(plugin)) {
							results.push({ plugin: pluginName, ok: false, error: "host package" });
							continue;
						}
						// Activating: enable. Deactivating: disable only if no other
						// active workflow keeps it.
						const want = active || keep.has(pluginName);
						const r = await switchPluginByName(manager, plugin, want);
						results.push({ plugin: pluginName, ...r });
					}

					const next = workflows.map((w) => w.id === workflowId ? { ...w, active } : w);
					const saved = persist(next);
					if (saved.error !== undefined) return send(res, 500, { ok: false, error: saved.error });

					send(res, 200, { ok: true, results, ...snapshot() });
				} catch (error) {
					send(res, 400, { ok: false, error: String(error) });
				}
			}
		}));

		// ── POST /save ── 存画布布局（先去重检查）
		webCtx.effect(() => webCtx.webServer.register({
			kind: "exact",
			path: `${API}/save`,
			handler: async (req, res) => {
				if (refused(req, res)) return;
				if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
				try {
					const body = await readJsonBody(req);
					const workflow = body.workflow;
					if (workflow === null || typeof workflow !== "object" || typeof workflow.id !== "string" || workflow.id === "") {
						return send(res, 400, { ok: false, error: "workflow is required" });
					}

					const scan = scanThirdParty(nodeModulesDir);
					const { workflows } = readState();

					// Duplicate entry id = boot crash. Refuse, do not merely warn.
					const trial = workflows.map((w) => w.id === workflow.id ? workflow : w);
					const duplicates = findDuplicateEntryIds(trial, scan);
					if (Object.keys(duplicates).length > 0) {
						return send(res, 409, { ok: false, error: "duplicate loader entry id", duplicates });
					}

					const next = [...workflows.filter((w) => w.id !== workflow.id), workflow];
					const saved = persist(next);
					if (saved.error !== undefined) return send(res, 500, { ok: false, error: saved.error });
					send(res, 200, { ok: true, ...snapshot() });
				} catch (error) {
					send(res, 400, { ok: false, error: String(error) });
				}
			}
		}));

		// ── POST /delete ── 删除组合（先停用其插件，再从状态移除）
		webCtx.effect(() => webCtx.webServer.register({
			kind: "exact",
			path: `${API}/delete`,
			handler: async (req, res) => {
				if (refused(req, res)) return;
				if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
				try {
					const body = await readJsonBody(req);
					const workflowId = typeof body.workflowId === "string" ? body.workflowId : "";
					if (workflowId === "") return send(res, 400, { ok: false, error: "workflowId is required" });
					if (manager === undefined) return send(res, 503, { ok: false, error: "plugin manager unavailable" });

					const scan = scanThirdParty(nodeModulesDir);
					const { workflows } = readState();
					const workflow = workflows.find((w) => w.id === workflowId);
					if (workflow === undefined) return send(res, 404, { ok: false, error: "unknown workflow" });

					// If the workflow was active, detach its plugins — unless another
					// active workflow still references them.
					const keep = new Set();
					for (const w of workflows) {
						if (w.id === workflowId || w.active !== true) continue;
						for (const n of workflowPlugins(w)) keep.add(n);
					}
					const results = [];
					if (workflow.active === true) {
						for (const pluginName of workflowPlugins(workflow)) {
							if (keep.has(pluginName)) continue;
							const plugin = scannedOr(scan, pluginName);
							if (isOfferable(plugin)) {
								const r = await switchPluginByName(manager, plugin, false);
								results.push({ plugin: pluginName, ...r });
							}
						}
					}

					const next = workflows.filter((w) => w.id !== workflowId);
					const saved = persist(next);
					if (saved.error !== undefined) return send(res, 500, { ok: false, error: saved.error });
					send(res, 200, { ok: true, results, ...snapshot() });
				} catch (error) {
					send(res, 400, { ok: false, error: String(error) });
				}
			}
		}));
	});
}

export { inject, name, API, STATE_VERSION };
