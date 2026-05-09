import { BrowserWindow, clipboard } from 'electron'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { basename, join } from 'path'
import os from 'os'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import {
  getPostById,
  getSetting,
  getTranscriptionPosts,
  type DbPost,
  updatePostTranscriptionResult,
  updatePostTranscriptionStatus
} from '../database'
import { findMediaFiles, fromUrlPath } from './media'

const execFileAsync = promisify(execFile)
const ffmpegPath = ffmpegInstaller.path.replace('app.asar', 'app.asar.unpacked')
const queuedPostIds = new Set<number>()
let isProcessing = false

export interface TranscriptionProgressPayload {
  postId: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message: string
  error?: string
}

function broadcastTranscriptionProgress(payload: TranscriptionProgressPayload): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('transcription:progress', payload)
  }
}

function getTranscriptFilePath(post: DbPost): string {
  const folderPath = post.video_path || post.cover_path || post.music_path
  if (!folderPath) {
    throw new Error('作品目录不存在')
  }
  return join(folderPath, 'transcript.txt')
}

function getNextQueuedPostId(): number | undefined {
  return [...queuedPostIds][0]
}

function resolveVideoFilePath(post: DbPost): string {
  const media = findMediaFiles(post.sec_uid, post.folder_name, post.aweme_type)
  if (!media?.video) {
    throw new Error('未找到可转写的视频文件')
  }
  return fromUrlPath(media.video)
}

async function extractAudio(videoFilePath: string, postId: number): Promise<string> {
  const tempDir = join(os.tmpdir(), 'dym-transcription')
  await mkdir(tempDir, { recursive: true })

  const outputPath = join(tempDir, `post-${postId}-${Date.now()}.mp3`)
  await execFileAsync(ffmpegPath, [
    '-y',
    '-i',
    videoFilePath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    outputPath
  ])
  return outputPath
}

async function callTranscriptionApi(audioPath: string): Promise<string> {
  const apiKey = getSetting('siliconflow_api_key') || ''
  if (!apiKey) {
    throw new Error('请先在系统设置中填写 SiliconFlow API Key')
  }

  const apiUrl =
    getSetting('transcription_api_url') || 'https://api.siliconflow.cn/v1/audio/transcriptions'
  const model = getSetting('transcription_model') || 'FunAudioLLM/SenseVoiceSmall'
  const audioBytes = await readFile(audioPath)

  const form = new FormData()
  form.append('file', new Blob([audioBytes], { type: 'audio/mpeg' }), basename(audioPath))
  form.append('model', model)

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  })

  const rawText = await response.text()
  let data: {
    text?: string
    message?: string
    error?: { message?: string }
  } = {}
  try {
    data = JSON.parse(rawText) as typeof data
  } catch {
    data = { message: rawText }
  }

  if (!response.ok) {
    throw new Error(data.error?.message || data.message || `转写失败 (${response.status})`)
  }

  if (typeof data.text !== 'string') {
    throw new Error('转写接口未返回 text 字段')
  }

  return data.text
}

async function runTranscription(postId: number): Promise<void> {
  const post = getPostById(postId)
  if (!post) {
    throw new Error('作品不存在')
  }
  if (post.aweme_type === 68) {
    throw new Error('图文作品不支持音频转写')
  }

  updatePostTranscriptionStatus(postId, 'processing', null)
  broadcastTranscriptionProgress({
    postId,
    status: 'processing',
    message: `开始转写 ${post.desc || post.caption || post.aweme_id}`
  })

  let tempAudioPath: string | null = null
  try {
    const videoFilePath = resolveVideoFilePath(post)
    tempAudioPath = await extractAudio(videoFilePath, postId)
    const text = await callTranscriptionApi(tempAudioPath)

    updatePostTranscriptionResult(postId, text)
    await writeFile(getTranscriptFilePath(post), text, 'utf8')

    broadcastTranscriptionProgress({
      postId,
      status: 'completed',
      message: '转写完成'
    })
  } catch (error) {
    const message = (error as Error).message
    updatePostTranscriptionStatus(postId, 'failed', message)
    broadcastTranscriptionProgress({
      postId,
      status: 'failed',
      message: '转写失败',
      error: message
    })
  } finally {
    if (tempAudioPath) {
      await rm(tempAudioPath, { force: true }).catch(() => undefined)
    }
  }
}

async function processQueue(): Promise<void> {
  if (isProcessing) {
    return
  }
  isProcessing = true

  try {
    while (queuedPostIds.size > 0) {
      const postId = getNextQueuedPostId()
      if (!postId) {
        break
      }

      queuedPostIds.delete(postId)
      await runTranscription(postId)
    }
  } finally {
    isProcessing = false
  }
}

export function initTranscriptionQueue(): void {
  const posts = getTranscriptionPosts()
  for (const post of posts) {
    if (post.transcription_status === 'processing') {
      updatePostTranscriptionStatus(post.id, 'pending', '任务在上次退出前中断，已重新排队')
    }
  }
}

export function listTranscriptionPosts(): DbPost[] {
  return getTranscriptionPosts()
}

export function queueTranscription(postId: number): void {
  const post = getPostById(postId)
  if (!post || post.aweme_type === 68) {
    return
  }

  if (!queuedPostIds.has(postId)) {
    queuedPostIds.add(postId)
    updatePostTranscriptionStatus(postId, 'pending', null)
    broadcastTranscriptionProgress({
      postId,
      status: 'pending',
      message: '已加入转写队列'
    })
  }

  void processQueue()
}

export function startTranscriptions(postIds: number[]): void {
  for (const postId of postIds) {
    queueTranscription(postId)
  }
}

export function retryTranscription(postId: number): void {
  queueTranscription(postId)
}

export async function copyTranscription(postId: number): Promise<string> {
  const post = getPostById(postId)
  if (!post?.transcription_text) {
    throw new Error('当前作品还没有转写内容')
  }

  clipboard.writeText(post.transcription_text)
  return post.transcription_text
}

export async function exportTranscription(postId: number): Promise<string> {
  const post = getPostById(postId)
  if (!post?.transcription_text) {
    throw new Error('当前作品还没有转写内容')
  }

  const transcriptPath = getTranscriptFilePath(post)
  await writeFile(transcriptPath, post.transcription_text, 'utf8')
  return transcriptPath
}
