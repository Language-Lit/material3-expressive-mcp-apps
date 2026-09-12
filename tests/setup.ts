// jsdom gaps the frame and the Material components rely on: the frame
// measures its viewport with ResizeObserver, and Dialog opens through the
// native `showModal`.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

const dialog = globalThis.HTMLDialogElement?.prototype
if (dialog && typeof dialog.showModal !== 'function') {
  dialog.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialog.show = function show(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialog.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

// jsdom has no media queries. The frame reads pointer and hover support
// through matchMedia; a stub answers "no" to everything, deterministically.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false
      },
    }) as MediaQueryList) as typeof window.matchMedia
}
