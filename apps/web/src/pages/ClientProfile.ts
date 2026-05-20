import { go } from '../router'
import { api } from '../api'
import { store } from '../store'
import { showToast } from '../components/Toast'
import type { ClientDetail, Account, Liability } from '@aw-portal/shared-types'

export async function renderClientProfile(container: HTMLElement, params: Record<string, string>) {
  const clientId = Number(params.id)
  container.innerHTML = `<div class="page-content"><div style="color:var(--gray-400);">Loading…</div></div>`

  let client: ClientDetail
  try {
    client = await api.clients.get(clientId)
    store.setCurrentClient(client)
  } catch {
    showToast('Client not found', 'error')
    go('/')
    return
  }

  const familyName = client.is_married
    ? `${client.display_name} Family`
    : client.display_name

  container.innerHTML = `
    <div class="page-content">
      <a class="back-link" href="#/">← Back to Clients</a>

      <div class="profile-header">
        <div class="profile-avatar">${client.initials}</div>
        <div class="profile-info">
          <div class="profile-name">${familyName}</div>
          <div class="profile-detail">
            ${client.is_married ? 'Married couple' : 'Individual'} · Last report: ${client.last_report_quarter ?? '—'}
          </div>
          <div class="profile-tags">
            <span class="badge badge-green">Active</span>
            <span class="badge badge-gold">Retainer</span>
            ${client.is_married ? '<span class="badge badge-gray">Joint Accounts</span>' : ''}
          </div>
        </div>
        <div style="margin-left:auto;">
          <button class="btn btn-primary" id="generate-report-btn">⚡ Generate Report</button>
        </div>
      </div>

      <div class="tabs" id="profile-tabs">
        <div class="tab active" data-tab="info">Profile</div>
        <div class="tab" data-tab="accounts">Accounts</div>
        <div class="tab" data-tab="reports">Reports</div>
      </div>
      <div id="tab-content"></div>
    </div>
  `

  _renderTab('info', client)

  document.querySelectorAll('.tab').forEach(tab => {
    (tab as HTMLElement).onclick = () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      _renderTab((tab as HTMLElement).dataset.tab!, client)
    }
  })

  document.getElementById('generate-report-btn')?.addEventListener('click', () => {
    go(`/clients/${clientId}/entry`)
  })
}

function _renderTab(tab: string, c: ClientDetail) {
  const content = document.getElementById('tab-content')!
  if (tab === 'info') content.innerHTML = _infoTab(c)
  else if (tab === 'accounts') content.innerHTML = _accountsTab(c)
  else if (tab === 'reports') _renderReportsTab(content, c)
}

function _infoTab(c: ClientDetail): string {
  const field = (label: string, val: string) => `
    <div class="form-group">
      <label class="form-label">${label}</label>
      <input type="text" class="form-input prefilled" value="${val}" readonly>
    </div>
  `
  return `
    <div class="form-section">
      <div class="form-section-title">📋 Client Information</div>
      <div class="form-grid">
        ${field('Client 1 Name', `${c.c1.first} ${c.c1.last}`)}
        ${field('Date of Birth', c.c1.dob)}
        ${field('SSN Last 4', `***${c.c1.ssn_last4}`)}
        ${c.c2 ? `
          ${field('Client 2 Name', `${c.c2.first} ${c.c2.last}`)}
          ${field('Date of Birth', c.c2.dob)}
          ${field('SSN Last 4', `***${c.c2.ssn_last4}`)}
        ` : ''}
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">💼 Financial Parameters</div>
      <div class="form-grid">
        ${field('Monthly Inflow (after tax)', _fmt(c.monthly_inflow))}
        ${field('Monthly Outflow', _fmt(c.monthly_outflow))}
        ${field('Monthly Excess', _fmt(c.monthly_inflow - c.monthly_outflow))}
        ${field('Reserve Target', `${c.reserve_target_months}× expenses (${_fmt(c.reserve_target_months * c.monthly_outflow)})`)}
      </div>
    </div>
  `
}

