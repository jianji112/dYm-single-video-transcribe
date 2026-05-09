import { BrowserWindow } from 'electron'

const BLOCKED_PROTOCOLS = ['bytedance:', 'snssdk:', 'aweme:']

export function blockCustomProtocols(win: BrowserWindow): void {
  win.webContents.on('will-navigate', (event, url) => {
    if (BLOCKED_PROTOCOLS.some((p) => url.startsWith(p))) {
      event.preventDefault()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (BLOCKED_PROTOCOLS.some((p) => url.startsWith(p))) {
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })
}
