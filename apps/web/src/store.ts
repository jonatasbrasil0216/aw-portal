import type { ClientSummary, ClientDetail, ReportSession, Calculations } from '@aw-portal/shared-types'

interface State {
  clients: ClientSummary[]
  currentClient: ClientDetail | null
  currentSession: ReportSession | null
  currentCalculations: Calculations | null
}

const state: State = {
  clients: [],
  currentClient: null,
  currentSession: null,
  currentCalculations: null,
}

export const store = {
  getClients: () => state.clients,
  setClients: (c: ClientSummary[]) => { state.clients = c },
  getCurrentClient: () => state.currentClient,
  setCurrentClient: (c: ClientDetail | null) => { state.currentClient = c },
  getCurrentSession: () => state.currentSession,
  setCurrentSession: (s: ReportSession | null) => { state.currentSession = s },
  getCalculations: () => state.currentCalculations,
  setCalculations: (c: Calculations | null) => { state.currentCalculations = c },
}
