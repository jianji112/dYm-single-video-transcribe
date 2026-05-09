import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Timer,
  Trash2,
  X,
  XCircle
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'

const PAGE_SIZE = 10

const statusConfig = {
  pending: { label: '待执行', icon: Clock, color: 'text-[#6E6E73]', bg: 'bg-[#F2F2F4]' },
  running: { label: '执行中', icon: Loader2, color: 'text-[#0A84FF]', bg: 'bg-[#E8F0FE]' },
  completed: {
    label: '已完成',
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50'
  },
  failed: { label: '失败', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' }
} as const

export default function DownloadPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<DbTaskWithUsers[]>([])
  const [users, setUsers] = useState<DbUser[]>([])
  const [open, setOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<DbTaskWithUsers | null>(null)
  const [taskName, setTaskName] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [concurrency, setConcurrency] = useState('3')
  const [autoSync, setAutoSync] = useState(false)
  const [syncCron, setSyncCron] = useState('')
  const [cronError, setCronError] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const [singleVideoOpen, setSingleVideoOpen] = useState(false)
  const [singleVideoUrl, setSingleVideoUrl] = useState('')
  const [singleVideoLoading, setSingleVideoLoading] = useState(false)

  useEffect(() => {
    void loadTasks()
    void loadUsers()
  }, [])

  const loadTasks = async () => {
    const data = await window.api.task.getAll()
    setTasks(data)
  }

  const loadUsers = async () => {
    const data = await window.api.user.getAll()
    setUsers(data)
  }

  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE))
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return tasks.slice(start, start + PAGE_SIZE)
  }, [tasks, currentPage])

  const generateTaskName = (userIds: number[]) => {
    if (userIds.length === 0) return ''
    const selectedUsers = users.filter((user) => userIds.includes(user.id))
    const date = new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    if (selectedUsers.length === 1) {
      return `${selectedUsers[0].nickname} - ${date}`
    }
    return `${selectedUsers[0].nickname} 等 ${selectedUsers.length} 个用户 - ${date}`
  }

  const resetTaskForm = () => {
    setEditingTask(null)
    setTaskName('')
    setSelectedUserIds([])
    setConcurrency('3')
    setAutoSync(false)
    setSyncCron('')
    setCronError('')
  }

  const handleOpenAdd = () => {
    resetTaskForm()
    setOpen(true)
  }

  const handleOpenEdit = (task: DbTaskWithUsers) => {
    setEditingTask(task)
    setTaskName(task.name)
    setSelectedUserIds(task.users.map((user) => user.id))
    setConcurrency(String(task.concurrency))
    setAutoSync(Boolean(task.auto_sync))
    setSyncCron(task.sync_cron || '')
    setCronError('')
    setOpen(true)
  }

  const handleUserToggle = (userId: number) => {
    setSelectedUserIds((prev) => {
      const next = prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      if (!editingTask) {
        setTaskName(generateTaskName(next))
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([])
      if (!editingTask) setTaskName('')
      return
    }
    const allIds = users.map((user) => user.id)
    setSelectedUserIds(allIds)
    if (!editingTask) setTaskName(generateTaskName(allIds))
  }

  const validateCron = async (expression: string) => {
    if (!expression.trim()) return true
    return window.api.sync.validateCron(expression)
  }

  const handleSave = async () => {
    if (!taskName.trim()) {
      toast.error('请输入任务名称')
      return
    }
    if (selectedUserIds.length === 0) {
      toast.error('请至少选择一个用户')
      return
    }

    if (autoSync && syncCron.trim()) {
      const valid = await validateCron(syncCron)
      if (!valid) {
        setCronError('Cron 表达式无效')
        toast.error('Cron 表达式无效')
        return
      }
    }

    setLoading(true)
    try {
      const concurrencyNum = Math.max(1, parseInt(concurrency, 10) || 3)
      if (editingTask) {
        await window.api.task.update(editingTask.id, {
          name: taskName.trim(),
          concurrency: concurrencyNum,
          auto_sync: autoSync,
          sync_cron: syncCron.trim()
        })
        await window.api.task.updateUsers(editingTask.id, selectedUserIds)
        await window.api.task.updateSchedule(editingTask.id)
        toast.success('下载任务已更新')
      } else {
        const newTask = await window.api.task.create({
          name: taskName.trim(),
          user_ids: selectedUserIds,
          concurrency: concurrencyNum,
          auto_sync: autoSync,
          sync_cron: syncCron.trim()
        })
        await window.api.task.updateSchedule(newTask.id)
        toast.success('下载任务已创建')
      }
      setOpen(false)
      resetTaskForm()
      await loadTasks()
    } catch {
      toast.error(editingTask ? '更新任务失败' : '创建任务失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await window.api.task.delete(id)
      toast.success('下载任务已删除')
      await loadTasks()
    } catch {
      toast.error('删除任务失败')
    }
  }

  const handleOpenSingleVideo = () => {
    setSingleVideoUrl('')
    setSingleVideoOpen(true)
  }

  const handleAddSingleVideo = async () => {
    if (!singleVideoUrl.trim()) {
      toast.error('请输入视频链接或分享文案')
      return
    }

    setSingleVideoLoading(true)
    try {
      const result = await window.api.singleVideo.enqueue(singleVideoUrl.trim())
      if (result.status === 'queued') {
        toast.success('已加入单视频下载队列')
      } else if (result.status === 'already-downloaded') {
        toast.info('该作品已经下载过了')
      } else {
        toast.info('该作品已经在下载队列中')
      }
      setSingleVideoOpen(false)
      setSingleVideoUrl('')
      navigate('/single-video')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '添加单视频下载失败')
    } finally {
      setSingleVideoLoading(false)
    }
  }

  const formatDate = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 flex items-center justify-between px-6 border-b border-[#E5E5E7] bg-white">
        <h1 className="text-xl font-semibold text-[#1D1D1F]">下载任务</h1>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleOpenSingleVideo}
            className="border-[#E5E5E7] text-[#1D1D1F]"
          >
            <Link2 className="mr-2 h-4 w-4" />
            添加单视频下载
          </Button>
          <Button onClick={handleOpenAdd} className="bg-[#0A84FF] hover:bg-[#0A84FF]/90 text-white">
            <Plus className="mr-2 h-4 w-4" />
            添加任务
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="overflow-hidden rounded-2xl border border-[#E5E5E7] bg-white shadow-sm">
            <div className="flex h-14 items-center justify-between border-b border-[#E5E5E7] px-5">
              <div className="flex items-center gap-3">
                <span className="text-base font-semibold text-[#1D1D1F]">任务列表</span>
                <span className="text-[13px] text-[#A1A1A6]">({tasks.length})</span>
              </div>
            </div>

            <div className="flex h-12 items-center bg-[#F5F5F7] px-5 text-[12px] font-semibold uppercase tracking-wide text-[#6E6E73]">
              <div className="w-[260px]">任务名称</div>
              <div className="flex-1">用户</div>
              <div className="w-24 text-center">状态</div>
              <div className="w-32 text-center">定时同步</div>
              <div className="w-32 text-center">创建时间</div>
              <div className="w-32 text-right">操作</div>
            </div>

            {paginatedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#6E6E73]">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F2F2F4]">
                  <Download className="h-8 w-8 text-[#A1A1A6]" />
                </div>
                <p className="text-base font-medium">暂无下载任务</p>
                <p className="mt-1 text-sm text-[#A1A1A6]">
                  可以创建批量下载任务，或直接添加单视频下载。
                </p>
              </div>
            ) : (
              paginatedTasks.map((task) => {
                const status = statusConfig[task.status]
                const StatusIcon = status.icon
                return (
                  <div
                    key={task.id}
                    className="group flex h-[68px] items-center border-b border-[#E5E5E7] px-5 transition-colors hover:bg-[#F2F2F4]/50"
                  >
                    <div className="flex w-[260px] items-center gap-3">
                      <FileText className="h-5 w-5 text-[#A1A1A6]" />
                      <span className="truncate font-medium text-[#1D1D1F]">{task.name}</span>
                    </div>

                    <div className="flex flex-1 items-center gap-2">
                      <div className="flex -space-x-2">
                        {task.users.slice(0, 3).map((user) => (
                          <Avatar key={user.id} className="h-7 w-7 border-2 border-white">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="bg-[#E8F0FE] text-xs text-[#0A84FF]">
                              {user.nickname?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      {task.users.length > 3 && (
                        <span className="text-xs text-[#A1A1A6]">+{task.users.length - 3}</span>
                      )}
                      <span className="ml-1 text-sm text-[#6E6E73]">{task.users.length} 个用户</span>
                    </div>

                    <div className="flex w-24 justify-center">
                      <Badge className={`gap-1 border-0 ${status.bg} ${status.color}`}>
                        <StatusIcon
                          className={`h-3 w-3 ${task.status === 'running' ? 'animate-spin' : ''}`}
                        />
                        {status.label}
                      </Badge>
                    </div>

                    <div className="flex w-32 flex-col items-center gap-0.5">
                      {task.auto_sync && task.sync_cron ? (
                        <>
                          <Badge
                            variant="outline"
                            className="gap-1 border-green-500 text-xs text-green-600"
                          >
                            <Timer className="h-3 w-3" />
                            已开启
                          </Badge>
                          <span className="font-mono text-xs text-[#A1A1A6]">{task.sync_cron}</span>
                        </>
                      ) : (
                        <span className="text-xs text-[#A1A1A6]">未设置</span>
                      )}
                    </div>

                    <div className="w-32 text-center text-sm text-[#6E6E73]">
                      {formatDate(task.created_at)}
                    </div>

                    <div className="flex w-32 justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#6E6E73] hover:text-[#1D1D1F]"
                        onClick={() => navigate(`/download/${task.id}`)}
                        title="查看详情"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#6E6E73] hover:text-[#1D1D1F]"
                        onClick={() => handleOpenEdit(task)}
                        title="编辑任务"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#6E6E73] hover:text-red-500"
                        onClick={() => handleDelete(task.id)}
                        title="删除任务"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}

            {tasks.length > PAGE_SIZE && (
              <div className="flex h-14 items-center justify-between border-t border-[#E5E5E7] px-5">
                <span className="text-sm text-[#6E6E73]">
                  第 {currentPage} / {totalPages} 页，共 {tasks.length} 条
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="border-[#E5E5E7]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="border-[#E5E5E7]"
                  >
                    下一页
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={singleVideoOpen} onOpenChange={setSingleVideoOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-[520px]" showCloseButton={false}>
          <div className="flex h-[60px] items-center justify-between border-b border-[#E5E5E7] px-6">
            <h2 className="text-lg font-semibold text-[#1D1D1F]">添加单视频下载</h2>
            <button
              onClick={() => setSingleVideoOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#F2F2F4]"
            >
              <X className="h-5 w-5 text-[#A1A1A6]" />
            </button>
          </div>

          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#1D1D1F]">视频链接或分享文案</Label>
              <textarea
                value={singleVideoUrl}
                onChange={(event) => setSingleVideoUrl(event.target.value)}
                placeholder="粘贴 douyin 链接，或整段分享文案"
                disabled={singleVideoLoading}
                rows={5}
                className="w-full resize-none rounded-lg border border-[#E5E5E7] bg-[#F5F5F7] px-3 py-3 text-sm text-[#1D1D1F] transition-colors focus:outline-none focus-visible:border-[#0A84FF] focus-visible:ring-2 focus-visible:ring-[#0A84FF]/20"
              />
            </div>
            <p className="text-xs text-[#A1A1A6]">
              支持短链、作品直链、精选页链接，以及包含链接的抖音分享文案。
            </p>
          </div>

          <DialogFooter className="flex h-[72px] items-center justify-end gap-3 border-t border-[#E5E5E7] px-6">
            <Button
              variant="outline"
              onClick={() => setSingleVideoOpen(false)}
              disabled={singleVideoLoading}
              className="h-10 border-[#E5E5E7] px-5"
            >
              取消
            </Button>
            <Button
              onClick={handleAddSingleVideo}
              disabled={singleVideoLoading || !singleVideoUrl.trim()}
              className="h-10 bg-[#0A84FF] px-5 text-white hover:bg-[#0A84FF]/90"
            >
              {singleVideoLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  添加中...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  加入队列
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-[520px]" showCloseButton={false}>
          <div className="flex h-[60px] items-center justify-between border-b border-[#E5E5E7] px-6">
            <h2 className="text-lg font-semibold text-[#1D1D1F]">
              {editingTask ? '编辑下载任务' : '添加下载任务'}
            </h2>
            <button
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#F2F2F4]"
            >
              <X className="h-5 w-5 text-[#A1A1A6]" />
            </button>
          </div>

          <div className="space-y-5 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#1D1D1F]">任务名称</Label>
                <Input
                  value={taskName}
                  onChange={(event) => setTaskName(event.target.value)}
                  placeholder="输入任务名称"
                  disabled={loading}
                  className="h-10 border-[#E5E5E7]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#1D1D1F]">并发数</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={concurrency}
                  onChange={(event) => setConcurrency(event.target.value)}
                  placeholder="3"
                  disabled={loading}
                  className="h-10 border-[#E5E5E7]"
                />
                <p className="text-xs text-[#A1A1A6]">同时下载的用户数</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-[#1D1D1F]">选择用户</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={loading}
                  className="text-[#6E6E73] hover:text-[#1D1D1F]"
                >
                  {selectedUserIds.length === users.length ? '取消全选' : '全选'}
                </Button>
              </div>
              <ScrollArea className="h-48 rounded-lg border border-[#E5E5E7]">
                <div className="space-y-1 p-2">
                  {users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-[#6E6E73]">
                      <p className="text-sm">暂无用户</p>
                      <p className="mt-1 text-xs text-[#A1A1A6]">请先在用户管理中添加用户</p>
                    </div>
                  ) : (
                    users.map((user) => (
                      <div
                        key={user.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[#F2F2F4]"
                        onClick={() => handleUserToggle(user.id)}
                      >
                        <Checkbox
                          checked={selectedUserIds.includes(user.id)}
                          onCheckedChange={() => handleUserToggle(user.id)}
                          disabled={loading}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback className="bg-[#E8F0FE] text-[#0A84FF]">
                            {user.nickname?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#1D1D1F]">
                            {user.nickname}
                          </p>
                          <p className="text-xs text-[#A1A1A6]">{user.aweme_count} 个作品</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <p className="text-xs text-[#A1A1A6]">已选择 {selectedUserIds.length} 个用户</p>
            </div>

            <div className="space-y-4 rounded-lg border border-[#E5E5E7] bg-[#F2F2F4]/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-[#1D1D1F]">定时同步</Label>
                  <p className="text-xs text-[#A1A1A6]">按计划自动执行这个下载任务</p>
                </div>
                <Switch checked={autoSync} onCheckedChange={setAutoSync} disabled={loading} />
              </div>
              {autoSync && (
                <div className="space-y-2 border-t border-[#E5E5E7] pt-3">
                  <Label className="text-sm font-medium text-[#1D1D1F]">Cron 表达式</Label>
                  <Input
                    value={syncCron}
                    onChange={(event) => {
                      setSyncCron(event.target.value)
                      setCronError('')
                    }}
                    placeholder="0 2 * * *"
                    disabled={loading}
                    className={`h-10 border-[#E5E5E7] ${cronError ? 'border-red-500' : ''}`}
                  />
                  {cronError && <p className="text-xs text-red-500">{cronError}</p>}
                  <div className="space-y-1 text-xs text-[#A1A1A6]">
                    <p>常用示例：</p>
                    <p className="font-mono">0 2 * * * - 每天凌晨 2:00</p>
                    <p className="font-mono">0 */6 * * * - 每 6 小时一次</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex h-[72px] items-center justify-end gap-3 border-t border-[#E5E5E7] px-6">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="h-10 border-[#E5E5E7] px-5"
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !taskName.trim() || selectedUserIds.length === 0}
              className="h-10 bg-[#0A84FF] px-5 text-white hover:bg-[#0A84FF]/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  {editingTask ? '保存' : '创建'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
