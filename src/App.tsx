import { useState } from 'react'
import './App.css'

type ClientId = 'A' | 'B'
type NoticeTone = 'neutral' | 'info' | 'success' | 'warning'

type Snapshot = {
  text: string
  version: number
}

type Notice = {
  tone: NoticeTone
  text: string
}

type ClientState = {
  id: ClientId
  label: string
  formText: string
  knownServer: Snapshot
  pendingDebounce: number | null
  notice: Notice
}

type PostRequestMessage = {
  id: number
  type: 'post-request'
  clientId: ClientId
  createdAt: number
  draft: string
  baseSnapshot: Snapshot
}

type RefreshRequestMessage = {
  id: number
  type: 'refresh-request'
  clientId: ClientId
  createdAt: number
}

type PostResponseMessage = {
  id: number
  type: 'post-response'
  clientId: ClientId
  createdAt: number
  draft: string
  accepted: boolean
  serverSnapshot: Snapshot
  reason: string
}

type RefreshResponseMessage = {
  id: number
  type: 'refresh-response'
  clientId: ClientId
  createdAt: number
  serverSnapshot: Snapshot
}

type Message =
  | PostRequestMessage
  | RefreshRequestMessage
  | PostResponseMessage
  | RefreshResponseMessage

type SimulationState = {
  clock: number
  server: Snapshot
  clients: Record<ClientId, ClientState>
  messages: Message[]
  nextMessageId: number
  eventLog: string[]
}

const DEBOUNCE_STEPS = 2
const CLIENT_IDS: ClientId[] = ['A', 'B']
const MAX_LOG_ENTRIES = 10
const INITIAL_TEXT = 'Shared note from server v1'

const cloneSnapshot = (snapshot: Snapshot): Snapshot => ({ ...snapshot })

const appendLog = (entries: string[], entry: string) => [entry, ...entries].slice(0, MAX_LOG_ENTRIES)

const createClient = (id: ClientId, server: Snapshot): ClientState => ({
  id,
  label: `Tab ${id}`,
  formText: server.text,
  knownServer: cloneSnapshot(server),
  pendingDebounce: null,
  notice: {
    tone: 'neutral',
    text: 'Loaded from the server snapshot.',
  },
})

const buildInitialState = (): SimulationState => {
  const server = { text: INITIAL_TEXT, version: 1 }

  return {
    clock: 0,
    server,
    clients: {
      A: createClient('A', server),
      B: createClient('B', server),
    },
    messages: [],
    nextMessageId: 1,
    eventLog: ['Scenario reset. Both tabs loaded version 1 from the server.'],
  }
}

const queuePost = (state: SimulationState, clientId: ClientId, source: string): SimulationState => {
  const client = state.clients[clientId]

  if (client.formText === client.knownServer.text) {
    return {
      ...state,
      clients: {
        ...state.clients,
        [clientId]: {
          ...client,
          pendingDebounce: null,
          notice: {
            tone: 'neutral',
            text: 'No POST queued because the form matches the known server state.',
          },
        },
      },
      eventLog: appendLog(state.eventLog, `${client.label} skipped POST creation because nothing is dirty.`),
    }
  }

  const message: PostRequestMessage = {
    id: state.nextMessageId,
    type: 'post-request',
    clientId,
    createdAt: state.clock,
    draft: client.formText,
    baseSnapshot: cloneSnapshot(client.knownServer),
  }

  return {
    ...state,
    messages: [...state.messages, message],
    nextMessageId: state.nextMessageId + 1,
    clients: {
      ...state.clients,
      [clientId]: {
        ...client,
        pendingDebounce: null,
        notice: {
          tone: 'info',
          text: `${source} queued POST ${clientId} with base v${client.knownServer.version}.`,
        },
      },
    },
    eventLog: appendLog(
      state.eventLog,
      `${client.label} queued POST ${clientId} carrying “${client.formText || '∅'}” from base v${client.knownServer.version}.`,
    ),
  }
}

const queueRefresh = (state: SimulationState, clientId: ClientId): SimulationState => {
  const client = state.clients[clientId]
  const message: RefreshRequestMessage = {
    id: state.nextMessageId,
    type: 'refresh-request',
    clientId,
    createdAt: state.clock,
  }

  return {
    ...state,
    messages: [...state.messages, message],
    nextMessageId: state.nextMessageId + 1,
    clients: {
      ...state.clients,
      [clientId]: {
        ...client,
        notice: {
          tone: 'info',
          text: `Queued a refresh request for ${client.label}.`,
        },
      },
    },
    eventLog: appendLog(state.eventLog, `${client.label} queued a refresh request.`),
  }
}

