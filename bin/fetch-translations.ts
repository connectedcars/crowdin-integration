#!/usr/bin/env node

import crowdin, { Credentials } from '@crowdin/crowdin-api-client'
import nconf from 'nconf'
import { promisify } from 'util'
const execAsync = promisify(require('child_process').exec)
import axios from 'axios'
import fs from 'fs'

import gitInfo from './git-info'

const GITHUB_PR_MAX_LENGTH = 65536 - 5000 // we substract a bit, since it seems as GH is not counting the same way as we do!

// Load config
nconf.argv().env().file('./crowdin.json')
nconf.defaults({
  workingDir: 'locales',
  pullRequest: {
    baseBranch: 'master'
  }
})

const credentials: Credentials = {
  token: nconf.get('CROWDIN_API_TOKEN')
}

if (!credentials.token) {
  console.warn('Missing crowdin API key! (CROWDIN_API_TOKEN)')
  process.exit(1)
}

const { translationsApi } = new crowdin(credentials)

async function cmd(cmd: string, opts = { cwd: __dirname }) {
  const result = await execAsync(cmd, opts)
  return result.stdout
}

async function downloadTranslations(projectId: number, buildId: number | null) {
  if (!buildId) {
    console.error('Missing build id')
    return null
  }
  try {
    const translations = await translationsApi.downloadTranslations(projectId, buildId)
    return translations.data.url
  } catch (error) {
    console.error(error)
  }
  return null
}

async function buildTranslations(projectId: number, callback?: (buildId: number) => void) {
  try {
    const build = await translationsApi.buildProject(projectId)
    const buildId = build.data.id
    const getBuildStatus = () => translationsApi.checkBuildStatus(projectId, buildId)

    const interval = setInterval(async () => {
      const buildStatus = await getBuildStatus()
      const progress = buildStatus.data.progress
      printProgress(`Build progress: ${progress}%`)

      if (progress >= 100) {
        clearInterval(interval)
        if (callback) {
          callback(buildId)
        }
      }
    }, 1000)

    return buildId
  } catch (error) {
    console.error(error)
  }
  return null
}

async function extractTranslations(url: string | null, destination: string): Promise<void> {
  const supportedLangs = nconf.get('supportedLanguages')
  // Some languages have the full language code, which we do not use
  const langMap = nconf.get('languageMap')
  const workingDir = nconf.get('workingDir')

  const destPath = `${workingDir}/${destination}.zip`

  if (!url) {
    console.log('No url given')
    return
  }
  try {
    const response = await axios({ url, responseType: 'stream' })

    await new Promise(newRes => {
      const stream = fs.createWriteStream(destPath)
      response.data.pipe(stream).on('finish', () => {
        console.log('Download successful')
        newRes(destPath)
      })
    })

    await extract(destination, supportedLangs, langMap)
  } catch (error) {
    console.error('Error downloading translations:', error)
  }
}

async function extract(source: string, langs: string[], langMap: Record<string, string>): Promise<void> {
  const workingDir = nconf.get('workingDir')
  const extractPath = nconf.get('extractPath')

  const opts = { cwd: `./${workingDir}` }
  console.log('Unzipping...')
  await cmd(`unzip -u ${source}.zip -d tmp`, opts)
  console.log('Copying...')
  for (const l of langs) {
    const langName = langMap?.[l] || l
    await cmd(`cp tmp/${extractPath}/${langName}.po ${l}.po`, opts)
  }
  console.log('Cleaning up...')
  await cmd(`rm -rf tmp/ ${source}.zip`, opts)
}

async function gitPullRequest() {
  const baseBranch = nconf.get('pullRequest:baseBranch') || 'master'
  const forcePR = nconf.get('force')

  const { branch } = await gitInfo()
  if (branch !== baseBranch && !forcePR) {
    console.log(`Skipped Crowdin pull request creation on branch ${branch}. Please switch to ${baseBranch} or use --force`)
    return
  }

  const ghProject = nconf.get('pullRequest:githubProject')

  const timestamp = Date.now()
  const branchName = `translate-${timestamp}`
  const fileNames = `locales/*.po`
  const opts = { cwd: './' }

  console.log('\nCreating automatic PR...')
  await cmd(`git checkout -b ${branchName}`)
  await cmd(`git add ${fileNames}`, opts)
  const modified = await cmd(`git diff --staged --name-only | cat`)
  if (!modified) {
    console.log('No file changes detected. Aborting.')
    return
  }
  const translationDiff: string = await cmd(`git diff --staged -U0 | grep -v '#' | grep '^[-+]' | sed 's/[+-]$//'`)
  const diffEscaped = translationDiff.replace(/'/g, "'\\''")
  const diffTruncated = diffEscaped.length >  GITHUB_PR_MAX_LENGTH ? diffEscaped.substring(0, GITHUB_PR_MAX_LENGTH)+'\ntruncated...' : diffEscaped
  await cmd(`git commit -m 'Updated translations from crowdin' -m '\`\`\`diff\n${diffTruncated}\n\`\`\`'`)
  await cmd(`git push -u origin ${branchName}`)
  await cmd(`git checkout ${baseBranch}`)
  console.log(`https://github.com/${ghProject}/compare/${branchName}`)
}

function printProgress(progress: string) {
  process.stdout.clearLine(0)
  process.stdout.cursorTo(0)
  process.stdout.write(progress)
}

void (async () => {
  const projectId = nconf.get('projectId')

  try {
    await buildTranslations(projectId, async buildId => {
      console.log()
      const translationUrl = await downloadTranslations(projectId, buildId)

      await extractTranslations(translationUrl, 'all')

      await gitPullRequest()
    })
  } catch (error) {
    console.error(error)
  }
})()
