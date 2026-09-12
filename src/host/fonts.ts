/**
 * Collects the `@font-face` rules for the given families from the document's
 * same-origin stylesheets, as CSS text an app can apply with the extension's
 * `applyHostFonts`. Pass the result to `McpAppFrame`'s `fonts` prop.
 *
 * Cross-origin stylesheets cannot be read and are skipped. The font files
 * themselves are then fetched by the app's sandboxed document, so they must be
 * served with `Access-Control-Allow-Origin` for the sandbox to load them.
 */
export function collectFontFaceCss(
  families: readonly string[],
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): string {
  if (!doc) return ''
  const wanted = new Set(families.map(normalizeFamily))
  const rules: string[] = []
  for (const sheet of Array.from(doc.styleSheets)) {
    let cssRules: CSSRuleList
    try {
      cssRules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of Array.from(cssRules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue
      const family = rule.style.getPropertyValue('font-family')
      if (family && wanted.has(normalizeFamily(family))) rules.push(rule.cssText)
    }
  }
  return rules.join('\n')
}

function normalizeFamily(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '').toLowerCase()
}