const stepClock = (state: SimulationState): SimulationState => {
  let nextState: SimulationState = {
    ...state,
    clock: state.clock + 1,
    clients: {
      A: { ...state.clients.A },
      B: { ...state.clients.B },
    },
  }

  for (const clientId of CLIENT_IDS) {
    const client = nextState.clients[clientId]

    if (client.pendingDebounce === null) {
      continue
    }

    const remaining = client.pendingDebounce - 1

    if (remaining <= 0) {
      nextState = queuePost(nextState, clientId, `Tick ${nextState.clock}`)
      continue
    }

    nextState.clients[clientId] = {
      ...client,
      pendingDebounce: remaining,
      notice: {
        tone: 'info',
        text: `Debounce countdown: ${remaining} tick${remaining === 1 ? '' : 's'} remaining.`,
      },
    }
  }

  return {
    ...nextState,
    eventLog: appendLog(nextState.eventLog, `Time advanced to tick ${nextState.clock}.`),
  }
}

const resolveMessage = (
  state: SimulationState,
  messageId: number,
  outcome: 'complete' | 'lost',
): SimulationState => {
  const message = state.messages.find((entry) => entry.id === messageId)

  if (!message) {
    return state
  }

  let nextState: SimulationState = {
    ...state,
    messages: state.messages.filter((entry) => entry.id !== messageId),
  }

  if (outcome === 'lost') {
    return {
      ...nextState,
      eventLog: appendLog(
        nextState.eventLog,
        `${describeMessage(message)} was marked lost before delivery completed.`,
      ),
    }
  }

  if (message.type === 'post-request') {
    const accepted = message.baseSnapshot.version === nextState.server.version
    const serverSnapshot = accepted
      ? {
          text: message.draft,
          version: nextState.server.version + 1,
        }
      : cloneSnapshot(nextState.server)

    nextState = {
      ...nextState,
      server: accepted ? serverSnapshot : nextState.server,
      messages: [
        ...nextState.messages,
        {
          id: nextState.nextMessageId,
          type: 'post-response',
          clientId: message.clientId,
          createdAt: nextState.clock,
          draft: message.draft,
          accepted,
          serverSnapshot: cloneSnapshot(serverSnapshot),
          reason: accepted
            ? `Accepted at v${serverSnapshot.version}.`
            : `Rejected because the server had already advanced to v${nextState.server.version}.`,
        },
      ],
      nextMessageId: nextState.nextMessageId + 1,
      eventLog: appendLog(
        nextState.eventLog,
        accepted
          ? `Server accepted POST ${message.clientId} and advanced to v${serverSnapshot.version}.`
          : `Server rejected POST ${message.clientId} because base v${message.baseSnapshot.version} was stale.`,
      ),
    }

    return nextState
  }

  if (message.type === 'refresh-request') {
    return {
      ...nextState,
      messages: [
        ...nextState.messages,
        {
          id: nextState.nextMessageId,
          type: 'refresh-response',
          clientId: message.clientId,
          createdAt: nextState.clock,
          serverSnapshot: cloneSnapshot(nextState.server),
        },
      ],
      nextMessageId: nextState.nextMessageId + 1,
      eventLog: appendLog(nextState.eventLog, `Server prepared a refresh response for Tab ${message.clientId}.`),
    }
  }

  if (message.type === 'post-response') {
    const client = nextState.clients[message.clientId]
    const keepLocalDraft = message.accepted && client.formText !== message.draft

    nextState.clients[message.clientId] = {
      ...client,
      knownServer: cloneSnapshot(message.serverSnapshot),
      formText: keepLocalDraft ? client.formText : message.serverSnapshot.text,
      pendingDebounce:
        keepLocalDraft && client.pendingDebounce === null ? DEBOUNCE_STEPS : client.pendingDebounce,
      notice: message.accepted
        ? {
            tone: 'success',
            text: keepLocalDraft
              ? `POST ${message.clientId} persisted. You still have newer unsent local edits.`
              : `POST ${message.clientId} persisted successfully.`,
          }
        : {
            tone: 'warning',
            text: `POST ${message.clientId} was rejected, so this tab refreshed to server v${message.serverSnapshot.version}.`,
          },
    }

    return {
      ...nextState,
      eventLog: appendLog(
        nextState.eventLog,
        message.accepted
          ? `Tab ${message.clientId} received a success response.`
          : `Tab ${message.clientId} received a failure response and refreshed from the server.`,
      ),
    }
  }

  const client = nextState.clients[message.clientId]
  nextState.clients[message.clientId] = {
    ...client,
    knownServer: cloneSnapshot(message.serverSnapshot),
    formText: message.serverSnapshot.text,
    pendingDebounce: null,
    notice: {
      tone: 'info',
      text: `Refresh complete. ${client.label} now mirrors server v${message.serverSnapshot.version}.`,
    },
  }

  return {
    ...nextState,
    eventLog: appendLog(nextState.eventLog, `${client.label} completed a refresh.`),
  }
}

