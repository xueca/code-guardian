// 文件功能: 检测 async 函数缺少 try-catch | 数据流: detect_anti_patterns → bare_async_detector → 报告
const { extractFunctionBody, getLine } = require('./function_body.js');

module.exports = function detectBareAsync(content) {
  const findings = [];
  const asyncPattern = /async\s+function\s+(\w+)\s*\([^)]*\)\s*\{/g;
  let m;
  while ((m = asyncPattern.exec(content)) !== null) {
    const body = extractFunctionBody(content, m.index);
    if (body && !/\btry\s*\{/.test(body)) {
      findings.push({
        pattern: 'bare-async',
        message: `async 函数 "${m[1]}" 缺少 try-catch`,
        line: getLine(content, m.index)
      });
    }
  }
  return findings;
};
