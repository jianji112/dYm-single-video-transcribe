import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Copy,
  FileDown,
  FolderOpen,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Search
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待转写' },
  { value: 'processing', label: '转写中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' }
] as const

const statusLabelMap: Record<NonNullable<DbPost['transcription_status']>, string> = {
  pending: '待转写',
  processing: '转写中',
  completed: '已完成',
  failed: '失败'
}

const statusClassMap: Record<NonNullable<DbPost['transcription_status']>, string> = {
  pending: 'bg-[#F2F2F4] text-[#6E6E73]',
  processing: 'bg-[#E8F0FE] text-[#0A84FF]',
  completed: 'bg-green-50 text-green-600',
  failed: 'bg-red-50 text-red-600'
}

function formatTime(timestamp: number | null): string {
  if (!timestamp) {
    return '-'
  }

  return new Date(timestamp * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getPreviewText(post: DbPost): string {
  if (post.transcription_text) {
    return post.transcription_text
  }
  if (post.transcription_status === 'failed') {
    return post.transcription_error || '转写失败，可重试'
  }
  if (post.transcription_status === 'processing') {
    return '正在转写中...'
  }
  return '还没有转写文本'
}

export default function TranscriptionPage() {
  const [posts, setPosts] = useState<DbPost[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<(typeof statusOptions)[number]['value']>('all')
  const [loading, setLoading] = useState(true)

  const loadPosts = async () => {
    setLoading(true)
    try {
      const data = await window.api.transcription.list()
      setPosts(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPosts()
    return window.api.transcription.onProgress(() => {
      void loadPosts()
    })
  }, [])

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesStatus =
        statusFilter === 'all' ? true : post.transcription_status === statusFilter
      const searchText = `${post.nickname} ${post.desc} ${post.caption} ${
        post.transcription_text || ''
      }`.toLowerCase()
      const matchesKeyword = keyword.trim()
        ? searchText.includes(keyword.trim().toLowerCase())
        : true
      return matchesStatus && matchesKeyword
    })
  }, [keyword, posts, statusFilter])

  const toggleSelected = (postId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) {
        next.delete(postId)
      } else {
        next.add(postId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    const currentIds = filteredPosts.map((post) => post.id)
    const allSelected = currentIds.length > 0 && currentIds.every((id) => selectedIds.has(id))

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        currentIds.forEach((id) => next.delete(id))
      } else {
        currentIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const startSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error('请先选择要转写的作品')
      return
    }

    await window.api.transcription.start(Array.from(selectedIds))
    toast.success(`已加入 ${selectedIds.size} 个转写任务`)
  }

  const startOne = async (postId: number) => {
    await window.api.transcription.start([postId])
    toast.success('已加入转写队列')
  }

  const retryOne = async (postId: number) => {
    await window.api.transcription.retry(postId)
    toast.success('已重新加入转写队列')
  }

  const copyFullText = async (postId: number) => {
    try {
      await window.api.transcription.copy(postId)
      toast.success('已复制全文')
    } catch (error) {
      toast.error(`复制失败: ${(error as Error).message}`)
    }
  }

  const exportText = async (postId: number) => {
    try {
      const filePath = await window.api.transcription.export(postId)
      toast.success(`已导出文本: ${filePath}`)
    } catch (error) {
      toast.error(`导出失败: ${(error as Error).message}`)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-16 items-center justify-between border-b border-[#E5E5E7] bg-white px-6">
        <div>
          <h1 className="text-xl font-semibold text-[#1D1D1F]">音频转写</h1>
          <p className="mt-0.5 text-sm text-[#6E6E73]">
            查看已下载视频的转写状态，支持手动补转和失败重试
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadPosts()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button onClick={() => void startSelected()} className="bg-[#0A84FF] text-white">
            <Play className="mr-2 h-4 w-4" />
            转写选中
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Card className="border-[#E5E5E7] bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1A6]" />
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索作者、标题或转写内容"
                  className="h-11 pl-9"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as (typeof statusOptions)[number]['value'])
                }
                className="h-11 rounded-lg border border-[#E5E5E7] bg-white px-3 text-sm text-[#1D1D1F]"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          <div className="space-y-3">
            {loading ? (
              <Card className="border-[#E5E5E7] bg-white p-10 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#0A84FF]" />
              </Card>
            ) : filteredPosts.length === 0 ? (
              <Card className="border-[#E5E5E7] bg-white p-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F2F2F4]">
                  <Mic className="h-8 w-8 text-[#A1A1A6]" />
                </div>
                <h2 className="text-lg font-semibold text-[#1D1D1F]">暂无可显示的转写记录</h2>
                <p className="mt-2 text-sm text-[#6E6E73]">
                  下载视频后，这里会显示转写状态和文本内容
                </p>
              </Card>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-[#6E6E73]">
                  <Checkbox
                    checked={
                      filteredPosts.length > 0 &&
                      filteredPosts.every((post) => selectedIds.has(post.id))
                    }
                    onCheckedChange={() => toggleSelectAll()}
                  />
                  <span>全选当前结果 ({filteredPosts.length})</span>
                </div>

                {filteredPosts.map((post) => {
                  const status = post.transcription_status || 'pending'

                  return (
                    <Card
                      key={post.id}
                      className="flex items-start gap-4 border-[#E5E5E7] bg-white px-5 py-4"
                    >
                      <div className="pt-1">
                        <Checkbox
                          checked={selectedIds.has(post.id)}
                          onCheckedChange={() => toggleSelected(post.id)}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <Badge className={statusClassMap[status]}>{statusLabelMap[status]}</Badge>
                          <span className="text-xs text-[#A1A1A6]">
                            最近转写: {formatTime(post.transcribed_at)}
                          </span>
                        </div>

                        <p className="line-clamp-2 text-sm font-medium text-[#1D1D1F]">
                          {post.desc || post.caption || post.aweme_id}
                        </p>
                        <p className="mt-1 text-xs text-[#6E6E73]">@{post.nickname}</p>
                        {post.transcription_error ? (
                          <p className="mt-2 text-xs text-red-500">{post.transcription_error}</p>
                        ) : null}
                        <div className="mt-3 min-h-20 select-text whitespace-pre-wrap rounded-xl bg-[#F5F5F7] p-3 text-sm text-[#1D1D1F]">
                          {getPreviewText(post)}
                        </div>
                      </div>

                      <div className="flex flex-shrink-0 flex-col gap-2">
                        <Button variant="outline" size="sm" onClick={() => void startOne(post.id)}>
                          <Play className="mr-2 h-4 w-4" />
                          转写
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void retryOne(post.id)}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          重试
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void copyFullText(post.id)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          复制全文
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void exportText(post.id)}
                        >
                          <FileDown className="mr-2 h-4 w-4" />
                          导出文本
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void window.api.post.openFolder(post.sec_uid, post.folder_name)}
                        >
                          <FolderOpen className="mr-2 h-4 w-4" />
                          打开目录
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
