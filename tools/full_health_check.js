// 文件功能: 聚合 5 项检查输出结构化报告 | 数据流: full_health_check Tool → 5 个 Tool → 汇总报告
const checkFileSize = require('./check_file_size.js');
const runESLint = require('./run_eslint.js');
const validateArchitecture = require('./validate_architecture.js');
const detectAntiPatterns = require('./detect_anti_patterns.js');
const checkCommentCompliance = require('./check_comment_compliance.js');

module.exports = async function fullHealthCheck(projectRoot, filePath) {
  if (!filePath) {
    return { ok: false, error: '缺少 filePath 参数' };
  }

  try {
    const results = await Promise.all([
      checkFileSize(projectRoot, filePath),
      runESLint(projectRoot, filePath),
      validateArchitecture(projectRoot, filePath),
      detectAntiPatterns(projectRoot, filePath),
      checkCommentCompliance(projectRoot, filePath)
    ]);

    const [size, eslint, architecture, antiPatterns, comments] = results;
    const allOk = size.ok && eslint.ok && architecture.ok && antiPatterns.ok && comments.ok;

    return {
      ok: allOk,
      filePath,
      summary: {
        fileSize: size.ok ? '✅' : '❌',
        eslint: eslint.ok ? '✅' : '❌',
        architecture: architecture.ok ? '✅' : '❌',
        antiPatterns: antiPatterns.ok ? '✅' : '❌',
        comments: comments.ok ? '✅' : '❌'
      },
      details: { size, eslint, architecture, antiPatterns, comments }
    };
  } catch (e) {
    return { ok: false, filePath, error: e.message };
  }
};
