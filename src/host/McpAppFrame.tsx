import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  Icon,
  IconButton,
  LinearProgress,
  Surface,
  Text,
  useMaterial3Theme,
  useResolvedColorMode,
} from '@language-lit/material3-expressive'
import type {
  CallToolResult,
  Client,
  Implementation,
  LoggingMessageNotificationParams,
  Transport,
} from '@modelcontextprotocol/client'
import { AppBridge, buildAllowAttribute } from '@modelcontextprotocol/ext-apps/app-bridge'
import {
  PostMessageTransport,
  type McpUiAppCapabilities,
  type McpUiDisplayMode,
  type McpUiDownloadFileRequest,
  type McpUiHostCapabilities,
  type McpUiHostContext,
  type McpUiMessageRequest,
  type McpUiStyles,
  type McpUiUpdateModelContextRequest,
} from '@modelcontextprotocol/ext-apps'

import { sandboxDocument } from './sandboxDocument'
import { cx } from '../internal/classNames'
import { FullscreenExitGlyph, FullscreenGlyph, PipExitGlyph, PipGlyph } from '../internal/icons'
import { PACKAGE_NAME, PACKAGE_VERSION } from '../internal/package'
import {
  detectDeviceCapabilities,
  detectLocale,
  detectTimeZone,
  readMaterialStyleVariables,
  toHostTheme,
} from './hostContext'
import type { McpAppResource } from './resource'

/** The frame's lifecycle, also exposed as `data-status` on its root. */
export type McpAppFrameStatus = 'connecting' | 'ready' | 'closed' | 'error'

export type McpAppPlatform = NonNullable<McpUiHostContext['platform']>
export type McpAppToolInfo = NonNullable<McpUiHostContext['toolInfo']>
export type McpAppSafeAreaInsets = NonNullable<McpUiHostContext['safeAreaInsets']>

export interface McpAppInitializedInfo {
  readonly appInfo: Implementation | undefined
  readonly appCapabilities: McpUiAppCapabilities | undefined
}

export interface McpAppFrameProps {
  /**
   * The connected MCP client for the server that owns the app. The frame
   * proxies the app's tool calls and resource reads through it. Pass `null`
   * for an app that needs no server access.
   */
  readonly client: Client | null
  /** The UI resource to render; see `readMcpAppResource`. */
  readonly resource: McpAppResource
  /** The host identity announced to the app. Defaults to this package. */
  readonly hostInfo?: Implementation
  /** The tool call that produced the app, exposed to it as `toolInfo`. */
  readonly toolInfo?: McpAppToolInfo
  /**
   * The tool call's complete arguments. Sent once the app has initialized and
   * again whenever the reference changes.
   */
  readonly toolInput?: Record<string, unknown>
  /** The tool call's result. Sent once the app has initialized and whenever the reference changes. */
  readonly toolResult?: CallToolResult
  /** Tells the app its tool call was cancelled. Sent whenever the reference changes. */
  readonly toolCancelled?: { readonly reason?: string }
  /** The accessible name of the frame. Defaults to the tool's title or name. */
  readonly title?: string
  /** Controlled display mode. */
  readonly displayMode?: McpUiDisplayMode
  /** Initial display mode when uncontrolled. Defaults to `inline`. */
  readonly defaultDisplayMode?: McpUiDisplayMode
  readonly onDisplayModeChange?: (mode: McpUiDisplayMode) => void
  /** Display modes the host offers. Defaults to `['inline']`. */
  readonly availableDisplayModes?: readonly McpUiDisplayMode[]
  /** Caps the inline height in CSS pixels and is announced as `containerDimensions.maxHeight`. */
  readonly maxHeight?: number
  /** The inline height before the app reports its own. Defaults to 96. */
  readonly minHeight?: number
  /**
   * Style variables to send instead of those derived from the Material
   * theme. Most hosts leave this unset and let the frame read its tokens.
   */
  readonly styleVariables?: McpUiStyles
  /** `@font-face` CSS the app may apply; see `collectFontFaceCss`. */
  readonly fonts?: string
  /** Overrides the detected BCP 47 locale. */
  readonly locale?: string
  /** Overrides the detected IANA time zone. */
  readonly timeZone?: string
  /** Defaults to `web`. */
  readonly platform?: McpAppPlatform
  readonly safeAreaInsets?: McpAppSafeAreaInsets
  /**
   * Loads the app through a sandbox proxy document at this URL instead of
   * `srcdoc`. The proxy receives the HTML once it reports ready.
   */
  readonly sandboxUrl?: string
  /** Overrides the iframe `sandbox` attribute (or the inner sandbox under a proxy). */
  readonly sandbox?: string
  /**
   * Supplies the transport to the app instead of a `PostMessageTransport` to
   * the iframe's window, for hosts whose sandbox is not an iframe. Read once
   * when the bridge is created; changing it later has no effect.
   */
  readonly transport?: (iframe: HTMLIFrameElement) => Transport
  /**
   * Handles `ui/open-link`. Return `false` to refuse. Without a handler the
   * frame opens `http` and `https` URLs in a new tab with `noopener`.
   */
  readonly onOpenLink?: (url: string) => boolean | void | Promise<boolean | void>
  /** Handles `ui/download-file`. Advertised only when provided. Return `false` to refuse. */
  readonly onDownloadFile?: (
    params: McpUiDownloadFileRequest['params'],
  ) => boolean | void | Promise<boolean | void>
  /** Receives `ui/message`, the app asking to add a user turn. Advertised only when provided. */
  readonly onMessage?: (params: McpUiMessageRequest['params']) => boolean | void | Promise<boolean | void>
  /** Receives `ui/update-model-context`. Advertised only when provided. */
  readonly onUpdateModelContext?: (params: McpUiUpdateModelContextRequest['params']) => void | Promise<void>
  /** Receives the app's log notifications. */
  readonly onLog?: (params: LoggingMessageNotificationParams) => void
  readonly onInitialized?: (info: McpAppInitializedInfo) => void
  readonly onSizeChange?: (size: { readonly width?: number; readonly height?: number }) => void
  /** The app asked to be removed. The frame hides it; the host decides what to unmount. */
  readonly onTeardownRequest?: () => void
  readonly onStatusChange?: (status: McpAppFrameStatus) => void
  readonly onError?: (error: Error) => void
  /** The live bridge, for hosts that need the protocol directly; `null` once closed. */
  readonly onBridge?: (bridge: AppBridge | null) => void
  readonly className?: string
  readonly style?: CSSProperties
}

