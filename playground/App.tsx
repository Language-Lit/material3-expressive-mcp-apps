import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Material3Provider,
  SegmentedButtonGroup,
  Select,
  Surface,
  Text,
} from '@language-lit/material3-expressive'
import type { CallToolResult, Client, Tool } from '@modelcontextprotocol/client'
import type { McpUiDisplayMode } from '@modelcontextprotocol/ext-apps'

import { McpAppFrame, useMcpAppResource, type McpAppFrameStatus } from '../src'
import { FORECAST_URI, connectDemoServer } from './server'

type ColorMode = 'light' | 'dark' | 'system'

const sandboxUrl = new URL(new URLSearchParams(location.search).get('sandboxUrl') ?? 'http://127.0.0.1:5474/sandbox.html')
sandboxUrl.searchParams.set('hostOrigin', location.origin)

const CITIES = ['Lisbon', 'São Paulo', 'Tokyo', 'Reykjavík']

interface LogEntry {
  readonly kind: string
  readonly text: string
}

export function App() {
  const [active, setActive] = useState(true)
  const [colorMode, setColorMode] = useState<ColorMode>('system')
  const [client, setClient] = useState<Client | null>(null)
  const [tool, setTool] = useState<Tool | undefined>(undefined)
  const [city, setCity] = useState(CITIES[0] ?? 'Lisbon')
  const [modes, setModes] = useState<readonly string[]>(['inline', 'fullscreen', 'pip'])
  const [toolInput, setToolInput] = useState<Record<string, unknown> | undefined>(undefined)
  const [toolResult, setToolResult] = useState<CallToolResult | undefined>(undefined)
  const [status, setStatus] = useState<McpAppFrameStatus | 'idle'>('idle')
  const [log, setLog] = useState<LogEntry[]>([])

  const record = useCallback((kind: string, text: string) => {
    setLog((entries) => [{ kind, text }, ...entries].slice(0, 60))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.m3eColorMode = colorMode
  }, [colorMode])

  useEffect(() => {
    let active = true
    let connection: Awaited<ReturnType<typeof connectDemoServer>> | undefined
    connectDemoServer().then(async (result) => {
      if (!active) {
        await result.client.close()
        return
      }
      connection = result
      const tools = await result.client.listTools()
      setTool(tools.tools.find((item) => item.name === 'get_forecast'))
      setClient(result.client)
    })
    return () => {
      active = false
      void connection?.client.close()
      void connection?.server.close()
    }
  }, [])

  const { resource, error } = useMcpAppResource(client, FORECAST_URI)

  const run = async () => {
    if (!client) return
    const input = { city }
    setToolInput(input)
    setToolResult(undefined)
    record('host', `tools/call get_forecast ${JSON.stringify(input)}`)
    const result = (await client.callTool({ name: 'get_forecast', arguments: input })) as CallToolResult
    setToolResult(result)
    record('host', 'tool result delivered to the app')
  }

  const availableDisplayModes = useMemo(
    () => (['inline', 'fullscreen', 'pip'] as const).filter((mode) => modes.includes(mode)) as McpUiDisplayMode[],
    [modes],
  )

  return (
    <Material3Provider colorMode={colorMode} style={{ blockSize: '100%' }}>
      <div className="pg-shell">
        <div className="pg-bar">
          <div>
            <Text as="h1" variant="titleLarge" style={{ margin: 0 }}>
              MCP Apps · Material 3 Expressive
            </Text>
            <Text as="p" variant="bodySmall" style={{ margin: 0 }}>
              An in-memory MCP server, a Material host frame, and a Material app in the sandbox. No backend.
            </Text>
          </div>
          <div className="pg-bar__actions">
            <Select
              label="City"
              options={CITIES.map((value) => ({ value, label: value }))}
              value={city}
              onValueChange={setCity}
              className="pg-select"
            />
            <Button variant="filled" onClick={() => void run()} disabled={!client || !resource}>
              Call get_forecast
            </Button>
            <Button variant="outlined" disabled={status === 'connecting' || status === 'closing' || status === 'idle'} onClick={() => setActive(status === 'closed')}>
              {status === 'closed' ? 'Reopen app' : 'Close app'}
            </Button>
            <SegmentedButtonGroup
              multiple
              segments={[
                { value: 'inline', label: 'Inline' },
                { value: 'fullscreen', label: 'Full screen' },
                { value: 'pip', label: 'PiP' },
              ]}
              value={modes}
              onValueChange={(value) => setModes(value.includes('inline') ? value : ['inline', ...value])}
            />
            <SegmentedButtonGroup
              segments={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
              value={colorMode}
              onValueChange={(value) => setColorMode(value as ColorMode)}
            />
          </div>
        </div>
        <div className="pg-body">
          <Surface as="section" color="surface-container-low" shape="large" className="pg-stage" aria-label="Conversation">
            <Text as="p" variant="bodyMedium" className="pg-stage__description">
              The frame below is what a chat host renders for the tool call. Status: <strong>{status}</strong>.
            </Text>
            {error ? (
              <Text as="p" variant="bodyMedium" className="pg-log__error">
                {error.message}
              </Text>
            ) : null}
            {client && resource && tool ? (
              <McpAppFrame
                client={client}
                sandboxUrl={sandboxUrl.href}
                active={active}
                resource={resource}
                toolInfo={{ id: 1, tool }}
                toolInput={toolInput}
                toolResult={toolResult}
                availableDisplayModes={availableDisplayModes}
                maxHeight={520}
                onStatusChange={(next) => {
                  setStatus(next)
                  record('frame', `status ${next}`)
                }}
                onInitialized={(info) => record('app', `initialized ${info.appInfo?.name}@${info.appInfo?.version}`)}
                onDisplayModeChange={(mode) => record('frame', `display mode ${mode}`)}
                onSizeChange={(size) => record('app', `size ${size.width ?? '·'}×${size.height ?? '·'}`)}
                onMessage={(params) =>
                  record('app', `ui/message ${params.content.map((block) => ('text' in block ? block.text : block.type)).join(' ')}`)
                }
                onUpdateModelContext={(params) =>
                  record('app', `ui/update-model-context ${params.content?.map((block) => ('text' in block ? block.text : block.type)).join(' ') ?? ''}`)
                }
                onOpenLink={(url) => {
                  record('app', `ui/open-link ${url}`)
                  return false
                }}
                onLog={(params) => record('app', `log ${params.level}: ${JSON.stringify(params.data)}`)}
                onError={(failure) => record('error', failure.message)}
              />
            ) : (
              <Text as="p" variant="bodyMedium">
                Connecting the in-memory server…
              </Text>
            )}
          </Surface>
          <Surface as="aside" color="surface-container" shape="large" className="pg-log" aria-label="Event log">
            <Text as="h2" variant="titleMedium" style={{ margin: 0 }}>
              Events
            </Text>
            <ul className="pg-log__list">
              {log.map((entry, index) => (
                <li key={index} className={entry.kind === 'error' ? 'pg-log__error' : undefined}>
                  <Text as="span" variant="labelMedium" className="pg-log__kind">
                    {entry.kind}
                  </Text>{' '}
                  <Text as="span" variant="bodySmall">
                    {entry.text}
                  </Text>
                </li>
              ))}
            </ul>
          </Surface>
        </div>
      </div>
    </Material3Provider>
  )
}
