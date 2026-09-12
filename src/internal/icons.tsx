import type { IconSource, IconSourceProps } from '@language-lit/material3-expressive'

/**
 * The four glyphs the frame's display-mode controls need.
 *
 * Path data is taken from Google's Material Symbols (Outlined, 24px, weight
 * 400), Apache License 2.0, https://github.com/google/material-design-icons.
 * Embedding them keeps the package free of a font dependency: the controls
 * render the same whether or not the host loads the Material Symbols font.
 * Each glyph is a source component for the design system's `Icon`, so it
 * forwards the class and accessibility attributes it is given and lets `Icon`
 * own color and size.
 */
function glyph(d: string): IconSource {
  const Glyph = (props: IconSourceProps) => (
    <svg viewBox="0 -960 960 960" {...props}>
      <path d={d} />
    </svg>
  )
  return Glyph
}

export const FullscreenGlyph = glyph(
  'M120-120v-200h80v120h120v80H120Zm520 0v-80h120v-120h80v200H640ZM120-640v-200h200v80H200v120h-80Zm640 0v-120H640v-80h200v200h-80Z',
)

export const FullscreenExitGlyph = glyph(
  'M240-120v-120H120v-80h200v200h-80Zm400 0v-200h200v80H720v120h-80ZM120-640v-80h120v-120h80v200H120Zm520 0v-200h80v120h120v80H640Z',
)

export const PipGlyph = glyph(
  'M80-520v-80h144L52-772l56-56 172 172v-144h80v280H80Zm80 360q-33 0-56.5-23.5T80-240v-200h80v200h320v80H160Zm640-280v-280H440v-80h360q33 0 56.5 23.5T880-720v280h-80ZM560-160v-200h320v200H560Z',
)

export const PipExitGlyph = glyph(
  'M160-160q-33 0-56.5-23.5T80-240v-280h80v280h640v-480H440v-80h360q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm523-140 57-57-124-123h104v-80H480v240h80v-103l123 123ZM80-600v-200h280v200H80Zm400 120Z',
)
