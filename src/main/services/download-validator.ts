import { existsSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'

export function validateDownloadFolder(folderPath: string, awemeType: number): boolean {
  if (!existsSync(folderPath)) return false

  const files = readdirSync(folderPath)
  if (files.length === 0) return false

  // Check for 0KB files (excluding .txt desc files which can be empty)
  for (const file of files) {
    if (file.endsWith('.txt')) continue
    const filePath = join(folderPath, file)
    const stat = statSync(filePath)
    if (stat.size === 0) return false
  }

  // Video types must have at least one .mp4 file
  if ([0, 4, 55, 61, 109, 201].includes(awemeType)) {
    const hasVideo = files.some((f) => f.endsWith('.mp4'))
    if (!hasVideo) return false
  }

  // Image type (68) must have at least one image file
  if (awemeType === 68) {
    const hasImage = files.some(
      (f) => f.endsWith('.webp') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')
    )
    if (!hasImage) return false
  }

  return true
}

export function cleanupFailedDownload(folderPath: string): void {
  if (!existsSync(folderPath)) return
  try {
    // Remove .tmp files
    const files = readdirSync(folderPath)
    for (const file of files) {
      if (file.endsWith('.tmp')) {
        unlinkSync(join(folderPath, file))
      }
    }
    // Remove 0KB files (excluding .txt)
    for (const file of files) {
      if (file.endsWith('.txt')) continue
      const filePath = join(folderPath, file)
      try {
        const stat = statSync(filePath)
        if (stat.size === 0) unlinkSync(filePath)
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

export interface BrokenPostInfo {
  postId: number
  awemeId: string
  nickname: string
  folderPath: string
  reason: string
}

export function checkPostFileIntegrity(
  videoPath: string,
  awemeType: number
): { valid: boolean; reason: string } {
  if (!existsSync(videoPath)) {
    return { valid: false, reason: '文件夹不存在' }
  }

  let files: string[]
  try {
    files = readdirSync(videoPath)
  } catch {
    return { valid: false, reason: '无法读取文件夹' }
  }

  if (files.length === 0) {
    return { valid: false, reason: '文件夹为空' }
  }

  // Check for 0KB media files
  for (const file of files) {
    if (file.endsWith('.txt')) continue
    if (file.endsWith('.tmp')) {
      return { valid: false, reason: `存在未完成的临时文件: ${file}` }
    }
    const filePath = join(videoPath, file)
    try {
      const stat = statSync(filePath)
      if (stat.size === 0) {
        return { valid: false, reason: `文件大小为 0KB: ${file}` }
      }
    } catch {
      return { valid: false, reason: `无法读取文件: ${file}` }
    }
  }

  // Video types need .mp4
  if ([0, 4, 55, 61, 109, 201].includes(awemeType)) {
    const hasVideo = files.some((f) => f.endsWith('.mp4'))
    if (!hasVideo) {
      return { valid: false, reason: '缺少视频文件 (.mp4)' }
    }
  }

  // Image type needs image files
  if (awemeType === 68) {
    const hasImage = files.some(
      (f) => f.endsWith('.webp') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')
    )
    if (!hasImage) {
      return { valid: false, reason: '缺少图片文件' }
    }
  }

  return { valid: true, reason: '' }
}