const DEFAULT_HOST_INFO: Implementation = { name: PACKAGE_NAME, version: PACKAGE_VERSION }
const DEFAULT_MODES: readonly McpUiDisplayMode[] = ['inline']
const DEFAULT_SANDBOX = 'allow-scripts allow-forms'
const PROXY_SANDBOX = 'allow-scripts allow-same-origin allow-forms'
const DEFAULT_MIN_HEIGHT = 96
const ALL_CONTENT_MODALITIES = { text: {}, image: {}, audio: {}, resource: {}, resourceLink: {} }

function useLatest<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}

function openLinkByDefault(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  if (typeof window === 'undefined') return false
  window.open(parsed.href, '_blank', 'noopener,noreferrer')
  return true
}

interface HostContextInput {
  readonly theme: McpUiHostContext['theme']
  readonly styles: McpUiStyles | undefined
  readonly fonts: string | undefined
  readonly displayMode: McpUiDisplayMode
  readonly availableDisplayModes: readonly McpUiDisplayMode[]
  readonly width: number | undefined
  readonly height: number | undefined
  readonly maxHeight: number | undefined
  readonly locale: string | undefined
  readonly timeZone: string | undefined
  readonly hostInfo: Implementation
  readonly platform: McpAppPlatform
  readonly deviceCapabilities: McpUiHostContext['deviceCapabilities']
  readonly safeAreaInsets: McpAppSafeAreaInsets | undefined
  readonly toolInfo: McpAppToolInfo | undefined
}

/** Assembles the host context the frame announces. Exported for hosts that build their own bridge. */
export function buildHostContext(input: HostContextInput): McpUiHostContext {
  const context: McpUiHostContext = {
    theme: input.theme,
    displayMode: input.displayMode,
    availableDisplayModes: [...input.availableDisplayModes],
    platform: input.platform,
    userAgent: `${input.hostInfo.name}/${input.hostInfo.version}`,
  }
  if (input.toolInfo) context.toolInfo = input.toolInfo
  if (input.styles || input.fonts) {
    context.styles = {
      ...(input.styles ? { variables: input.styles } : {}),
      ...(input.fonts ? { css: { fonts: input.fonts } } : {}),
    }
  }
  if (input.width !== undefined) {
    context.containerDimensions =
      input.displayMode === 'inline'
        ? { width: input.width, ...(input.maxHeight !== undefined ? { maxHeight: input.maxHeight } : {}) }
        : input.height !== undefined
          ? { width: input.width, height: input.height }
          : { width: input.width }
  }
  if (input.locale) context.locale = input.locale
  if (input.timeZone) context.timeZone = input.timeZone
  if (input.deviceCapabilities) context.deviceCapabilities = input.deviceCapabilities
  if (input.safeAreaInsets) context.safeAreaInsets = input.safeAreaInsets
  return context
}

