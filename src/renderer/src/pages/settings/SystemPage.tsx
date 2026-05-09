import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  Loader2,
  Chrome,
  CheckCircle,
  Download,
  RefreshCw,
  FolderSync,
  FolderOpen,
  Database,
  X
} from 'lucide-react'

const CURRENT_REPO_URL = 'https://github.com/jianji112/dYm-single-video-transcribe'
const CURRENT_REPO_NAME = 'jianji112/dYm-single-video-transcribe'
const UPSTREAM_REPO_URL = 'https://github.com/Everless321/dYm'
const UPSTREAM_REPO_NAME = 'Everless321/dYm'

export default function SystemPage() {
  // Cookie
  const [cookie, setCookie] = useState('')
  const [fetchingCookie, setFetchingCookie] = useState(false)

  // API
  const [apiKey, setApiKey] = useState('')
  const [apiUrl, setApiUrl] = useState('https://api.x.ai/v1')
  const [verifyingApi, setVerifyingApi] = useState(false)

  // 下载
  const [downloadPath, setDownloadPath] = useState('')
  const [maxDownloadCount, setMaxDownloadCount] = useState('0')
  const [videoDownloadConcurrency, setVideoDownloadConcurrency] = useState('3')
  const [convertToJpg, setConvertToJpg] = useState(false)
  const [downloadPostOnAddUser, setDownloadPostOnAddUser] = useState(true)
  const [singleVideoAddUser, setSingleVideoAddUser] = useState(false)
  const [singleVideoClipboardAction, setSingleVideoClipboardAction] = useState('confirm')
  const [singleVideoAutoTranscribe, setSingleVideoAutoTranscribe] = useState(true)
  const originalDownloadPath = useRef('')

  // 迁移
  const [showMigrationDialog, setShowMigrationDialog] = useState(false)
  const [migrationCount, setMigrationCount] = useState(0)
  const [pendingNewPath, setPendingNewPath] = useState('')
  const [pendingOldPath, setPendingOldPath] = useState('')
  const [migrating, setMigrating] = useState(false)

  // 分析
  const [analysisConcurrency, setAnalysisConcurrency] = useState('2')
  const [analysisRpm, setAnalysisRpm] = useState('10')
  const [analysisModel, setAnalysisModel] = useState('grok-4-fast')
  const [analysisSlices, setAnalysisSlices] = useState('4')
  const [analysisPrompt, setAnalysisPrompt] = useState('')
  const [siliconflowApiKey, setSiliconflowApiKey] = useState('')
  const [transcriptionApiUrl, setTranscriptionApiUrl] = useState(
    'https://api.siliconflow.cn/v1/audio/transcriptions'
  )
  const [transcriptionModel, setTranscriptionModel] = useState('FunAudioLLM/SenseVoiceSmall')

  // 更新
  const [currentVersion, setCurrentVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  useEffect(() => {
    loadSettings()
    loadVersion()

    const unsubscribe = window.api.updater.onStatus((status) => {
      setUpdateStatus(status)
      if (status.status === 'error') {
        toast.error(`更新失败: ${status.error}`)
      } else if (status.status === 'downloaded') {
        toast.success('更新已下载，重启应用即可安装')
      }
    })

    return () => unsubscribe()
  }, [])

  const loadVersion = async () => {
    try {
      const version = await window.api.updater.getCurrentVersion()
      setCurrentVersion(version)
    } catch {
      setCurrentVersion('未知')
    }
  }

  const loadSettings = async () => {
    const settings = await window.api.settings.getAll()
    setCookie(settings.douyin_cookie || '')
    setApiKey(settings.grok_api_key || '')
    setApiUrl(settings.grok_api_url || 'https://api.x.ai/v1')
    const savedPath = settings.download_path || ''
    setDownloadPath(savedPath)
    originalDownloadPath.current = savedPath
    setMaxDownloadCount(settings.max_download_count || '0')
    setVideoDownloadConcurrency(settings.video_download_concurrency || '3')
    setConvertToJpg(settings.convert_images_to_jpg === 'true')
    setDownloadPostOnAddUser(settings.download_post_on_add_user !== 'false')
    setSingleVideoAddUser(settings.single_video_add_user === 'true')
    setSingleVideoClipboardAction(settings.single_video_clipboard_action || 'confirm')
    setSingleVideoAutoTranscribe(settings.single_video_auto_transcribe !== 'false')
    setAnalysisConcurrency(settings.analysis_concurrency || '2')
    setAnalysisRpm(settings.analysis_rpm || '10')
    setAnalysisModel(settings.analysis_model || 'grok-4-fast')
    setAnalysisSlices(settings.analysis_slices || '4')
    setAnalysisPrompt(settings.analysis_prompt || '')
    setSiliconflowApiKey(settings.siliconflow_api_key || '')
    setTranscriptionApiUrl(
      settings.transcription_api_url || 'https://api.siliconflow.cn/v1/audio/transcriptions'
    )
    setTranscriptionModel(settings.transcription_model || 'FunAudioLLM/SenseVoiceSmall')
  }

  // Cookie handlers
  const handleFetchCookie = async () => {
    setFetchingCookie(true)
    try {
      const result = await window.api.cookie.fetchDouyin()
      setCookie(result)
      if (result) {
        toast.success('Cookie 获取成功')
      } else {
        toast.warning('未获取到 Cookie，请确保已登录')
      }
    } catch {
      toast.error('获取 Cookie 失败')
    } finally {
      setFetchingCookie(false)
    }
  }

  const handleSaveCookie = async () => {
    try {
      await window.api.settings.set('douyin_cookie', cookie)
      toast.success('Cookie 已保存')
    } catch {
      toast.error('保存失败')
    }
  }

  // API handlers
  const handleSaveApi = async () => {
    try {
      await window.api.settings.set('grok_api_key', apiKey)
      await window.api.settings.set('grok_api_url', apiUrl)
      toast.success('API 设置已保存')
    } catch {
      toast.error('保存失败')
    }
  }

  const handleVerifyApi = async () => {
    if (!apiKey) {
      toast.error('请先输入 API Key')
      return
    }
    setVerifyingApi(true)
    try {
      await window.api.grok.verify(apiKey, apiUrl, analysisModel)
      toast.success('API Key 验证成功')
    } catch (error) {
      toast.error(`验证失败: ${(error as Error).message}`)
    } finally {
      setVerifyingApi(false)
    }
  }

  // Download handlers
  const handleSaveDownload = async () => {
    try {
      const oldPath =
        originalDownloadPath.current || (await window.api.settings.getDefaultDownloadPath())
      const newPath = downloadPath

      if (newPath && oldPath !== newPath) {
        const count = await window.api.migration.getCount(oldPath)
        if (count > 0) {
          setMigrationCount(count)
          setPendingOldPath(oldPath)
          setPendingNewPath(newPath)
          setShowMigrationDialog(true)
          return
        }
      }

      await saveDownloadSettings()
    } catch {
      toast.error('保存失败')
    }
  }

  const saveDownloadSettings = async () => {
    await window.api.settings.set('download_path', downloadPath)
    await window.api.settings.set('max_download_count', maxDownloadCount)
    await window.api.settings.set('video_download_concurrency', videoDownloadConcurrency)
    await window.api.settings.set('convert_images_to_jpg', convertToJpg ? 'true' : 'false')
    await window.api.settings.set(
      'download_post_on_add_user',
      downloadPostOnAddUser ? 'true' : 'false'
    )
    originalDownloadPath.current = downloadPath
    toast.success('下载设置已保存')
  }

  const handleMigrate = async () => {
    setMigrating(true)
    try {
      const result = await window.api.migration.execute(pendingOldPath, pendingNewPath)

      await saveDownloadSettings()
      setShowMigrationDialog(false)

      if (result.failed > 0) {
        toast.warning(`迁移完成: 成功 ${result.success} 个，失败 ${result.failed} 个`)
      } else {
        toast.success(`迁移完成: 已迁移 ${result.success} 个文件夹`)
      }
    } catch (error) {
      toast.error(`迁移失败: ${(error as Error).message}`)
    } finally {
      setMigrating(false)
    }
  }

  const handleSkipMigration = async () => {
    setShowMigrationDialog(false)
    await saveDownloadSettings()
  }

  // Analysis handlers
  const handleSaveAnalysis = async () => {
    try {
      await window.api.settings.set('analysis_concurrency', analysisConcurrency)
      await window.api.settings.set('analysis_rpm', analysisRpm)
      await window.api.settings.set('analysis_model', analysisModel)
      await window.api.settings.set('analysis_slices', analysisSlices)
      await window.api.settings.set('analysis_prompt', analysisPrompt)
      toast.success('分析设置已保存')
    } catch {
      toast.error('保存失败')
    }
  }

  const handleSaveTranscription = async () => {
    try {
      await window.api.settings.set('single_video_add_user', singleVideoAddUser ? 'true' : 'false')
      await window.api.settings.set('single_video_clipboard_action', singleVideoClipboardAction)
      await window.api.settings.set(
        'single_video_auto_transcribe',
        singleVideoAutoTranscribe ? 'true' : 'false'
      )
      await window.api.settings.set('siliconflow_api_key', siliconflowApiKey)
      await window.api.settings.set('transcription_api_url', transcriptionApiUrl)
      await window.api.settings.set('transcription_model', transcriptionModel)
      toast.success('单视频与转写设置已保存')
    } catch {
      toast.error('保存失败')
    }
  }

  const handleClearData = async () => {
    if (window.confirm('确定要清除所有数据吗？此操作不可恢复。')) {
      toast.success('数据已清除')
    }
  }

  // Update handlers
  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    try {
      const info = await window.api.updater.check()
      if (info) {
        toast.success(`发现新版本: v${info.version}`)
      } else {
        toast.info('当前已是最新版本')
      }
    } catch (error) {
      toast.error(`检查更新失败: ${(error as Error).message}`)
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleDownloadUpdate = async () => {
    try {
      await window.api.updater.download()
      toast.info('开始下载更新...')
    } catch (error) {
      toast.error(`下载失败: ${(error as Error).message}`)
    }
  }

  const handleInstallUpdate = () => {
    window.api.updater.install()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-16 flex items-center px-6 border-b border-[#E5E5E7] bg-white flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-[#1D1D1F]">系统设置</h1>
          <p className="text-sm text-[#6E6E73] mt-0.5">下载、分析与更新的全局配置</p>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-[#6E6E73] uppercase tracking-widest">
                基础配置
              </p>
              <h2 className="text-lg font-semibold text-[#1D1D1F] mt-1">账号与接口</h2>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Cookie Card */}
              <div className="bg-white rounded-2xl border border-[#E5E5E7] shadow-sm p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-[#1D1D1F]">抖音 Cookie</h2>
                    <p className="text-xs text-[#A1A1A6]">设置抖音登录 Cookie 用于获取视频数据</p>
                  </div>
                  <button
                    onClick={handleFetchCookie}
                    disabled={fetchingCookie}
                    className="h-9 px-4 rounded-lg border border-[#E5E5E7] text-sm text-[#1D1D1F] hover:bg-[#F2F2F4] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto"
                  >
                    {fetchingCookie ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Chrome className="h-4 w-4" />
                    )}
                    从浏览器获取
                  </button>
                </div>

                <div className="space-y-3 mt-4">
                  <textarea
                    value={cookie}
                    onChange={(e) => setCookie(e.target.value)}
                    placeholder="粘贴 Cookie 或点击上方按钮自动获取..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[#F5F5F7] border border-[#E5E5E7] text-sm text-[#1D1D1F] font-mono resize-none transition-colors focus:outline-none focus-visible:border-[#0A84FF] focus-visible:ring-2 focus-visible:ring-[#0A84FF]/20"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveCookie}
                      className="h-9 px-4 rounded-lg bg-[#0A84FF] text-sm text-white font-medium hover:bg-[#0060D5] transition-colors"
                    >
                      保存 Cookie
                    </button>
                  </div>
                </div>
              </div>

              {/* API Settings Card */}
              <div className="bg-white rounded-2xl border border-[#E5E5E7] shadow-sm p-6">
                <h2 className="text-base font-semibold text-[#1D1D1F] mb-4">API 设置</h2>
                <p className="text-xs text-[#A1A1A6] mb-4">配置 Grok API 用于视频内容分析</p>

                <div className="space-y-4">
                  {/* API Key */}
                  <div className="flex items-center justify-between">
                    <div className="md:min-w-[120px]">
                      <p className="text-sm text-[#1D1D1F]">API Key</p>
                    </div>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="xai-**********************"
                      className="w-full md:w-[360px] h-10 px-3 rounded-lg bg-[#F5F5F7] border border-[#E5E5E7] text-sm text-[#1D1D1F] font-mono transition-colors focus:outline-none focus-visible:border-[#0A84FF] focus-visible:ring-2 focus-visible:ring-[#0A84FF]/20"
                    />
                  </div>

                  {/* API URL */}
                  <div className="flex items-center justify-between">
                    <div className="md:min-w-[120px]">
                      <p className="text-sm text-[#1D1D1F]">API URL</p>
                    </div>
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      placeholder="https://api.x.ai/v1"
                      className="w-full md:w-[360px] h-10 px-3 rounded-lg bg-[#F5F5F7] border border-[#E5E5E7] text-sm text-[#1D1D1F] font-mono transition-colors focus:outline-none focus-visible:border-[#0A84FF] focus-visible:ring-2 focus-visible:ring-[#0A84FF]/20"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleVerifyApi}
                      disabled={verifyingApi}
                      className="h-9 px-4 rounded-lg border border-[#E5E5E7] text-sm text-[#1D1D1F] hover:bg-[#F2F2F4] transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {verifyingApi ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      验证
                    </button>
                    <button
                      onClick={handleSaveApi}
                      className="h-9 px-4 rounded-lg bg-[#0A84FF] text-sm text-white font-medium hover:bg-[#0060D5] transition-colors"
                    >
                      保存
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#6E6E73]">
                单视频与转写
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#1D1D1F]">剪贴板识别与 SiliconFlow</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-[#E5E5E7] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-[#1D1D1F]">单视频下载</h2>

                <div className="divide-y divide-[#E5E5E7]">
                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">单视频下载时自动加入用户管理</p>
                      <p className="mt-1 text-xs text-[#A1A1A6]">
                        关闭后作者仍会入库支撑作品和转写，但默认不显示在用户管理和批量下载列表中
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSingleVideoAddUser(!singleVideoAddUser)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        singleVideoAddUser ? 'bg-[#0A84FF]' : 'bg-[#D1D1D6]'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          singleVideoAddUser ? 'translate-x-[22px]' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">剪贴板检测动作</p>
                      <p className="mt-1 text-xs text-[#A1A1A6]">
                        检测到抖音视频链接后，询问加入、直接入队或忽略
                      </p>
                    </div>
                    <select
                      value={singleVideoClipboardAction}
                      onChange={(e) => setSingleVideoClipboardAction(e.target.value)}
                      className="h-10 w-full rounded-lg border border-[#E5E5E7] bg-[#F5F5F7] px-3 text-sm text-[#1D1D1F] md:w-[200px]"
                    >
                      <option value="confirm">询问后加入</option>
                      <option value="auto">直接入队</option>
                      <option value="off">关闭检测</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">下载后自动转写</p>
                      <p className="mt-1 text-xs text-[#A1A1A6]">
                        仅对新的单视频任务生效，不自动补跑历史视频
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSingleVideoAutoTranscribe(!singleVideoAutoTranscribe)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        singleVideoAutoTranscribe ? 'bg-[#0A84FF]' : 'bg-[#D1D1D6]'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          singleVideoAutoTranscribe ? 'translate-x-[22px]' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E5E7] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-[#1D1D1F]">音频转写接口</h2>
                <p className="mb-4 text-xs text-[#A1A1A6]">
                  使用 SiliconFlow 音频转写接口，结果写入数据库并同步生成 transcript.txt
                </p>

                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-[#1D1D1F]">API Key</label>
                    <input
                      type="password"
                      value={siliconflowApiKey}
                      onChange={(e) => setSiliconflowApiKey(e.target.value)}
                      placeholder="sk-************************"
                      className="h-10 rounded-lg border border-[#E5E5E7] bg-[#F5F5F7] px-3 font-mono text-sm text-[#1D1D1F] transition-colors focus:outline-none focus-visible:border-[#0A84FF] focus-visible:ring-2 focus-visible:ring-[#0A84FF]/20"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-[#1D1D1F]">转写地址</label>
                    <input
                      type="text"
                      value={transcriptionApiUrl}
                      onChange={(e) => setTranscriptionApiUrl(e.target.value)}
                      placeholder="https://api.siliconflow.cn/v1/audio/transcriptions"
                      className="h-10 rounded-lg border border-[#E5E5E7] bg-[#F5F5F7] px-3 font-mono text-sm text-[#1D1D1F] transition-colors focus:outline-none focus-visible:border-[#0A84FF] focus-visible:ring-2 focus-visible:ring-[#0A84FF]/20"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-[#1D1D1F]">模型名称</label>
                    <input
                      type="text"
                      value={transcriptionModel}
                      onChange={(e) => setTranscriptionModel(e.target.value)}
                      placeholder="FunAudioLLM/SenseVoiceSmall"
                      className="h-10 rounded-lg border border-[#E5E5E7] bg-[#F5F5F7] px-3 font-mono text-sm text-[#1D1D1F] transition-colors focus:outline-none focus-visible:border-[#0A84FF] focus-visible:ring-2 focus-visible:ring-[#0A84FF]/20"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveTranscription}
                      className="h-9 rounded-lg bg-[#0A84FF] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0060D5]"
                    >
                      保存单视频与转写设置
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-[#6E6E73] uppercase tracking-widest">
                任务参数
              </p>
              <h2 className="text-lg font-semibold text-[#1D1D1F] mt-1">下载与分析</h2>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Download Settings Card */}
              <div className="bg-white rounded-2xl border border-[#E5E5E7] shadow-sm p-6">
                <h2 className="text-base font-semibold text-[#1D1D1F] mb-4">下载设置</h2>

                <div className="divide-y divide-[#E5E5E7]">
                  {/* Download Path */}
                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">下载路径</p>
                      <p className="text-xs text-[#A1A1A6] mt-1">视频下载保存位置</p>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-[320px]">
                      <input
                        type="text"
                        value={downloadPath}
                        onChange={(e) => setDownloadPath(e.target.value)}
                        placeholder="/Users/downloads/douyin"
                        className="flex-1 h-10 px-3 rounded-lg bg-[#F5F5F7] border border-[#E5E5E7] text-sm text-[#1D1D1F] transition-colors focus:outline-none focus-visible:border-[#0A84FF] focus-visible:ring-2 focus-visible:ring-[#0A84FF]/20"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const path = await window.api.system.openDirectoryDialog()
                          if (path) setDownloadPath(path)
                        }}
                        className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg border border-[#E5E5E7] bg-[#F5F5F7] hover:bg-[#E8E8ED] transition-colors"
                        title="选择目录"
                      >
                        <FolderOpen className="h-4 w-4 text-[#6E6E73]" />
                      </button>
                    </div>
                  </div>

                  {/* Max Download Count */}
                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">最大下载数量</p>
                      <p className="text-xs text-[#A1A1A6] mt-1">0 表示无限制</p>
                    </div>
                    <input
                      type="number"
                      value={maxDownloadCount}
                      onChange={(e) => setMaxDownloadCount(e.target.value)}
                      className="w-full md:w-[140px] h-10 px-3 rounded-lg bg-[#F5F5F7] border border-[#E5E5E7] text-sm text-[#1D1D1F] transition-colors focus:outline-none focus-visible:border-[#0A84FF] focus-visible:ring-2 focus-visible:ring-[#0A84FF]/20 text-center"
                    />
                  </div>

                  {/* Concurrency */}
                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">并发下载数</p>
                      <p className="text-xs text-[#A1A1A6] mt-1">同时下载的视频数量</p>
                    </div>
                    <input
                      type="number"
                      value={videoDownloadConcurrency}
                      onChange={(e) => setVideoDownloadConcurrency(e.target.value)}
                      min="1"
                      className="w-20 h-9 px-3 rounded-md bg-[#F5F5F7] border border-[#E5E5E7] text-sm text-[#1D1D1F] font-mono text-center focus:outline-none focus:border-[#0A84FF]"
                    />
                  </div>
                  {/* Convert Images to JPG */}
                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">图片转 JPG</p>
                      <p className="text-xs text-[#A1A1A6] mt-1">
                        下载图文作品时自动转换为 JPG 格式
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConvertToJpg(!convertToJpg)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        convertToJpg ? 'bg-[#0A84FF]' : 'bg-[#D1D1D6]'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          convertToJpg ? 'translate-x-[22px]' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  {/* Download post on add-user via video link */}
                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">添加用户时下载作品</p>
                      <p className="text-xs text-[#A1A1A6] mt-1">
                        输入作品链接添加用户时，后台下载该作品；用户已存在则补下载
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDownloadPostOnAddUser(!downloadPostOnAddUser)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        downloadPostOnAddUser ? 'bg-[#0A84FF]' : 'bg-[#D1D1D6]'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          downloadPostOnAddUser ? 'translate-x-[22px]' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveDownload}
                    className="h-9 px-4 rounded-lg bg-[#0A84FF] text-sm text-white font-medium hover:bg-[#0060D5] transition-colors"
                  >
                    保存下载设置
                  </button>
                </div>
              </div>

              {/* Analysis Settings Card */}
              <div className="bg-white rounded-2xl border border-[#E5E5E7] shadow-sm p-6">
                <h2 className="text-base font-semibold text-[#1D1D1F] mb-4">分析设置</h2>
                <p className="text-xs text-[#A1A1A6] mb-4">配置视频内容分析参数</p>

                <div className="divide-y divide-[#E5E5E7]">
                  {/* Analysis Model */}
                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">AI 模型</p>
                      <p className="text-xs text-[#A1A1A6] mt-1">用于视频分析的模型</p>
                    </div>
                    <input
                      type="text"
                      value={analysisModel}
                      onChange={(e) => setAnalysisModel(e.target.value)}
                      placeholder="grok-4-fast"
                      className="w-48 h-9 px-3 rounded-md bg-[#F5F5F7] border border-[#E5E5E7] text-sm text-[#1D1D1F] focus:outline-none focus:border-[#0A84FF]"
                    />
                  </div>

                  {/* Analysis Concurrency */}
                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">分析并发数</p>
                      <p className="text-xs text-[#A1A1A6] mt-1">同时分析的视频数量</p>
                    </div>
                    <input
                      type="number"
                      value={analysisConcurrency}
                      onChange={(e) => setAnalysisConcurrency(e.target.value)}
                      min="1"
                      className="w-20 h-9 px-3 rounded-md bg-[#F5F5F7] border border-[#E5E5E7] text-sm text-[#1D1D1F] font-mono text-center focus:outline-none focus:border-[#0A84FF]"
                    />
                  </div>

                  {/* Analysis RPM */}
                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">RPM 限制</p>
                      <p className="text-xs text-[#A1A1A6] mt-1">每分钟最大请求数</p>
                    </div>
                    <input
                      type="number"
                      value={analysisRpm}
                      onChange={(e) => setAnalysisRpm(e.target.value)}
                      className="w-full md:w-[140px] h-10 px-3 rounded-lg bg-[#F5F5F7] border border-[#E5E5E7] text-sm text-[#1D1D1F] transition-colors focus:outline-none focus-visible:border-[#0A84FF] focus-visible:ring-2 focus-visible:ring-[#0A84FF]/20 text-center"
                    />
                  </div>

                  {/* Analysis Slices */}
                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">视频切片数</p>
                      <p className="text-xs text-[#A1A1A6] mt-1">每个视频分析的帧数</p>
                    </div>
                    <input
                      type="number"
                      value={analysisSlices}
                      onChange={(e) => setAnalysisSlices(e.target.value)}
                      min="1"
                      className="w-20 h-9 px-3 rounded-md bg-[#F5F5F7] border border-[#E5E5E7] text-sm text-[#1D1D1F] font-mono text-center focus:outline-none focus:border-[#0A84FF]"
                    />
                  </div>

                  {/* Analysis Prompt */}
                  <div className="py-4">
                    <div className="mb-2">
                      <p className="text-sm text-[#1D1D1F]">自定义 Prompt</p>
                      <p className="text-xs text-[#A1A1A6] mt-1">留空使用默认 Prompt</p>
                    </div>
                    <textarea
                      value={analysisPrompt}
                      onChange={(e) => setAnalysisPrompt(e.target.value)}
                      placeholder="自定义分析提示词..."
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F5F7] border border-[#E5E5E7] text-sm text-[#1D1D1F] resize-none transition-colors focus:outline-none focus-visible:border-[#0A84FF] focus-visible:ring-2 focus-visible:ring-[#0A84FF]/20"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveAnalysis}
                    className="h-9 px-4 rounded-lg bg-[#0A84FF] text-sm text-white font-medium hover:bg-[#0060D5] transition-colors"
                  >
                    保存分析设置
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-[#6E6E73] uppercase tracking-widest">系统</p>
              <h2 className="text-lg font-semibold text-[#1D1D1F] mt-1">版本与安全</h2>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Version & Update Card */}
              <div className="bg-white rounded-2xl border border-[#E5E5E7] shadow-sm p-6">
                <h2 className="text-base font-semibold text-[#1D1D1F] mb-4">关于</h2>

                <div className="divide-y divide-[#E5E5E7]">
                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">当前版本</p>
                      <p className="text-xs text-[#A1A1A6] mt-1">v{currentVersion}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {updateStatus?.status === 'available' && (
                        <button
                          onClick={handleDownloadUpdate}
                          className="h-9 px-4 rounded-lg bg-[#0A84FF] text-sm text-white font-medium hover:bg-[#0060D5] transition-colors flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          下载 v{updateStatus.info?.version}
                        </button>
                      )}
                      {updateStatus?.status === 'downloading' && (
                        <div className="flex items-center gap-2 text-sm text-[#A1A1A6]">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          下载中 {Math.round(updateStatus.progress || 0)}%
                        </div>
                      )}
                      {updateStatus?.status === 'downloaded' && (
                        <button
                          onClick={handleInstallUpdate}
                          className="h-9 px-4 rounded-lg bg-[#22C55E] text-sm text-white font-medium hover:bg-[#16A34A] transition-colors flex items-center gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          重启安装
                        </button>
                      )}
                      {(!updateStatus ||
                        updateStatus.status === 'not-available' ||
                        updateStatus.status === 'error') && (
                        <button
                          onClick={handleCheckUpdate}
                          disabled={checkingUpdate}
                          className="h-9 px-4 rounded-lg border border-[#E5E5E7] text-sm text-[#1D1D1F] hover:bg-[#F2F2F4] transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          {checkingUpdate ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          检查更新
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">当前项目仓库</p>
                      <p className="text-xs text-[#A1A1A6] mt-1">查看源代码和发布记录</p>
                    </div>
                    <a
                      href={CURRENT_REPO_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#0A84FF] hover:underline"
                    >
                      {CURRENT_REPO_NAME}
                    </a>
                  </div>

                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">项目声明</p>
                      <p className="mt-1 text-xs text-[#A1A1A6]">
                        本项目基于原始开源项目修改而来，保留原项目许可证与来源信息。
                      </p>
                    </div>
                    <p className="text-sm text-[#1D1D1F]">
                      由{' '}
                      <a
                        href={UPSTREAM_REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0A84FF] hover:underline"
                      >
                        {UPSTREAM_REPO_NAME}
                      </a>{' '}
                      修改而来
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">数据目录</p>
                      <p className="text-xs text-[#A1A1A6] mt-1">数据库及配置文件所在位置</p>
                    </div>
                    <button
                      onClick={() => window.api.system.openDataDirectory()}
                      className="h-9 px-4 rounded-lg border border-[#E5E5E7] text-sm text-[#1D1D1F] hover:bg-[#F2F2F4] transition-colors flex items-center gap-2"
                    >
                      <Database className="h-4 w-4" />
                      打开目录
                    </button>
                  </div>
                </div>
              </div>

              {/* Danger Zone Card */}
              <div className="bg-white rounded-2xl border border-[#FF3B30]/30 shadow-sm p-6">
                <h2 className="text-base font-semibold text-[#FF3B30] mb-4">危险区域</h2>

                <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-[#1D1D1F]">清除所有数据</p>
                    <p className="text-xs text-[#A1A1A6] mt-1">删除所有下载的视频和用户数据</p>
                  </div>
                  <button
                    onClick={handleClearData}
                    className="h-9 px-4 rounded-lg border border-[#0A84FF] text-sm font-medium text-[#0A84FF] hover:bg-[#E8F0FE] transition-colors"
                  >
                    清除数据
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Migration Dialog */}
      {showMigrationDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-[480px] shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E7]">
              <div className="flex items-center gap-3">
                <FolderSync className="h-5 w-5 text-[#0A84FF]" />
                <h3 className="text-base font-semibold text-[#1D1D1F]">检测到下载路径变更</h3>
              </div>
              <button
                onClick={() => setShowMigrationDialog(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[#F2F2F4] transition-colors"
              >
                <X className="h-4 w-4 text-[#6E6E73]" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              <p className="text-sm text-[#1D1D1F] mb-4">
                发现 <span className="font-medium text-[#0A84FF]">{migrationCount}</span>{' '}
                个视频文件夹在旧路径中。
              </p>
              <p className="text-sm text-[#6E6E73] mb-4">
                是否将文件迁移到新路径？迁移后数据库记录将自动更新。
              </p>
              <div className="text-xs text-[#A1A1A6] space-y-1 bg-[#F2F2F4] rounded-lg p-3">
                <p>
                  <span className="text-[#6E6E73]">旧路径:</span>{' '}
                  {originalDownloadPath.current || '默认路径'}
                </p>
                <p>
                  <span className="text-[#6E6E73]">新路径:</span> {pendingNewPath}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#E5E5E7]">
              <button
                onClick={handleSkipMigration}
                disabled={migrating}
                className="h-9 px-4 rounded-lg border border-[#E5E5E7] text-sm text-[#1D1D1F] hover:bg-[#F2F2F4] transition-colors disabled:opacity-50"
              >
                跳过迁移
              </button>
              <button
                onClick={handleMigrate}
                disabled={migrating}
                className="h-9 px-4 rounded-lg bg-[#0A84FF] text-sm text-white font-medium hover:bg-[#0060D5] transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {migrating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    迁移中...
                  </>
                ) : (
                  <>
                    <FolderSync className="h-4 w-4" />
                    迁移文件
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
