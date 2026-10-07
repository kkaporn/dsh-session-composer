// dsh-plugin-canvas 宿主半自检：无框架、无夹具。
// 运行：node test-index.mjs（在插件目录内）
import { fileURLToPath } from "node:url";
import * as M from "./lib/index.js";

const nmDir = fileURLToPath(new URL("..", import.meta.url)); // = profile/node_modules

const log = (t, v) => console.log(t, JSON.stringify(v));
let failures = 0;
const check = (label, cond, detail = "") => {
  if (!cond) { failures++; console.log(`FAIL  ${label}  ${detail}`); }
  else console.log(`ok    ${label}`);
};

console.log("=== A. scanThirdParty（排除本体 + 识别 bundle + 提取 entry id）===");
const scan = M.scanThirdParty(nmDir);
console.log("扫描到", scan.length, "个第三方插件");
check("不包含本体", !scan.some(p => p.name.startsWith("@deepseek-ai/")));
check("不包含自身", !scan.some(p => p.name === "dsh-plugin-canvas"));
check("godot-bridge 是 bundle", scan.find(p => p.name === "godot-bridge")?.isBundle === true);

console.log("\n=== B. extractEntryIds ===");
const patch = `- insert:\n    - id: tool-godot-bridge\n      name: godot-bridge\n    - id: second-entry\n      name: x`;
check("提取 2 个 id", M.extractEntryIds(patch).length === 2);

console.log("\n=== C. 去重（entry id 撞 = 崩溃）===");
const wfA = { id: "a", pages: [{ id: "p", name: "x", nodes: [{ id: "n1", plugin: "godot-bridge" }, { id: "n2", plugin: "dsh-godot-skill" }] }] };
check("godot-bridge + dsh-godot-skill 无碰撞", Object.keys(M.findDuplicateEntryIds([wfA], scan)).length === 0);
const clashScan = [
  { name: "pkg-a", version: "1", isBundle: true, entryIds: ["same-id"] },
  { name: "pkg-b", version: "1", isBundle: true, entryIds: ["same-id"] },
];
const wfB = { id: "b", pages: [{ id: "p", name: "x", nodes: [{ id: "n1", plugin: "pkg-a" }, { id: "n2", plugin: "pkg-b" }] }] };
check("检测到 same-id 碰撞", M.findDuplicateEntryIds([wfB], clashScan).get("same-id")?.length === 2);

console.log("\n=== D. toggleOutcome 五种 application ===");
const app = (a) => M.toggleOutcome({ application: a });
check("applied → live", app("applied").live === true && app("applied").ok === true);
check("restart-required → saved not live", app("restart-required").live === false && app("restart-required").ok === true);
check("overridden → error", app("overridden").ok === false);
check("failed → error", app("failed").ok === false);
check("cancelled → error", app("cancelled").ok === false);
check("unknown → error", app("SOMETHING-NEW").ok === false);
check("无 application → unknown-outcome", app(undefined).ok === false && app(undefined).error === "unknown-outcome");

console.log("\n=== E. workflowPlugins / canvasPlugins ===");
const wf = { id: "w", pages: [
  { id: "p1", name: "a", nodes: [{ plugin: "x" }, { plugin: "y" }] },
  { id: "p2", name: "b", nodes: [{ plugin: "z" }, { plugin: "x" }] },
]};
check("workflowPlugins 并集去重", JSON.stringify(M.workflowPlugins(wf)) === JSON.stringify(["x", "y", "z"]));

console.log("\n=== F. createFence 边界 ===");
check("无 fence → 放行", M.createFence(() => undefined)({}, { writeHead() {}, end() {} }) === false);
const rejectFence = M.createFence(() => (req) => ({ rejection: 401 }));
let status = 0;
const rej = rejectFence({}, { writeHead(s) { status = s; }, end() {} });
check("401 拒绝 → true 且 status=401", rej === true && status === 401);

console.log("\n" + (failures === 0 ? "✅ 全部通过" : `❌ ${failures} 项失败`));
process.exit(failures === 0 ? 0 : 1);
