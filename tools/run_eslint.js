// 文件功能: 对指定文件运行 ESLint 并返回结构化报告 | 数据流: run_eslint Tool → ESLint API → 结构化报告
// 复用规则来源: frontend/eslint.config.js
const { ESLint } = require('eslint');
const path = require('path');
const fs = require('fs');
const Module = require('module');
const { pathToFileURL } = require('url');

// 把 code-guardian 的 node_modules 加入全局模块查找路径，
// 使得在 frontend cwd 下运行的 ESLint 仍能解析本包安装的依赖。
function addCodeGuardianModules(codeGuardianDir) {
  const modulesPath = path.join(codeGuardianDir, 'node_modules');
  if (fs.existsSync(modulesPath) && !Module.globalPaths.includes(modulesPath)) {
    Module.globalPaths.push(modulesPath);
  }
}

// 把前端 eslint.config.js 中的本地插件路径替换为 file:// URL，
// 因为临时配置在 code-guardian 目录下，相对路径会失效。
function prepareTempConfig(frontendDir, codeGuardianDir) {
  const configPath = path.join(frontendDir, 'eslint.config.js');
  let configCode = fs.readFileSync(configPath, 'utf-8');

  const pluginAbsolutePath = path.join(frontendDir, 'eslint-plugin-architecture', 'index.js');
  const pluginFileUrl = pathToFileURL(pluginAbsolutePath).href;

  configCode = configCode.replace(
    /['"]\.\/eslint-plugin-architecture\/index\.js['"]/g,
    `'${pluginFileUrl}'`
  );

  // 使用 .mjs 后缀，Node.js 自动按 ESM 解析，无需修改 package.json
  const tempConfigPath = path.join(codeGuardianDir, `.eslint.config.${Date.now()}.temp.mjs`);
  fs.writeFileSync(tempConfigPath, configCode, 'utf-8');
  return tempConfigPath;
}

module.exports = async function runESLint(projectRoot, filePath) {
  if (!filePath) {
    return { ok: false, error: '缺少 filePath 参数' };
  }

  const absPath = path.resolve(projectRoot, filePath);
  if (!fs.existsSync(absPath)) {
    return { ok: false, filePath, error: `文件不存在: ${filePath}` };
  }

  const frontendDir = path.join(projectRoot, 'frontend');
  const codeGuardianDir = path.join(projectRoot, 'my-mcp-server', 'code-guardian');

  // 只处理 frontend 文件；backend 暂无 ESLint 配置
  if (filePath.startsWith('backend/')) {
    return { ok: true, filePath, skipped: true, reason: 'backend 目录暂无 eslint.config.js' };
  }

  // 检查前端 ESLint 配置是否存在
  const configFile = path.join(frontendDir, 'eslint.config.js');
  if (!fs.existsSync(configFile)) {
    return { ok: true, filePath, skipped: true, reason: `未找到 ESLint 配置: ${configFile}` };
  }

  // 确保 ESLint 能解析 code-guardian 中的依赖
  addCodeGuardianModules(codeGuardianDir);

  let tempConfigPath = null;

  try {
    tempConfigPath = prepareTempConfig(frontendDir, codeGuardianDir);

    // cwd 设为 frontend，使 lint 文件在 base path 内；
    // 依赖通过 Module.globalPaths 从 code-guardian/node_modules 解析。
    const eslint = new ESLint({
      cwd: frontendDir,
      overrideConfigFile: tempConfigPath
    });
    const results = await eslint.lintFiles([absPath]);

    const errorCount = results.reduce((sum, r) => sum + r.errorCount, 0);
    const warningCount = results.reduce((sum, r) => sum + r.warningCount, 0);

    const messages = results.flatMap(r =>
      r.messages.map(m => ({
        line: m.line,
        column: m.column,
        severity: m.severity === 2 ? 'error' : 'warning',
        message: m.message,
        ruleId: m.ruleId
      }))
    );

    return {
      ok: errorCount === 0,
      filePath,
      errorCount,
      warningCount,
      messages
    };
  } catch (e) {
    return { ok: false, filePath, error: e.message };
  } finally {
    // 清理临时配置文件
    if (tempConfigPath && fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  }
};
