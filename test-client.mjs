// dsh-plugin-canvas 客户端结构自检：模拟 window.__ModuleLoader__ + React。
// 运行：node test-client.mjs（在插件目录内）
let capturedFactory = null;
globalThis.window = {
  __ModuleLoader__: { load: (spec) => { capturedFactory = spec.factory; } }
};

await import("./lib/client.js");

if (capturedFactory === null) {
  console.log("FAIL: window.__ModuleLoader__.load 未被调用");
  process.exit(1);
}

const mockReact = {
  createElement: () => ({}),
  useState: (v) => [v, () => {}],
  useRef: () => ({ current: null }),
  useCallback: (fn) => fn,
  useEffect: () => {},
};
const mod = capturedFactory((name) => {
  if (name === "react") return mockReact;
  throw new Error("unexpected require: " + name);
});

let injectedSlot = null;
let effectRan = false;
mod.apply({
  effect: () => { effectRan = true; },
  slots: { inject: (name) => { injectedSlot = name; }, register: () => {} }
});

const ok = Array.isArray(mod.inject) && mod.inject.includes("slots")
  && typeof mod.apply === "function"
  && effectRan
  && injectedSlot === "conversation.input.right";
console.log("inject:", JSON.stringify(mod.inject));
console.log("slot:", injectedSlot);
console.log(ok ? "\n✅ client 结构验证通过" : "\n❌ 结构验证失败");
process.exit(ok ? 0 : 1);
