#!/usr/bin/env node
/**
 * PostToolUse hook: runs prettier on the file Claude just wrote/edited.
 * Receives the hook JSON on stdin, extracts the file path, and formats in place.
 * Silently no-ops on file types prettier doesn't understand (--ignore-unknown).
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

let input
try {
  input = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0) // no stdin / malformed — do nothing
}

const file = input?.tool_response?.filePath ?? input?.tool_input?.file_path
if (!file) process.exit(0)

const isWin = process.platform === 'win32'
const bin = join(process.cwd(), 'node_modules', '.bin', isWin ? 'prettier.cmd' : 'prettier')

// shell:true on Windows is required to invoke .cmd files via Node's spawn
spawnSync(bin, ['--write', '--ignore-unknown', file], {
  stdio: 'inherit',
  shell: isWin,
})

// Never fail the hook — formatting is best-effort
process.exit(0)
