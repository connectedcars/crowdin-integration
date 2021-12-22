#!/usr/bin/env node

import { promisify } from 'util'
const execAsync = promisify(require('child_process').exec)

async function cmd(cmd: string) {
  const result = await execAsync(cmd, { cwd: __dirname })
  return result.stdout.split('\n').join('')
}

type GitInfo = { branch: string; commit: string; tag: string }

export default async (): Promise<GitInfo> => {
  {
    const branch = await cmd('git rev-parse --abbrev-ref HEAD')
    const commit = await cmd('git rev-parse HEAD')
    const tag = await cmd('git describe --always --tag --abbrev=0')

    return {
      branch,
      commit,
      tag: commit !== tag ? tag : null
    }
  }
}
