import { createContext, useContext } from 'react'
import type { CallToolResult } from '@modelcontextprotocol/client'
import type { App, McpUiDisplayMode, McpUiHostCapabilities, McpUiHostContext } from '@modelcontextprotocol/ext-apps'

/** The provider's lifecycle, also exposed as `data-status` on the app root. */
export type McpAppStatus = 'connecting' | 'connected' | 'closed' | 'error'

export interface McpAppToolCall<TArgs = Record<string, unknown>> {
  /** The complete tool arguments, once the host has sent them. */
  readonly input: TArgs | undefined
  /** The latest partial arguments while the model is still streaming them. */
  readonly partialInput: Partial<TArgs> | undefined
  /** The tool result, once the host has sent it. */
  readonly result: CallToolResult | undefined
  /** Set when the host reports the tool call was cancelled. */
  readonly cancelled: { readonly reason?: string } | undefined
}

export interface McpAppState {
  /** The connected `App`, or `null` until the handshake completes. */
  readonly app: App | null
  readonly status: McpAppStatus
  readonly isConnected: boolean
  readonly error: Error | null
  /** The host context as last announced, merged with every change since. */
  readonly hostContext: McpUiHostContext | undefined
  readonly hostCapabilities: McpUiHostCapabilities | undefined
  readonly toolCall: McpAppToolCall
  /** Asks the host for a display mode; resolves to the mode the host granted. */
  readonly requestDisplayMode: (mode: McpUiDisplayMode) => Promise<McpUiDisplayMode>
}

export const McpAppContext = createContext<McpAppState | null>(null)

/** The app's connection, host context and tool call. Must be used under `McpAppProvider`. */
export function useMcpApp(): McpAppState {
  const state = useContext(McpAppContext)
  if (!state) throw new Error('useMcpApp must be used inside <McpAppProvider>')
  return state
}

/** The host context, or `undefined` before the handshake completes. */
export function useHostContext(): McpUiHostContext | undefined {
  return useMcpApp().hostContext
}

/** The tool call that produced this app, as the host delivers it. */
export function useToolCall<TArgs = Record<string, unknown>>(): McpAppToolCall<TArgs> {
  return useMcpApp().toolCall as McpAppToolCall<TArgs>
}

export interface McpAppDisplayMode {
  readonly displayMode: McpUiDisplayMode
  readonly availableDisplayModes: readonly McpUiDisplayMode[]
  readonly requestDisplayMode: (mode: McpUiDisplayMode) => Promise<McpUiDisplayMode>
}

/** The current display mode, the modes the host offers, and a way to ask for one. */
export function useDisplayMode(): McpAppDisplayMode {
  const { hostContext, requestDisplayMode } = useMcpApp()
  return {
    displayMode: hostContext?.displayMode ?? 'inline',
    availableDisplayModes: hostContext?.availableDisplayModes ?? ['inline'],
    requestDisplayMode,
  }
}
