import { BrowserWindow } from 'electron'
import {
  SINGLE_VIDEO_ONLY_USER_REMARK,
  createSingleVideoTask,
  createUser,
  deleteSingleVideoTask,
  getAllSingleVideoTasks,
  getPostByAwemeId,
  getSetting,
  getSingleVideoTaskByAwemeId,
  getSingleVideoTaskById,
  getUserBySecUid,
  type CreateUserInput,
  type DbSingleVideoTask,
  type DbUser,
  updateUser,
  updateUserSettings,
  updateSingleVideoTask
} from '../database'
import { fetchUserProfileBySecUid, fetchVideoDetail } from './douyin'
import { downloadSinglePost } from './downloader'
import { queueTranscription } from './transcription'

interface ResolvedSingleVideoContext {
  sourceUrl: string
  awemeId: string
  secUid: string
  nickname: string
  desc: string
  awemeType: number
  userInput: CreateUserInput
  awemeData: Record<string, unknown>
}

export interface SingleVideoEnqueueResult {
  status: 'queued' | 'already-downloaded' | 'already-queued'
  task?: DbSingleVideoTask
  postId?: number
}

export interface SingleVideoProgressPayload {
  taskId: number
  awemeId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message: string
  error?: string
  postId?: number | null
}

let isProcessing = false

function broadcastSingleVideoProgress(payload: SingleVideoProgressPayload): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('singleVideo:progress', payload)
  }
}

function getNextPendingTask(): DbSingleVideoTask | undefined {
  return getAllSingleVideoTasks()
    .filter((task) => task.status === 'pending')
    .sort((a, b) => a.id - b.id)[0]
}

async function resolveSingleVideoContext(sourceUrl: string): Promise<ResolvedSingleVideoContext> {
  const detail = (await fetchVideoDetail(sourceUrl)) as {
    awemeId?: string
    awemeType?: number
    desc?: string
    nickname?: string
    secUserId?: string
    uid?: string
    toAwemeData?: () => Record<string, unknown>
  }

  const awemeId = detail.awemeId || ''
  const secUid = detail.secUserId || ''
  if (!awemeId) {
    throw new Error('未能解析出作品 ID')
  }
  if (!secUid) {
    throw new Error('未能解析出作品作者')
  }
  if (typeof detail.toAwemeData !== 'function') {
    throw new Error('作品详情缺少下载所需数据')
  }

  const profileRes = (await fetchUserProfileBySecUid(secUid)) as unknown as {
    _data?: { user?: Record<string, unknown> }
  }
  const userData = profileRes._data?.user
  if (!userData) {
    throw new Error('获取作者资料失败')
  }

  return {
    sourceUrl,
    awemeId,
    secUid,
    nickname: detail.nickname || String(userData.nickname || ''),
    desc: detail.desc || '',
    awemeType: detail.awemeType || 0,
    userInput: {
      sec_uid: secUid,
      uid: String(userData.uid || detail.uid || ''),
      nickname: String(userData.nickname || detail.nickname || ''),
      signature: String(userData.signature || ''),
      avatar:
        (userData.avatar_larger as { url_list?: string[] } | undefined)?.url_list?.[0] ||
        (userData.avatar_medium as { url_list?: string[] } | undefined)?.url_list?.[0] ||
        '',
      short_id: String(userData.short_id || ''),
      unique_id: String(userData.unique_id || ''),
      following_count: Number(userData.following_count || 0),
      follower_count: Number(userData.follower_count || 0),
      total_favorited: Number(userData.total_favorited || 0),
      aweme_count: Number(userData.aweme_count || 0),
      homepage_url: `https://www.douyin.com/user/${secUid}`
    },
    awemeData: detail.toAwemeData()
  }
}

export async function ensureUserFromVideoSource(
  sourceUrl: string
): Promise<{ user: DbUser; isNewUser: boolean; awemeData: Record<string, unknown> }> {
  const context = await resolveSingleVideoContext(sourceUrl)
  const shouldAddUser = getSetting('single_video_add_user') === 'true'
  const existing = getUserBySecUid(context.secUid)
  if (existing) {
    const refreshed =
      updateUser(existing.id, {
        ...context.userInput,
        show_in_home: undefined,
        remark: undefined
      }) || existing

    if (shouldAddUser && refreshed.remark === SINGLE_VIDEO_ONLY_USER_REMARK) {
      const promoted =
        updateUserSettings(refreshed.id, {
          remark: '',
          show_in_home: true
        }) || refreshed
      return { user: promoted, isNewUser: false, awemeData: context.awemeData }
    }

    return { user: refreshed, isNewUser: false, awemeData: context.awemeData }
  }

  const created = createUser({
    ...context.userInput,
    show_in_home: true,
    remark: shouldAddUser ? '' : SINGLE_VIDEO_ONLY_USER_REMARK
  })
  return { user: created, isNewUser: true, awemeData: context.awemeData }
}

