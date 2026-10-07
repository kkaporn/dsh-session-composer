# dsh-plugin-canvas

无限画布插件仓库：把第三方插件拖入画布脱离全局、组装成组合、开启后重新加入全局响应。

## 核心模型

| 动作 | 结果 |
|---|---|
| 装完（不动） | 插件在**本体库**，全局响应 |
| 拖入画布 | 插件**脱离全局**，进入画布（休眠） |
| 开启组合 | 组合内插件**进入全局响应** |
| 关闭组合 | 组合内插件**退出全局** |

常驻插件（如 ponytail、cost-meter）**不拖进画布**就永远全局。

## 安全保证

- **本体硬隔离**：`@deepseek-ai/*` 永不显示、永不操作。
- **只动一个开关**：启停 100% 委托宿主 `pluginManager.setBundleEnabled` / `setPluginEnabled`，不改插件代码/配置/依赖/数据。
- **不写配置文件**：只写 `~/.dsh/plugin-canvas/state.json`，不写任何 YAML / package.json。
- **重复 entry id 阻断**：保存组合前检查，撞 id 会导致启动崩溃，直接拒绝。

## 安装

从 GitHub 安装：

```bash
dsh plugin add github:kkaporn/dsh-session-composer
```

或从本地目录安装：

```bash
dsh plugin add /path/to/dsh-plugin-canvas
```

## 开发

零运行时依赖（纯 `node:` 内置模块）。自检无需框架：

```bash
node test-index.mjs     # 宿主半纯函数自检
node test-client.mjs    # 客户端结构自检
```

## 架构

- **宿主半**（`lib/index.js`）：5 个 HTTP 路由（`/state` `/drag` `/activate` `/save` `/delete`），启停全部委托宿主 `pluginManager`，只写 `~/.dsh/plugin-canvas/state.json`。
- **客户端**（`lib/client.js`）：入口图标注册 `conversation.composer.dock`，手写无限画布（节点拖拽 + pan/zoom + 连线 + 拖入），无 React Flow 依赖。

## 许可

MIT
