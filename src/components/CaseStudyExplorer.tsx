import type { CaseStudy } from '../types'

interface CaseStudyExplorerProps {
  caseStudy: CaseStudy
  stepIndex: number
  onSelectStep: (index: number) => void
  onPreviousStep: () => void
  onNextStep: () => void
}

const messageArrow = '→'

function CaseStudyExplorer({
  caseStudy,
  stepIndex,
  onSelectStep,
  onPreviousStep,
  onNextStep,
}: CaseStudyExplorerProps) {
  const currentStep = caseStudy.steps[stepIndex]
  const progress = ((stepIndex + 1) / caseStudy.steps.length) * 100

  return (
    <div className="case-study-shell">
      <aside className="case-study-sidebar" aria-label="Case study navigation">
        <p className="eyebrow">Case studies</p>
        <h1>Racechecker</h1>
        <p className="lede">
          Protocol walkthroughs that make requests, returned artifacts, and security guarantees
          explicit.
        </p>
        <div className="case-study-card case-study-card--active">
          <p className="case-study-card__title">{caseStudy.title}</p>
          <p className="case-study-card__strapline">{caseStudy.strapline}</p>
        </div>
        <div className="sidebar-note">
          <h2>Why this flow?</h2>
          <p>
            PKCE lets a browser-only client prove possession of a locally generated verifier
            without ever creating an application server session.
          </p>
        </div>
      </aside>

      <main className="case-study-main">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Interactive sequence diagram</p>
            <h2>{caseStudy.title}</h2>
            <p className="hero-panel__description">{caseStudy.description}</p>
          </div>
          <div className="hero-panel__meta">
            <div>
              <span className="meta-label">Current stage</span>
              <strong>{currentStep.stageLabel}</strong>
            </div>
            <div>
              <span className="meta-label">Step</span>
              <strong>
                {stepIndex + 1} / {caseStudy.steps.length}
              </strong>
            </div>
          </div>
        </section>

        <section className="controls-panel" aria-label="Step controls">
          <div className="progress-copy">
            <p className="eyebrow">Step-by-step inspection</p>
            <p>
              Move forward and backward to see exactly what each actor holds, what crosses the
              network, and what security property becomes true at that moment.
            </p>
          </div>
          <div className="controls-panel__actions">
            <button type="button" className="nav-button" onClick={onPreviousStep} disabled={stepIndex === 0}>
              Back
            </button>
            <button
              type="button"
              className="nav-button nav-button--primary"
              onClick={onNextStep}
              disabled={stepIndex === caseStudy.steps.length - 1}
            >
              Forward
            </button>
          </div>
          <div className="progress-bar" aria-hidden="true">
            <span style={{ width: `${progress}%` }}></span>
          </div>
          <ol className="step-timeline">
            {caseStudy.steps.map((step, index) => {
              const isActive = index === stepIndex

              return (
                <li key={step.id}>
                  <button
                    type="button"
                    className={`timeline-step${isActive ? ' timeline-step--active' : ''}`}
                    onClick={() => onSelectStep(index)}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <span className="timeline-step__index">{index + 1}</span>
                    <span>
                      <strong>{step.stageLabel}</strong>
                      <small>{step.title}</small>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>

        <div className="step-stage" key={currentStep.id}>
          <section className="panel panel--highlight">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Current step</p>
                <h3>{currentStep.title}</h3>
              </div>
              <span className="stage-chip">{currentStep.stageLabel}</span>
            </div>
            <p className="step-summary">{currentStep.summary}</p>
            <div className="focus-box">
              <span className="focus-box__label">Why it matters</span>
              <p>{currentStep.focus}</p>
            </div>
          </section>

          <section className="panel sequence-panel" aria-label="Network exchange and actors">
            <div className="actor-strip">
              {caseStudy.actors.map((actor) => (
                <div className="actor-pill" key={actor.id} style={{ ['--actor-accent' as string]: actor.accent }}>
                  <strong>{actor.label}</strong>
                  <span>{actor.role}</span>
                </div>
              ))}
            </div>
            {currentStep.request || currentStep.response ? (
              <div className="message-flow">
                <div className="message-flow__header">
                  <span>{currentStep.senderId ? caseStudy.actors.find((actor) => actor.id === currentStep.senderId)?.label : 'No outbound message'}</span>
                  <span className="message-flow__arrow">{messageArrow}</span>
                  <span>{currentStep.receiverId ? caseStudy.actors.find((actor) => actor.id === currentStep.receiverId)?.label : 'Local browser work'}</span>
                </div>
                <div className="message-grid">
                  {currentStep.request ? (
                    <article className="message-card">
                      <p className="eyebrow">Outbound</p>
                      <h3>{currentStep.request.label}</h3>
                      <p className="message-card__meta">
                        {[currentStep.request.method, currentStep.request.endpoint].filter(Boolean).join(' ')}
                      </p>
                      <p className="message-card__transport">{currentStep.request.transport}</p>
                      <ul>
                        {currentStep.request.payload.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  ) : (
                    <article className="message-card message-card--muted">
                      <p className="eyebrow">Outbound</p>
                      <h3>No network call yet</h3>
                      <p>This step is local browser work only.</p>
                    </article>
                  )}
                  {currentStep.response ? (
                    <article className="message-card">
                      <p className="eyebrow">Return</p>
                      <h3>{currentStep.response.label}</h3>
                      <p className="message-card__transport">{currentStep.response.transport}</p>
                      <ul>
                        {currentStep.response.payload.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  ) : (
                    <article className="message-card message-card--muted">
                      <p className="eyebrow">Return</p>
                      <h3>No response yet</h3>
                      <p>The important work in this step happens before any request is sent.</p>
                    </article>
                  )}
                </div>
              </div>
            ) : null}
          </section>

          <section className="detail-grid">
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Crypto primitives</p>
                  <h3>What cryptography is active?</h3>
                </div>
              </div>
              <ul className="bullet-list">
                {currentStep.crypto.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Guarantees</p>
                  <h3>What becomes true now?</h3>
                </div>
              </div>
              <ul className="bullet-list bullet-list--guarantee">
                {currentStep.guarantees.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Attacker view</p>
                <h3>What would a thief need here?</h3>
              </div>
            </div>
            <p>{currentStep.attackerPerspective}</p>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Actor state</p>
                <h3>What each participant currently holds</h3>
              </div>
            </div>
            <div className="state-grid">
              {caseStudy.actors.map((actor) => {
                const items = currentStep.actorStates[actor.id] ?? []

                return (
                  <article className="state-card" key={actor.id} style={{ ['--actor-accent' as string]: actor.accent }}>
                    <header>
                      <strong>{actor.label}</strong>
                      <span>{actor.role}</span>
                    </header>
                    <div className="state-card__items">
                      {items.map((item) => (
                        <div className={`state-item state-item--${item.tone ?? 'neutral'}`} key={`${actor.id}-${item.label}`}>
                          <span>{item.label}</span>
                          <p>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default CaseStudyExplorer
