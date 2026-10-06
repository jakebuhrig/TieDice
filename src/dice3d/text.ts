// Draws text so the visible ink, not the font's line box, is centred on (x, y). Centring the line box
// leaves digits a little high or low; measuring the ink puts them in the middle of the face.
export function fillTextCentered(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  const align = context.textAlign
  const baseline = context.textBaseline
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  const m = context.measureText(text)
  context.fillText(
    text,
    x - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2,
    y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2,
  )
  context.textAlign = align
  context.textBaseline = baseline
}
