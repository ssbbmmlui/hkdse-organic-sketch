import { FormEvent, useMemo, useState } from 'react'
import {
  NameError,
  SERIES_GUIDE,
  SERIES_META,
  fromIupacName,
  renderSkeletalSvg,
  renderStructuralSvg,
} from './chemistry'
import { exportSvgMarkupAsPng } from './exportPng'

export default function App() {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [showNumbers, setShowNumbers] = useState(false)

  const result = useMemo(() => {
    if (!submitted.trim()) return { ok: 'idle' as const }
    try {
      const mol = fromIupacName(submitted)
      return {
        ok: true as const,
        mol,
        structural: renderStructuralSvg(mol, showNumbers),
        skeletal: renderSkeletalSvg(mol),
      }
    } catch (err) {
      const message = err instanceof NameError ? err.message : err instanceof Error ? err.message : String(err)
      return { ok: false as const, message }
    }
  }, [submitted, showNumbers])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(query.trim())
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">HKDSE Chemistry</p>
        <h1>Organic Sketch</h1>
        <p className="lede">
          Enter the IUPAC name of an organic compound (parent chain ≤ 8C) to generate its
          structural formula and skeletal formula.
        </p>
      </header>

      <form className="search" onSubmit={onSubmit}>
        <label htmlFor="iupac">IUPAC name</label>
        <div className="row">
          <input
            id="iupac"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. hex-1-ene"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">Draw</button>
        </div>
      </form>

      {result.ok === true ? (
        <section className="result">
          <div className="meta">
            <div>
              <p className="name">{result.mol.parsed.inputName}</p>
              <p className="series">
                {SERIES_META[result.mol.parsed.series].en}
                <span className="general">{SERIES_META[result.mol.parsed.series].general}</span>
              </p>
            </div>
            <dl className="facts">
              <div>
                <dt>Molecular formula</dt>
                <dd>{prettyFormula(result.mol.formula)}</dd>
              </div>
              <div>
                <dt>Condensed formula</dt>
                <dd className="condensed">{prettyFormula(result.mol.condensed)}</dd>
              </div>
            </dl>
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={showNumbers}
              onChange={(e) => setShowNumbers(e.target.checked)}
            />
            Show carbon numbers on the structural formula
          </label>

          <div className="cards">
            <article className="card">
              <header className="card-head">
                <h2>Structural formula</h2>
                <button
                  type="button"
                  className="export-btn"
                  onClick={() =>
                    exportSvgMarkupAsPng(result.structural, result.mol.parsed.inputName, 'structural')
                  }
                >
                  Export PNG
                </button>
              </header>
              <div
                className="canvas"
                dangerouslySetInnerHTML={{ __html: result.structural }}
              />
            </article>
            <article className="card">
              <header className="card-head">
                <h2>Skeletal formula</h2>
                <button
                  type="button"
                  className="export-btn"
                  onClick={() =>
                    exportSvgMarkupAsPng(result.skeletal, result.mol.parsed.inputName, 'skeletal')
                  }
                >
                  Export PNG
                </button>
              </header>
              <div
                className="canvas"
                dangerouslySetInnerHTML={{ __html: result.skeletal }}
              />
            </article>
          </div>
        </section>
      ) : result.ok === false ? (
        <div className="error" role="alert">
          <strong>Could not draw this name</strong>
          <p>{result.message}</p>
        </div>
      ) : null}

      <aside className="guide">
        <h2>Syllabus coverage</h2>
        <p>
          Parent chain up to 8 carbons. Accepts post-2013 IUPAC names (hex-1-ene) and older forms
          such as 1-hexene.
        </p>
        <ul>
          {SERIES_GUIDE.map((item) => (
            <li key={item.en}>
              <b>{item.en}</b>
              <span>{item.example}</span>
            </li>
          ))}
        </ul>
      </aside>

      <footer>
        <p>
          An offline parser written for HKDSE naming rules. Inspired by Cambridge{' '}
          <a href="https://github.com/dan2097/opsin" target="_blank" rel="noreferrer">
            OPSIN
          </a>{' '}
          (IUPAC to structure) and Reymond{' '}
          <a href="https://github.com/reymond-group/smilesDrawer" target="_blank" rel="noreferrer">
            SmilesDrawer
          </a>{' '}
          (skeletal drawing). This tool does not call external chemistry APIs.
        </p>
      </footer>
    </div>
  )
}

function prettyFormula(formula: string) {
  return formula.replace(/(\d+)/g, (n) =>
    n.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]),
  )
}
