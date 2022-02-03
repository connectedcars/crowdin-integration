#!/usr/bin/env node

import crowdin, { Credentials } from '@crowdin/crowdin-api-client'
import fs from 'fs'
import nconf from 'nconf'

import gitInfo from './git-info'

const BRANCH_NAME = process.env.BRANCH_NAME

// Load config
nconf.argv().env().file('./crowdin.json')

const baseBranch = nconf.get('pullRequest:baseBranch')
const forceUpload = nconf.get('force')

const workingDir = nconf.get('workingDir')
const filePath = workingDir ? `${workingDir}/template.pot` : 'template.pot'

const credentials: Credentials = {
  token: nconf.get('CROWDIN_API_TOKEN')
}

if (!credentials.token) {
  console.warn('Missing crowdin API key! (CROWDIN_API_TOKEN)')
  process.exit(1)
}

const { uploadStorageApi, sourceFilesApi } = new crowdin(credentials)

async function addStorage() {
  try {
    const storage = await uploadStorageApi.addStorage('template.pot', fs.readFileSync(filePath))
    const storageId = storage.data.id

    return storageId
  } catch (error) {
    console.error(error)
  }
  return null
}

async function findFileId() {
  const projectId = nconf.get('projectId')
  const remotePath = nconf.get('remotePath')

  try {
    const files = await sourceFilesApi.listProjectFiles(projectId)

    const file = files.data.find(({ data }) => data.path === remotePath)

    if (!file?.data.id) {
      throw new Error('File not found, check your "remotePath" setting.')
    }

    return file.data.id
  } catch (error) {
    console.error(error)
  }
  return null
}

async function updateFile(fileId: number, storageId: number) {
  const projectId = nconf.get('projectId')

  try {
    await sourceFilesApi.updateOrRestoreFile(projectId, fileId, { storageId })

    console.log('Translations updated')
  } catch (error) {
    console.error(error)
  }
  return null
}

void (async () => {
  const branch = BRANCH_NAME || (await gitInfo()).branch

  if (branch !== baseBranch && !forceUpload) {
    console.log(`Skipped Crowdin translation upload on branch ${branch}`)
    return
  }

  const fileId = await findFileId()
  console.log('Found fileId', fileId)

  console.log('Uploading', filePath)
  const storageId = await addStorage()

  if (!fileId || !storageId) {
    console.error('missing fileId or storageId')
    return
  }

  console.log('Updating file...')
  await updateFile(fileId, storageId)
})()
