// 文件功能: check_file_size Tool 测试 | 数据流: node:test → check_file_size → 断言
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const checkFileSize = require('../tools/check_file_size.js');

// 为每个测试创建独立临时目录，避免并行冲突
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-test-'));
  return dir;
}

function createFixture(dir, name, lines) {
  const content = Array(lines).fill('// line').join('\n');
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
}

describe('check_file_size', () => {
  it('通过：小文件在限制内', () => {
    const dir = makeTempDir();
    createFixture(dir, 'small.js', 50);
    const result = checkFileSize(dir, 'small.js');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.lines, 50);
    assert.strictEqual(result.limit, 150);
    cleanup(dir);
  });

  it('失败：文件超过限制', () => {
    const dir = makeTempDir();
    createFixture(dir, 'oversized.js', 200);
    const result = checkFileSize(dir, 'oversized.js');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.lines, 200);
    assert.strictEqual(result.limit, 150);
    assert.strictEqual(result.exceeded, 50);
    cleanup(dir);
  });

  it('通过：controller 文件在 150 行内', () => {
    const dir = makeTempDir();
    createFixture(dir, 'controllers/test.js', 100);
    const result = checkFileSize(dir, 'controllers/test.js');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.limit, 150);
    cleanup(dir);
  });

  it('失败：route 文件超过 50 行', () => {
    const dir = makeTempDir();
    createFixture(dir, 'routes/test.js', 60);
    const result = checkFileSize(dir, 'routes/test.js');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.limit, 50);
    cleanup(dir);
  });

  it('失败：文件不存在', () => {
    const dir = makeTempDir();
    const result = checkFileSize(dir, 'nonexistent.js');
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('不存在'));
    cleanup(dir);
  });

  it('通过：.vue 文件在 200 行内', () => {
    const dir = makeTempDir();
    createFixture(dir, 'views/Test.vue', 100);
    const result = checkFileSize(dir, 'views/Test.vue');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.limit, 200);
    cleanup(dir);
  });
});