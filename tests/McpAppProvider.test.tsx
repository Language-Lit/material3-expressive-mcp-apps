import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InMemoryTransport, type Transport } from '@modelcontextprotocol/client'
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge'
import type { McpUiHostContext, McpUiStyles } from '@modelcontextprotocol/ext-apps'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { McpAppProvider } from '../src/app/McpAppProvider'
import { useDisplayMode, useMcpApp, useToolCall } from '../src/app/context'

function Probe() {
  const { status, hostContext, hostCapabilities } = useMcpApp()
  const { input, result, cancelled } = useToolCall<{ city: string }>()
  const { displayMode, availableDisplayModes, requestDisplayMode } = useDisplayMode()
  return (
    <div>
      <output data-testid="status">{status}</output>
      <output data-testid="theme">{hostContext?.theme ?? ''}</output>
      <output data-testid="locale">{hostContext?.locale ?? ''}</output>
      <output data-testid="open-links">{hostCapabilities?.openLinks ? 'yes' : 'no'}</output>
      <output data-testid="input">{input?.city ?? ''}</output>
      <output data-testid="result">{result?.content?.[0]?.type === 'text' ? result.content[0].text : ''}</output>
      <output data-testid="cancelled">{cancelled?.reason ?? ''}</output>
      <output data-testid="display-mode">{displayMode}</output>
      <output data-testid="available">{availableDisplayModes.join(',')}</output>
      <a href="#fullscreen" onClick={(event) => { event.preventDefault(); void requestDisplayMode('fullscreen') }}>
        Go full screen
      </a>
    </div>
  )
}

async function mountApp(hostContext: McpUiHostContext = {}) {
  const [hostTransport, appTransport] = InMemoryTransport.createLinkedPair()
  const bridge = new AppBridge(
    null,
    { name: 'test-host', version: '1.0.0' },
    { openLinks: {} },
    {
      hostContext: {
        theme: 'dark',
        displayMode: 'inline',
        availableDisplayModes: ['inline', 'fullscreen'],
        locale: 'en-GB',
        ...hostContext,
      },
    },
  )
  const requested: string[] = []
  bridge.onrequestdisplaymode = async ({ mode }) => {
    requested.push(mode)
    return { mode }
  }
  const initialized = new Promise<void>((resolve) => bridge.addEventListener('initialized', () => resolve()))
  await bridge.connect(hostTransport)

  const view = render(
    <McpAppProvider appInfo={{ name: 'test-app', version: '1.0.0' }} transport={appTransport as Transport} autoResize={false}>
      <Probe />
    </McpAppProvider>,
  )
  await act(async () => {
    await initialized
  })
  await waitFor(() => expect(screen.getByTestId('status').textContent).toContain('connected'))

  return {
    bridge,
    requested,
    view,
    async close() {
      await bridge.close().catch(() => {})
    },
  }
}

let harness: Awaited<ReturnType<typeof mountApp>> | undefined
afterEach(async () => {
  cleanup()
  await harness?.close()
  harness = undefined
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.removeProperty('color-scheme')
})

const themeRoot = () => document.querySelector<HTMLElement>('.m3e-mcp-app-theme')!
const appRoot = () => document.querySelector<HTMLElement>('.m3e-mcp-app')!