const describeMessage = (message: Message) => {
  switch (message.type) {
    case 'post-request':
      return `POST ${message.clientId} request #${message.id}`
    case 'refresh-request':
      return `refresh request for Tab ${message.clientId} (#${message.id})`
    case 'post-response':
      return `POST ${message.clientId} response #${message.id}`
    case 'refresh-response':
      return `refresh response for Tab ${message.clientId} (#${message.id})`
  }
}

const messageDirection = (message: Message) =>
  message.type === 'post-request' || message.type === 'refresh-request'
    ? 'Browser → server'
    : 'Server → browser'

const messageTitle = (message: Message) => {
  if (message.type === 'post-request') {
    return `POST ${message.clientId}`
  }

  if (message.type === 'refresh-request') {
    return `Refresh ${message.clientId}`
  }

  if (message.type === 'post-response') {
    return `${message.accepted ? 'Success' : 'Failure'} → Tab ${message.clientId}`
  }

  return `Refresh response → Tab ${message.clientId}`
}

function App() {
  const [simulation, setSimulation] = useState<SimulationState>(() => buildInitialState())

  const dirtyClients = CLIENT_IDS.filter(
    (clientId) => simulation.clients[clientId].formText !== simulation.clients[clientId].knownServer.text,
  ).length

  return (
    <main className="app-shell">
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Case study collection</p>
          <h1>Optimistic UI race checker</h1>
          <p className="hero-copy">
            Case study 1 simulates two browser tabs editing the same debounced text field while an
            optimistic-concurrency server decides whether each POST is accepted or rejected.
          </p>
        </div>

        <div className="hero-actions">
          <div className="case-study-card">
            <span className="case-badge">Case study 1</span>
            <h2>Debounced textbox + version check</h2>
            <p>
              Step time to fire debounced POSTs, queue refreshes, then resolve any in-flight
              request or response in whatever order you want.
            </p>
          </div>

          <div className="control-card">
            <div>
              <span className="metric-label">Tick</span>
              <strong className="metric-value">{simulation.clock}</strong>
            </div>
            <div>
              <span className="metric-label">Dirty tabs</span>
              <strong className="metric-value">{dirtyClients}</strong>
            </div>
            <div>
              <span className="metric-label">In flight</span>
              <strong className="metric-value">{simulation.messages.length}</strong>
            </div>
            <button type="button" onClick={() => setSimulation((current) => stepClock(current))}>
              Step time
            </button>
            <button type="button" className="secondary" onClick={() => setSimulation(buildInitialState())}>
              Reset scenario
            </button>
          </div>
        </div>
      </header>

      <section className="workspace">
        <div className="browser-column">
          {CLIENT_IDS.map((clientId) => {
            const client = simulation.clients[clientId]
            const dirty = client.formText !== client.knownServer.text
            const pendingMessages = simulation.messages.filter((message) => message.clientId === clientId)

            return (
              <article key={clientId} className="panel browser-panel">
                <div className="panel-header">
                  <div>
                    <p className="panel-kicker">Browser copy</p>
                    <h2>{client.label}</h2>
                  </div>
                  <span className={`status-pill ${dirty ? 'warning' : 'success'}`}>
                    {dirty ? 'Local edits pending' : 'In sync'}
                  </span>
                </div>

                <label className="field-label" htmlFor={`editor-${clientId}`}>
                  Text box
                </label>
                <textarea
                  id={`editor-${clientId}`}
                  value={client.formText}
                  onChange={(event) => {
                    const value = event.target.value
                    setSimulation((current) => {
                      const currentClient = current.clients[clientId]
                      const dirtyValue = value !== currentClient.knownServer.text

                      return {
                        ...current,
                        clients: {
                          ...current.clients,
                          [clientId]: {
                            ...currentClient,
                            formText: value,
                            pendingDebounce: dirtyValue ? DEBOUNCE_STEPS : null,
                            notice: dirtyValue
                              ? {
                                  tone: 'info',
                                  text: `Edit captured. A debounced POST will queue after ${DEBOUNCE_STEPS} ticks.`,
                                }
                              : {
                                  tone: 'neutral',
                                  text: 'Local form matches the known server state again.',
                                },
                          },
                        },
                      }
                    })
                  }}
                />

                <div className="client-stats">
                  <div>
                    <span>Known server</span>
                    <strong>v{client.knownServer.version}</strong>
                  </div>
                  <div>
                    <span>Debounce</span>
                    <strong>
                      {client.pendingDebounce === null
                        ? 'idle'
                        : `${client.pendingDebounce} tick${client.pendingDebounce === 1 ? '' : 's'}`}
                    </strong>
                  </div>
                  <div>
                    <span>In flight</span>
                    <strong>{pendingMessages.length}</strong>
                  </div>
                </div>

                <div className="button-row">
                  <button
                    type="button"
                    disabled={!dirty}
                    onClick={() => setSimulation((current) => queuePost(current, clientId, 'Manual action'))}
                  >
                    POST {clientId} now
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setSimulation((current) => queueRefresh(current, clientId))}
                  >
                    Queue refresh
                  </button>
                </div>

                <p className={`notice notice-${client.notice.tone}`}>{client.notice.text}</p>

                <div className="snapshot-box">
                  <span>Tab’s current server model</span>
                  <code>{client.knownServer.text || '∅'}</code>
                </div>
              </article>
            )
          })}
        </div>

        <aside className="server-column">
          <article className="panel server-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Authoritative state</p>
                <h2>Server</h2>
              </div>
              <span className="status-pill neutral">Optimistic concurrency</span>
            </div>
            <div className="server-state">
              <div>
                <span>Current version</span>
                <strong>v{simulation.server.version}</strong>
              </div>
              <div>
                <span>Stored text</span>
                <p>{simulation.server.text || '∅'}</p>
              </div>
            </div>
          </article>

          <article className="panel queue-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Network timeline</p>
                <h2>In-flight messages</h2>
              </div>
              <span className="status-pill neutral">Resolve in any order</span>
            </div>

            {simulation.messages.length === 0 ? (
              <p className="empty-state">No messages are in flight right now.</p>
            ) : (
              <div className="message-list">
                {simulation.messages.map((message) => (
                  <article key={message.id} className="message-card">
                    <div className="message-topline">
                      <strong>{messageTitle(message)}</strong>
                      <span>{messageDirection(message)}</span>
                    </div>

                    <p className="message-meta">Created at tick {message.createdAt}</p>

                    {message.type === 'post-request' && (
                      <p className="message-body">
                        Base v{message.baseSnapshot.version} → “{message.draft || '∅'}”
                      </p>
                    )}
                    {message.type === 'refresh-request' && (
                      <p className="message-body">Request the latest server snapshot.</p>
                    )}
                    {message.type === 'post-response' && (
                      <p className="message-body">
                        {message.reason} Server snapshot: v{message.serverSnapshot.version} → “
                        {message.serverSnapshot.text || '∅'}”
                      </p>
                    )}
                    {message.type === 'refresh-response' && (
                      <p className="message-body">
                        Snapshot: v{message.serverSnapshot.version} → “
                        {message.serverSnapshot.text || '∅'}”
                      </p>
                    )}

                    <div className="button-row compact">
                      <button
                        type="button"
                        onClick={() =>
                          setSimulation((current) => resolveMessage(current, message.id, 'complete'))
                        }
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setSimulation((current) => resolveMessage(current, message.id, 'lost'))}
                      >
                        Lose
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="panel log-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Recent events</p>
                <h2>Simulator log</h2>
              </div>
            </div>
            <ol>
              {simulation.eventLog.map((entry, index) => (
                <li key={`${entry}-${index}`}>{entry}</li>
              ))}
            </ol>
          </article>
        </aside>
      </section>
    </main>
  )
}

export default App
