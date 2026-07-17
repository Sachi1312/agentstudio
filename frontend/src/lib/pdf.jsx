import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { createRoot } from 'react-dom/client'
import { Article } from './Article'

// The earlier approach drew plain text glyphs with jsPDF's built-in fonts,
// which only support WinAnsi (Latin) encoding — every non-Latin script
// (Hindi, Japanese, etc.) came out blank, and even Latin text needed manual
// sanitizing for typographic characters. Rendering the article's actual
// on-page HTML (same fonts, same Tailwind styling, same Markdown table
// rendering) and rasterizing it sidesteps both problems: the browser's own
// font stack already handles every script, and the PDF visually matches
// the site instead of being a plain text dump. Trade-off: the PDF text
// becomes part of an image, so it's not selectable/searchable — acceptable
// for an "export what you see" feature.
//
// jsPDF's own doc.html() (which wraps html2canvas with automatic
// pagination) was tried first and hangs indefinitely on real article
// content, even short ones — a known-flaky part of jsPDF unrelated to
// html2canvas itself, which renders the same content in ~200ms standalone.
// So this calls html2canvas directly and paginates manually: one full
// screenshot, sliced into page-sized chunks, each added as an image.
const PRINT_WIDTH_PX = 800

// A row of near-uniform color (low side-to-side variance) means blank
// space — the gap between paragraphs/elements, not a line of text glyphs
// crossing it. Checking uniformity rather than matching one fixed
// "background" RGB makes this work regardless of which background is
// showing at that point (the beige page, a white fact-check card, a
// table's header row, ...).
function isRowBlank(ctx, y, width) {
  const row = ctx.getImageData(0, y, width, 1).data
  const step = 4
  let baseR = row[0], baseG = row[1], baseB = row[2]
  for (let x = 0; x < width; x += step) {
    const i = x * 4
    if (Math.abs(row[i] - baseR) + Math.abs(row[i + 1] - baseG) + Math.abs(row[i + 2] - baseB) > 18) {
      return false
    }
  }
  return true
}

// Slicing a page strictly at a fixed pixel height cuts straight through
// whatever happens to be there — including the middle of a text line, as
// seen in a real generated PDF. Search backward from the ideal break for a
// blank row to slice at instead, so each page ends in the whitespace
// between paragraphs. Falls back to the ideal (possibly mid-line) break if
// nothing blank turns up within the search window, rather than blocking.
function findSafeBreak(ctx, idealY, width, searchRangePx) {
  const minY = Math.max(0, idealY - searchRangePx)
  for (let y = idealY; y > minY; y--) {
    if (isRowBlank(ctx, y, width)) return y
  }
  return idealY
}

export async function downloadArticlePdf(text, filename) {
  await document.fonts.ready

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '0'
  // Off-screen via a large negative offset, not opacity: 0 — confirmed by
  // direct pixel sampling that html2canvas renders an opacity:0 element as
  // fully blank (correct canvas dimensions, zero non-background pixels)
  // even though the DOM content and layout are entirely correct. That was
  // the actual cause of "blank PDF" reports, not a timing issue.
  container.style.left = '-9999px'
  container.style.width = `${PRINT_WIDTH_PX}px`
  container.style.pointerEvents = 'none'
  container.style.backgroundColor = '#F0EBE3'
  document.body.appendChild(container)

  const root = createRoot(container)

  try {
    root.render(
      <div className="font-dm" style={{ padding: '48px' }}>
        <Article
          text={text}
          headlineClassName="font-playfair text-3xl text-beige-900 font-normal leading-tight mb-8"
        />
      </div>
    )

    // Wait for the container to actually have laid-out content before
    // snapshotting it, rather than guessing a fixed delay — a fixed delay
    // that's comfortably long on a warm dev machine can still be too short
    // on a real machine with a cold font cache or a heavier article, and
    // html2canvas would then capture an empty container, producing a
    // blank PDF with no error. Deliberately polling with setTimeout, not
    // requestAnimationFrame — rAF is throttled/suspended in backgrounded
    // tabs, which previously stalled this whole function forever.
    let waited = 0
    while (container.scrollHeight < 80 && waited < 3000) {
      await new Promise(r => setTimeout(r, 30))
      waited += 30
    }

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#F0EBE3',
      useCORS: true,
    })

    if (canvas.height < 10) {
      throw new Error('Rendered content was empty — nothing to export')
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const margin = 36
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const contentWidth = pageWidth - margin * 2
    const contentHeight = pageHeight - margin * 2

    const ptPerCanvasPx = contentWidth / canvas.width
    const pageHeightInCanvasPx = contentHeight / ptPerCanvasPx
    const ctx = canvas.getContext('2d')
    const searchRangePx = pageHeightInCanvasPx * 0.4

    let renderedPx = 0
    let pageIndex = 0
    while (renderedPx < canvas.height) {
      const idealEnd = renderedPx + pageHeightInCanvasPx
      let sliceEnd = Math.min(idealEnd, canvas.height)

      // No need to search for a break on the final page — everything
      // left already fits.
      if (sliceEnd < canvas.height) {
        const safeY = findSafeBreak(ctx, Math.floor(idealEnd), canvas.width, searchRangePx)
        // Ignore a safe break that would shrink this page down to almost
        // nothing (e.g. a mostly-blank leading gap right after the last
        // break) — better an occasional mid-line cut than a near-empty page.
        if (safeY - renderedPx > pageHeightInCanvasPx * 0.3) {
          sliceEnd = safeY
        }
      }

      const sliceHeightPx = sliceEnd - renderedPx
      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      sliceCanvas.height = sliceHeightPx
      sliceCanvas
        .getContext('2d')
        .drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx)

      if (pageIndex > 0) doc.addPage()
      doc.addImage(
        sliceCanvas.toDataURL('image/jpeg', 0.92),
        'JPEG',
        margin,
        margin,
        contentWidth,
        sliceHeightPx * ptPerCanvasPx
      )

      renderedPx = sliceEnd
      pageIndex++
    }

    doc.save(filename)
  } finally {
    root.unmount()
    container.remove()
  }
}
