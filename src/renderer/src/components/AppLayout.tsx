import { useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Download,
  HardDrive,
  Home,
  LayoutGrid,
  Link2,
  Mic,
  ScrollText,
  Settings,
  Sparkles,
  Users
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/', label: '数据概览', icon: Home },
  { path: '/browse', label: '视频浏览', icon: LayoutGrid },
  { path: '/users', label: '用户管理', icon: Users },
  { path: '/download', label: '下载任务', icon: Download },
  { path: '/single-video', label: '单视频下载', icon: Link2 },
  { path: '/transcriptions', label: '音频转写', icon: Mic },
  { path: '/files', label: '文件管理', icon: HardDrive },
  { path: '/analysis', label: '视频分析', icon: Sparkles },
  { path: '/logs', label: '同步日志', icon: ScrollText },
  { path: '/settings', label: '系统设置', icon: Settings }
]

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const addUserFromLink = async (link: string) => {
      try {
        const { user, isNewUser, postDownload } = await window.api.user.add(link)
        const prefix = isNewUser ? `已添加用户 ${user.nickname}` : `用户 ${user.nickname} 已存在`

        if (postDownload.status === 'downloading') {
          toast.success(`${prefix}，正在后台下载该作品`)
        } else if (postDownload.status === 'already-downloaded') {
          toast.success(`${prefix}，该作品已下载过`)
        } else if (isNewUser) {
          toast.success(prefix)
        } else {
          toast.info(prefix)
        }

        navigate('/users')
      } catch (error) {
        toast.error(`添加失败: ${(error as Error).message}`)
      }
    }

    const enqueueSingleVideo = async (link: string) => {
      try {
        const result = await window.api.singleVideo.enqueue(link)
        if (result.status === 'already-downloaded') {
          toast.info('该作品已存在，无需重复下载')
        } else if (result.status === 'already-queued') {
          toast.info('该作品已在下载队列中')
        } else {
          toast.success('已加入单视频下载队列')
        }
        navigate('/single-video')
      } catch (error) {
        toast.error(`加入下载队列失败: ${(error as Error).message}`)
      }
    }

    const unsubscribe = window.api.clipboard.onDouyinLink((link) => {
      void (async () => {
        try {
          const parsed = await window.api.douyin.parseUrl(link)
          if (parsed.type === 'user') {
            toast('检测到抖音用户链接', {
              description: link.length > 56 ? `${link.slice(0, 56)}...` : link,
              duration: 8000,
              action: {
                label: '添加用户',
                onClick: () => {
                  void addUserFromLink(link)
                }
              }
            })
            return
          }

          if (parsed.type !== 'video') {
            return
          }

          const clipboardAction =
            (await window.api.settings.get('single_video_clipboard_action')) || 'confirm'
          if (clipboardAction === 'off') {
            return
          }

          if (clipboardAction === 'auto') {
            void enqueueSingleVideo(link)
            return
          }

          toast('检测到抖音视频链接', {
            description: link.length > 56 ? `${link.slice(0, 56)}...` : link,
            duration: 8000,
            action: {
              label: '加入下载',
              onClick: () => {
                void enqueueSingleVideo(link)
              }
            }
          })
        } catch (error) {
          console.error('Failed to handle clipboard link:', error)
        }
      })()
    })

    return unsubscribe
  }, [navigate])

  useEffect(() => {
    return window.api.user.onAddPostProgress((progress) => {
      if (progress.status === 'success') {
        toast.success(`作品下载完成: ${progress.nickname}`)
      } else if (progress.status === 'failed') {
        toast.error(`作品下载失败: ${progress.nickname} - ${progress.error || '未知错误'}`)
      }
    })
  }, [])

  useEffect(() => {
    return window.api.singleVideo.onProgress((progress) => {
      if (progress.status === 'completed') {
        toast.success(`单视频下载完成: ${progress.awemeId}`)
      } else if (progress.status === 'failed') {
        toast.error(`单视频下载失败: ${progress.error || progress.message}`)
      }
    })
  }, [])

  useEffect(() => {
    return window.api.transcription.onProgress((progress) => {
      if (progress.status === 'completed') {
        toast.success('音频转写完成')
      } else if (progress.status === 'failed') {
        toast.error(`音频转写失败: ${progress.error || progress.message}`)
      }
    })
  }, [])

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="flex h-screen bg-[#F5F5F7]">
      <aside className="flex w-60 flex-shrink-0 flex-col border-r border-[#E5E5E7] bg-white">
        <div className="flex h-[72px] items-center gap-3 border-b border-[#E5E5E7] px-6">
          <Download className="h-7 w-7 text-[#0A84FF]" />
          <span className="text-lg font-semibold text-[#1D1D1F]">dYm</span>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          <span className="block px-4 py-2 text-[11px] font-medium tracking-wide text-[#A1A1A6]">
            菜单
          </span>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex h-12 items-center gap-3 rounded-lg px-4 transition-colors',
                  active
                    ? 'bg-[#E8F0FE] font-medium text-[#1D1D1F]'
                    : 'text-[#6E6E73] hover:bg-[#F2F2F4]'
                )}
              >
                <Icon className={cn('h-5 w-5', active ? 'text-[#0A84FF]' : 'text-[#6E6E73]')} />
                <span className="text-sm">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
