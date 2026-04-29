export type ActorStateTone = 'secret' | 'derived' | 'request' | 'response' | 'token' | 'warning' | 'neutral'

export interface ActorDefinition {
  id: string
  label: string
  role: string
  accent: string
}

export interface ActorStateItem {
  label: string
  value: string
  tone?: ActorStateTone
}

export interface MessageSpec {
  label: string
  method?: string
  endpoint?: string
  transport: string
  payload: string[]
}

export interface CaseStudyStep {
  id: string
  title: string
  stageLabel: string
  summary: string
  focus: string
  senderId?: string
  receiverId?: string
  request?: MessageSpec
  response?: MessageSpec
  crypto: string[]
  guarantees: string[]
  attackerPerspective: string
  actorStates: Record<string, ActorStateItem[]>
}

export interface CaseStudy {
  slug: string
  title: string
  strapline: string
  description: string
  actors: ActorDefinition[]
  steps: CaseStudyStep[]
}
