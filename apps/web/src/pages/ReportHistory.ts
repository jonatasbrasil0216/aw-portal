import { api } from '../api'
import { go } from '../router'
import { showToast } from '../components/Toast'
import type { ReportHistorySummary } from '@aw-portal/shared-types'

export async function renderReportHistory(container: HTMLElement) {
  container.innerHTML = `
    <div class="page-content">
      <div class="page-header">
        <div>
          <div class="page-title">Report History</div>
          <div class="page-subtitle">All generated reports across all clients</div>
        </div>
      </div>
      <div class="form-section" id="history-wrap">
        <div style="color:var(--gray-400);padding:20px 0;">Loading…</div>
      </div>
    </div>
  `

  try {
    const sessions = await api.sessions.listAll()
    _render(sessions)
  } catch {
    showToast('Failed to load report history', 'error')
  }
}

function _render(sessions: ReportHistorySummary[]) {
  const wrap = document.getElementById('history-wrap')!

  if (!sessions.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📄</div>
        <div class="empty-state-title">No reports yet</div>
        <div class="empty-state-desc">Generated reports will appear here.</div>
      </div>
    `
    return
  }

  const rows = sessions.map(s => `
    <tr>
      <td><strong>${s.client_name}</strong></td>
      <td>SACS + TCC</td>
      <td><span class="badge badge-gold">${s.quarter}</span></td>
      <td>${s.report_date}</td>
      <td>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline btn-sm" data-open="${s.id}">View</button>
          ${s.has_sacs_pdf || s.has_tcc_pdf ? `<button class="btn btn-outline btn-sm" data-dl="${s.id}" data-has-sacs="${s.has_sacs_pdf}" data-has-tcc="${s.has_tcc_pdf}">⬇ Download</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('')

  wrap.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="history-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Report Type</th>
            <th>Quarter</th>
            <th>Generated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `

  wrap.querySelectorAll('[data-open]').forEach(btn => {
    (btn as HTMLElement).onclick = () => go(`/sessions/${(btn as HTMLElement).dataset.open}/view`)
  })

  wrap.querySelectorAll('[data-dl]').forEach(btn => {
    (btn as HTMLElement).onclick = () => {
      const el = btn as HTMLElement
      const sid = Number(el.dataset.dl)
      if (el.dataset.hasSacs === 'true') api.sessions.downloadSACS(sid)
      if (el.dataset.hasTcc === 'true') setTimeout(() => api.sessions.downloadTCC(sid), 600)
    }
  })
}
