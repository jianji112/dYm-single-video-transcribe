import { DouyinHandler, getSecUserId, getAwemeId, setConfig } from 'dy-downloader'
import { getSetting } from '../database'

let handler: DouyinHandler | null = null

const DOYIN_URL_PATTERN =
  /https?:\/\/(?:v\.douyin\.com|www\.douyin\.com|www\.iesdouyin\.com)\/[\w\-./?%&=#:]+/i

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[),，。！？、】》」’”]+$/u, '')
}

export function extractDouyinUrlFromText(input: string): string | null {
  const match = input.match(DOYIN_URL_PATTERN)
  if (!match) return null
  return trimTrailingPunctuation(match[0])
}

function normalizeDouyinInput(input: string): string {
  const trimmed = input.trim()
  return extractDouyinUrlFromText(trimmed) || trimmed
}

function extractModalId(input: string): string | null {
  const normalized = normalizeDouyinInput(input)
  const match = normalized.match(/[?&]modal_id=(\d+)/i)
  return match?.[1] || null
}

export function initDouyinHandler(): DouyinHandler | null {
  const cookie = getSetting('douyin_cookie')
  if (cookie) {
    setConfig({ encryption: 'ab' })
    handler = new DouyinHandler({ cookie })
    console.log('[Douyin] Handler initialized with A-Bogus encryption')
  } else {
    handler = null
    console.log('[Douyin] No cookie, handler not initialized')
  }
  return handler
}

export function getDouyinHandler(): DouyinHandler | null {
  return handler
}

export function refreshDouyinHandler(): DouyinHandler | null {
  return initDouyinHandler()
}

export type LinkType = 'user' | 'video' | 'unknown'

export interface LinkParseResult {
  type: LinkType
  id: string
}

export async function parseDouyinUrl(url: string): Promise<LinkParseResult> {
  const normalized = normalizeDouyinInput(url)
  console.log('[Douyin] parseDouyinUrl:', normalized)

  try {
    const secUserId = await getSecUserId(normalized)
    if (secUserId) {
      console.log('[Douyin] Detected as user link, secUserId:', secUserId)
      return { type: 'user', id: secUserId }
    }
  } catch (e) {
    console.log('[Douyin] Not a user link:', (e as Error).message)
  }

  const modalId = extractModalId(normalized)
  if (modalId) {
    console.log('[Douyin] Detected modal_id as video id:', modalId)
    return { type: 'video', id: modalId }
  }

  try {
    const awemeId = await getAwemeId(normalized)
    if (awemeId) {
      console.log('[Douyin] Detected as video link, awemeId:', awemeId)
      return { type: 'video', id: awemeId }
    }
  } catch (e) {
    console.log('[Douyin] Not a video link:', (e as Error).message)
  }

  return { type: 'unknown', id: '' }
}

export async function fetchUserProfile(url: string) {
  if (!handler) {
    throw new Error('DouyinHandler not initialized, please set cookie first')
  }
  const normalized = normalizeDouyinInput(url)
  console.log('[Douyin] fetchUserProfile url:', normalized)
  const secUserId = await getSecUserId(normalized)
  console.log('[Douyin] secUserId:', secUserId)
  const profile = await handler.fetchUserProfile(secUserId)
  console.log('[Douyin] profile:', JSON.stringify(profile, null, 2))
  return profile
}

export async function fetchUserProfileBySecUid(secUserId: string) {
  if (!handler) {
    throw new Error('DouyinHandler not initialized, please set cookie first')
  }
  console.log('[Douyin] fetchUserProfileBySecUid:', secUserId)
  const profile = await handler.fetchUserProfile(secUserId)
  console.log('[Douyin] profile:', JSON.stringify(profile, null, 2))
  return profile
}

export async function fetchVideoDetail(urlOrAwemeId: string) {
  if (!handler) {
    throw new Error('DouyinHandler not initialized, please set cookie first')
  }
  const normalized = normalizeDouyinInput(urlOrAwemeId)
  const target = extractModalId(normalized) || normalized
  console.log('[Douyin] fetchVideoDetail:', target)
  try {
    const detail = await handler.fetchOneVideo(target)
    console.log('[Douyin] video detail:', JSON.stringify(detail, null, 2))
    return detail
  } catch (error) {
    console.error('[Douyin] fetchVideoDetail error:', error)
    throw error
  }
}

export { getSecUserId, getAwemeId }
