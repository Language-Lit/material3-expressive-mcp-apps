import type {
  McpUiHostContext,
  McpUiStyleVariableKey,
  McpUiStyles,
  McpUiTheme,
} from '@modelcontextprotocol/ext-apps'
import type { ResolvedColorMode } from '@language-lit/material3-expressive/theme'

/** Reads one design token by custom-property name; returns `''` when unset. */
export type TokenReader = (token: string) => string

/**
 * How one MCP Apps style variable is derived from the design system.
 *
 * - `token` reads a `--m3e-*` custom property as-is.
 * - `alpha` wraps the token in a `color-mix()` at the given percentage, which is
 *   how Material expresses its disabled state layers.
 * - `layers` composes several tokens into one value (the hairline shadow).
 * - `literal` is a value the design system has no token for; each one is a
 *   recorded deviation in `docs/SPEC.md`.
 */
export type MaterialStyleVariableSource =
  | { readonly token: string }
  | { readonly token: string; readonly alpha: number }
  | { readonly layers: readonly string[]; readonly format: (values: readonly string[]) => string }
  | { readonly literal: string }

const color = (role: string) => `--m3e-sys-color-${role}` as const
const typescale = (role: string, property: 'font-size' | 'line-height' | 'font-weight' | 'font-family') =>
  `--m3e-sys-typescale-baseline-${role}-${property}` as const
const corner = (size: string) => `--m3e-sys-shape-corner-${size}` as const
const elevation = (level: number) => `--m3e-sys-elevation-level${level}-shadow` as const

/**
 * The mapping from the MCP Apps host style variables to Material 3 roles.
 *
 * MCP Apps names its colors by *use* (background, text, border, focus ring) and
 * *tone* (primary through disabled). Material names them by *role*. The table
 * pairs each use and tone with the role whose contract matches: `primary`
 * background is the surface an app sits on, not the accent; `info`, `danger`,
 * `success` and `warning` are tonal containers so that they stay inside the
 * scheme; `disabled` is the on-surface color at Material's disabled opacities.
 * Material has no success or warning role, so those borrow tertiary and
 * secondary, a deviation recorded in `docs/SPEC.md` §7.
 */
export const MATERIAL_STYLE_VARIABLE_SOURCES: Readonly<
  Record<McpUiStyleVariableKey, MaterialStyleVariableSource>
