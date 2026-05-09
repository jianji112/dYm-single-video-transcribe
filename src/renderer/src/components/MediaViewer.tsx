import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Heart,
  MessageCircle,
  Play,
  Volume2,
  VolumeX,
  X
} from 'lucide-react'

interface MediaViewerProps {
  post: DbPost | null
  open: boolean
  onOpenChange: (open: boolean) => void
  allPosts?: DbPost[]
  onSelectPost?: (post: DbPost) => void
}

const IMAGE_AUTO_INTERVAL = 3000

function parseTags(tagsStr: string | null): string[] {
  if (!tagsStr) {
    return []
  }

  try {
    const tags = JSON.parse(tagsStr)
    return Array.isArray(tags) ? tags : []
  } catch {
    return []
  }
}

function getTranscriptionMessage(post: DbPost | null): string {
  if (!post) {
    return ''
  }
  if (post.aweme_type === 68) {
    return '图文作品不支持音频转写'
  }
  if (post.transcription_text) {
    return post.transcription_text
  }
  if (post.transcription_status === 'failed') {
    return post.transcription_error || '转写失败，可在音频转写页面重试'
  }
  if (post.transcription_status === 'processing') {
    return '正在转写中...'
  }
  return '还没有转写内容，可在音频转写页面手动发起转写'
}

