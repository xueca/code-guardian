// 文件功能: 检测组件内过长链式数据转换 | 数据流: detect_anti_patterns → long_transform_detector → 报告
const { getLine } = require('./function_body.js');

module.exports = function detectLongTransformInView(content, filePath) {
  const findings = [];
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (ext !== '.vue') return findings;

  const scriptMatch = content.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/);
  if (!scriptMatch) return findings;

  const script = scriptMatch[1];
  // 检测链式 map/filter/reduce 调用长度是否超过 3 行
  const chainPattern = /(\.[\w$]+\([^)]*\)\s*\n\s*\.[\w$]+\([^)]*\)\s*\n\s*\.[\w$]+\([^)]*\))/g;
  let m;
  while ((m = chainPattern.exec(script)) !== null) {
    findings.push({
      pattern: 'long-transform-in-view',
      message: '组件内存在超过 3 行的链式数据转换',
      line: getLine(content, scriptMatch.index + m.index)
    });
  }
  return findings;
};
