import { describe, expect, it } from 'vitest'

import {
  MATERIAL_STYLE_VARIABLE_SOURCES,
  materialStyleVariables,
  readMaterialStyleVariables,
  toHostTheme,
} from '../src/host/hostContext'

const TOKENS: Record<string, string> = {
  '--m3e-sys-color-surface': 'rgb(254, 247, 255)',
  '--m3e-sys-color-on-surface': 'rgb(29, 27, 32)',
  '--m3e-sys-color-outline-variant': 'rgb(202, 196, 208)',
  '--m3e-sys-color-primary': 'rgb(101, 85, 143)',
  '--m3e-sys-typescale-baseline-body-medium-font-family': '"Roboto", sans-serif',
  '--m3e-sys-typescale-baseline-body-medium-font-size': '0.875rem',
  '--m3e-sys-shape-corner-medium': '12px',
  '--m3e-sys-elevation-level1-shadow': '0px 1px 2px 0px rgba(0, 0, 0, 0.3)',
}

describe('materialStyleVariables', () => {
  const styles = materialStyleVariables((token) => TOKENS[token] ?? '')

  it('maps the primary background to the Material surface and the primary text to on-surface', () => {
    expect(styles['--color-background-primary']).toBe('rgb(254, 247, 255)')
    expect(styles['--color-text-primary']).toBe('rgb(29, 27, 32)')
    expect(styles['--color-ring-primary']).toBe('rgb(101, 85, 143)')
  })

  it('expresses disabled colors as Material state opacities over on-surface', () => {
    expect(styles['--color-background-disabled']).toBe('color-mix(in srgb, rgb(29, 27, 32) 12%, transparent)')
    expect(styles['--color-text-disabled']).toBe('color-mix(in srgb, rgb(29, 27, 32) 38%, transparent)')
  })

  it('composes the hairline shadow from the outline variant', () => {
    expect(styles['--shadow-hairline']).toBe('0 0 0 1px rgb(202, 196, 208)')
    expect(styles['--shadow-sm']).toBe('0px 1px 2px 0px rgba(0, 0, 0, 0.3)')
  })

  it('carries typography and shape through the typescale and corner tokens', () => {
    expect(styles['--font-sans']).toBe('"Roboto", sans-serif')
    expect(styles['--font-text-md-size']).toBe('0.875rem')
    expect(styles['--border-radius-md']).toBe('12px')
  })

  it('keeps the literals the design system has no token for', () => {
    expect(styles['--color-background-ghost']).toBe('transparent')
    expect(styles['--border-width-regular']).toBe('1px')
    expect(styles['--font-mono']).toMatch(/monospace/)
  })

  it('omits a variable whose token is unset instead of sending an empty string', () => {
    expect(styles['--color-background-secondary']).toBeUndefined()
    expect(Object.values(styles).every((value) => value !== '')).toBe(true)
  })

  it('covers every style variable key the extension defines', () => {
    const everything = materialStyleVariables(() => 'value')
    const keys = Object.keys(MATERIAL_STYLE_VARIABLE_SOURCES).sort()
    expect(Object.keys(everything).sort()).toEqual(keys)
    expect(keys).toHaveLength(76)
  })
})

describe('readMaterialStyleVariables', () => {
  it('reads the tokens from the element’s computed style', () => {
    const element = document.createElement('div')
    element.style.setProperty('--m3e-sys-color-surface', 'rgb(1, 2, 3)')
    document.body.append(element)
    try {
      const styles = readMaterialStyleVariables(element)
      expect(styles['--color-background-primary']).toBe('rgb(1, 2, 3)')
      expect(styles['--color-background-ghost']).toBe('transparent')
    } finally {
      element.remove()
    }
  })
})

describe('toHostTheme', () => {
  it('maps the resolved color mode one to one', () => {
    expect(toHostTheme('light')).toBe('light')
    expect(toHostTheme('dark')).toBe('dark')
  })
})
