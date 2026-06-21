# Code Guardian

[![npm version](https://img.shields.io/npm/v/code-guardian)](https://www.npmjs.com/package/code-guardian)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/Node.js-%3E%3D%2018-brightgreen)](https://nodejs.org/)

Code Guardian 是一个 MCP (Model Context Protocol) Server，为 AI 编码助手（如 Claude Code、Trae、Cursor、Windsurf 等）提供代码质量检查能力。它能在 AI 修改代码前后自动检查文件大小、ESLint、架构分层合规、反模式扫描和注释规范，确保 AI 生成的代码符合项目团队的编码标准。

## 目录

- [前置要求](#前置要求)
- [安装](#安装)
- [快速开始](#快速开始)
- [工作原理](#工作原理)
- [6 个检查工具](#6-个检查工具)
- [配置参考](#配置参考)
- [与 AI 规则联动](#与-ai-规则联动)
- [四层防御体系](#四层防御体系)
- [运行测试](#运行测试)
- [项目结构](#项目结构)
- [贡献指南](#贡献指南)
- [常见问题](#常见问题)
- [License](#license)

## 前置要求

- **Node.js** >= 18.0.0（MCP SDK 依赖）
- **ESLint** >= 9.0.0（可选，`run_eslint` 工具需要）
- 项目需要有一个 `.code-guardian.json` 配置文件（详见[配置参考](#配置参考)）

## 安装

### 方式一：从 GitHub 安装（推荐）

```bash
npm install --save-dev github:xueca/code-guardian
```

> 需要 [Git](https://git-scm.com/) 已安装且可访问 GitHub。

### 方式二：从 npm 安装

```bash
npm install code-guardian --save-dev
```

> 需要 npm 账号且已登录。如果 npm 注册/登录遇到问题，请使用方式一。

### 方式三：本地开发安装

```bash
git clone https://github.com/xueca/code-guardian.git
cd code-guardian
npm install
```

## 快速开始

### 1. 创建项目配置文件

在项目根目录创建 `.code-guardian.json`：

```json
{
  "version": "1.0",
  "fileSizeLimits": {
    "**/controllers/**/*.js": 150,
    "**/routes/**/*.js": 50,
    "**/*.vue": 200,
    "**/*.js": 150
  },
  "antiPatterns": {
    "directApiInView": true,
    "bareAsync": true,
    "resourceLeak": true
  }
}
```

> 完整配置项见下方 [配置参考](#配置参考)。

### 2. 配置 MCP 客户端

**Claude Code**（`.claude/settings.json`）：

```json
{
  "mcpServers": {
    "code-guardian": {
      "command": "node",
      "args": [
        "./node_modules/code-guardian/index.js",
        "--project-root",
        "."
      ]
    }
  }
}
```

**Trae**（`.trae/mcp.json`）：

```json
{
  "mcpServers": {
    "code-guardian": {
      "command": "node",
      "args": [
        "/absolute/path/to/node_modules/code-guardian/index.js",
        "--project-root",
        "/absolute/path/to/project"
      ]
    }
  }
}
```

**Cursor / Windsurf**（`.cursor/mcp.json` 或 `.windsurf/mcp.json`）：

```json
{
  "mcpServers": {
    "code-guardian": {
      "command": "node",
      "args": [
        "./node_modules/code-guardian/index.js",
        "--project-root",
        "."
      ]
    }
  }
}
```

> **关于 `--project-root`**：Code Guardian 需要知道项目根目录来定位 `.code-guardian.json` 配置文件和待检查的文件。如果省略此参数，默认使用 Node.js 进程的当前工作目录（`process.cwd()`）。对于 Trae 等需要绝对路径的客户端，必须显式指定。

### 3. 使用

在 AI 对话中直接调用 Tool：

```
code-guardian:full_health_check({ filePath: "src/views/Home.vue" })
code-guardian:check_file_size({ filePath: "backend/controllers/userController.js" })
```

## 工作原理

Code Guardian 是一个基于 [JSON-RPC 2.0](https://www.jsonrpc.org/specification) 协议、通过 `stdio` 传输的 MCP Server。它的工作流程如下：

```
AI 编码助手（Client）
  │
  │  JSON-RPC Request（via stdio）
  ▼
index.js（MCP Server 入口）
  │
  │  解析 --project-root → 定位项目根目录
  │  路由 Tool Name → 对应 handler
  ▼
tools/*.js（检查执行层）
  │
  │  读取 .code-guardian.json 配置
  │  读取目标文件内容
  │  执行检查逻辑
  ▼
结构化 JSON 报告 → 返回给 AI 编码助手
```

**关键设计决策**：

- **无状态**：每次 Tool 调用独立执行，不维护跨调用状态
- **配置驱动**：所有检查参数（行数上限、分层规则、反模式开关）均从 `.code-guardian.json` 读取，不硬编码
- **Glob 模式匹配**：文件路径通过 glob 模式匹配对应配置项，支持 `**/` 和 `/**` 通配符
- **Graceful Degradation**：ESLint 不可用时（未安装或配置缺失），`run_eslint` 返回 `{ ok: true, skipped: true }` 而非报错

## 6 个检查工具

| 工具 | 功能 | 输入 | 输出 |
|------|------|------|------|
| `check_file_size` | 检查文件行数是否超限 | `filePath` | `{ ok, lines, limit, exceeded }` |
| `run_eslint` | 运行 ESLint 检查 | `filePath` | `{ ok, errorCount, warningCount, messages }` |
| `validate_architecture` | 检查分层与依赖方向 | `filePath` | `{ ok, issues: [...] }` |
| `detect_anti_patterns` | 扫描 6 种反模式 | `filePath` | `{ ok, findings: [...] }` |
| `check_comment_compliance` | 检查注释规范 | `filePath` | `{ ok, issues: [...] }` |
| `full_health_check` | 一键运行全部检查 | `filePath` | `{ ok, summary, details }` |

---

### check_file_size

检查文件是否超过 `.code-guardian.json` 中 `fileSizeLimits` 定义的行数上限。使用 glob 模式从上到下匹配，第一个匹配的规则生效。

**返回示例**：

```json
{
  "ok": true,
  "filePath": "src/views/Home.vue",
  "lines": 165,
  "limit": 200,
  "exceeded": 0
}
```

**匹配逻辑**：例如文件 `src/views/Home.vue` 会依次匹配 `fileSizeLimits` 中的 glob 模式：
1. `**/controllers/**/*.js` → 不匹配，跳过
2. `**/routes/**/*.js` → 不匹配，跳过
3. `**/*.vue` → 匹配，限制 = 200

---

### run_eslint

对文件运行 ESLint 检查。ESLint 及其插件为可选依赖（peerDependencies），Code Guardian 通过 `Module.globalPaths` 确保 ESLint 能正确解析插件依赖。

> **前置条件**：项目需安装 `eslint` 及相关插件，并在 `.code-guardian.json` 中配置 `eslint.configPath` 和 `eslint.frontendDir`。

**返回示例**：

```json
{
  "ok": true,
  "filePath": "src/views/Home.vue",
  "errorCount": 0,
  "warningCount": 3,
  "messages": [
    { "line": 42, "severity": "warning", "message": "...", "ruleId": "vue/attributes-order" }
  ]
}
```

**如果 ESLint 未安装或配置缺失**：

```json
{
  "ok": true,
  "skipped": true,
  "reason": "ESLint 未安装或配置缺失"
}
```

---

### validate_architecture

检查架构分层合规性，基于 `.code-guardian.json` 中 `architecture.layers` 配置：

- **视图层检查**（`forbidden`）：检测匹配文件中是否包含禁止的 API 调用关键字（如 fetch、axios、EventSource）
- **依赖方向检查**（`forbiddenImports`）：检测匹配文件中是否 import 了禁止的模块路径前缀
- **资源泄露检测**：检测 composable / views 中是否存在 timer/SSE/AbortController 未配对清理

**返回示例**：

```json
{
  "ok": false,
  "filePath": "src/views/Home.vue",
  "issues": [
    {
      "type": "forbidden_api_call",
      "message": "视图层禁止直接调用 fetch",
      "line": 42
    }
  ]
}
```

---

### detect_anti_patterns

扫描 6 种反模式，每种可通过 `.code-guardian.json` 中 `antiPatterns` 配置独立开关：

| 反模式 | 检测内容 | 严重程度 | 配置键 |
|--------|---------|---------|--------|
| 视图层直接 API 调用 | .vue 文件中直接调用 fetch/axios/EventSource | P0 | `directApiInView` |
| 裸 async 无 catch | async 函数缺少 try-catch 包裹 | P0 | `bareAsync` |
| 资源未清理 | setInterval/EventSource/AbortController 未在 onUnmounted 中清理 | P0 | `resourceLeak` |
| 模块级状态变量 | composable 文件顶层存在模块级响应式状态变量 | P1 | `moduleLevelState` |
| 组件内长数据转换 | 组件内存在超过 3 行的链式数据转换（map/filter/reduce） | P1 | `longTransformInView` |
| 重复代码块 | script 中存在 4 行以上的重复代码块 | P2 | `duplicateCode` |

**返回示例**：

```json
{
  "ok": false,
  "filePath": "src/views/Home.vue",
  "findings": [
    {
      "type": "bareAsync",
      "severity": "P0",
      "message": "async 函数缺少 try-catch 错误处理",
      "line": 28
    }
  ]
}
```

---

### check_comment_compliance

检查文件头注释和函数注释是否符合项目注释规范（参考 `.code-guardian.json` 中 `commentStandard` 配置）：

- **.vue 文件**：检查 HTML 文件头注释（`<!-- 页面功能: xxx → useXxx() -->`）
- **.js 文件**：检查文件头注释（`// 文件功能: xxx | 数据流: xxx`）
- **函数注释**：检查函数定义前是否有注释（支持单行 `//` 和块注释 `/** */`）

**返回示例**：

```json
{
  "ok": false,
  "filePath": "src/views/Home.vue",
  "issues": [
    {
      "type": "missing_file_header",
      "message": "缺少文件头注释"
    },
    {
      "type": "missing_function_comment",
      "function": "handleSubmit",
      "line": 42
    }
  ]
}
```

---

### full_health_check

聚合以上 5 项检查，输出结构化的一键报告：

```json
{
  "ok": false,
  "filePath": "src/views/Home.vue",
  "summary": {
    "fileSize": "✅",
    "eslint": "✅",
    "architecture": "❌",
    "antiPatterns": "❌",
    "comments": "✅"
  },
  "details": {
    "size": { "ok": true, "lines": 165, "limit": 200 },
    "eslint": { "ok": true, "errorCount": 0 },
    "architecture": { "ok": false, "issues": [...] },
    "antiPatterns": { "ok": false, "findings": [...] },
    "comments": { "ok": true, "issues": [] }
  }
}
```

> 注意：`full_health_check` 使用 `Promise.all` 并行执行 5 项检查，以提高性能。

## 配置参考

完整 `.code-guardian.json` 配置项：

```json
{
  "version": "1.0",
  "fileSizeLimits": {
    "**/controllers/**/*.js": 150,
    "**/routes/**/*.js": 50,
    "**/middleware/**/*.js": 80,
    "**/*.vue": 200,
    "**/*.js": 150
  },
  "architecture": {
    "layers": [
      {
        "name": "views",
        "path": "**/*.vue",
        "forbidden": ["fetch", "axios", "EventSource"]
      },
      {
        "name": "api",
        "path": "**/api/**/*.js",
        "forbiddenImports": ["composables/", "stores/"]
      },
      {
        "name": "composables",
        "path": "**/composables/**/*.js",
        "forbiddenImports": ["views/"]
      },
      {
        "name": "backend",
        "path": "**/controllers/**/*.js",
        "forbiddenImports": ["views/", "stores/", "composables/"]
      }
    ]
  },
  "antiPatterns": {
    "directApiInView": true,
    "longTransformInView": true,
    "bareAsync": true,
    "resourceLeak": true,
    "moduleLevelState": true,
    "duplicateCode": true
  },
  "eslint": {
    "configPath": "frontend/eslint.config.js",
    "frontendDir": "frontend"
  },
  "commentStandard": {
    "fileHeaderRequired": true,
    "functionCommentRequired": true,
    "vueTemplateCommentRecommended": true
  }
}
```

### fileSizeLimits

- **键**：glob 模式，支持 `**/` 匹配任意前缀目录，`/**` 匹配任意后缀目录
- **值**：最大行数（整数）
- **匹配规则**：从上到下，第一个匹配的模式生效。建议将更具体的规则放在前面，通用规则放在最后
- **默认值**（当无匹配时）：`**/*.js` = 150, `**/*.vue` = 200
- **注意**：路径分隔符统一使用 `/`（Windows 路径中的 `\` 会被自动转换）

### architecture.layers

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 分层名称（用于报告中的标识） |
| `path` | `string` | 是 | glob 模式，匹配该层包含的文件 |
| `forbidden` | `string[]` | 否 | 禁止在匹配文件中出现的关键字列表 |
| `forbiddenImports` | `string[]` | 否 | 禁止在匹配文件中 import 的路径前缀列表 |

**`forbidden` 检测**：逐行扫描文件内容，检测是否包含禁止关键字。适用于检测直接 API 调用（fetch、axios、EventSource）。

**`forbiddenImports` 检测**：扫描 `import` 语句和 `require()` 调用，检测是否引用了禁止的模块路径前缀。适用于检测反向依赖。

### antiPatterns

- 每个键值对：`"检测项名称": true/false`
- 设为 `false` 可关闭某项检测
- 默认全部开启
- 如果配置中缺少某个键，则该检测项保持关闭

### eslint

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `configPath` | `string` | 是 | ESLint 配置文件相对于项目根目录的路径 |
| `frontendDir` | `string` | 是 | 前端代码目录（`run_eslint` 仅处理此目录下的文件） |

### commentStandard

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `fileHeaderRequired` | `boolean` | `true` | 是否要求文件头注释 |
| `functionCommentRequired` | `boolean` | `true` | 是否要求函数注释 |
| `vueTemplateCommentRecommended` | `boolean` | `true` | 是否建议 Vue 模板区域注释 |

## 与 AI 规则联动

推荐在项目中创建 AI 规则文件，强制 AI 在修改代码时调用 Code Guardian。以下为各 AI 编码助手的规则文件路径：

**Trae**（`.trae/rules/07-mcp-code-guardian.md`）：

```markdown
# MCP Code Guardian 强制调用规则

修改任何 .vue / .js 文件时：
1. 修改前：调用 full_health_check 了解当前状态
2. 修改中：调用 check_file_size 防止超行
3. 修改后：调用 full_health_check 验证无新问题
4. 如果 ok: false，先修复再报告完成
```

**Claude Code**（`.claude/rules/code-guardian.md`）：

```markdown
# Code Guardian — Mandatory Pre/Post Code Change Checks

Before modifying any .vue / .js file:
- Call code-guardian:full_health_check({ filePath }) to baseline

After modifying:
- Call code-guardian:full_health_check({ filePath }) to verify
- If any check fails, fix before marking task complete
```

**通用规则**（适用于 Cursor、Windsurf 等）：将上述规则文件放置在项目的 `.cursorrules` 或 `.windsurfrules` 中。

## 四层防御体系

Code Guardian 设计为多层防御，确保代码质量检查不会遗漏：

| 层级 | 机制 | 触发方式 | 失败行为 |
|------|------|---------|---------|
| Layer 1 | MCP Tools | AI 主动调用 | 返回 `ok: false` + 详细问题列表 |
| Layer 2 | after-write Hook | 文件写入后自动触发 | `process.exit(1)` 阻止写入 |
| Layer 3 | `/review` Command | 用户手动触发 | 输出结构化报告 |
| Layer 4 | Husky pre-commit | `git commit` 前触发 | 阻止提交 |

**Layer 1（MCP Tools）** 是最核心的防御层，由 AI 在修改代码前后主动调用，提供即时反馈。

**Layer 2（after-write Hook）** 是兜底机制，当 AI 忘记调用 Code Guardian 时，文件写入后自动触发检查。实现方式：在 `.claude/hooks/after-write.cjs` 中调用 `code-guardian:full_health_check`。

**Layer 3（/review Command）** 允许用户随时手动触发全面检查，无需等待 AI 自动调用。

**Layer 4（Husky pre-commit）** 是最后一道防线，在代码提交前确保所有文件通过检查。

## 运行测试

```bash
# 运行所有测试
node --test __tests__/

# 运行指定测试文件
node --test __tests__/check_file_size.test.js

# 带详细输出
node --test --test-reporter=spec __tests__/
```

测试框架：Node.js 原生 `node:test`（无需额外依赖）。

测试文件：
- `check_file_size.test.js`：文件大小检查（6 个测试用例）
- `validate_architecture.test.js`：架构合规检查（6 个测试用例）
- `detect_anti_patterns.test.js`：反模式扫描（6 个测试用例）

## 项目结构

```
code-guardian/
├── .code-guardian.json     # 自带默认配置
├── .gitignore              # Git 忽略规则
├── index.js                # MCP Server 入口（JSON-RPC over stdio）
├── package.json
├── README.md
├── __tests__/              # 测试（node:test 框架）
│   ├── check_file_size.test.js
│   ├── validate_architecture.test.js
│   └── detect_anti_patterns.test.js
└── tools/
    ├── check_file_size.js      # 行数检查
    ├── run_eslint.js           # ESLint 集成
    ├── validate_architecture.js # 架构分层检查
    ├── detect_anti_patterns.js  # 反模式扫描（入口）
    ├── check_comment_compliance.js # 注释规范检查
    ├── full_health_check.js    # 一键聚合检查
    └── lib/
        ├── config-loader.js           # 配置加载 + glob 匹配引擎
        ├── function_body.js           # 函数体提取工具
        ├── direct_api_detector.js     # 视图层直接 API 调用检测
        ├── long_transform_detector.js # 组件内长数据转换检测
        ├── bare_async_detector.js     # 裸 async 无 catch 检测
        ├── resource_leak_detector.js  # 资源未清理检测
        ├── module_state_detector.js   # 模块级状态变量检测
        └── duplicate_code_detector.js # 重复代码块检测
```

## 贡献指南

欢迎贡献！请遵循以下流程：

1. **Fork** 本仓库
2. **创建分支**：`git checkout -b feat/your-feature`
3. **编写代码**：确保通过所有现有测试
4. **添加测试**：新功能或 bug 修复需要添加对应测试用例
5. **运行测试**：`node --test __tests__/`
6. **提交 PR**：提交前请确保：
   - 所有测试通过
   - 代码符合项目编码规范（文件头注释、函数注释）
   - 新工具或配置变更需要更新 README.md

### 开发环境

```bash
# 克隆仓库
git clone https://github.com/xueca/code-guardian.git
cd code-guardian

# 安装依赖
npm install

# 运行测试
node --test __tests__/

# 本地测试 MCP Server
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node index.js --project-root .
```

### 新增检查工具

1. 在 `tools/` 下创建新的检查模块，导出 `async function(projectRoot, filePath)`
2. 在 `tools/lib/` 下创建检测器子模块（如需要）
3. 在 `index.js` 中注册工具（添加到 `TOOLS` 数组和 `handleToolCall` switch）
4. 在 `full_health_check.js` 中集成
5. 在 `__tests__/` 中添加测试
6. 更新 README.md 的工具列表

## 常见问题

### Q: Code Guardian 和 ESLint/Prettier 有什么区别？

A: Code Guardian 不是 ESLint 的替代品，而是**互补层**。ESLint 检查 JavaScript 语法和风格规则，Code Guardian 检查更高层次的架构问题（分层合规、反模式、文件行数）。Code Guardian 的 `run_eslint` 工具实际上是对 ESLint 的封装，将其集成到 AI 工作流中。

### Q: 为什么选择 MCP 协议而不是直接作为 CLI 工具？

A: MCP（Model Context Protocol）是 AI 编码助手的标准协议。通过 MCP Server，AI 可以在修改代码时主动调用检查工具，无需人工干预。这比传统的 CLI 工具（需要手动运行）更高效，也比 Hook 机制（只能被动触发）更灵活。

### Q: 必须在每个项目中配置 `.code-guardian.json` 吗？

A: 是的。Code Guardian 的设计原则是"每个项目有自己的编码标准"。`.code-guardian.json` 允许团队根据项目特点自定义文件行数限制、分层架构规则和反模式开关。Code Guardian 自带一个默认配置作为参考模板。

### Q: `run_eslint` 工具报错怎么办？

A: 首先确认项目已安装 ESLint 及其插件：
```bash
npm install --save-dev eslint @eslint/js eslint-plugin-vue globals
```
然后检查 `.code-guardian.json` 中 `eslint.configPath` 是否指向了正确的 ESLint 配置文件。如果不需要 ESLint 检查，可以移除 `eslint` 配置项使其优雅降级。

### Q: 如何自定义文件行数限制？

A: 在 `.code-guardian.json` 的 `fileSizeLimits` 中添加或修改 glob 模式。例如，如果希望 Vue 组件的行数上限为 300 行：
```json
{
  "fileSizeLimits": {
    "**/*.vue": 300
  }
}
```
注意：规则从上到下匹配，第一个匹配的生效。建议将更具体的规则放在前面。

### Q: 如何关闭某个反模式检测？

A: 在 `.code-guardian.json` 的 `antiPatterns` 中将对应检测项设为 `false`：
```json
{
  "antiPatterns": {
    "duplicateCode": false
  }
}
```

### Q: 支持哪些文件类型？

A: 目前主要支持 `.vue` 和 `.js` 文件。`.ts` / `.tsx` 文件的部分检查（如 `check_file_size`、`validate_architecture`）可以工作，但 ESLint 和注释检查可能需要额外配置。未来版本计划全面支持 TypeScript。

## License

[MIT](LICENSE)