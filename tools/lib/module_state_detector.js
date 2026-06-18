// 文件功能: 检测 composable 文件顶层模块级状态变量 | 数据流: detect_anti_patterns → module_state_detector → 报告
const { getLine } = require('./function_body.js');

module.exports = function detectModuleLevelState(content, filePath) {
  const findings = [];
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (ext !== '.js') return findings;

  // 检测顶层 let/var 定义可能持有状态的变量
  const moduleStatePattern = /^(?:let|var)\s+(\w*(?:Stream|State|Current|Ref|Reactive|Store|Cache|Instance|Controller)\w*)\s*=/gm;
  let m;
  while ((m = moduleStatePattern.exec(content)) !== null) {
    findings.push({
      pattern: 'module-level-state',
      message: `模块级变量 "${m[1]}" 可能持有组件状态`,
      line: getLine(content, m.index)
    });
  }
  return findings;
};
