import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Material3Provider, useResolvedColorMode } from '@language-lit/material3-expressive'
import type { ColorMode, Material3Theme, ResolvedColorMode } from '@language-lit/material3-expressive/theme'
import type { Implementation, Transport } from '@modelcontextprotocol/client'
import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiAppCapabilities,
  type McpUiDisplayMode,
  type McpUiHostCapabilities,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps'

import { cx } from '../internal/classNames'
import { McpAppContext, type McpAppState, type McpAppStatus, type McpAppToolCall } from './context'

export interface McpAppProviderProps {
  /** The app's identity, announced to the host in `ui/initialize`. */
  readonly appInfo: Implementation
  /** Capabilities the app declares, such as the display modes it supports. */
  readonly capabilities?: McpUiAppCapabilities
  /** The Material theme. Defaults to the design system's default theme. */
  readonly theme?: Material3Theme
  /**
   * Forces a color mode. By default the app follows the host's `theme`,
   * falling back to `system` until the host has said.
   */
  readonly colorMode?: ColorMode
  /** Passed through to `Material3Provider` for the `system` fallback. */
  readonly systemModeFallback?: ResolvedColorMode
  /**
   * The transport to the host. Defaults to a `PostMessageTransport` to
   * `window.parent`, which is what an iframe-sandboxed app needs. Read once
   * when the app is created; changing it later has no effect.
   */
  readonly transport?: Transport
  /** Reports the app's size to the host as it changes. Defaults to `true`. */
  readonly autoResize?: boolean
  /**
   * Sets the host's `--color-*` and `--font-*` style variables on the app
   * root and injects the host's `@font-face` CSS. Defaults to `true`.
   */
  readonly applyHostStyles?: boolean
  /**
   * Mirrors the resolved Material color mode (including overrides) onto `document.documentElement` as `data-theme`
   * and `color-scheme`, so native controls and scrollbars match. Defaults to
   * `true`.
   */
  readonly applyDocumentColorScheme?: boolean
  readonly onConnected?: (app: App) => void
  readonly onError?: (error: Error) => void
  readonly children?: ReactNode
  readonly className?: string
  readonly style?: CSSProperties
}

const EMPTY_TOOL_CALL: McpAppToolCall = {
  input: undefined,
  partialInput: undefined,
  result: undefined,
  cancelled: undefined,
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}

/**
 * Connects an MCP App built with Material 3 Expressive to its host.
 *
 * The provider owns the `App` for the component's lifetime, completes the
 * handshake, and keeps the host context current. It mounts a
 * `Material3Provider` whose color mode follows the host theme, exposes the
 * host's style variables on the app root, sizes the root to the host's safe
 * areas, and hands the tool call and display mode to the hooks in this entry.
 */
