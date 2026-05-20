import type {
  ClientSummary, ClientDetail, CreateClientInput,
  ReportSession, BalanceEntry, Calculations, CreateSessionInput,
  ReportHistorySummary,
} from '@aw-portal/shared-types'

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function del(path: string): Promise<void> {
  const res = await fetch(BASE + path, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

export const api = {
  clients: {
    list: () => get<ClientSummary[]>('/clients'),
    get: (id: number) => get<ClientDetail>('/clients/' + id),
    create: (data: CreateClientInput) => post<ClientDetail>('/clients', data),
    update: (id: number, data: Partial<CreateClientInput>) => put<ClientDetail>('/clients/' + id, data),
    addAccount: (id: number, data: object) => post('/clients/' + id + '/accounts', data),
    deleteAccount: (clientId: number, accountId: number) => del('/clients/' + clientId + '/accounts/' + accountId),
    addLiability: (id: number, data: object) => post('/clients/' + id + '/liabilities', data),
    deleteLiability: (clientId: number, liabilityId: number) => del('/clients/' + clientId + '/liabilities/' + liabilityId),
  },
  sessions: {
    listAll: () => get<ReportHistorySummary[]>('/sessions'),
    list: (clientId: number) => get<ReportSession[]>('/clients/' + clientId + '/sessions'),
    create: (clientId: number, data: CreateSessionInput) => post<ReportSession>('/clients/' + clientId + '/sessions', data),
    get: (id: number) => get<ReportSession>('/sessions/' + id),
    updateBalances: (id: number, entries: BalanceEntry[]) => put<BalanceEntry[]>('/sessions/' + id + '/balances', { entries }),
    calculate: (id: number) => post<Calculations>('/sessions/' + id + '/calculate', {}),
    generateSACS: (id: number) => post('/sessions/' + id + '/generate/sacs', {}),
    generateTCC: (id: number) => post('/sessions/' + id + '/generate/tcc', {}),
    downloadSACS: (id: number) => window.open(BASE + '/sessions/' + id + '/download/sacs', '_blank'),
    downloadTCC: (id: number) => window.open(BASE + '/sessions/' + id + '/download/tcc', '_blank'),
  },
}
