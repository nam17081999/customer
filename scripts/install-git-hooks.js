#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = process.cwd()
const hooksDir = path.join(ROOT, '.githooks')

if (!fs.existsSync(hooksDir)) {
  fs.mkdirSync(hooksDir, { recursive: true })
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: ROOT,
  stdio: 'inherit',
})

console.log('Đã cấu hình git hooks path: .githooks')