export function MediaViewer({
  post,
  open,
  onOpenChange,
  allPosts = [],
  onSelectPost
}: MediaViewerProps) {
  const [currentPost, setCurrentPost] = useState<DbPost | null>(post)
  const [media, setMedia] = useState<MediaFiles | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [recommendCovers, setRecommendCovers] = useState<Map<number, string>>(new Map())
  const [manualOverride, setManualOverride] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setCurrentPost(post)
  }, [post])

  const loadMedia = async (targetPost: DbPost) => {
    setLoading(true)
    try {
      const result = await window.api.post.getMediaFiles(
        targetPost.sec_uid,
        targetPost.folder_name,
        targetPost.aweme_type
      )
      setMedia(result)
    } catch (error) {
      console.error('Failed to load media:', error)
      setMedia(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && currentPost) {
      void loadMedia(currentPost)
      setManualOverride(false)
      setCurrentIndex(0)
      return
    }

    setMedia(null)
    setCurrentIndex(0)
    setManualOverride(false)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [open, currentPost?.id])

  useEffect(() => {
    if (media?.music && media.type === 'images' && audioRef.current) {
      audioRef.current.play().catch(() => undefined)
    }
  }, [media])

  useEffect(() => {
    if (!open || !currentPost) {
      return
    }

    return window.api.transcription.onProgress((progress) => {
      if (progress.postId !== currentPost.id) {
        return
      }

      void (async () => {
        const latest = await window.api.db.queryOne<DbPost>('SELECT * FROM posts WHERE id = ?', [
          currentPost.id
        ])
        if (latest) {
          setCurrentPost(latest)
        }
      })()
    })
  }, [open, currentPost?.id])

  const recommendations = useMemo(() => {
    if (!currentPost || allPosts.length === 0) {
      return []
    }

    const currentTags = parseTags(currentPost.analysis_tags)
    const currentSecUid = currentPost.sec_uid
    const usedIds = new Set<number>([currentPost.id])
    const result: DbPost[] = []
    const candidates = allPosts.filter((item) => item.id !== currentPost.id)

    if (currentTags.length > 0) {
      const sameTagOtherAuthor = candidates
        .filter((item) => {
          if (item.sec_uid === currentSecUid) {
            return false
          }
          const tags = parseTags(item.analysis_tags)
          return tags.some((tag) => currentTags.includes(tag))
        })
        .slice(0, 2)

      for (const item of sameTagOtherAuthor) {
        if (!usedIds.has(item.id) && result.length < 3) {
          result.push(item)
          usedIds.add(item.id)
        }
      }
    }

    const sameAuthor = candidates.find(
      (item) => item.sec_uid === currentSecUid && !usedIds.has(item.id)
    )
    if (sameAuthor && result.length < 3) {
      result.push(sameAuthor)
      usedIds.add(sameAuthor.id)
    }

    for (const item of candidates) {
      if (result.length >= 3) {
        break
      }
      if (usedIds.has(item.id)) {
        continue
      }
      result.push(item)
      usedIds.add(item.id)
    }

    return result
  }, [allPosts, currentPost])

  useEffect(() => {
    const loadCovers = async () => {
      const covers = new Map<number, string>()
      for (const item of recommendations) {
        try {
          const coverPath = await window.api.post.getCoverPath(item.sec_uid, item.folder_name)
          if (coverPath) {
            covers.set(item.id, coverPath)
          }
        } catch (error) {
          console.error('Failed to load cover for recommendation:', error)
        }
      }
      setRecommendCovers(covers)
    }

    if (recommendations.length > 0) {
      void loadCovers()
    } else {
      setRecommendCovers(new Map())
    }
  }, [recommendations])

  const isImages = media?.type === 'images'
  const images = media?.images || []
  const imageVideos = media?.imageVideos || []
  const currentImageVideo = imageVideos[currentIndex] || null
  const hasMultipleImages = images.length > 1

  useEffect(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current)
      autoTimerRef.current = null
    }

    if (!open || !isImages || !hasMultipleImages || manualOverride) {
      return
    }

    autoTimerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
    }, IMAGE_AUTO_INTERVAL)

    return () => {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current)
        autoTimerRef.current = null
      }
    }
  }, [open, isImages, hasMultipleImages, images.length, manualOverride])

  const handlePrev = () => {
    setManualOverride(true)
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }

  const handleNext = () => {
    setManualOverride(true)
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }

  const handleSelectIndex = (idx: number) => {
    setManualOverride(true)
    setCurrentIndex(idx)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isImages && hasMultipleImages) {
      if (event.key === 'ArrowLeft') {
        handlePrev()
      }
      if (event.key === 'ArrowRight') {
        handleNext()
      }
    }
    if (event.key === 'Escape') {
      onOpenChange(false)
    }
  }

  const handleOpenFolder = async () => {
    if (!currentPost) {
      return
    }
    try {
      await window.api.post.openFolder(currentPost.sec_uid, currentPost.folder_name)
    } catch (error) {
      console.error('Failed to open folder:', error)
    }
  }

  const handleCopyTranscription = async () => {
    if (!currentPost) {
      return
    }
    try {
      await window.api.transcription.copy(currentPost.id)
    } catch (error) {
      console.error('Failed to copy transcription:', error)
    }
  }

  const handleSelectRecommend = (nextPost: DbPost) => {
    setCurrentPost(nextPost)
    onSelectPost?.(nextPost)
  }

  if (!open || !currentPost) {
    return null
  }

  const tags = parseTags(currentPost.analysis_tags)
  const transcriptionText = currentPost.transcription_text || ''
  const transcriptionStatus = currentPost.transcription_status || 'pending'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="flex overflow-hidden rounded-2xl border border-[#E5E5E7] bg-white shadow-xl"
        style={{ width: 780, height: 520 }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="relative flex items-center justify-center bg-black" style={{ width: 380 }}>
          {loading ? (
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
          ) : media ? (
            isImages ? (
              <>
                {images.length > 0 &&
                  (currentImageVideo ? (
                    <video
                      key={currentImageVideo}
                      src={`local://${currentImageVideo}`}
                      poster={`local://${images[currentIndex]}`}
                      className="max-h-full max-w-full object-contain"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={`local://${images[currentIndex]}`}
                      alt={`图片 ${currentIndex + 1}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  ))}

                {hasMultipleImages && (
                  <>
                    <button
                      className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                      onClick={handlePrev}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                      onClick={handleNext}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
                      {images.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSelectIndex(idx)}
                          className={`h-1.5 w-1.5 rounded-full transition-colors ${
                            idx === currentIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
                          }`}
                          aria-label={`第 ${idx + 1} 张`}
                        />
                      ))}
                    </div>
                  </>
                )}

                {media.music && (
                  <>
                    <audio ref={audioRef} src={`local://${media.music}`} loop muted={isMuted} />
                    <button
                      className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                      onClick={() => {
                        const nextMuted = !isMuted
                        setIsMuted(nextMuted)
                        if (audioRef.current) {
                          audioRef.current.muted = nextMuted
                        }
                      }}
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                  </>
                )}
              </>
            ) : media.video ? (
              <video src={`local://${media.video}`} className="max-h-full max-w-full" controls autoPlay />
            ) : (
              <div className="text-center text-white">视频文件未找到</div>
            )
          ) : (
            <div className="text-center text-white">无法加载媒体文件</div>
          )}
        </div>

        <div className="flex flex-col" style={{ width: 400, padding: 20 }}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 flex-1 text-base font-medium leading-tight text-[#1D1D1F]">
              {currentPost.desc || currentPost.caption || '无标题'}
            </h3>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#F2F2F4] transition-colors hover:bg-[#E5E5E7]"
            >
              <X className="h-4 w-4 text-[#6E6E73]" />
            </button>
          </div>

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#E8F0FE] px-2.5 py-1 text-xs font-medium text-[#0A84FF]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#F2F2F4]">
                <span className="text-sm font-medium text-[#6E6E73]">
                  {currentPost.nickname?.charAt(0) || 'U'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-[#1D1D1F]">@{currentPost.nickname}</p>
                <p className="text-xs text-[#A1A1A6]">作者信息暂未提供</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-[#6E6E73]">
                <Heart className="h-4 w-4" />
                <span className="text-xs">--</span>
              </div>
              <div className="flex items-center gap-1 text-[#6E6E73]">
                <MessageCircle className="h-4 w-4" />
                <span className="text-xs">--</span>
              </div>
            </div>
          </div>

          <div className="my-4 h-px bg-[#E5E5E7]" />

          <button
            onClick={() => void handleOpenFolder()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0A84FF] text-sm font-medium text-white transition-colors hover:bg-[#0060D5]"
          >
            <Download className="h-4 w-4" />
            打开文件夹
          </button>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-medium text-[#1D1D1F]">转写内容</h4>
              <button
                onClick={() => void handleCopyTranscription()}
                disabled={!transcriptionText}
                className="flex items-center gap-1 text-xs text-[#0A84FF] disabled:text-[#A1A1A6]"
              >
                <Copy className="h-3.5 w-3.5" />
                复制全文
              </button>
            </div>
            <div className="h-28 select-text overflow-auto whitespace-pre-wrap rounded-xl border border-[#E5E5E7] bg-[#F5F5F7] p-3 text-sm text-[#1D1D1F]">
              {getTranscriptionMessage(currentPost)}
            </div>
            {!transcriptionText && transcriptionStatus === 'failed' && currentPost.transcription_error ? (
              <p className="mt-2 text-xs text-red-500">{currentPost.transcription_error}</p>
            ) : null}
          </div>

          <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
            <h4 className="mb-3 text-sm font-medium text-[#1D1D1F]">相关推荐</h4>
            <div className="space-y-2.5 overflow-auto">
              {recommendations.length > 0 ? (
                recommendations.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectRecommend(item)}
                    className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-[#F2F2F4]"
                  >
                    <div className="flex h-[70px] w-[70px] flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F2F2F4]">
                      {recommendCovers.get(item.id) ? (
                        <img
                          src={`local://${recommendCovers.get(item.id)}`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Play className="h-5 w-5 text-[#A1A1A6]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm leading-tight text-[#1D1D1F]">
                        {item.desc || item.caption || '无标题'}
                      </p>
                      <p className="mt-1 text-xs text-[#A1A1A6]">@{item.nickname}</p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="py-4 text-center text-xs text-[#A1A1A6]">暂无相关推荐</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
