import { useElementSize } from '../../../hooks/useElementSize'

/**
 * Size a game's keyboard from the space left for it, so the whole keyboard stays on screen: as tall as the area
 * allows (keeping room for the middle-C row under the keys and some sparks above), between `min` and `max` px.
 */
export function useKeysFit(max = 200, min = 110) {
  const [ref, { height }] = useElementSize<HTMLDivElement>()
  // The middle-C row is 1.5rem, so it grows with the text size setting.
  const keys = Math.round(Math.max(min, Math.min(max, height - 46)))
  return { ref, keys, sparks: Math.max(30, Math.min(110, height - keys - 20)) }
}