interface HostCapabilitiesInput {
  readonly client: Client | null
  readonly resource: McpAppResource
  readonly downloadFile: boolean
  readonly message: boolean
  readonly updateModelContext: boolean
}

/** Assembles the capabilities the frame advertises. Exported for hosts that build their own bridge. */
export function buildHostCapabilities(input: HostCapabilitiesInput): McpUiHostCapabilities {
  const server = input.client?.getServerCapabilities()
  const capabilities: McpUiHostCapabilities = { openLinks: {}, logging: {} }
  if (input.downloadFile) capabilities.downloadFile = {}
  if (server?.tools) capabilities.serverTools = { listChanged: Boolean(server.tools.listChanged) }
  if (server?.resources) capabilities.serverResources = { listChanged: Boolean(server.resources.listChanged) }
  if (input.message) capabilities.message = { ...ALL_CONTENT_MODALITIES }
  if (input.updateModelContext) {
    capabilities.updateModelContext = { ...ALL_CONTENT_MODALITIES, structuredContent: {} }
  }
  const meta = input.resource.meta
  if (meta?.permissions || meta?.csp) {
    capabilities.sandbox = {
      ...(meta.permissions ? { permissions: meta.permissions } : {}),
      ...(meta.csp ? { csp: meta.csp } : {}),
    }
  }
  return capabilities
}

/**
 * Embeds an MCP App in a Material 3 Expressive host.
 *
 * The frame owns the sandboxed iframe and the `AppBridge` behind it. It
 * derives the host context from the surrounding `Material3Provider` (theme,
 * style variables read from the live tokens, container dimensions, locale,
 * time zone, device capabilities), keeps that context in sync as the theme or
 * layout changes, follows the app's reported height inline, and offers the
 * display modes the host allows through Material controls.
 */
