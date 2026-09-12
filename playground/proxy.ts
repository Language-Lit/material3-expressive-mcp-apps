import './csp-runtime'
import { buildAllowAttribute } from '@modelcontextprotocol/ext-apps/app-bridge'
import type { McpUiSandboxResourceReadyNotification } from '@modelcontextprotocol/ext-apps'

// Example proxy, served on its own origin. The server validates hostOrigin.
const hostOrigin = new URL(location.href).searchParams.get('hostOrigin')!
const view = document.createElement('iframe')
view.title = 'MCP App view'
view.style.cssText = 'display:block;width:100%;height:100%;border:0'
let loaded = false
window.addEventListener('message', (event) => {
  const message = event.data
  if (!message || message.jsonrpc !== '2.0') return
  const reserved = typeof message.method === 'string' && message.method.startsWith('ui/notifications/sandbox-')
  if (event.source === parent && event.origin === hostOrigin) {
    if (message.method === 'ui/notifications/sandbox-resource-ready' && !loaded) {
      loaded = true
      const params = message.params as McpUiSandboxResourceReadyNotification['params']
      void load(params)
    } else if (!reserved && loaded) {
      view.contentWindow?.postMessage(message, '*')
    }
  } else if (event.source === view.contentWindow && !reserved) {
    parent.postMessage(message, hostOrigin)
  }
})
async function load(params: McpUiSandboxResourceReadyNotification['params']) {
  view.setAttribute('sandbox', params.sandbox ?? 'allow-scripts allow-forms')
  view.allow = buildAllowAttribute(params.permissions)
  const response = await fetch('/views', {
    method: 'POST', headers: {
      'Content-Type': 'application/json',
      ...(new URL(location.href).searchParams.get('ticket') ? { Authorization: `Bearer ${new URL(location.href).searchParams.get('ticket')}` } : {}),
    }, body: JSON.stringify(params),
  })
  if (!response.ok) throw new Error('The sandbox proxy refused the view.')
  const { path } = await response.json() as { path: string }
  view.src = path
  document.body.append(view)
}
parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/sandbox-proxy-ready', params: {} }, hostOrigin)
