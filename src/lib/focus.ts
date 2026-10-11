/**
 * Chrome leaves focus on a button after you click it, so the next Space or Enter clicks it again
 * (e.g. Space re-clicks "Listen" instead of starting playback). Safari never focuses on click.
 * Drop that focus after mouse and touch clicks; keyboard focus (Tab, then Enter/Space) is left alone.
 */
export function installClickBlur() {
  document.addEventListener('click', (e) => {
    if (e.detail === 0) return // a click from the keyboard
    const target = e.target instanceof Element ? e.target : null
    const el = target?.closest('button, a, summary, [role="button"], [role="radio"], [role="switch"], [role="tab"]')
    if (el instanceof HTMLElement && el === document.activeElement) el.blur()
  })
}

/** A focused control that uses arrow keys, Space and Enter itself: text fields, sliders, radio groups, menus. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target instanceof HTMLElement && target.isContentEditable) return true
  return !!target.closest('input, textarea, select, [role="slider"], [role="radio"], [role="radiogroup"], [role="listbox"], [role="menu"], [role="tab"]')
}

/** A focused button or link: Enter and Space click it, so page shortcuts should leave those keys alone. */
export function isButtonTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !!target.closest('button, a, summary, [role="button"], [role="switch"]')
}

/** Shortcut keys should ignore auto-repeat and anything with ⌘/Ctrl/Alt (browser shortcuts). */
export function isPlainKey(e: KeyboardEvent): boolean {
  return !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !e.defaultPrevented
}