export function McpAppFrame(props: McpAppFrameProps): ReactNode {
  const {
    client,
    resource,
    hostInfo,
    toolInfo,
    toolInput,
    toolResult,
    toolCancelled,
    title,
    displayMode: controlledMode,
    defaultDisplayMode = 'inline',
    onDisplayModeChange,
    availableDisplayModes = DEFAULT_MODES,
    maxHeight,
    minHeight = DEFAULT_MIN_HEIGHT,
    styleVariables,
    fonts,
    locale,
    timeZone,
    platform = 'web',
    safeAreaInsets,
    sandboxUrl,
    sandbox,
    transport,
    onOpenLink,
    onDownloadFile,
    onMessage,
    onUpdateModelContext,
    onLog,
    onInitialized,
    onSizeChange,
    onTeardownRequest,
    onStatusChange,
    onError,
    onBridge,
    className,
    style,
  } = props

  const resolvedColorMode = useResolvedColorMode()
  const theme = useMaterial3Theme()

  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const bridgeRef = useRef<AppBridge | null>(null)
  const sentRef = useRef<{ input?: unknown; result?: unknown; cancelled?: unknown }>({})

  const [status, setStatusState] = useState<McpAppFrameStatus>('connecting')
  const [error, setError] = useState<Error | null>(null)
  const [uncontrolledMode, setUncontrolledMode] = useState<McpUiDisplayMode>(defaultDisplayMode)
  const [appHeight, setAppHeight] = useState<number | undefined>(undefined)
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number } | undefined>(undefined)
  const [styles, setStyles] = useState<McpUiStyles | undefined>(styleVariables)

  const mode = controlledMode ?? uncontrolledMode
  const effectiveHostInfo = useMemo(
    () => hostInfo ?? DEFAULT_HOST_INFO,
    // The identity is what matters on the wire, not the object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hostInfo?.name, hostInfo?.version, hostInfo?.title],
  )
  const deviceCapabilities = useMemo(() => detectDeviceCapabilities(), [])
  const resolvedLocale = locale ?? detectLocale()
  const resolvedTimeZone = timeZone ?? detectTimeZone()

  const latest = useLatest({
    mode,
    availableDisplayModes,
    transport,
    onDisplayModeChange,
    onOpenLink,
    onDownloadFile,
    onMessage,
    onUpdateModelContext,
    onLog,
    onInitialized,
    onSizeChange,
    onTeardownRequest,
    onStatusChange,
    onError,
    onBridge,
  })

  const setStatus = useCallback(
    (next: McpAppFrameStatus) => {
      setStatusState(next)
      latest.current.onStatusChange?.(next)
    },
    [latest],
  )

  const changeMode = useCallback(
    (next: McpUiDisplayMode) => {
      if (controlledMode === undefined) setUncontrolledMode(next)
      latest.current.onDisplayModeChange?.(next)
    },
    [controlledMode, latest],
  )
  const changeModeRef = useLatest(changeMode)

  // Style variables follow the theme: the color mode or the theme object
  // changing means the tokens the frame read have new values.
  useEffect(() => {
    if (styleVariables) {
      setStyles(styleVariables)
      return
    }
    const root = rootRef.current
    if (root) setStyles(readMaterialStyleVariables(root))
  }, [styleVariables, resolvedColorMode, theme])

  // The viewport's size is the app's container. Re-observed on a display-mode
  // change because the viewport moves to a different box then.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = (width: number, height: number) => {
      const next = { width: Math.round(width), height: Math.round(height) }
      setViewportSize((previous) =>
        previous && previous.width === next.width && previous.height === next.height ? previous : next,
      )
    }
    const rect = viewport.getBoundingClientRect()
    measure(rect.width, rect.height)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) measure(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [mode])

  const hostContext = useMemo(
    () =>
      buildHostContext({
        theme: toHostTheme(resolvedColorMode),
        styles,
        fonts,
        displayMode: mode,
        availableDisplayModes,
        width: viewportSize?.width,
        height: viewportSize?.height,
        maxHeight,
        locale: resolvedLocale,
        timeZone: resolvedTimeZone,
        hostInfo: effectiveHostInfo,
        platform,
        deviceCapabilities,
        safeAreaInsets,
        toolInfo,
      }),
    [
      resolvedColorMode,
      styles,
      fonts,
      mode,
      availableDisplayModes,
      viewportSize,
      maxHeight,
      resolvedLocale,
      resolvedTimeZone,
      effectiveHostInfo,
      platform,
      deviceCapabilities,
      safeAreaInsets,
      toolInfo,
    ],
  )
  const hostContextRef = useLatest(hostContext)

  const metaKey = JSON.stringify(resource.meta ?? null)
  const hasDownloadFile = Boolean(onDownloadFile)
  const hasMessage = Boolean(onMessage)
  const hasUpdateModelContext = Boolean(onUpdateModelContext)

  // One bridge per resource. Everything the app can observe later flows
  // through `setHostContext`; everything it must know at initialization is
  // measured here, synchronously, before the document is loaded.
  useEffect(() => {
    const iframe = iframeRef.current
    const root = rootRef.current
    const viewport = viewportRef.current
    if (!iframe || !root || !viewport) return

    let disposed = false
    sentRef.current = {}
    setError(null)
    setAppHeight(undefined)
    setStatus('connecting')

    const fail = (cause: unknown) => {
      if (disposed) return
      const failure = toError(cause)
      setError(failure)
      setStatus('error')
      latest.current.onError?.(failure)
    }

    if (client && !client.getServerCapabilities()) {
      fail(new Error('McpAppFrame needs a connected client: call client.connect() before rendering the frame.'))
      return
    }

    const rect = viewport.getBoundingClientRect()
    const initialContext = buildHostContext({
      ...hostContextRef.current,
      theme: hostContextRef.current.theme,
      styles: styleVariables ?? readMaterialStyleVariables(root),
      fonts,
      displayMode: latest.current.mode,
      availableDisplayModes: latest.current.availableDisplayModes,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      maxHeight,
      locale: resolvedLocale,
      timeZone: resolvedTimeZone,
      hostInfo: effectiveHostInfo,
      platform,
      deviceCapabilities,
      safeAreaInsets,
      toolInfo,
    })

    const capabilities = buildHostCapabilities({
      client,
      resource,
      downloadFile: hasDownloadFile,
      message: hasMessage,
      updateModelContext: hasUpdateModelContext,
    })

    const bridge = new AppBridge(client, effectiveHostInfo, capabilities, { hostContext: initialContext })
    bridgeRef.current = bridge

    bridge.addEventListener('initialized', () => {
      if (disposed) return
      setStatus('ready')
      latest.current.onInitialized?.({
        appInfo: bridge.getAppVersion(),
        appCapabilities: bridge.getAppCapabilities(),
      })
    })
    bridge.addEventListener('sizechange', (params) => {
      if (disposed) return
      if (typeof params.height === 'number' && Number.isFinite(params.height)) {
        setAppHeight(Math.max(0, Math.ceil(params.height)))
      }
      latest.current.onSizeChange?.(params)
    })
    bridge.addEventListener('sandboxready', () => {
      if (disposed) return
      bridge
        .sendSandboxResourceReady({
          html: resource.html,
          sandbox: sandbox ?? DEFAULT_SANDBOX,
          ...(resource.meta?.csp ? { csp: resource.meta.csp } : {}),
          ...(resource.meta?.permissions ? { permissions: resource.meta.permissions } : {}),
        })
        .catch(fail)
    })
    bridge.addEventListener('requestteardown', () => {
      if (disposed) return
      setStatus('closed')
      latest.current.onTeardownRequest?.()
    })
    bridge.addEventListener('loggingmessage', (params) => {
      if (disposed) return
      latest.current.onLog?.(params)
    })

    bridge.onrequestdisplaymode = async ({ mode: requested }) => {
      if (latest.current.availableDisplayModes.includes(requested)) {
        changeModeRef.current(requested)
        return { mode: requested }
      }
      return { mode: latest.current.mode }
    }
    bridge.onopenlink = async ({ url }) => {
      const handler = latest.current.onOpenLink
      const outcome = handler ? await handler(url) : openLinkByDefault(url)
      return outcome === false ? { isError: true } : {}
    }
    if (hasDownloadFile) {
      bridge.ondownloadfile = async (params) => {
        const outcome = await latest.current.onDownloadFile?.(params)
        return outcome === false ? { isError: true } : {}
      }
    }
    if (hasMessage) {
      bridge.onmessage = async (params) => {
        const outcome = await latest.current.onMessage?.(params)
        return outcome === false ? { isError: true } : {}
      }
    }
    if (hasUpdateModelContext) {
      bridge.onupdatemodelcontext = async (params) => {
        await latest.current.onUpdateModelContext?.(params)
        return {}
      }
    }

    let link: Transport
    try {
      const createTransport = latest.current.transport
      if (createTransport) {
        link = createTransport(iframe)
      } else {
        const target = iframe.contentWindow
        if (!target) throw new Error('The frame has no window to talk to.')
        link = new PostMessageTransport(target, target)
      }
    } catch (cause) {
      fail(cause)
      return
    }

    bridge.connect(link).then(() => {
      if (disposed) return
      if (sandboxUrl) iframe.src = sandboxUrl
      else iframe.srcdoc = sandboxDocument(resource.html, resource.meta?.csp)
    }).catch(fail)
    latest.current.onBridge?.(bridge)

    return () => {
      disposed = true
      bridgeRef.current = null
      latest.current.onBridge?.(null)
      bridge.close().catch(() => {})
      iframe.removeAttribute('srcdoc')
      iframe.removeAttribute('src')
    }
    // Callback presence is part of the advertised capabilities, so toggling
    // one re-creates the bridge; callback identity does not, and neither does
    // the transport factory, which is read once when the bridge is created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    client,
    resource.uri,
    resource.html,
    metaKey,
    sandboxUrl,
    sandbox,
    effectiveHostInfo,
    hasDownloadFile,
    hasMessage,
    hasUpdateModelContext,
  ])

  // Once the app is initialized, every change the frame observes is diffed
  // and sent as `ui/notifications/host-context-changed`.
  useEffect(() => {
    const bridge = bridgeRef.current
    if (!bridge || status !== 'ready') return
    try {
      bridge.setHostContext(hostContext)
    } catch (cause) {
      latest.current.onError?.(toError(cause))
    }
  }, [hostContext, status, latest])

  useEffect(() => {
    const bridge = bridgeRef.current
    if (!bridge || status !== 'ready') return
    const sent = sentRef.current
    const deliver = async () => {
      if (toolInput !== undefined && sent.input !== toolInput) {
        sent.input = toolInput
        await bridge.sendToolInput({ arguments: toolInput })
      }
      if (toolResult !== undefined && sent.result !== toolResult) {
        sent.result = toolResult
        await bridge.sendToolResult(toolResult)
      }
      if (toolCancelled !== undefined && sent.cancelled !== toolCancelled) {
        sent.cancelled = toolCancelled
        await bridge.sendToolCancelled({ ...(toolCancelled.reason ? { reason: toolCancelled.reason } : {}) })
      }
    }
    deliver().catch((cause) => latest.current.onError?.(toError(cause)))
  }, [status, toolInput, toolResult, toolCancelled, latest])

  const frameTitle = title ?? toolInfo?.tool.title ?? toolInfo?.tool.name ?? 'MCP App'
  const bordered = resource.meta?.prefersBorder !== false
  const showBar = availableDisplayModes.length > 1 || mode !== 'inline'
  const allow = buildAllowAttribute(resource.meta?.permissions)
  const inlineHeight = Math.max(minHeight, Math.min(appHeight ?? minHeight, maxHeight ?? Number.POSITIVE_INFINITY))
  const viewportStyle: CSSProperties | undefined =
    mode === 'inline' ? { blockSize: `${inlineHeight}px` } : undefined

  const controls = showBar ? (
    <div className="m3e-mcp-frame__bar">
      <Text as="span" variant="titleSmall" className="m3e-mcp-frame__title">
        {frameTitle}
      </Text>
      <div className="m3e-mcp-frame__controls">
        {availableDisplayModes.includes('pip') && mode !== 'pip' ? (
          <IconButton size="small" aria-label="Picture in picture" onClick={() => changeMode('pip')}>
            <Icon source={PipGlyph} />
          </IconButton>
        ) : null}
        {mode === 'pip' ? (
          <IconButton size="small" aria-label="Return to the conversation" onClick={() => changeMode('inline')}>
            <Icon source={PipExitGlyph} />
          </IconButton>
        ) : null}
        {availableDisplayModes.includes('fullscreen') && mode !== 'fullscreen' ? (
          <IconButton size="small" aria-label="Enter full screen" onClick={() => changeMode('fullscreen')}>
            <Icon source={FullscreenGlyph} />
          </IconButton>
        ) : null}
        {mode === 'fullscreen' ? (
          <IconButton size="small" aria-label="Exit full screen" onClick={() => changeMode('inline')}>
            <Icon source={FullscreenExitGlyph} />
          </IconButton>
        ) : null}
      </div>
    </div>
  ) : null

  const content = (
    <>
      {controls}
      <div
        ref={viewportRef}
        className="m3e-mcp-frame__viewport"
        style={viewportStyle}
        aria-busy={status === 'connecting' || undefined}
      >
        {status === 'connecting' ? (
          <LinearProgress className="m3e-mcp-frame__progress" aria-label="Loading the app" />
        ) : null}
        <iframe
          ref={iframeRef}
          className="m3e-mcp-frame__iframe"
          title={frameTitle}
          sandbox={sandbox ?? (sandboxUrl ? PROXY_SANDBOX : DEFAULT_SANDBOX)}
          allow={allow || undefined}
          hidden={status === 'closed' || status === 'error'}
        />
        {status === 'error' && error ? (
          <Surface as="div" color="error-container" shape="medium" className="m3e-mcp-frame__notice" role="alert">
            <Text as="p" variant="bodyMedium">
              {error.message}
            </Text>
          </Surface>
        ) : null}
        {status === 'closed' ? (
          <Text as="p" variant="bodyMedium" className="m3e-mcp-frame__closed" role="status">
            The app has closed.
          </Text>
        ) : null}
      </div>
    </>
  )

  const onKeyDown = (event: { key: string }) => {
    if (event.key === 'Escape' && mode !== 'inline' && availableDisplayModes.includes('inline')) {
      changeMode('inline')
    }
  }

  return (
    <div
      ref={rootRef}
      className={cx(
        'm3e-mcp-frame',
        `m3e-mcp-frame--${mode}`,
        bordered && 'm3e-mcp-frame--bordered',
        className,
      )}
      style={style}
      data-status={status}
      data-display-mode={mode}
      onKeyDown={onKeyDown}
    >
      {bordered ? (
        <Surface
          as="section"
          color="surface-container-low"
          shape={mode === 'fullscreen' ? 'none' : 'large'}
          className="m3e-mcp-frame__surface"
          aria-label={frameTitle}
        >
          {content}
        </Surface>
      ) : (
        <section className="m3e-mcp-frame__surface" aria-label={frameTitle}>
          {content}
        </section>
      )}
    </div>
  )
}
