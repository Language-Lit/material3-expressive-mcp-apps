import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { Material3Provider } from '@language-lit/material3-expressive'
import { InMemoryTransport, type JSONRPCMessage } from '@modelcontextprotocol/client'
import { afterEach, expect, it } from 'vitest'
import { McpAppProvider } from '../src/app/McpAppProvider'
import { useMcpApp, useToolCall } from '../src/app/context'
import { McpAppFrame } from '../src/host/McpAppFrame'

afterEach(cleanup)
function Probe() {
  const { status } = useMcpApp()
  const { input, result } = useToolCall<{ city: string }>()
  return <><output data-testid="status">{status}</output><output data-testid="input">{input?.city}</output><output data-testid="result">{JSON.stringify(result)}</output></>
}

it('connects the provider to an independent plain-JSON host', async () => {
  const [host, app] = InMemoryTransport.createLinkedPair()
  const received: JSONRPCMessage[] = []
  host.onmessage = (message) => {
    received.push(message)
    if ('method' in message && message.method === 'ui/initialize' && 'id' in message) {
      void host.send({ jsonrpc: '2.0', id: message.id, result: {
        protocolVersion: '2026-01-26', hostInfo: { name: 'independent-host', version: '1' },
        hostCapabilities: {}, hostContext: { theme: 'dark', displayMode: 'inline' },
      } })
    }
  }
  await host.start()
  const view = render(<McpAppProvider appInfo={{ name: 'wire-app', version: '1' }} transport={app} autoResize={false}><Probe /></McpAppProvider>)
  try {
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('connected'))
    expect(received.some((message) => 'method' in message && message.method === 'ui/notifications/initialized')).toBe(true)
    await act(async () => {
      await host.send({ jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: { city: 'Tokyo' } } })
      await host.send({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { content: [{ type: 'text', text: 'Sunny' }] } })
    })
    expect(screen.getByTestId('input').textContent).toBe('Tokyo')
    expect(screen.getByTestId('result').textContent).toContain('Sunny')
    await act(async () => { await host.send({ jsonrpc: '2.0', id: 100, method: 'ui/resource-teardown', params: {} }) })
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('closed'))
    expect(received).toContainEqual({ jsonrpc: '2.0', id: 100, result: {} })
  } finally { view.unmount(); await host.close() }
})

it('hosts an independent plain-JSON app through initialization, mode refusal and teardown', async () => {
  const [host, app] = InMemoryTransport.createLinkedPair()
  const received: JSONRPCMessage[] = []
  app.onmessage = (message) => {
    received.push(message)
    if ('method' in message && message.method === 'ui/resource-teardown' && 'id' in message) {
      void app.send({ jsonrpc: '2.0', id: message.id, result: {} })
    }
  }
  await app.start()
  const view = render(<Material3Provider><McpAppFrame client={null} resource={{ uri: 'ui://plain-json', html: '<p>Wire app</p>' }}
    transport={() => host} toolInput={{ city: 'Tokyo' }} displayMode="inline" availableDisplayModes={['inline', 'fullscreen']} /></Material3Provider>)
  try {
    await act(async () => { await app.send({ jsonrpc: '2.0', id: 1, method: 'ui/initialize', params: {
      protocolVersion: '2026-01-26', appInfo: { name: 'independent-app', version: '1' }, appCapabilities: {},
    } }) })
    await waitFor(() => expect(received).toContainEqual(expect.objectContaining({ id: 1, result: expect.objectContaining({ protocolVersion: '2026-01-26' }) })))
    await act(async () => { await app.send({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }) })
    await waitFor(() => expect(received).toContainEqual(expect.objectContaining({ method: 'ui/notifications/tool-input', params: { arguments: { city: 'Tokyo' } } })))
    await act(async () => { await app.send({ jsonrpc: '2.0', id: 2, method: 'ui/request-display-mode', params: { mode: 'fullscreen' } }) })
    await waitFor(() => expect(received).toContainEqual({ jsonrpc: '2.0', id: 2, result: { mode: 'inline' } }))
    await act(async () => { await app.send({ jsonrpc: '2.0', method: 'ui/notifications/request-teardown', params: {} }) })
    await waitFor(() => expect(document.querySelector('.m3e-mcp-frame')?.getAttribute('data-status')).toBe('closed'))
    expect(received.some((message) => 'method' in message && message.method === 'ui/resource-teardown')).toBe(true)
  } finally { view.unmount(); await app.close() }
})
