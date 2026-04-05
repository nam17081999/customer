#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = process.cwd()
const args = new Set(process.argv.slice(2))
const stagedOnly = args.has('--staged')

const TEXT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.md',
  '.json',
  '.css',
  '.scss',
  '.html',
  '.toml',
  '.yml',
  '.yaml',
  '.txt',
])

const SKIP_DIRS = new Set([
  '.git',
  '.next',
  'node_modules',
  'dist',
  'build',
  'coverage',
])

const SKIP_FILES = new Set([
  'docs/ai-rules.md',
  'scripts/check-mojibake.js',
])

const BAD_PATTERNS = [
  'Ã',
  'Â',
  'Ä',
  'á»',
  'áº',
  'Æ',
  'â€™',
  'â€œ',
  'â€',
  'ðŸ',
  'â†',
  'â”',
  'â€”',
  'â€¢',
  'â€¦',
  'âœ',
  'â‰',
  '\uFFFD',
]

function normalizeSlashes(input) {
  return input.split(path.sep).join('/')
}

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function shouldSkip(relativePath) {
  if (SKIP_FILES.has(relativePath)) return true
  const parts = relativePath.split('/')
  return parts.some((part) => SKIP_DIRS.has(part))
}

function collectRepoFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = normalizeSlashes(path.relative(ROOT, fullPath))
    if (shouldSkip(relativePath)) continue
    if (entry.isDirectory()) {
      collectRepoFiles(fullPath, results)
      continue
    }
    if (entry.isFile() && isTextFile(relativePath)) {
      results.push(relativePath)
    }
  }
  return results
}

function getStagedFiles() {
  const output = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
    { cwd: ROOT, encoding: 'utf8' }
  )
  return output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeSlashes)
    .filter((file) => !shouldSkip(file) && isTextFile(file))
}

function scanFile(relativePath) {
  const fullPath = path.join(ROOT, relativePath)
  let content
  try {
    content = fs.readFileSync(fullPath, 'utf8')
  } catch (error) {
    return [{ pattern: 'READ_ERROR', line: 1, excerpt: error.message }]
  }

  const lines = content.split(/\r?\n/)
  const findings = []

  lines.forEach((line, index) => {
    for (const pattern of BAD_PATTERNS) {
      if (line.includes(pattern)) {
        findings.push({
          pattern,
          line: index + 1,
          excerpt: line.trim().slice(0, 180),
        })
        break
      }
    }
  })

  return findings
}

const files = stagedOnly ? getStagedFiles() : collectRepoFiles(ROOT)
const failures = []

for (const file of files) {
  const findings = scanFile(file)
  if (findings.length > 0) {
    failures.push({ file, findings })
  }
}

if (failures.length > 0) {
  console.error('Phát hiện dấu hiệu lỗi mã hóa tiếng Việt:')
  for (const failure of failures) {
    console.error(`- ${failure.file}`)
    for (const finding of failure.findings.slice(0, 5)) {
      console.error(
        `  dòng ${finding.line}: [${finding.pattern}] ${finding.excerpt}`
      )
    }
    if (failure.findings.length > 5) {
      console.error(`  ... và thêm ${failure.findings.length - 5} dòng khác`)
    }
  }
  console.error(
    'Dừng lại để tránh commit hoặc lưu thêm nội dung mojibake. Kiểm tra encoding UTF-8 và cách ghi file trước khi tiếp tục.'
  )
  process.exit(1)
}

console.log(
  stagedOnly
    ? 'Không phát hiện lỗi mã hóa trong các file staged.'
    : 'Không phát hiện lỗi mã hóa trong repo.'
)
