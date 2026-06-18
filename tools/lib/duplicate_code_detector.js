// 文件功能: 启发式检测 script 中重复代码块 | 数据流: detect_anti_patterns → duplicate_code_detector → 报告
const { getLine } = require('./function_body.js');

module.exports = function detectDuplicateCode(content, filePath) {
  const findings = [];
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (ext !== '.vue' && ext !== '.js') return findings;

  let codeToCheck = content;

  // 对 .vue 文件只检查 script 部分，避免模板标签重复误报
  if (ext === '.vue') {
    const scriptMatch = content.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/);
    if (!scriptMatch) return findings;
    codeToCheck = scriptMatch[1];
  }

  const lines = codeToCheck.split('\n');
  const seen = new Map();

  // 忽略 import/export/空行/纯符号行/注释行/单属性赋值行
  function isMeaningfulLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^(\/\/|import\s|export\s|const\s+.*=\s*require\(|return\s|}\s*$|}\s*,?\s*$)/.test(trimmed)) return false;
    if (/^[{}\[\]();,]+$/.test(trimmed)) return false;
    return true;
  }

  // 检测 6 行重复块，降低 common pattern（如连续 ref 定义）的误报
  const BLOCK_SIZE = 6;
  for (let i = 0; i <= lines.length - BLOCK_SIZE; i++) {
    const blockLines = lines.slice(i, i + BLOCK_SIZE).filter(isMeaningfulLine);
    if (blockLines.length < BLOCK_SIZE) continue;

    const block = blockLines.map(l => l.trim()).join('\n');
    if (block.length < 40) continue;

    if (seen.has(block)) {
      findings.push({
        pattern: 'duplicate-code',
        severity: 'warning',
        message: `script 中发现疑似重复代码块（首次出现在第 ${seen.get(block)} 行）`,
        line: getLine(content, i)
      });
      break;
    }
    seen.set(block, i + 1);
  }

  return findings;
};