async function processQueue(): Promise<void> {
  if (isProcessing) {
    return
  }
  isProcessing = true

  try {
    while (true) {
      const task = getNextPendingTask()
      if (!task) {
        break
      }

      updateSingleVideoTask(task.id, { status: 'processing', error: null })
      broadcastSingleVideoProgress({
        taskId: task.id,
        awemeId: task.aweme_id,
        status: 'processing',
        message: `开始下载 ${task.nickname || task.aweme_id}`
      })

      try {
        const context = await resolveSingleVideoContext(task.source_url)
        updateSingleVideoTask(task.id, {
          aweme_id: context.awemeId,
          sec_uid: context.secUid,
          nickname: context.nickname,
          desc: context.desc
        })

        const existingPost = getPostByAwemeId(context.awemeId)
        if (existingPost) {
          updateSingleVideoTask(task.id, {
            status: 'completed',
            error: null,
            post_id: existingPost.id
          })
          broadcastSingleVideoProgress({
            taskId: task.id,
            awemeId: context.awemeId,
            status: 'completed',
            message: '作品已存在，已跳过重复下载',
            postId: existingPost.id
          })
          continue
        }

        const { user, awemeData } = await ensureUserFromVideoSource(task.source_url)
        const result = await downloadSinglePost(user, awemeData)

        if (result.status === 'success') {
          updateSingleVideoTask(task.id, {
            status: 'completed',
            error: null,
            post_id: result.postId
          })
          broadcastSingleVideoProgress({
            taskId: task.id,
            awemeId: context.awemeId,
            status: 'completed',
            message: '下载完成',
            postId: result.postId
          })

          const shouldAutoTranscribe =
            getSetting('single_video_auto_transcribe') !== 'false' && context.awemeType !== 68
          if (shouldAutoTranscribe) {
            queueTranscription(result.postId)
          }
          continue
        }

        if (result.status === 'already-downloaded') {
          const post = getPostByAwemeId(context.awemeId)
          updateSingleVideoTask(task.id, {
            status: 'completed',
            error: null,
            post_id: post?.id ?? null
          })
          broadcastSingleVideoProgress({
            taskId: task.id,
            awemeId: context.awemeId,
            status: 'completed',
            message: '作品已存在，已跳过重复下载',
            postId: post?.id ?? null
          })
          continue
        }

        updateSingleVideoTask(task.id, { status: 'failed', error: result.error })
        broadcastSingleVideoProgress({
          taskId: task.id,
          awemeId: context.awemeId,
          status: 'failed',
          message: '下载失败',
          error: result.error
        })
      } catch (error) {
        const message = (error as Error).message
        updateSingleVideoTask(task.id, { status: 'failed', error: message })
        broadcastSingleVideoProgress({
          taskId: task.id,
          awemeId: task.aweme_id,
          status: 'failed',
          message: '下载失败',
          error: message
        })
      }
    }
  } finally {
    isProcessing = false
  }
}

export function initSingleVideoQueue(): void {
  const tasks = getAllSingleVideoTasks()
  for (const task of tasks) {
    if (task.status === 'processing') {
      updateSingleVideoTask(task.id, {
        status: 'pending',
        error: '任务在上次退出前中断，已重新排队'
      })
    }
  }
  void processQueue()
}

export function listSingleVideoTasks(): DbSingleVideoTask[] {
  return getAllSingleVideoTasks()
}

export async function enqueueSingleVideoTask(sourceUrl: string): Promise<SingleVideoEnqueueResult> {
  const context = await resolveSingleVideoContext(sourceUrl)
  const existingPost = getPostByAwemeId(context.awemeId)
  if (existingPost) {
    return { status: 'already-downloaded', postId: existingPost.id }
  }

  const existingTask = getSingleVideoTaskByAwemeId(context.awemeId)
  if (existingTask) {
    if (existingTask.status === 'failed') {
      const resetTask = updateSingleVideoTask(existingTask.id, {
        source_url: context.sourceUrl,
        sec_uid: context.secUid,
        nickname: context.nickname,
        desc: context.desc,
        status: 'pending',
        error: null,
        post_id: null
      })
      if (resetTask) {
        broadcastSingleVideoProgress({
          taskId: resetTask.id,
          awemeId: resetTask.aweme_id,
          status: 'pending',
          message: '已重新加入下载队列'
        })
        void processQueue()
        return { status: 'queued', task: resetTask }
      }
    }
    return { status: 'already-queued', task: existingTask }
  }

  const task = createSingleVideoTask({
    source_url: context.sourceUrl,
    aweme_id: context.awemeId,
    sec_uid: context.secUid,
    nickname: context.nickname,
    desc: context.desc
  })
  broadcastSingleVideoProgress({
    taskId: task.id,
    awemeId: task.aweme_id,
    status: 'pending',
    message: '已加入下载队列'
  })
  void processQueue()
  return { status: 'queued', task }
}

export async function retrySingleVideoTask(id: number): Promise<DbSingleVideoTask> {
  const task = getSingleVideoTaskById(id)
  if (!task) {
    throw new Error('任务不存在')
  }

  const updated = updateSingleVideoTask(id, {
    status: 'pending',
    error: null,
    post_id: null
  })
  if (!updated) {
    throw new Error('重试任务失败')
  }

  broadcastSingleVideoProgress({
    taskId: updated.id,
    awemeId: updated.aweme_id,
    status: 'pending',
    message: '已重新加入下载队列'
  })
  void processQueue()
  return updated
}

export function removeSingleVideoTask(id: number): void {
  const task = getSingleVideoTaskById(id)
  if (!task) {
    throw new Error('任务不存在')
  }
  if (task.status === 'processing') {
    throw new Error('下载中的任务不能删除')
  }
  deleteSingleVideoTask(id)
}
