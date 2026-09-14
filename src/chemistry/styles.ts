/** Styles mirrored from index.css so exported / API SVGs match the on-screen formula. */
export const FORMULA_CSS = `
.formula-svg .bond {
  stroke: #1c2430;
  stroke-width: 1.35;
  stroke-linecap: butt;
}
.formula-svg.structural .bond { stroke-width: 1.15; }
.formula-svg.skeletal .bond { stroke-linecap: round; }
.formula-svg.skeletal .vertex { fill: #1c2430; }
.formula-svg .atom,
.formula-svg .locant {
  font-family: 'Times New Roman', Times, serif;
  font-weight: 400;
}
.formula-svg .atom {
  font-size: 15px;
  text-anchor: middle;
  dominant-baseline: middle;
  fill: #1c2430;
}
.formula-svg.structural .atom { font-size: 13px; }
.formula-svg.structural .atom.alkyl,
.formula-svg.structural .atom.compact { letter-spacing: -0.1em; }
.formula-svg.skeletal .atom.hetero { fill: #1f5c4d; }
.formula-svg .atom.anchor-start { text-anchor: start; }
.formula-svg .atom.anchor-end { text-anchor: end; }
.formula-svg .sub { font-size: 10px; }
.formula-svg.structural .sub { font-size: 8.5px; }
.formula-svg .locant {
  font-size: 8px;
  fill: #d32f2f;
  text-anchor: middle;
  dominant-baseline: middle;
}
`

/** Inject drawing CSS into an SVG so it renders correctly outside this app. */
export function embedSvgStyles(svg: string): string {
  if (svg.includes('<style')) return svg
  return svg.replace(/<svg\b([^>]*)>/, `<svg$1><style>${FORMULA_CSS}</style>`)
}
