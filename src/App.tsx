import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  NameError,
  SERIES_GUIDE,
  SERIES_META,
  fromIupacName,
  renderSkeletalSvg,
  renderStructuralSvg,
} from './chemistry'
import { exportSvgMarkupAsPng } from './exportPng'
import { prettyFormula } from './format'
import Practice from './Practice'

type Mode = 'draw' | 'practice'

function modeFromHash(): Mode {
  return window.location.hash === '#practice' ? 'practice' : 'draw'
}

export default function App() {
  const [mode, setMode] = useState<Mode>(modeFromHash)
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [showNumbers, setShowNumbers] = useState(false)
  const [fromRight, setFromRight] = useState(false)

  useEffect(() => {
    const onHash = () => setMode(modeFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (next: Mode) => {
    setMode(next)
    window.location.hash = next === 'practice' ? 'practice' : ''
  }

  const result = useMemo(() => {
    if (!submitted.trim()) return { ok: 'idle' as const }
    try {
      const mol = fromIupacName(submitted)
      return {
        ok: true as const,
        mol,
        structural: renderStructuralSvg(mol, showNumbers, fromRight),
        skeletal: renderSkeletalSvg(mol, fromRight),
      }
    } catch (err) {
      const message = err instanceof NameError ? err.message : err instanceof Error ? err.message : String(err)
      return { ok: false as const, message }
    }
  }, [submitted, showNumbers, fromRight])

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
          {mode === 'practice'
            ? 'Practice mode draws a random compound from the HKDSE rules. Name it, or identify its homologous series.'
            : 'Enter the IUPAC name of an organic compound (parent chain ≤ 8C) to generate its structural formula and skeletal formula.'}
        </p>
        <nav className="mode-nav" aria-label="Mode">
          <button type="button" className={mode === 'draw' ? 'active' : ''} onClick={() => go('draw')}>
            Draw
          </button>
          <button
            type="button"
            className={mode === 'practice' ? 'active' : ''}
            onClick={() => go('practice')}
          >
            Practice
          </button>
        </nav>
      </header>

      {mode === 'practice' ? <Practice /> : null}

      {mode === 'draw' ? (
      <>
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

          <div className="toggles">
            <label className="toggle">
              <input
                type="checkbox"
                checked={showNumbers}
                onChange={(e) => setShowNumbers(e.target.checked)}
              />
              Show carbon numbers on the structural formula
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={fromRight}
                onChange={(e) => setFromRight(e.target.checked)}
              />
              Mirror the chain (count carbons from right to left)
            </label>
          </div>

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
      </>
      ) : null}

      {mode === 'draw' ? (
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
      ) : null}

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