describe('McpAppProvider', () => {
  it('connects, follows the host theme and exposes the host context', async () => {
    harness = await mountApp()
    expect(screen.getByTestId('theme').textContent).toContain('dark')
    expect(screen.getByTestId('locale').textContent).toContain('en-GB')
    expect(screen.getByTestId('open-links').textContent).toContain('yes')
    expect(screen.getByTestId('available').textContent).toContain('inline,fullscreen')
    expect(themeRoot().getAttribute('data-m3e-color-mode')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(appRoot().dataset.status).toBe('connected')
    expect(appRoot().dataset.displayMode).toBe('inline')
  })

  it('applies the host style variables and safe areas to the app root', async () => {
    harness = await mountApp({
      styles: { variables: { '--color-background-primary': 'rgb(1, 2, 3)' } as McpUiStyles },
      safeAreaInsets: { top: 10, right: 0, bottom: 20, left: 4 },
    })
    expect(appRoot().style.getPropertyValue('--color-background-primary')).toBe('rgb(1, 2, 3)')
    expect(appRoot().style.getPropertyValue('--m3e-mcp-safe-area-top')).toBe('10px')
    expect(appRoot().style.getPropertyValue('--m3e-mcp-safe-area-bottom')).toBe('20px')
    expect(appRoot().style.getPropertyValue('--m3e-mcp-safe-area-left')).toBe('4px')
  })

  it('receives the tool call as the host sends it', async () => {
    harness = await mountApp()
    const { bridge } = harness
    await act(async () => {
      await bridge.sendToolInput({ arguments: { city: 'Lisbon' } })
    })
    await waitFor(() => expect(screen.getByTestId('input').textContent).toContain('Lisbon'))

    await act(async () => {
      await bridge.sendToolResult({ content: [{ type: 'text', text: 'Sunny' }] })
    })
    await waitFor(() => expect(screen.getByTestId('result').textContent).toContain('Sunny'))

    await act(async () => {
      await bridge.sendToolCancelled({ reason: 'timeout' })
    })
    await waitFor(() => expect(screen.getByTestId('cancelled').textContent).toContain('timeout'))
  })

  it('re-themes when the host context changes', async () => {
    harness = await mountApp()
    await act(async () => {
      await harness!.bridge.sendHostContextChange({ theme: 'light', displayMode: 'fullscreen' })
    })
    await waitFor(() => expect(themeRoot().getAttribute('data-m3e-color-mode')).toBe('light'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(appRoot().classList.contains('m3e-mcp-app--fullscreen')).toBe(true)
    expect(screen.getByTestId('display-mode').textContent).toContain('fullscreen')
  })

  it('asks the host for a display mode and adopts the answer', async () => {
    harness = await mountApp()
    await userEvent.click(screen.getByRole('link', { name: 'Go full screen' }))
    await waitFor(() => expect(screen.getByTestId('display-mode').textContent).toContain('fullscreen'))
    expect(harness.requested).toEqual(['fullscreen'])
    expect(appRoot().dataset.displayMode).toBe('fullscreen')
  })

  it('reports a closed status when the host tears the resource down', async () => {
    harness = await mountApp()
    await act(async () => {
      await harness!.bridge.teardownResource({})
    })
    await waitFor(() => expect(screen.getByTestId('status').textContent).toContain('closed'))
  })

  it('lets a forced color mode win over the host theme', async () => {
    const [hostTransport, appTransport] = InMemoryTransport.createLinkedPair()
    const bridge = new AppBridge(null, { name: 'h', version: '1' }, {}, { hostContext: { theme: 'dark' } })
    const initialized = new Promise<void>((resolve) => bridge.addEventListener('initialized', () => resolve()))
    await bridge.connect(hostTransport)
    render(
      <McpAppProvider
        appInfo={{ name: 'a', version: '1' }}
        transport={appTransport as Transport}
        autoResize={false}
        colorMode="light"
        applyDocumentColorScheme={false}
      >
        <Probe />
      </McpAppProvider>,
    )
    await act(async () => {
      await initialized
    })
    try {
      await waitFor(() => expect(screen.getByTestId('status').textContent).toContain('connected'))
      expect(themeRoot().getAttribute('data-m3e-color-mode')).toBe('light')
      expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    } finally {
      await bridge.close()
    }
  })

  it.each(['light', 'dark', 'system'] as const)('applies the resolved %s override to the document and restores it', async (colorMode) => {
    const [hostTransport, appTransport] = InMemoryTransport.createLinkedPair()
    const bridge = new AppBridge(null, { name: 'h', version: '1' }, {}, { hostContext: { theme: colorMode === 'dark' ? 'light' : 'dark' } })
    await bridge.connect(hostTransport)
    document.documentElement.setAttribute('data-theme', 'previous')
    document.documentElement.style.setProperty('color-scheme', 'light dark', 'important')
    const provider = (applyDocumentColorScheme = true) => <McpAppProvider appInfo={{ name: 'a', version: '1' }} transport={appTransport} autoResize={false} colorMode={colorMode} applyDocumentColorScheme={applyDocumentColorScheme}><Probe /></McpAppProvider>
    const view = render(provider())
    try {
      await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('connected'))
      const resolved = colorMode === 'system' ? 'light' : colorMode
      expect(document.documentElement.style.colorScheme).toBe(resolved)
      expect(document.documentElement.getAttribute('data-theme')).toBe(resolved)
      view.rerender(provider(false))
      expect(document.documentElement.getAttribute('data-theme')).toBe('previous')
      expect(document.documentElement.style.colorScheme).toBe('light dark')
      expect(document.documentElement.style.getPropertyPriority('color-scheme')).toBe('important')
      view.rerender(provider())
      view.unmount()
      expect(document.documentElement.getAttribute('data-theme')).toBe('previous')
    } finally { cleanup(); await bridge.close() }
  })

  it('throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<Probe />)).toThrow(/inside <McpAppProvider>/)
    } finally {
      spy.mockRestore()
    }
  })
})
