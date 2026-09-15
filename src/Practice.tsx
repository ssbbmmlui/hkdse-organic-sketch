import { FormEvent, useMemo, useState } from 'react'
import {
  DIFFICULTY_META,
  SERIES_META,
  fromIupacName,
  namesEquivalent,
  nextQuestion,
  renderSkeletalSvg,
  renderStructuralSvg,
  type Difficulty,
  type PracticeQuestion,
} from './chemistry'
import { prettyFormula } from './format'

const LEVELS: Difficulty[] = ['easy', 'medium', 'difficult']

export default function Practice() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [question, setQuestion] = useState<PracticeQuestion>(() => nextQuestion('easy'))
  const [answer, setAnswer] = useState('')
  const [pickedSeries, setPickedSeries] = useState<string>('')
  const [checked, setChecked] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [score, setScore] = useState({ right: 0, asked: 0 })
  const [showNumbers, setShowNumbers] = useState(false)

  const mol = useMemo(() => fromIupacName(question.item.name), [question])
  const drawing = useMemo(
    () =>
      question.view === 'skeletal'
        ? renderSkeletalSvg(mol)
        : renderStructuralSvg(mol, showNumbers, question.fromRight),
    [mol, question.view, question.fromRight, showNumbers],
  )

  const startQuestion = (level: Difficulty, previousName?: string) => {
    setDifficulty(level)
    setQuestion(nextQuestion(level, previousName))
    setAnswer('')
    setPickedSeries('')
    setChecked(false)
    setCorrect(false)
  }

  const onCheck = (e: FormEvent) => {
    e.preventDefault()
    if (checked) return
    const ok =
      question.kind === 'name'
        ? namesEquivalent(answer, question.item.name)
        : pickedSeries === mol.parsed.series
    setCorrect(ok)
    setChecked(true)
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), asked: s.asked + 1 }))
  }

  const onNext = () => startQuestion(difficulty, question.item.name)

  return (
    <section className="practice">
      <p className="practice-intro">
        Random HKDSE-scope questions. After you check an answer, the tool shows the preferred name
        and both formulae.
      </p>

      <div className="practice-toolbar">
        <div className="level-row" role="group" aria-label="Difficulty">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              className={`level-btn ${difficulty === level ? 'active' : ''}`}
              onClick={() => startQuestion(level)}
            >
              {DIFFICULTY_META[level].label}
            </button>
          ))}
        </div>
        <p className="score" aria-live="polite">
          Score {score.right}/{score.asked}
        </p>
      </div>
      <p className="level-blurb">{DIFFICULTY_META[difficulty].blurb}</p>

      <article className="card practice-card">
        <header className="card-head">
          <h2>{question.view === 'skeletal' ? 'Skeletal formula' : 'Structural formula'}</h2>
        </header>
        <div className="canvas" dangerouslySetInnerHTML={{ __html: drawing }} />
        {question.view === 'structural' ? (
          <label className="toggle">
            <input
              type="checkbox"
              checked={showNumbers}
              onChange={(e) => setShowNumbers(e.target.checked)}
            />
            Show carbon numbers
          </label>
        ) : null}
      </article>

      <form className="practice-answer" onSubmit={onCheck}>
        {question.kind === 'name' ? (
          <>
            <label htmlFor="practice-name">IUPAC name</label>
            <div className="row">
              <input
                id="practice-name"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="e.g. hex-1-ene"
                autoComplete="off"
                spellCheck={false}
                disabled={checked}
              />
              <button type="submit" disabled={checked || !answer.trim()}>
                Check
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="search-label">Homologous series</p>
            <div className="series-choices">
              {question.seriesOptions.map((series) => (
                <label key={series} className={`choice ${pickedSeries === series ? 'on' : ''}`}>
                  <input
                    type="radio"
                    name="series"
                    value={series}
                    checked={pickedSeries === series}
                    disabled={checked}
                    onChange={() => setPickedSeries(series)}
                  />
                  {SERIES_META[series].en}
                </label>
              ))}
            </div>
            <button type="submit" disabled={checked || !pickedSeries}>
              Check
            </button>
          </>
        )}
      </form>

      {checked ? (
        <div className={`practice-feedback ${correct ? 'ok' : 'bad'}`} role="status">
          <strong>{correct ? 'Correct' : 'Not quite'}</strong>
          <p>
            Preferred name: <b>{question.item.name}</b>
            {question.kind === 'series' ? (
              <>
                {' '}
                · Series: <b>{SERIES_META[mol.parsed.series].en}</b>
              </>
            ) : null}
          </p>
          <dl className="facts">
            <div>
              <dt>Molecular formula</dt>
              <dd>{prettyFormula(mol.formula)}</dd>
            </div>
            <div>
              <dt>Condensed formula</dt>
              <dd className="condensed">{prettyFormula(mol.condensed)}</dd>
            </div>
          </dl>
          <div className="cards reveal-cards">
            <article className="card">
              <h2>Structural formula</h2>
              <div
                className="canvas"
                dangerouslySetInnerHTML={{
                  __html: renderStructuralSvg(mol, showNumbers, question.fromRight),
                }}
              />
            </article>
            <article className="card">
              <h2>Skeletal formula</h2>
              <div className="canvas" dangerouslySetInnerHTML={{ __html: renderSkeletalSvg(mol) }} />
            </article>
          </div>
        </div>
      ) : null}

      <div className="practice-actions">
        <button type="button" className="next-btn" onClick={onNext}>
          Next question
        </button>
      </div>
    </section>
  )
}
