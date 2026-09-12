import { useState } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Material3Provider } from '@language-lit/material3-expressive'
import { InMemoryTransport, type Transport } from '@modelcontextprotocol/client'
import {
  App,
  type McpUiAppCapabilities,
  type McpUiDisplayMode,
  type McpUiStyles,
  type McpUiToolInputNotification,
} from '@modelcontextprotocol/ext-apps'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { McpAppFrame, type McpAppFrameProps } from '../src/host/McpAppFrame'
import { readMcpAppResource, type McpAppResource } from '../src/host/resource'
import { VIEW_URI, connectTestServer } from '../fixtures/server'

type Harness = Awaited<ReturnType<typeof mountFrame>>

async function mountFrame(
  props: Partial<McpAppFrameProps> & { colorMode?: 'light' | 'dark' } = {},
  appCapabilities: McpUiAppCapabilities = { availableDisplayModes: ['inline', 'fullscreen', 'pip'] },
) {
  const connection = await connectTestServer()
  const resource = props.resource ?? (await readMcpAppResource(connection.client, VIEW_URI))
  const [hostTransport, appTransport] = InMemoryTransport.createLinkedPair()
  const { colorMode = 'light', ...frameProps } = props
  const transport = () => hostTransport

  const renderFrame = (overrides: Partial<McpAppFrameProps> & { colorMode?: 'light' | 'dark' } = {}) => {
    const { colorMode: mode = colorMode, ...rest } = overrides
    return (
      <Material3Provider colorMode={mode}>
        <McpAppFrame
          client={connection.client}
          resource={resource}
          transport={transport}
          onAuthorizeToolCall={() => true}
          {...frameProps}
          {...rest}
        />
      </Material3Provider>
    )
  }
  const view = render(renderFrame())

  const app = new App({ name: 'test-app', version: '1.2.3' }, appCapabilities, { autoResize: false })
  app.onteardown = async () => ({})
  const toolInputs: McpUiToolInputNotification['params'][] = []
  app.addEventListener('toolinput', (params) => toolInputs.push(params))
  const toolResults: unknown[] = []
  app.addEventListener('toolresult', (params) => toolResults.push(params))
  const cancellations: unknown[] = []
  app.addEventListener('toolcancelled', (params) => cancellations.push(params))

  await act(async () => {
    await app.connect(appTransport as Transport)
  })

  return {
    app,
    client: connection.client,
    resource,
    toolInputs,
    toolResults,
    cancellations,
    rerender: (overrides: Partial<McpAppFrameProps> & { colorMode?: 'light' | 'dark' }) =>
      view.rerender(renderFrame(overrides)),
    unmount: view.unmount,
    async close() {
      await app.close().catch(() => {})
      await connection.close()
    },
  }
}

const root = () => document.querySelector<HTMLElement>('.m3e-mcp-frame')!
const viewport = () => document.querySelector<HTMLElement>('.m3e-mcp-frame__viewport')!
const iframe = () => document.querySelector<HTMLIFrameElement>('iframe')!

let harness: Harness | undefined
afterEach(async () => {
  cleanup()
  await harness?.close()
  harness = undefined
})

