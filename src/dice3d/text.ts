// Draws text so the visible ink, not the font's line box, is centred on (x, y). Centring the line box
// leaves digits a little high or low; measuring the ink puts them in the middle of the face.
//
// A 6 and a 9 are underlined, as on real dice, because turned upside down one reads as the other.
export function fillTextCentered(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  const align = context.textAlign
  const baseline = context.textBaseline
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  const m = context.measureText(text)
  const width = m.actualBoundingBoxRight - m.actualBoundingBoxLeft
  const height = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
  const left = x - width / 2
  const baselineY = y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2
  context.fillText(text, left, baselineY)
  if (/^[69]$/.test(text)) {
    const thickness = Math.max(2, height * 0.1)
    context.fillRect(left - m.actualBoundingBoxLeft, baselineY + m.actualBoundingBoxDescent + height * 0.12, width, thickness)
  }
  context.textAlign = align
  context.textBaseline = baseline
}
