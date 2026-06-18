// 文件功能: 检查架构分层和依赖方向合规 | 数据流: validate_architecture Tool → config-loader → 正则扫描 → 结构化报告
// 复用规则来源: .trae/rules/01-architecture-contract.md
const fs = require('fs');
const path = require('path');
const { loadConfig, globToRegex } = require('./lib/config-loader.js');

// 提取文件中所有 import / require 语句，避免字符串字面量中的路径误报
function extractImportStatements(content) {
  const statements = [];
  const importRegex = /import\b[\s\S]*?\bfrom\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    statements.push(match[1] || match[2]);
  }
  while ((match = requireRegex.exec(content)) !== null) {
    statements.push(match[1]);
  }
  return statements;
}

// 检测 imports 中是否包含指定路径前缀
function importsContain(imports, prefixes) {
  return imports.some(src => prefixes.some(prefix => src.includes(prefix)));
}

// 检测文本中是否包含直接 API 调用（fetch / axios / EventSource）
function hasDirectApiCall(content, forbidden) {
  const pattern = new RegExp(
    forbidden.map(f => {
      if (f === 'fetch') return '\\bfetch\\s*\\(';
      if (f === 'axios') return '\\baxios\\s*\\.';
      if (f === 'EventSource') return 'new\\s+EventSource\\s*\\(';
      return f;
    }).join('|')
  );
  return pattern.test(content);
}

// 按资源类型配对检查潜在资源泄露
function detectResourceLeaks(content) {
  const issues = [];
  const pairs = [
    { create: /\bsetInterval\s*\(/g, cleanup: /\bclearInterval\s*\(/g, name: 'setInterval' },
    { create: /\bsetTimeout\s*\(/g, cleanup: /\bclearTimeout\s*\(/g, name: 'setTimeout' },
    { create: /new\s+AbortController\s*\(/g, cleanup: /\.abort\s*\(/g, name: 'AbortController' },
    { create: /new\s+EventSource\s*\(/g, cleanup: /\.close\s*\(\)/g, name: 'EventSource' }
  ];

  pairs.forEach(({ create, cleanup, name }) => {
    const createCount = (content.match(create) || []).length;
    const cleanupCount = (content.match(cleanup) || []).length;
    if (createCount > cleanupCount) {
      issues.push(`发现 ${createCount} 处 ${name} 但只有 ${cleanupCount} 处清理逻辑，可能存在资源泄露`);
    }
  });

  return issues;
}

module.exports = function validateArchitecture(projectRoot, filePath) {
  if (!filePath) {
    return { ok: false, error: '缺少 filePath 参数' };
  }

  const absPath = path.resolve(projectRoot, filePath);
  if (!fs.existsSync(absPath)) {
    return { ok: false, filePath, error: `文件不存在: ${filePath}` };
  }

  const content = fs.readFileSync(absPath, 'utf-8');
  const imports = extractImportStatements(content);
  const ext = path.extname(filePath).toLowerCase();
  const issues = [];

  const config = loadConfig(projectRoot);
  const layers = config.architecture?.layers || [];

  // 找到当前文件匹配的架构层
  const matchedLayer = layers.find(layer => {
    const regex = globToRegex(layer.path);
    return regex.test(filePath);
  });

  if (matchedLayer) {
    // 检查禁止的 API 调用（仅 .vue 层）
    if (matchedLayer.forbidden && ext === '.vue') {
      if (hasDirectApiCall(content, matchedLayer.forbidden)) {
        issues.push(`视图层存在直接 API 调用（${matchedLayer.forbidden.join('/')}），违反架构分层契约`);
      }
    }

    // 检查禁止的 import
    if (matchedLayer.forbiddenImports) {
      if (importsContain(imports, matchedLayer.forbiddenImports)) {
        issues.push(`${matchedLayer.name} 层存在禁止的依赖（${matchedLayer.forbiddenImports.join('/')}），违反依赖方向`);
      }
    }
  }

  // 兜底：.vue 文件不应 import axios 或 sse.js
  if (ext === '.vue') {
    if (importsContain(imports, ['axios'])) {
      issues.push('视图层存在 axios import，违反架构分层契约');
    }
    if (importsContain(imports, ['utils/sse.js'])) {
      issues.push('视图层存在 sse.js import，违反架构分层契约');
    }
  }

  // composables / views 中检查 timer/SSE/AbortController 是否配对清理
  if ((filePath.includes('composables/') || ext === '.vue') && content.length > 0) {
    issues.push(...detectResourceLeaks(content));
  }

  return { ok: issues.length === 0, filePath, issues };
};
