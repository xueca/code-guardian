// 文件功能: 检测 timer/SSE/AbortController 未清理 | 数据流: detect_anti_patterns → resource_leak_detector → 报告
const { getLine } = require('./function_body.js');

module.exports = function detectResourceLeak(content, filePath) {
  const findings = [];
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (ext !== '.vue' && ext !== '.js') return findings;

  const resourcePattern = /\bsetInterval\s*\(|\bsetTimeout\s*\(|new\s+AbortController\s*\(|new\s+EventSource\s*\(/g;
  const cleanupPattern = /onUnmounted|clearInterval|clearTimeout|controller\.abort|\.close\(\)/;

  const hasCleanup = cleanupPattern.test(content);
  let m;

  while ((m = resourcePattern.exec(content)) !== null) {
    // 如果文件完全没有任何清理迹象，才报 leak
    if (!hasCleanup) {
      findings.push({
        pattern: 'resource-leak',
        message: `发现未清理资源: ${m[0].trim()}`,
        line: getLine(content, m.index)
      });
    }
  }
  return findings;
};
