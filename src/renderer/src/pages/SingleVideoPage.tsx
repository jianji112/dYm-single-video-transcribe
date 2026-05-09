import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  CircleDashed,
  FolderOpen,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  XCircle
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const statusConfig = {
  pending: {
    label: '排队中',
    icon: CircleDashed,
    className: 'bg-[#F2F2F4] text-[#6E6E73]'
  },
  processing: {
    label: '下载中',
    icon: Loader2,
    className: 'bg-[#E8F0FE] text-[#0A84FF]'
  },
  completed: {
    label: '已完成',
    icon: CheckCircle2,
    className: 'bg-green-50 text-green-600'
  },
  failed: {
    label: '失败',
    icon: XCircle,
    className: 'bg-red-50 text-red-600'
  }
} satisfies Record<
  SingleVideoTask['status'],
  { label: string; icon: typeof Loader2; className: string }
>

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function SingleVideoPage() {
  const [tasks, setTasks] = useState<SingleVideoTask[]>([])
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all' | SingleVideoTask['status']>('all')

  const loadTasks = async () => {
    const data = await window.api.singleVideo.list()
    setTasks(data)
  }

  useEffect(() => {
    void loadTasks()
    return window.api.singleVideo.onProgress(() => {
      void loadTasks()
    })
  }, [])

  const filteredTasks = useMemo(() => {
    if (filter === 'all') {
      return tasks
    }
    return tasks.filter((task) => task.status === filter)
  }, [filter, tasks])

  const handleSubmit = async () => {
    if (!url.trim()) {
      toast.error('请输入抖音视频链接或分享文案')
      return
    }

    setSubmitting(true)
    try {
      const result = await window.api.singleVideo.enqueue(url.trim())
      if (result.status === 'already-downloaded') {
        toast.info('该作品已存在，无需重复下载')
      } else if (result.status === 'already-queued') {
        toast.info('该作品已在下载队列中')
      } else {
        toast.success('已加入下载队列')
      }
      setUrl('')
      await loadTasks()
    } catch (error) {
      toast.error(`加入下载队列失败: ${(error as Error).message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const openTaskFolder = async (task: SingleVideoTask) => {
    if (!task.post_id) {
      toast.info('该任务还没有可打开的下载目录')
      return
    }

    const post = await window.api.db.queryOne<{ sec_uid: string; folder_name: string }>(
      'SELECT sec_uid, folder_name FROM posts WHERE id = ?',
      [task.post_id]
    )
    if (!post) {
      toast.error('未找到对应作品记录')
      return
    }

    await window.api.post.openFolder(post.sec_uid, post.folder_name)
  }

  const handleRetry = async (taskId: number) => {
    try {
      await window.api.singleVideo.retry(taskId)
      toast.success('已重新加入下载队列')
      await loadTasks()
    } catch (error) {
      toast.error(`重试失败: ${(error as Error).message}`)
    }
  }

  const handleRemove = async (taskId: number) => {
    try {
      await window.api.singleVideo.remove(taskId)
      await loadTasks()
    } catch (error) {
      toast.error(`删除任务失败: ${(error as Error).message}`)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-16 items-center justify-between border-b border-[#E5E5E7] bg-white px-6">
        <div>
          <h1 className="text-xl font-semibold text-[#1D1D1F]">单视频下载</h1>
          <p className="mt-0.5 text-sm text-[#6E6E73]">
            支持手动粘贴、剪贴板识别、查看队列状态和失败重试
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | SingleVideoTask['status'])}
            className="h-10 rounded-lg border border-[#E5E5E7] bg-white px-3 text-sm text-[#1D1D1F]"
          >
            <option value="all">全部状态</option>
            <option value="pending">排队中</option>
            <option value="processing">下载中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
          </select>
          <Button variant="outline" onClick={() => void loadTasks()}>
            刷新
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Card className="border-[#E5E5E7] bg-white p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <p className="mb-2 text-sm font-medium text-[#1D1D1F]">添加单视频任务</p>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="粘贴抖音视频链接、分享口令或 jingxuan?modal_id 链接"
                  className="h-11"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleSubmit()
                    }
                  }}
                />
              </div>
              <Button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="h-11 bg-[#0A84FF] px-5 text-white hover:bg-[#0060D5]"
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                加入队列
              </Button>
            </div>
          </Card>

          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <Card className="border-[#E5E5E7] bg-white p-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F2F2F4]">
                  <Link2 className="h-8 w-8 text-[#A1A1A6]" />
                </div>
                <h2 className="text-lg font-semibold text-[#1D1D1F]">暂无单视频任务</h2>
                <p className="mt-2 text-sm text-[#6E6E73]">
                  从上方粘贴一个抖音视频链接即可开始下载
                </p>
              </Card>
            ) : (
              filteredTasks.map((task) => {
                const status = statusConfig[task.status]
                const Icon = status.icon

                return (
                  <Card
                    key={task.id}
                    className="flex items-start justify-between gap-4 border-[#E5E5E7] bg-white px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <Badge className={status.className}>
                          <Icon
                            className={cn(
                              'mr-1 h-3.5 w-3.5',
                              task.status === 'processing' ? 'animate-spin' : ''
                            )}
                          />
                          {status.label}
                        </Badge>
                        <span className="text-xs text-[#A1A1A6]">{formatTime(task.created_at)}</span>
                      </div>

                      <p className="line-clamp-2 text-sm font-medium text-[#1D1D1F]">
                        {task.desc || task.aweme_id}
                      </p>
                      <div className="mt-1 space-y-1 text-xs text-[#6E6E73]">
                        <p>@{task.nickname || '未知作者'}</p>
                        <p className="truncate">{task.source_url}</p>
                        {task.error ? <p className="text-red-500">{task.error}</p> : null}
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void openTaskFolder(task)}
                        disabled={!task.post_id}
                      >
                        <FolderOpen className="mr-2 h-4 w-4" />
                        打开目录
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRetry(task.id)}
                        disabled={task.status === 'processing'}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        重试
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRemove(task.id)}
                        disabled={task.status === 'processing'}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
