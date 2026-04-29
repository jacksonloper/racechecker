import { useState } from 'react'
import CaseStudyExplorer from './components/CaseStudyExplorer'
import { pkceSpaCaseStudy } from './data/pkceSpa'
import './App.css'

function App() {
  const [stepIndex, setStepIndex] = useState(0)

  const lastStepIndex = pkceSpaCaseStudy.steps.length - 1

  return (
    <CaseStudyExplorer
      caseStudy={pkceSpaCaseStudy}
      stepIndex={stepIndex}
      onSelectStep={setStepIndex}
      onPreviousStep={() => setStepIndex((current) => Math.max(current - 1, 0))}
      onNextStep={() => setStepIndex((current) => Math.min(current + 1, lastStepIndex))}
    />
  )
}

export default App