export function McpAppProvider(props: McpAppProviderProps): ReactNode {
  const {
    appInfo,
    capabilities,
    theme,
    colorMode,
    systemModeFallback,
    transport,
    autoResize = true,
    applyHostStyles = true,
    applyDocumentColorScheme = true,
    onConnected,
    onError,
    children,
    className,
    style,
  } = props

  const rootRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<App | null>(null)
  const callbacks = useRef({ onConnected, onError, transport })
  useEffect(() => {
    callbacks.current = { onConnected, onError, transport }
  })

  const [status, setStatus] = useState<McpAppStatus>('connecting')
  const [app, setApp] = useState<App | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>(undefined)
  const [hostCapabilities, setHostCapabilities] = useState<McpUiHostCapabilities | undefined>(undefined)
  const [toolCall, setToolCall] = useState<McpAppToolCall>(EMPTY_TOOL_CALL)

  const appInfoKey = JSON.stringify([appInfo.name, appInfo.version, appInfo.title ?? null])
  const capabilitiesKey = JSON.stringify(capabilities ?? null)

  useEffect(() => {
    let disposed = false
    const instance = new App(appInfo, capabilities ?? {}, { autoResize })
    appRef.current = instance
    setStatus('connecting')
    setError(null)
    setApp(null)
    setHostContext(undefined)
    setHostCapabilities(undefined)
    setToolCall(EMPTY_TOOL_CALL)

    // Listeners are attached before `connect`: tool notifications are one-shot
    // and the SDK insists on a listener being present before they can arrive.
    instance.addEventListener('hostcontextchanged', (params) => {
      if (disposed) return
      setHostContext((previous) => ({ ...previous, ...params }))
    })
    instance.addEventListener('toolinput', (params) => {
      if (disposed) return
      setToolCall((previous) => ({ ...previous, input: params.arguments ?? {} }))
    })
    instance.addEventListener('toolinputpartial', (params) => {
      if (disposed) return
      setToolCall((previous) => ({ ...previous, partialInput: params.arguments ?? {} }))
    })
    instance.addEventListener('toolresult', (params) => {
      if (disposed) return
      setToolCall((previous) => ({ ...previous, result: params }))
    })
    instance.addEventListener('toolcancelled', (params) => {
      if (disposed) return
      setToolCall((previous) => ({
        ...previous,
        cancelled: { ...(params.reason ? { reason: params.reason } : {}) },
      }))
    })
    instance.onteardown = async () => {
      if (!disposed) {
        appRef.current = null
        setApp(null)
        setStatus('closed')
      }
      return {}
    }

    instance.connect(callbacks.current.transport).then(
      () => {
        if (disposed) return
        setHostContext(instance.getHostContext())
        setHostCapabilities(instance.getHostCapabilities())
        setApp(instance)
        setStatus('connected')
        callbacks.current.onConnected?.(instance)
      },
      (cause: unknown) => {
        if (disposed) return
        const failure = toError(cause)
        setError(failure)
        setStatus('error')
        callbacks.current.onError?.(failure)
      },
    )

    return () => {
      disposed = true
      appRef.current = null
      instance.close().catch(() => {})
    }
    // The app's identity and capabilities are what the handshake announces;
    // the objects carrying them may be re-created on every render. The
    // transport is read once, when the app is created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appInfoKey, capabilitiesKey, autoResize])

  const variables = hostContext?.styles?.variables
  const fontCss = hostContext?.styles?.css?.fonts
  useEffect(() => {
    if (!applyHostStyles) return
    const root = rootRef.current
    if (variables && root) applyHostStyleVariables(variables, root)
  }, [applyHostStyles, variables])
  useEffect(() => {
    if (!applyHostStyles || !fontCss) return
    applyHostFonts(fontCss)
  }, [applyHostStyles, fontCss])

  const hostTheme = hostContext?.theme

  const requestDisplayMode = useCallback(async (mode: McpUiDisplayMode): Promise<McpUiDisplayMode> => {
    const instance = appRef.current
    if (!instance) throw new Error('The app is not connected to a host yet.')
    const result = await instance.requestDisplayMode({ mode })
    setHostContext((previous) => ({ ...previous, displayMode: result.mode }))
    return result.mode
  }, [])

  const state = useMemo<McpAppState>(
    () => ({
      app,
      status,
      isConnected: status === 'connected',
      error,
      hostContext,
      hostCapabilities,
      toolCall,
      requestDisplayMode,
    }),
    [app, status, error, hostContext, hostCapabilities, toolCall, requestDisplayMode],
  )

  const displayMode = hostContext?.displayMode ?? 'inline'
  const insets = hostContext?.safeAreaInsets
  const rootStyle = useMemo<CSSProperties>(() => {
    const vars: Record<string, string> = {}
    if (insets) {
      vars['--m3e-mcp-safe-area-top'] = `${insets.top}px`
      vars['--m3e-mcp-safe-area-right'] = `${insets.right}px`
      vars['--m3e-mcp-safe-area-bottom'] = `${insets.bottom}px`
      vars['--m3e-mcp-safe-area-left'] = `${insets.left}px`
    }
    return { ...(vars as CSSProperties), ...style }
  }, [insets, style])

  return (
    <Material3Provider
      theme={theme}
      colorMode={colorMode ?? hostTheme ?? 'system'}
      systemModeFallback={systemModeFallback}
      className="m3e-mcp-app-theme"
    >
      <DocumentColorScheme enabled={applyDocumentColorScheme} />
      <McpAppContext.Provider value={state}>
        <div
          ref={rootRef}
          className={cx('m3e-mcp-app', `m3e-mcp-app--${displayMode}`, className)}
          style={rootStyle}
          data-status={status}
          data-display-mode={displayMode}
        >
          {children}
        </div>
      </McpAppContext.Provider>
    </Material3Provider>
  )
}

/** Read the public Material context so system mode and explicit overrides agree. */
function DocumentColorScheme({ enabled }: { readonly enabled: boolean }): ReactNode {
  const mode = useResolvedColorMode()
  useEffect(() => {
    if (!enabled) return
    const root = document.documentElement
    const previousTheme = root.getAttribute('data-theme')
    const previousScheme = root.style.getPropertyValue('color-scheme')
    const previousPriority = root.style.getPropertyPriority('color-scheme')
    applyDocumentTheme(mode)
    return () => {
      if (previousTheme === null) root.removeAttribute('data-theme')
      else root.setAttribute('data-theme', previousTheme)
      if (previousScheme) root.style.setProperty('color-scheme', previousScheme, previousPriority)
      else root.style.removeProperty('color-scheme')
    }
  }, [enabled, mode])
  return null
}