function _accountsTab(c: ClientDetail): string {
  const TYPE_LABELS: Record<string, string> = {
    ira: 'IRA', roth_ira: 'Roth IRA', '401k': '401K', pension: 'Pension',
    brokerage: 'Joint Brokerage', individual_brokerage: 'Individual Brokerage',
    trust: 'Trust', checking: 'Checking', savings: 'Savings',
  }

  const acctField = (a: Account) => `
    <div class="form-group">
      <label class="form-label">
        ${TYPE_LABELS[a.account_type] ?? a.account_type}${a.account_number_last4 ? ` ···${a.account_number_last4}` : ''}
      </label>
      <input type="text" class="form-input prefilled" value="Balance entered each quarter" readonly>
    </div>
  `

  const liabField = (l: Liability) => `
    <div class="form-group">
      <label class="form-label">${l.liability_type} @ ${l.interest_rate}</label>
      <input type="text" class="form-input prefilled" value="Balance entered each quarter" readonly>
    </div>
  `

  const c1Ret  = c.accounts.filter(a => a.account_category === 'retirement'     && a.owner === 'c1').sort((a,b) => a.sort_order - b.sort_order)
  const c2Ret  = c.accounts.filter(a => a.account_category === 'retirement'     && a.owner === 'c2').sort((a,b) => a.sort_order - b.sort_order)
  const nonRet = c.accounts.filter(a => a.account_category === 'non_retirement').sort((a,b) => a.sort_order - b.sort_order)
  const trust  = c.accounts.filter(a => a.account_category === 'trust')
  const liabs  = c.liabilities.sort((a, b) => a.sort_order - b.sort_order)

  const sections: string[] = []

  if (c1Ret.length) sections.push(`
    <div class="form-section">
      <div class="form-section-title">🏦 ${c.c1.first}'s Retirement Accounts</div>
      <div class="form-grid">${c1Ret.map(acctField).join('')}</div>
    </div>
  `)

  if (c.c2 && c2Ret.length) sections.push(`
    <div class="form-section">
      <div class="form-section-title">🏦 ${c.c2.first}'s Retirement Accounts</div>
      <div class="form-grid">${c2Ret.map(acctField).join('')}</div>
    </div>
  `)

  if (nonRet.length) sections.push(`
    <div class="form-section">
      <div class="form-section-title">📈 Non-Retirement Accounts</div>
      <div class="form-grid">${nonRet.map(acctField).join('')}</div>
    </div>
  `)

  if (trust.length) sections.push(`
    <div class="form-section">
      <div class="form-section-title">🏠 Trust / Property</div>
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">Property Address</label>
          <input type="text" class="form-input prefilled" value="${trust[0].account_number_last4 ?? 'Address on file'}" readonly>
        </div>
        <div class="form-group">
          <label class="form-label">Zillow Zestimate</label>
          <input type="text" class="form-input prefilled" value="Entered each quarter from Zillow" readonly>
        </div>
      </div>
    </div>
  `)

  if (liabs.length) sections.push(`
    <div class="form-section">
      <div class="form-section-title">📉 Liabilities</div>
      <div class="form-grid">${liabs.map(liabField).join('')}</div>
    </div>
  `)

  if (!sections.length) return `
    <div class="empty-state">
      <div class="empty-state-icon">🏦</div>
      <div class="empty-state-title">No accounts yet</div>
      <div class="empty-state-desc">Accounts will appear here once added to this client.</div>
    </div>
  `

  return sections.join('')
}

async function _renderReportsTab(container: HTMLElement, c: ClientDetail) {
  container.innerHTML = `<div style="color:var(--gray-400);padding:20px 0;">Loading reports…</div>`
  try {
    const sessions = await api.sessions.list(c.id)
    if (!sessions.length) {
      container.innerHTML = `
        <div class="form-section">
          <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <div class="empty-state-title">No reports yet</div>
            <div class="empty-state-desc">Click "Generate Report" to create the first quarterly report.</div>
          </div>
        </div>
      `
      return
    }
    const rows = sessions.map(s => `
      <tr>
        <td style="font-weight:600;">${s.quarter}</td>
        <td>${s.report_date}</td>
        <td><span class="badge badge-green">SACS + TCC</span></td>
        <td>
          <div style="display:flex;gap:8px;">
            ${s.has_sacs_pdf ? `<button class="btn btn-outline btn-sm" onclick="window.open('/api/sessions/${s.id}/download/sacs','_blank')">⬇ SACS</button>` : ''}
            ${s.has_tcc_pdf ? `<button class="btn btn-outline btn-sm" onclick="window.open('/api/sessions/${s.id}/download/tcc','_blank')">⬇ TCC</button>` : ''}
            <button class="btn btn-gold btn-sm" data-session="${s.id}">Open</button>
          </div>
        </td>
      </tr>
    `).join('')
    container.innerHTML = `
      <div class="form-section">
        <div class="form-section-title">📊 Report History</div>
        <table class="history-table">
          <thead><tr><th>Quarter</th><th>Date</th><th>Type</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `
    container.querySelectorAll('[data-session]').forEach(btn => {
      (btn as HTMLElement).onclick = () => go(`/sessions/${(btn as HTMLElement).dataset.session}/view`)
    })
  } catch {
    showToast('Failed to load reports', 'error')
  }
}


function _fmt(n: number) { return '$' + n.toLocaleString() }
