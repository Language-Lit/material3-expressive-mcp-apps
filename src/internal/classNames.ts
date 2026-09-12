/** Joins the truthy class names. Small enough to own rather than depend on. */
export function cx(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
