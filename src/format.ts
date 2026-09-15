export function prettyFormula(formula: string) {
  return formula.replace(/(\d+)/g, (n) =>
    n.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]),
  )
}