> = {
  '--color-background-primary': { token: color('surface') },
  '--color-background-secondary': { token: color('surface-container') },
  '--color-background-tertiary': { token: color('surface-container-high') },
  '--color-background-inverse': { token: color('inverse-surface') },
  '--color-background-ghost': { literal: 'transparent' },
  '--color-background-info': { token: color('primary-container') },
  '--color-background-danger': { token: color('error-container') },
  '--color-background-success': { token: color('tertiary-container') },
  '--color-background-warning': { token: color('secondary-container') },
  '--color-background-disabled': { token: color('on-surface'), alpha: 12 },

  '--color-text-primary': { token: color('on-surface') },
  '--color-text-secondary': { token: color('on-surface-variant') },
  '--color-text-tertiary': { token: color('outline') },
  '--color-text-inverse': { token: color('inverse-on-surface') },
  '--color-text-ghost': { token: color('outline') },
  '--color-text-info': { token: color('on-primary-container') },
  '--color-text-danger': { token: color('on-error-container') },
  '--color-text-success': { token: color('on-tertiary-container') },
  '--color-text-warning': { token: color('on-secondary-container') },
  '--color-text-disabled': { token: color('on-surface'), alpha: 38 },

  '--color-border-primary': { token: color('outline-variant') },
  '--color-border-secondary': { token: color('outline') },
  '--color-border-tertiary': { token: color('surface-container-highest') },
  '--color-border-inverse': { token: color('inverse-on-surface') },
  '--color-border-ghost': { literal: 'transparent' },
  '--color-border-info': { token: color('primary') },
  '--color-border-danger': { token: color('error') },
  '--color-border-success': { token: color('tertiary') },
  '--color-border-warning': { token: color('secondary') },
  '--color-border-disabled': { token: color('on-surface'), alpha: 12 },

  '--color-ring-primary': { token: color('primary') },
  '--color-ring-secondary': { token: color('secondary') },
  '--color-ring-inverse': { token: color('inverse-primary') },
  '--color-ring-info': { token: color('primary') },
  '--color-ring-danger': { token: color('error') },
  '--color-ring-success': { token: color('tertiary') },
  '--color-ring-warning': { token: color('secondary') },

  '--font-sans': { token: typescale('body-medium', 'font-family') },
  '--font-mono': { literal: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
  '--font-weight-normal': { token: typescale('body-medium', 'font-weight') },
  '--font-weight-medium': { token: typescale('title-medium', 'font-weight') },
  '--font-weight-semibold': { token: typescale('title-medium', 'font-weight') },
  '--font-weight-bold': { token: '--m3e-sys-typescale-emphasized-title-medium-font-weight' },

  '--font-text-xs-size': { token: typescale('label-small', 'font-size') },
  '--font-text-sm-size': { token: typescale('body-small', 'font-size') },
  '--font-text-md-size': { token: typescale('body-medium', 'font-size') },
  '--font-text-lg-size': { token: typescale('body-large', 'font-size') },
  '--font-heading-xs-size': { token: typescale('title-small', 'font-size') },
  '--font-heading-sm-size': { token: typescale('title-medium', 'font-size') },
  '--font-heading-md-size': { token: typescale('title-large', 'font-size') },
  '--font-heading-lg-size': { token: typescale('headline-small', 'font-size') },
  '--font-heading-xl-size': { token: typescale('headline-medium', 'font-size') },
  '--font-heading-2xl-size': { token: typescale('headline-large', 'font-size') },
  '--font-heading-3xl-size': { token: typescale('display-small', 'font-size') },
  '--font-text-xs-line-height': { token: typescale('label-small', 'line-height') },
  '--font-text-sm-line-height': { token: typescale('body-small', 'line-height') },
  '--font-text-md-line-height': { token: typescale('body-medium', 'line-height') },
  '--font-text-lg-line-height': { token: typescale('body-large', 'line-height') },
  '--font-heading-xs-line-height': { token: typescale('title-small', 'line-height') },
  '--font-heading-sm-line-height': { token: typescale('title-medium', 'line-height') },
  '--font-heading-md-line-height': { token: typescale('title-large', 'line-height') },
  '--font-heading-lg-line-height': { token: typescale('headline-small', 'line-height') },
  '--font-heading-xl-line-height': { token: typescale('headline-medium', 'line-height') },
  '--font-heading-2xl-line-height': { token: typescale('headline-large', 'line-height') },
  '--font-heading-3xl-line-height': { token: typescale('display-small', 'line-height') },

  '--border-radius-xs': { token: corner('extra-small') },
  '--border-radius-sm': { token: corner('small') },
  '--border-radius-md': { token: corner('medium') },
  '--border-radius-lg': { token: corner('large') },
  '--border-radius-xl': { token: corner('extra-large') },
  '--border-radius-full': { token: corner('full') },
  '--border-width-regular': { literal: '1px' },

  '--shadow-hairline': {
    layers: [color('outline-variant')],
    format: ([outline]) => `0 0 0 1px ${outline}`,
  },
  '--shadow-sm': { token: elevation(1) },
  '--shadow-md': { token: elevation(2) },
  '--shadow-lg': { token: elevation(3) },
}

/**
 * Resolves the MCP Apps style variables from a token reader. A key whose
 * source token is unset is left out, so an app sees only values that exist.
 */
export function materialStyleVariables(read: TokenReader): McpUiStyles {
  const styles: Partial<Record<McpUiStyleVariableKey, string>> = {}
  for (const [key, source] of Object.entries(MATERIAL_STYLE_VARIABLE_SOURCES) as ReadonlyArray<
    [McpUiStyleVariableKey, MaterialStyleVariableSource]
  >) {
    const value = resolve(source, read)
    if (value !== undefined) styles[key] = value
  }
  return styles as McpUiStyles
}

function resolve(source: MaterialStyleVariableSource, read: TokenReader): string | undefined {
  if ('literal' in source) return source.literal
  if ('layers' in source) {
    const values = source.layers.map((token) => read(token).trim())
    if (values.some((value) => value === '')) return undefined
    return source.format(values)
  }
  const value = read(source.token).trim()
  if (value === '') return undefined
  if ('alpha' in source) return `color-mix(in srgb, ${value} ${source.alpha}%, transparent)`
  return value
}

/**
 * Reads the style variables from an element's computed style. The element
 * must sit inside a `Material3Provider` (or another `.m3e-theme` ancestor), as
 * that is where the `--m3e-sys-*` tokens are defined.
 */
export function readMaterialStyleVariables(element: Element): McpUiStyles {
  const view = element.ownerDocument.defaultView
  if (!view) return materialStyleVariables(() => '')
  const computed = view.getComputedStyle(element)
  return materialStyleVariables((token) => computed.getPropertyValue(token))
}

/** The MCP Apps theme for a resolved Material color mode. */
export function toHostTheme(mode: ResolvedColorMode): McpUiTheme {
  return mode === 'dark' ? 'dark' : 'light'
}

/** Touch and hover support, as the `deviceCapabilities` host context field. */
export function detectDeviceCapabilities(
  view: Pick<Window, 'matchMedia'> | undefined = typeof window === 'undefined' ? undefined : window,
): NonNullable<McpUiHostContext['deviceCapabilities']> | undefined {
  if (!view || typeof view.matchMedia !== 'function') return undefined
  return {
    touch: view.matchMedia('(pointer: coarse)').matches,
    hover: view.matchMedia('(hover: hover)').matches,
  }
}

/** The user's locale as a BCP 47 tag, or `undefined` outside a browser. */
export function detectLocale(): string | undefined {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    return undefined
  }
}

/** The user's IANA time zone, or `undefined` when the runtime cannot say. */
export function detectTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}