describe('McpAppFrame', () => {
  it('completes the handshake and announces a Material host context', async () => {
    const onInitialized = vi.fn()
    const onStatusChange = vi.fn()
    harness = await mountFrame({
      onInitialized,
      onStatusChange,
      toolInfo: { id: 7, tool: { name: 'greet', title: 'Greet', inputSchema: { type: 'object' } } },
      locale: 'pt-BR',
      timeZone: 'America/Sao_Paulo',
      availableDisplayModes: ['inline', 'fullscreen'],
      maxHeight: 480,
    })
    const { app } = harness

    await waitFor(() => expect(root().dataset.status).toBe('ready'))
    expect(onStatusChange).toHaveBeenCalledWith('ready')
    expect(onInitialized).toHaveBeenCalledWith({
      appInfo: expect.objectContaining({ name: 'test-app', version: '1.2.3' }),
      appCapabilities: expect.objectContaining({ availableDisplayModes: ['inline', 'fullscreen', 'pip'] }),
    })

    const context = app.getHostContext()!
    expect(context.theme).toBe('light')
    expect(context.displayMode).toBe('inline')
    expect(context.availableDisplayModes).toEqual(['inline', 'fullscreen'])
    expect(context.locale).toBe('pt-BR')
    expect(context.timeZone).toBe('America/Sao_Paulo')
    expect(context.platform).toBe('web')
    expect(context.userAgent).toBe('@language-lit/material3-expressive-mcp-apps/0.2.0')
    expect(context.toolInfo).toEqual({ id: 7, tool: expect.objectContaining({ name: 'greet' }) })
    expect(context.containerDimensions).toEqual({ width: 0, maxHeight: 480 })
    expect(context.styles?.variables?.['--color-background-ghost']).toBe('transparent')
    expect(context.deviceCapabilities).toEqual({ touch: expect.any(Boolean), hover: expect.any(Boolean) })

    expect(iframe().getAttribute('sandbox')).toBe('allow-scripts allow-forms')
    expect(iframe().getAttribute('allow')).toContain('clipboard-write')
    expect(iframe().srcdoc).toContain('Test view')
    expect(iframe().title).toBe('Greet')
    expect(screen.getByRole('region', { name: 'Greet' })).toBeTruthy()
  })

  it('advertises capabilities from the client and the callbacks it was given', async () => {
    harness = await mountFrame({ onMessage: vi.fn(), onDownloadFile: vi.fn() })
    const capabilities = harness.app.getHostCapabilities()!
    expect(capabilities.openLinks).toEqual({})
    expect(capabilities.logging).toEqual({})
    expect(capabilities.serverTools).toEqual({ listChanged: true })
    expect(capabilities.serverResources).toEqual({ listChanged: true })
    expect(capabilities.message).toEqual(expect.objectContaining({ text: {} }))
    expect(capabilities.downloadFile).toEqual({})
    expect(capabilities.updateModelContext).toBeUndefined()
    expect(capabilities.sandbox).toEqual({
      permissions: { clipboardWrite: {} },
      csp: { connectDomains: ['https://api.example.com'] },
    })
  })

  it('sends host style variables the host supplies instead of reading tokens', async () => {
    const styleVariables = { '--color-background-primary': 'rgb(1, 2, 3)' } as McpUiStyles
    harness = await mountFrame({ styleVariables, fonts: '@font-face { font-family: Test; }' })
    const context = harness.app.getHostContext()!
    expect(context.styles).toEqual({
      variables: styleVariables,
      css: { fonts: '@font-face { font-family: Test; }' },
    })
  })

  it('delivers the tool input, result and cancellation as they arrive', async () => {
    const input = { name: 'Ada' }
    harness = await mountFrame({ toolInput: input })
    const { toolInputs, toolResults, cancellations, rerender } = harness

    await waitFor(() => expect(toolInputs).toEqual([{ arguments: { name: 'Ada' } }]))

    const result = { content: [{ type: 'text' as const, text: 'Hello, Ada.' }] }
    rerender({ toolInput: input, toolResult: result })
    await waitFor(() => expect(toolResults).toEqual([result]))
    expect(toolInputs).toHaveLength(1)

    const cancelled = { reason: 'user action' }
    rerender({ toolInput: input, toolResult: result, toolCancelled: cancelled })
    await waitFor(() => expect(cancellations).toEqual([{ reason: 'user action' }]))
  })

  it('follows the app’s reported height inline, capped by maxHeight', async () => {
    harness = await mountFrame({ maxHeight: 300, minHeight: 80 })
    const { app } = harness
    expect(viewport().style.blockSize).toBe('80px')

    await act(async () => {
      await app.sendSizeChanged({ width: 320, height: 240 })
    })
    await waitFor(() => expect(viewport().style.blockSize).toBe('240px'))

    await act(async () => {
      await app.sendSizeChanged({ height: 900 })
    })
    await waitFor(() => expect(viewport().style.blockSize).toBe('300px'))
  })

  it('grants display modes the host offers and refuses the rest', async () => {
    const onDisplayModeChange = vi.fn()
    harness = await mountFrame({ availableDisplayModes: ['inline', 'fullscreen'], onDisplayModeChange })
    const { app } = harness

    let granted: McpUiDisplayMode | undefined
    await act(async () => {
      granted = (await app.requestDisplayMode({ mode: 'fullscreen' })).mode
    })
    expect(granted).toBe('fullscreen')
    expect(onDisplayModeChange).toHaveBeenCalledWith('fullscreen')
    await waitFor(() => expect(root().dataset.displayMode).toBe('fullscreen'))
    await waitFor(() => expect(app.getHostContext()?.displayMode).toBe('fullscreen'))

    await act(async () => {
      granted = (await app.requestDisplayMode({ mode: 'pip' })).mode
    })
    expect(granted).toBe('fullscreen')
    expect(root().dataset.displayMode).toBe('fullscreen')

    await userEvent.click(screen.getByRole('button', { name: 'Exit full screen' }))
    await waitFor(() => expect(root().dataset.displayMode).toBe('inline'))
    await waitFor(() => expect(app.getHostContext()?.displayMode).toBe('inline'))
    expect(screen.getByRole('button', { name: 'Enter full screen' })).toBeTruthy()
  })

  it('reports inline when a controlled owner refuses an app fullscreen request', async () => {
    const onDisplayModeChange = vi.fn()
    harness = await mountFrame({ displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'], onDisplayModeChange })
    let result: unknown
    await act(async () => { result = await harness!.app.requestDisplayMode({ mode: 'fullscreen' }) })
    expect(result).toEqual({ mode: 'inline' })
    expect(root().dataset.displayMode).toBe('inline')
    expect(harness.app.getHostContext()?.displayMode).toBe('inline')
    expect(onDisplayModeChange).toHaveBeenCalledWith('fullscreen')
  })

  it('reports the committed mode when a controlled owner accepts the request', async () => {
    const [hostTransport, appTransport] = InMemoryTransport.createLinkedPair()
    function Controlled() {
      const [mode, setMode] = useState<McpUiDisplayMode>('inline')
      return <Material3Provider><McpAppFrame client={null} resource={{ uri: 'ui://controlled', html: '<p>App</p>' }}
        transport={() => hostTransport} displayMode={mode} availableDisplayModes={['inline', 'fullscreen']}
        onDisplayModeChange={setMode} /></Material3Provider>
    }
    render(<Controlled />)
    const app = new App({ name: 'controlled', version: '1' }, {}, { autoResize: false })
    app.onteardown = async () => ({})
    try {
      await act(async () => { await app.connect(appTransport) })
      let result: unknown
      await act(async () => { result = await app.requestDisplayMode({ mode: 'fullscreen' }) })
      expect(result).toEqual({ mode: 'fullscreen' })
      expect(root().dataset.displayMode).toBe('fullscreen')
    } finally { cleanup(); await app.close() }
  })

  it('respects a controlled display mode', async () => {
    const onDisplayModeChange = vi.fn()
    harness = await mountFrame({
      displayMode: 'inline',
      availableDisplayModes: ['inline', 'pip'],
      onDisplayModeChange,
    })
    await userEvent.click(screen.getByRole('button', { name: 'Picture in picture' }))
    expect(onDisplayModeChange).toHaveBeenCalledWith('pip')
    expect(root().dataset.displayMode).toBe('inline')

    harness.rerender({ displayMode: 'pip', availableDisplayModes: ['inline', 'pip'], onDisplayModeChange })
    expect(root().dataset.displayMode).toBe('pip')
    expect(screen.getByRole('button', { name: 'Return to the conversation' })).toBeTruthy()
  })

  it('routes links, messages, model context, logs and server tools to the host', async () => {
    const onOpenLink = vi.fn((url: string) => url.includes('allowed'))
    const onMessage = vi.fn()
    const onUpdateModelContext = vi.fn()
    const onLog = vi.fn()
    harness = await mountFrame({ onOpenLink, onMessage, onUpdateModelContext, onLog })
    const { app } = harness

    expect(await app.openLink({ url: 'https://allowed.example' })).toEqual({})
    expect(await app.openLink({ url: 'https://blocked.example' })).toEqual({ isError: true })
    expect(onOpenLink).toHaveBeenCalledTimes(2)

    const message = { role: 'user' as const, content: [{ type: 'text' as const, text: 'Book it' }] }
    expect(await app.sendMessage(message)).toEqual({})
    expect(onMessage).toHaveBeenCalledWith(message)

    await app.updateModelContext({ structuredContent: { selected: 'A' } })
    expect(onUpdateModelContext).toHaveBeenCalledWith({ structuredContent: { selected: 'A' } })

    await app.sendLog({ level: 'info', data: 'ready' })
    await waitFor(() => expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ level: 'info', data: 'ready' })))

    const result = await app.callServerTool({ name: 'greet', arguments: { name: 'Ada' } })
    expect(result.content).toEqual([{ type: 'text', text: 'Hello, Ada.' }])
  })

  it('denies app tools by default, including direct protocol requests', async () => {
    harness = await mountFrame({ onAuthorizeToolCall: undefined })
    expect(harness.app.getHostCapabilities()?.serverTools).toBeUndefined()
    const execute = vi.spyOn(harness.client, 'request')
    const result = await harness.app.request({ method: 'tools/call', params: { name: 'greet', arguments: { name: 'Denied' } } })
    expect(result).toMatchObject({ isError: true })
    expect(execute).not.toHaveBeenCalled()
  })

  it('waits for explicit approval before executing a server tool', async () => {
    let approve!: (allowed: boolean) => void
    const onAuthorizeToolCall = vi.fn(() => new Promise<boolean>((resolve) => { approve = resolve }))
    harness = await mountFrame({ onAuthorizeToolCall })
    const execute = vi.spyOn(harness.client, 'request')
    const response = harness.app.callServerTool({ name: 'greet', arguments: { name: 'Approved' } })
    await waitFor(() => expect(onAuthorizeToolCall).toHaveBeenCalled())
    expect(execute).not.toHaveBeenCalled()
    approve(true)
    expect((await response).content).toEqual([{ type: 'text', text: 'Hello, Approved.' }])
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('refuses a declined tool approval', async () => {
    harness = await mountFrame({ onAuthorizeToolCall: async () => false })
    const execute = vi.spyOn(harness.client, 'request')
    const result = await harness.app.callServerTool({ name: 'greet', arguments: { name: 'Denied' } })
    expect(result.isError).toBe(true)
    expect(execute).not.toHaveBeenCalled()
  })

  it('does not execute an approval that arrives after the frame closes', async () => {
    let approve!: (allowed: boolean) => void
    const onAuthorizeToolCall = vi.fn(() => new Promise<boolean>((resolve) => { approve = resolve }))
    harness = await mountFrame({ onAuthorizeToolCall })
    const execute = vi.spyOn(harness.client, 'request')
    const response = harness.app.callServerTool({ name: 'greet', arguments: { name: 'Too late' } }).catch(() => null)
    await waitFor(() => expect(onAuthorizeToolCall).toHaveBeenCalled())
    await act(async () => { await harness!.app.requestTeardown() })
    await waitFor(() => expect(root().dataset.status).toBe('closed'))
    approve(true)
    await response
    expect(execute).not.toHaveBeenCalled()
  })

  it('tells the app when the host theme changes', async () => {
    harness = await mountFrame({ colorMode: 'light' })
    const { app, rerender } = harness
    expect(app.getHostContext()?.theme).toBe('light')

    await act(async () => {
      rerender({ colorMode: 'dark' })
    })
    await waitFor(() => expect(app.getHostContext()?.theme).toBe('dark'))
  })

  it('hides the app when it asks to be torn down', async () => {
    const onTeardownRequest = vi.fn()
    harness = await mountFrame({ onTeardownRequest })
    await act(async () => {
      await harness!.app.requestTeardown()
    })
    await waitFor(() => expect(root().dataset.status).toBe('closed'))
    expect(onTeardownRequest).toHaveBeenCalled()
    expect(iframe().hidden).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('The app has closed.')
  })

  it('waits for acknowledgement and rejects new work while closing', async () => {
    const onMessage = vi.fn()
    const onBridge = vi.fn()
    const onTeardownRequest = vi.fn()
    harness = await mountFrame({ onMessage, onBridge, onTeardownRequest })
    let acknowledge!: () => void
    harness.app.onteardown = () => new Promise((resolve) => { acknowledge = () => resolve({}) })
    const documentBefore = iframe().srcdoc
    await act(async () => { await harness!.app.requestTeardown() })
    await waitFor(() => expect(root().dataset.status).toBe('closing'))
    expect(iframe().srcdoc).toBe(documentBefore)
    expect(onTeardownRequest).not.toHaveBeenCalled()
    await expect(harness.app.callServerTool({ name: 'greet', arguments: { name: 'Blocked' } })).rejects.toThrow(/closing/)
    await expect(harness.app.sendMessage({ role: 'user', content: [{ type: 'text', text: 'Blocked' }] })).rejects.toThrow(/closing/)
    expect(onMessage).not.toHaveBeenCalled()
    await act(async () => { acknowledge() })
    await waitFor(() => expect(root().dataset.status).toBe('closed'))
    expect(iframe().srcdoc).toBe('')
    expect(onBridge).toHaveBeenLastCalledWith(null)
    expect(onTeardownRequest).toHaveBeenCalledTimes(1)
    await expect(harness.app.callServerTool({ name: 'greet', arguments: { name: 'Blocked' } })).rejects.toThrow()
  })

  it('supports graceful host closure through active=false', async () => {
    harness = await mountFrame()
    let acknowledge!: () => void
    const teardown = vi.fn(() => new Promise<Record<string, never>>((resolve) => { acknowledge = () => resolve({}) }))
    harness.app.onteardown = teardown
    harness.rerender({ active: false })
    await waitFor(() => expect(teardown).toHaveBeenCalledTimes(1))
    expect(root().dataset.status).toBe('closing')
    expect(iframe().srcdoc).toContain('Test view')
    await act(async () => { acknowledge() })
    await waitFor(() => expect(root().dataset.status).toBe('closed'))
    expect(iframe().srcdoc).toBe('')
  })

  it('bounds teardown when the app never acknowledges', async () => {
    const onError = vi.fn()
    harness = await mountFrame({ onError })
    harness.app.onteardown = () => new Promise(() => {})
    vi.useFakeTimers()
    try {
      await act(async () => { await harness!.app.requestTeardown() })
      expect(root().dataset.status).toBe('closing')
      await act(async () => { await vi.advanceTimersByTimeAsync(1001) })
      expect(root().dataset.status).toBe('closed')
      expect(iframe().srcdoc).toBe('')
      expect(onError).toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })

  it('sends teardown before React removes the iframe on immediate unmount', async () => {
    const [hostTransport, appTransport] = InMemoryTransport.createLinkedPair()
    const send = hostTransport.send.bind(hostTransport)
    const teardownConnected: boolean[] = []
    hostTransport.send = async (message, options) => {
      if ('method' in message && message.method === 'ui/resource-teardown') teardownConnected.push(iframe().isConnected)
      return send(message, options)
    }
    const view = render(<Material3Provider><McpAppFrame client={null} resource={{ uri: 'ui://unmount', html: '<p>Unmount</p>' }} transport={() => hostTransport} /></Material3Provider>)
    const app = new App({ name: 'unmount', version: '1' }, {}, { autoResize: false })
    const teardown = vi.fn(async () => ({}))
    app.onteardown = teardown
    try {
      await act(async () => { await app.connect(appTransport) })
      await act(async () => { view.unmount() })
      expect(teardownConnected).toEqual([true])
      expect(teardown).toHaveBeenCalledTimes(1)
    } finally { await app.close() }
  })

  it('waits for the old resource teardown before connecting its replacement', async () => {
    harness = await mountFrame()
    const oldIframe = iframe()
    let acknowledge!: () => void
    harness.app.onteardown = () => new Promise((resolve) => { acknowledge = () => resolve({}) })
    const [hostTransport, appTransport] = InMemoryTransport.createLinkedPair()
    const replacementFactory = vi.fn(() => hostTransport)
    harness.rerender({ resource: { uri: 'ui://replacement', html: '<p>Replacement</p>', meta: { prefersBorder: false } }, transport: replacementFactory })
    await waitFor(() => expect(acknowledge).toBeTypeOf('function'))
    expect(replacementFactory).not.toHaveBeenCalled()
    expect(iframe().srcdoc).toContain('Test view')
    await act(async () => { acknowledge() })
    await waitFor(() => expect(replacementFactory).toHaveBeenCalledTimes(1))
    const replacement = new App({ name: 'replacement', version: '1' }, {}, { autoResize: false })
    replacement.onteardown = async () => ({})
    try {
      await act(async () => { await replacement.connect(appTransport) })
      expect(iframe()).toBe(oldIframe)
      expect(iframe().srcdoc).toContain('Replacement')
      expect(root().dataset.status).toBe('ready')
    } finally { cleanup(); await replacement.close() }
  })

  it.each([undefined, '/sandbox.html', 'data:text/html,x', 'javascript:void(0)'])('rejects browser embedding with invalid proxy %s', async (sandboxUrl) => {
    const onError = vi.fn()
    render(<Material3Provider><McpAppFrame client={null} resource={{ uri: 'ui://blocked', html: '<p>Must not load</p>' }} sandboxUrl={sandboxUrl} onError={onError} /></Material3Provider>)
    await waitFor(() => expect(root().dataset.status).toBe('error'))
    expect(onError).toHaveBeenCalled()
    expect(iframe().srcdoc).toBe('')
    expect(iframe().getAttribute('src')).toBeNull()
  })

  it('closes the bridge on unmount', async () => {
    const onBridge = vi.fn()
    harness = await mountFrame({ onBridge })
    expect(onBridge).toHaveBeenLastCalledWith(expect.objectContaining({ setHostContext: expect.any(Function) }))
    harness.unmount()
    expect(onBridge).toHaveBeenLastCalledWith(null)
  })

  it('reports a client that is not connected instead of hanging', async () => {
    const onError = vi.fn()
    const resource: McpAppResource = { uri: 'ui://x', html: '<p>x</p>' }
    const { Client } = await import('@modelcontextprotocol/client')
    const client = new Client({ name: 'idle', version: '0' })
    render(
      <Material3Provider colorMode="light">
        <McpAppFrame client={client} resource={resource} onError={onError} />
      </Material3Provider>,
    )
    await waitFor(() => expect(root().dataset.status).toBe('error'))
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/connected client/) }))
    expect(screen.getByRole('alert').textContent).toMatch(/connected client/)
  })

  it('works without a client and without a border', async () => {
    const [hostTransport, appTransport] = InMemoryTransport.createLinkedPair()
    const resource: McpAppResource = { uri: 'ui://x', html: '<p>x</p>', meta: { prefersBorder: false } }
    render(
      <Material3Provider colorMode="light">
        <McpAppFrame client={null} resource={resource} transport={() => hostTransport} title="Plain" />
      </Material3Provider>,
    )
    const app = new App({ name: 'plain', version: '1' }, {}, { autoResize: false })
    await act(async () => {
      await app.connect(appTransport as Transport)
    })
    try {
      expect(app.getHostCapabilities()?.serverTools).toBeUndefined()
      expect(root().classList.contains('m3e-mcp-frame--bordered')).toBe(false)
      expect(document.querySelector('.m3e-mcp-frame__bar')).toBeNull()
      expect(iframe().title).toBe('Plain')
    } finally {
      await app.close()
    }
  })
})
