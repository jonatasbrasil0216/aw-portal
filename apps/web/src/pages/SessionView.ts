import { api } from '../api'
import { go } from '../router'
import { showToast } from '../components/Toast'
import { buildFields, renderFormSections, renderCalcPanel } from './DataEntry'
import type { ClientDetail, Calculations, ReportSession } from '@aw-portal/shared-types'

export async function renderSessionView(container: HTMLElement, params: Record<string, string>) {
  const sessionId = Number(params.id)
  container.innerHTML = `<div class="page-content"><div style="color:var(--gray-400);">Loading…</div></div>`

  let session: ReportSession
  let client: ClientDetail
  let calcs: Calculations

  try {
    session = await api.sessions.get(sessionId)
    client  = await api.clients.get(session.client_id)
    calcs   = await api.sessions.calculate(sessionId)
  } catch {
    showToast('Failed to load report', 'error')
    go('/reports')
    return
  }

  const balanceMap: Record<string, number> = {}
  ;(session.balance_entries ?? []).forEach(e => { balanceMap[e.field_key] = e.balance })

  const fields = buildFields(client)

  container.innerHTML = `
    <div class="page-content">
      <a class="back-link" href="#/reports">← Back to Report History</a>

      <div class="page-header">
        <div>
          <div class="page-title">${client.display_name} · ${session.quarter}</div>
          <div class="page-subtitle">${session.report_date} — read-only</div>
        </div>
        <div style="display:flex;gap:8px;">
          ${session.has_sacs_pdf ? `<button class="btn btn-outline" id="dl-sacs-btn">⬇ SACS PDF</button>` : ''}
          ${session.has_tcc_pdf  ? `<button class="btn btn-outline" id="dl-tcc-btn">⬇ TCC PDF</button>`  : ''}
        </div>
      </div>

      <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;">
        <div style="flex:1;min-width:320px;" id="form-sections"></div>
        <div style="width:280px;flex-shrink:0;" id="calc-panel-wrap"></div>
      </div>
    </div>
  `

  renderFormSections(fields, balanceMap, client, true)
  renderCalcPanel(calcs)

  if (session.has_sacs_pdf) document.getElementById('dl-sacs-btn')?.addEventListener('click', () => api.sessions.downloadSACS(sessionId))
  if (session.has_tcc_pdf)  document.getElementById('dl-tcc-btn')?.addEventListener('click',  () => api.sessions.downloadTCC(sessionId))
}
