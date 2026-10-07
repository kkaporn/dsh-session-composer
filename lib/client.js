/**
 * dsh-plugin-canvas — browser half.
 *
 * One entry icon in the composer dock, opening a panel that is the warehouse:
 *  - Left: third-party plugins, split "本体库" (global response) vs "画布中".
 *  - Right: workflows, each with an on/off switch and its plugin list.
 *
 * "拖入画布" detaches a plugin from global response; "移出" re-attaches it.
 * Activating a workflow re-attaches every plugin in it; deactivating detaches
 * them (except plugins still referenced by another active workflow).
 *
 * The stylesheet is tagged with `data-plugin` and installed once from `apply`,
 * so a hot reload reclaims exactly its own tags instead of leaving stale rules.
 */
window.__ModuleLoader__.load({
  id: "dsh-plugin-canvas",
  factory: (require) => {
    var React = require("react");
    var h = React.createElement;

    var API = "/api/plugins/dsh-plugin-canvas";
    var PLUGIN_ID = "dsh-plugin-canvas";
    var STYLE_SELECTOR = 'style[data-plugin="' + PLUGIN_ID + '"]';

    var CSS = [
      ".dpc-anchor{display:inline-flex}",
      ".dpc-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;",
      "height:28px;padding:0 10px;border:0;border-radius:var(--dsw-radius-sm,8px);",
      "background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.16)));",
      "color:var(--dsw-alias-label-primary,#e8e8e8);cursor:pointer;",
      "font-family:inherit;font-size:12px;line-height:18px;white-space:nowrap}",
      ".dpc-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.16))}",
      ".dpc-btn[data-on='1']{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.16));",
      "box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1,rgba(127,127,127,.28))}",
      ".dpc-btn[data-tone='primary']{font-weight:600;",
      "box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary,#4c9aff)}",
      ".dpc-btn:disabled{cursor:default;opacity:.45}",
      ".dpc-btn:focus-visible,.dpc-row:focus-visible,.dpc-input:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ",
      "var(--dsw-alias-brand-primary,#4c9aff);outline-offset:2px}",
      ".dpc-backdrop{position:fixed;inset:0;z-index:59;background:rgba(0,0,0,.45)}",
      ".dpc-panel{box-sizing:border-box;position:fixed;left:50%;transform:translateX(-50%);top:64px;z-index:60;",
      "width:min(760px,94vw);max-height:min(80vh,680px);overflow:auto;overscroll-behavior:contain;",
      "padding:18px 20px 16px;text-align:left;border:0;border-radius:var(--dsw-radius-lg,20px);",
      "background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.16)));",
      "color:var(--dsw-alias-label-primary,#e8e8e8);font-family:inherit;font-size:13px;line-height:20px;",
      "box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(0,0,0,.35))}",
      ".dpc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 0 12px}",
      ".dpc-title{font-size:15px;line-height:22px;font-weight:600}",
      ".dpc-cols{display:grid;grid-template-columns:280px 1fr;gap:12px}",
      ".dpc-card{position:relative;padding:10px 12px 12px;border-radius:var(--dsw-radius-md,12px);",
      "background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06))}",
      ".dpc-sec{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:0 0 6px;",
      "font-size:11px;line-height:16px;font-weight:600;color:var(--dsw-alias-label-secondary,#a8a8a8)}",
      ".dpc-row{display:flex;align-items:center;gap:8px;min-height:32px;padding:0 4px;border-radius:var(--dsw-radius-sm,8px)}",
      ".dpc-row:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.16))}",
      ".dpc-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
      "font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px}",
      ".dpc-mut{flex:0 0 auto;color:var(--dsw-alias-state-idle-primary,#8c8c8c);font-size:11px}",
      ".dpc-tag{flex:0 0 auto;padding:1px 8px;border-radius:999px;font-size:11px;",
      "background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.16));color:var(--dsw-alias-label-secondary,#a8a8a8)}",
      ".dpc-tag[data-tone='ok']{color:var(--dsw-alias-state-success-primary,#4ec9a0)}",
      ".dpc-tag[data-tone='warn']{color:var(--dsw-alias-state-warn-primary,#e0b341)}",
      ".dpc-input{box-sizing:border-box;width:100%;height:30px;padding:0 10px;border:1px solid ",
      "var(--dsw-alias-border-l1,rgba(127,127,127,.28));border-radius:var(--dsw-radius-md,12px);",
      "background:var(--dsw-alias-bg-base,var(--dsw-alias-bg-layer-1,rgba(127,127,127,.10)));color:inherit;font-family:inherit;font-size:12px}",
      ".dpc-empty{padding:6px 4px 8px;font-size:12px;color:var(--dsw-alias-state-idle-primary,#8c8c8c)}",
      ".dpc-msg{margin:8px 0 0;padding:8px 10px;border-radius:var(--dsw-radius-sm,8px);font-size:12px;",
      "background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.16))}",
      ".dpc-msg[data-kind='error']{color:var(--dsw-alias-state-error-primary,#e06c75);word-break:break-word}",
      ".dpc-foot{padding:10px 0 0;font-size:11px;line-height:17px;color:var(--dsw-alias-state-idle-primary,#8c8c8c)}",
      ".dpc-canvas{position:relative;flex:1;min-height:340px;overflow:hidden;border-radius:var(--dsw-radius-md,12px);",
      "background:var(--dsw-alias-bg-base,var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06)));cursor:grab;touch-action:none}",
      ".dpc-canvas.dpc-panning{cursor:grabbing}",
      ".dpc-viewport{position:absolute;left:0;top:0;transform-origin:0 0}",
      ".dpc-node{position:absolute;box-sizing:border-box;width:150px;padding:8px 10px;border-radius:var(--dsw-radius-sm,8px);",
      "background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.16)));",
      "box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1,rgba(127,127,127,.28));cursor:grab;user-select:none;touch-action:none}",
      ".dpc-node.dpc-dragging{box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary,#4c9aff);cursor:grabbing}",
      ".dpc-node-name{display:block;font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:11px;",
      "overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dpc-node-meta{display:block;font-size:10px;color:var(--dsw-alias-state-idle-primary,#8c8c8c);margin-top:2px}",
      ".dpc-node-x{position:absolute;top:4px;right:6px;width:16px;height:16px;border:0;border-radius:6px;background:transparent;",
      "color:var(--dsw-alias-label-secondary,#a8a8a8);font-size:12px;line-height:1;cursor:pointer;padding:0;opacity:0}",
      ".dpc-node:hover .dpc-node-x{opacity:1}",
      ".dpc-node-x:hover{color:var(--dsw-alias-state-error-primary,#e06c75)}",
      ".dpc-canvas-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;",
      "color:var(--dsw-alias-state-idle-primary,#8c8c8c);font-size:12px;pointer-events:none}",
      ".dpc-edge{stroke:var(--dsw-alias-label-secondary,#a8a8a8);stroke-width:1.5;fill:none;opacity:.6}",
      "@media (prefers-reduced-motion: reduce){.dpc-panel,.dpc-btn{transition:none}}"
    ].join("");

    function installStyles() {
      if (typeof document === "undefined") return function () {};
      if (document.querySelector(STYLE_SELECTOR) !== null) return function () {};
      var tag = document.createElement("style");
      tag.setAttribute("data-plugin", PLUGIN_ID);
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return function () {
        var stale = document.querySelector(STYLE_SELECTOR);
        if (stale !== null) stale.remove();
      };
    }

    /** ES5 shallow copy: some client runtimes reject object spread. */
    function assign(target) {
      for (var i = 1; i < arguments.length; i += 1) {
        var src = arguments[i];
        if (src) for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
      }
      return target;
    }

    function readable(text) {
      var message = String(text === undefined || text === null ? "" : text);
      if (/not installed in this profile/.test(message)) return "这个包里没有它，装不了";
      if (/not-bundle/.test(message)) return "这个插件不是 bundle，无法全局启停";
      if (/duplicate loader entry id/.test(message)) return "插件声明了重复的 entry id，会导致启动崩溃，已拒绝";
      if (/unknown workflow/.test(message)) return "找不到这个组合，刷新后再试";
      if (/unknown entry/.test(message)) return "宿主不认识这个条目";
      if (/management-required/.test(message)) return "宿主必需的条目，不能关";
      if (/restart-required/.test(message)) return "已保存，需重启一次 DSH 才生效";
      if (/overridden/.test(message)) return "宿主里有更高优先级的设置覆盖了这次改动";
      if (/exceeds \d+ bytes/.test(message)) return "请求太大，被拒绝了";
      if (/unauthorized/.test(message)) return "没有权限（认证失败）";
      return message;
    }

    function ComposerControl(props) {
      var sessionId = props !== null && props !== undefined && typeof props.sessionId === "string" ? props.sessionId : "";

      var openState = React.useState(false);
      var open = openState[0];
      var setOpen = openState[1];
      var dataBox = React.useState(null);
      var data = dataBox[0];
      var setData = dataBox[1];
      var errorBox = React.useState("");
      var error = errorBox[0];
      var setError = errorBox[1];
      var noteBox = React.useState("");
      var note = noteBox[0];
      var setNote = noteBox[1];
      var busyBox = React.useState(false);
      var busy = busyBox[0];
      var setBusy = busyBox[1];
      var currentBox = React.useState("");
      var currentId = currentBox[0];
      var setCurrentId = currentBox[1];
      var labelBox = React.useState("");
      var label = labelBox[0];
      var setLabel = labelBox[1];
      var panelRef = React.useRef(null);
      var canvasRef = React.useRef(null);
      var viewportState = React.useState({ panX: 0, panY: 0, zoom: 1 });
      var viewport = viewportState[0];
      var setViewport = viewportState[1];
      var dragNodeState = React.useState(null);
      var dragNode = dragNodeState[0];
      var setDragNode = dragNodeState[1];
      var panStartState = React.useState(null);
      var panStart = panStartState[0];
      var setPanStart = panStartState[1];
      var dragPosState = React.useState({});
      var dragPos = dragPosState[0];
      var setDragPos = dragPosState[1];

      var load = React.useCallback(function () {
        setError("");
        return fetch(API + "/state")
          .then(function (res) {
            if (!res.ok) return res.text().then(function (t) { throw new Error(t || "HTTP " + res.status); });
            return res.json();
          })
          .then(function (body) {
            setData(body);
            setCurrentId(function (prev) {
              if (prev !== "" && (body.workflows || []).some(function (w) { return w.id === prev; })) return prev;
              return body.workflows && body.workflows.length > 0 ? body.workflows[0].id : "";
            });
          })
          .catch(function (err) { setError(readable(String(err && err.message ? err.message : err))); });
      }, []);

      React.useEffect(function () { load(); }, [load]);
      React.useEffect(function () { if (open) load(); }, [open, load]);

      React.useEffect(function () {
        if (!open) return undefined;
        var onKey = function (event) {
          if (event.key !== "Escape") return;
          event.stopImmediatePropagation();
          setOpen(false);
        };
        window.addEventListener("keydown", onKey, true);
        return function () { window.removeEventListener("keydown", onKey, true); };
      }, [open]);

      React.useEffect(function () {
        if (!open) return undefined;
        var onDown = function (event) {
          var panel = panelRef.current;
          if (panel !== null && !panel.contains(event.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDown, true);
        return function () { document.removeEventListener("mousedown", onDown, true); };
      }, [open]);

      React.useEffect(function () {
        if (open && panelRef.current !== null) panelRef.current.focus();
      }, [open]);

      var mutating = function (path, body, done) {
        if (busy) return;
        setBusy(true);
        setError("");
        setNote("");
        fetch(API + path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
          .then(function (res) {
            if (!res.ok) return res.text().then(function (t) { return { status: res.status, body: { ok: false, error: t || "HTTP " + res.status } }; });
            return res.json().then(function (b) { return { status: res.status, body: b }; });
          })
          .then(function (out) {
            if (out.status !== 200 || out.body.ok === false) {
              setError(readable(out.body && out.body.error ? out.body.error : "HTTP " + out.status));
              return;
            }
            if (out.body.plugins !== undefined) setData(out.body);
            if (done) done(out.body);
          })
          .catch(function (err) { setError(String(err)); })
          .then(function () { setBusy(false); });
      };

      var plugins = (data && data.plugins) || [];
      var workflows = (data && data.workflows) || [];
      var duplicates = (data && data.duplicates) || {};

      var current = workflows.find(function (w) { return w.id === currentId; }) || null;
      var currentPlugins = current ? pluginsInWorkflow(current) : [];
      var inCanvas = {};
      for (var i = 0; i < plugins.length; i += 1) if (plugins[i].inCanvas) inCanvas[plugins[i].name] = true;

      function pluginsInWorkflow(workflow) {
        var names = [];
        for (var p = 0; p < (workflow.pages || []).length; p += 1) {
          var nodes = workflow.pages[p].nodes || [];
          for (var n = 0; n < nodes.length; n += 1) {
            var name = nodes[n].plugin;
            if (typeof name === "string" && name !== "" && names.indexOf(name) < 0) names.push(name);
          }
        }
        return names;
      }

      var addToCurrent = function (name) {
        if (current === null) return;
        if (currentPlugins.indexOf(name) >= 0) return;
        setNote("");
        mutating("/drag", { plugin: name, workflowId: current.id, inCanvas: true, x: 120, y: 80 }, function () {
          setNote("已拖入画布：它已脱离全局响应。");
        });
      };

      var removeFromCurrent = function (name) {
        if (current === null) return;
        mutating("/drag", { plugin: name, workflowId: current.id, inCanvas: false }, function () {
          setNote("已移出画布：它回到全局响应。");
        });
      };

      var toggleActive = function (workflow) {
        mutating("/activate", { workflowId: workflow.id, active: workflow.active !== true }, function () {
          setNote(workflow.active !== true ? "组合已开启，插件进入全局响应。" : "组合已关闭，插件退出全局响应。");
        });
      };

      var newWorkflow = function () {
        var id = "wf-" + Date.now().toString(36);
        var wf = { id: id, name: label !== "" ? label : "未命名组合", active: false, pages: [{ id: "pg-1", name: "主画布", nodes: [], edges: [] }] };
        setLabel("");
        mutating("/save", { workflow: wf }, function (out) {
          setCurrentId(id);
          setNote("已新建组合。");
        });
      };

      var renameAndSave = function () {
        if (current === null) return;
        mutating("/save", { workflow: assign({}, current, { name: label !== "" ? label : current.name }) }, function () {
          setNote("已保存。");
        });
      };

      var deleteWorkflow = function (workflow) {
        if (!window.confirm("删除组合「" + (workflow.name || workflow.id) + "」？它的插件会回到全局响应。")) return;
        mutating("/delete", { workflowId: workflow.id }, function () {
          setCurrentId("");
          setNote("已删除组合。");
        });
      };

      // ── 画布交互 ──
      var currentNodes = current !== null && current.pages.length > 0 ? (current.pages[0].nodes || []) : [];
      var currentEdges = current !== null && current.pages.length > 0 ? (current.pages[0].edges || []) : [];

      var nodePos = function (node) {
        var pos = dragPos[node.id];
        return pos !== undefined ? pos : { x: node.x, y: node.y };
      };

      var commitNode = function (nodeId) {
        var pos = dragPos[nodeId];
        if (pos === undefined || current === null) return;
        var updated = assign({}, current, { pages: current.pages.map(function (page, pi) {
          if (pi !== 0) return page;
          return assign({}, page, { nodes: page.nodes.map(function (n) { return n.id === nodeId ? assign({}, n, { x: Math.round(pos.x), y: Math.round(pos.y) }) : n; }) });
        }) });
        setDragPos(function (prev) {
          var next = {};
          for (var k in prev) if (k !== nodeId) next[k] = prev[k];
          return next;
        });
        mutating("/save", { workflow: updated }, function () {});
      };

      var onCanvasPointerDown = function (e) {
        if (busy || current === null) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        var nodeEl = e.target && e.target.closest ? e.target.closest(".dpc-node") : null;
        if (nodeEl !== null) {
          var nodeId = nodeEl.getAttribute("data-node-id");
          var node = currentNodes.find(function (n) { return n.id === nodeId; });
          if (node !== undefined) {
            var pos = nodePos(node);
            setDragNode({ nodeId: node.id, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y });
          }
        } else {
          setPanStart({ sx: e.clientX, sy: e.clientY, px: viewport.panX, py: viewport.panY });
        }
        if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
      };

      var onCanvasPointerMove = function (e) {
        if (dragNode !== null) {
          var zoom = viewport.zoom;
          var nx = dragNode.ox + (e.clientX - dragNode.sx) / zoom;
          var ny = dragNode.oy + (e.clientY - dragNode.sy) / zoom;
          setDragPos(function (prev) {
            var next = {};
            for (var k in prev) next[k] = prev[k];
            next[dragNode.nodeId] = { x: nx, y: ny };
            return next;
          });
        } else if (panStart !== null) {
          setViewport(function (v) { return assign({}, v, { panX: panStart.px + (e.clientX - panStart.sx), panY: panStart.py + (e.clientY - panStart.sy) }); });
        }
      };

      var onCanvasPointerUp = function () {
        if (dragNode !== null) commitNode(dragNode.nodeId);
        setDragNode(null);
        setPanStart(null);
      };

      var onCanvasWheel = function (e) {
        e.preventDefault();
        setViewport(function (v) {
          var factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
          var zoom = Math.min(3, Math.max(0.3, v.zoom * factor));
          return assign({}, v, { zoom: zoom });
        });
      };

      var addAtPosition = function (name, clientX, clientY) {
        if (current === null) return;
        if (currentPlugins.indexOf(name) >= 0) return;
        var rect = canvasRef.current !== null ? canvasRef.current.getBoundingClientRect() : null;
        var x = 120, y = 80;
        if (rect !== null && typeof clientX === "number") {
          x = Math.round((clientX - rect.left - viewport.panX) / viewport.zoom);
          y = Math.round((clientY - rect.top - viewport.panY) / viewport.zoom);
        }
        mutating("/drag", { plugin: name, workflowId: current.id, inCanvas: true, x: x, y: y }, function () {
          setNote("已拖入画布：它已脱离全局响应。");
        });
      };

      // 画布节点（含临时拖拽位置 + data-node-id 供 pointer 识别）
      var nodeEls = currentNodes.map(function (node) {
        var pos = nodePos(node);
        var p = plugins.find(function (x) { return x.name === node.plugin; });
        return h("div", {
          className: "dpc-node" + (dragNode !== null && dragNode.nodeId === node.id ? " dpc-dragging" : ""),
          key: node.id, "data-node-id": node.id,
          style: { left: pos.x, top: pos.y }
        }, [
          h("span", { className: "dpc-node-name", key: "n", title: node.plugin }, node.plugin),
          h("span", { className: "dpc-node-meta", key: "m" }, (p && p.version ? p.version : "") + (node.plugin && p && p.inBundles ? " · 全局" : "")),
          h("button", {
            className: "dpc-node-x", key: "x", type: "button", title: "移出画布（回到全局）",
            "aria-label": "移出 " + node.plugin,
            onClick: function () { removeFromCurrent(node.plugin); }
          }, "×")
        ]);
      });

      // 连线（SVG）：节点右边缘中点 → 目标节点左边缘中点
      var NODE_W = 150;
      var NODE_H = 44;
      var edgeEls = currentEdges.map(function (edge) {
        var a = currentNodes.find(function (n) { return n.id === edge.from; });
        var b = currentNodes.find(function (n) { return n.id === edge.to; });
        if (a === undefined || b === undefined) return null;
        var pa = nodePos(a);
        var pb = nodePos(b);
        return h("line", {
          className: "dpc-edge", key: edge.from + "→" + edge.to,
          x1: pa.x + NODE_W, y1: pa.y + NODE_H / 2,
          x2: pb.x, y2: pb.y + NODE_H / 2
        });
      }).filter(function (e) { return e !== null; });

      var canvasView = current === null
        ? h("div", { className: "dpc-canvas-empty", key: "empty" }, "先在左侧新建或打开一个组合。")
        : h("div", {
            className: "dpc-canvas" + (panStart !== null ? " dpc-panning" : ""),
            key: "canvas", ref: canvasRef,
            onPointerDown: onCanvasPointerDown,
            onPointerMove: onCanvasPointerMove,
            onPointerUp: onCanvasPointerUp,
            onWheel: onCanvasWheel,
            onDragOver: function (e) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; },
            onDrop: function (e) {
              e.preventDefault();
              var pluginName = e.dataTransfer.getData("text/plain");
              if (pluginName !== "") addAtPosition(pluginName, e.clientX, e.clientY);
            }
          }, [
            h("div", { className: "dpc-viewport", key: "vp", style: { transform: "translate(" + viewport.panX + "px," + viewport.panY + "px) scale(" + viewport.zoom + ")" } }, [
              nodeEls,
              h("svg", { key: "edges", width: 10000, height: 10000, style: { position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" } }, edgeEls)
            ]),
            currentNodes.length === 0
              ? h("div", { className: "dpc-canvas-empty", key: "hint" }, "从左侧本体库点「＋」或拖拽插件到这里。")
              : null
          ]);

      var libraryRows = plugins.length === 0
        ? h("div", { className: "dpc-empty", key: "empty" }, data === null ? "读取中…" : "这个 profile 里没有第三方插件。")
        : plugins.filter(function (p) { return !p.inCanvas; }).map(function (p) {
            return h("div", {
              className: "dpc-row", key: p.name, draggable: current !== null && !busy,
              onDragStart: function (e) { e.dataTransfer.setData("text/plain", p.name); e.dataTransfer.effectAllowed = "copy"; }
            }, [
              h("span", { className: "dpc-name", key: "n", title: p.name }, p.name),
              p.inBundles ? h("span", { className: "dpc-tag", key: "g", "data-tone": "ok" }, "全局") : h("span", { className: "dpc-tag", key: "g", "data-tone": "warn" }, "休眠"),
              h("span", { className: "dpc-mut", key: "v" }, p.version),
              h("button", {
                className: "dpc-btn", key: "a", type: "button", disabled: busy || current === null,
                title: "拖入当前组合（脱离全局）", onClick: function () { addToCurrent(p.name); }
              }, "＋")
            ]);
          });

      var workflowRows = workflows.length === 0
        ? h("div", { className: "dpc-empty", key: "empty" }, "还没有组合。点下方「新建组合」。")
        : workflows.map(function (w) {
            var count = pluginsInWorkflow(w).length;
            return h("div", { className: "dpc-row", key: w.id }, [
              h("span", { className: "dpc-name", key: "n", title: w.id }, w.name || w.id),
              h("span", { className: "dpc-mut", key: "c" }, count + " 个"),
              h("button", {
                className: "dpc-btn", key: "s", type: "button", disabled: busy,
                onClick: function () { setCurrentId(w.id); }
              }, currentId === w.id ? "当前" : "打开"),
              h("button", {
                className: "dpc-btn", key: "t", type: "button", "data-on": w.active ? "1" : "0", disabled: busy,
                onClick: function () { toggleActive(w); }
              }, w.active ? "开启中" : "已关闭"),
              h("button", {
                className: "dpc-btn", key: "d", type: "button", disabled: busy,
                title: "删除组合", onClick: function () { deleteWorkflow(w); }
              }, "✕")
            ]);
          });

      var dupKeys = Object.keys(duplicates);
      var dupWarn = dupKeys.length > 0
        ? h("div", { className: "dpc-msg", key: "dup", "data-kind": "error" },
            "⚠️ 有插件声明了重复的 entry id（会导致启动崩溃）：" + dupKeys.join("、"))
        : null;

      var button = h("button", {
        className: "dpc-btn", type: "button", "data-on": open ? "1" : "0",
        "aria-expanded": open ? "true" : "false", "aria-label": "插件画布",
        onClick: function () { setOpen(!open); }
      }, "🧩 画布");

      if (!open) return h("span", { className: "dpc-anchor" }, [button]);

      return h("span", { className: "dpc-anchor" }, [
        button,
        h("div", { className: "dpc-backdrop", key: "backdrop", onClick: function () { setOpen(false); } }),
        h("div", { className: "dpc-panel", key: "panel", ref: panelRef, role: "dialog", "aria-modal": "true", "aria-label": "插件画布", tabIndex: -1 }, [
          h("div", { className: "dpc-head", key: "head" }, [
            h("span", { className: "dpc-title", key: "t" }, "🧩 插件画布"),
            h("button", { className: "dpc-btn", key: "close", type: "button", title: "关闭", "aria-label": "关闭", onClick: function () { setOpen(false); } }, "×")
          ]),
          h("div", { className: "dpc-card", key: "wflist", style: { marginBottom: 12 } }, [
            h("div", { className: "dpc-sec", key: "h" }, [
              h("span", { key: "t" }, "组合"),
              h("button", { className: "dpc-btn", key: "new", type: "button", disabled: busy, onClick: newWorkflow }, "＋ 新建")
            ]),
            h("div", { key: "rows" }, workflowRows)
          ]),
          h("div", { className: "dpc-cols", key: "cols" }, [
            h("div", { className: "dpc-card", key: "lib" }, [
              h("div", { className: "dpc-sec", key: "h" }, h("span", { key: "t" }, "本体库（第三方插件）")),
              h("div", { key: "rows" }, libraryRows),
              h("div", { className: "dpc-foot", key: "tip" }, "点「＋」或拖拽到右侧画布 = 脱离全局响应。")
            ]),
            h("div", { className: "dpc-card", key: "canvas-card" }, [
              h("div", { className: "dpc-sec", key: "h" }, [
                h("span", { key: "t" }, current ? "画布：" + (current.name || current.id) : "画布"),
                current !== null ? h("span", { key: "z", className: "dpc-mut" }, Math.round(viewport.zoom * 100) + "%") : null
              ]),
              canvasView
            ])
          ]),
          current !== null ? h("div", { className: "dpc-card", key: "rename", style: { marginTop: 12 } }, [
            h("div", { className: "dpc-sec", key: "h" }, h("span", { key: "t" }, "重命名")),
            h("div", { className: "dpc-row", key: "r" }, [
              h("input", {
                className: "dpc-input", key: "i", type: "text", disabled: busy,
                placeholder: current.name || "组合名字", "aria-label": "组合名字",
                value: label, onChange: function (e) { setLabel(e.target.value); }
              }),
              h("button", { className: "dpc-btn", key: "b", type: "button", disabled: busy, onClick: renameAndSave }, "保存")
            ])
          ]) : null,
          dupWarn,
          note !== "" ? h("div", { className: "dpc-msg", key: "note" }, note) : null,
          error !== "" ? h("div", { className: "dpc-msg", key: "err", "data-kind": "error" }, error) : null,
          h("div", { className: "dpc-foot", key: "foot" }, "拖入画布 = 脱离全局响应；开启组合 = 组合内插件进入全局响应。本体插件（@deepseek-ai/*）不显示、不可操作。")
        ])
      ]);
    }

    function apply(ctx) {
      ctx.effect(function () { return installStyles(); }, "dsh-plugin-canvas: styles");
      ctx.slots.inject("conversation.input.right", function () {
        return ctx.slots.register(
          { name: "conversation.input.right", id: PLUGIN_ID, order: 100, label: "插件画布" },
          ComposerControl
        );
      });
    }

    return { apply, inject: ["slots"] };
  }
});
