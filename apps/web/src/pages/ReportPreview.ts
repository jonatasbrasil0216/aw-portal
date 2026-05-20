import { api } from '../api'
import { store } from '../store'
import { go } from '../router'
import { showToast } from '../components/Toast'
import type { ReportSession, Calculations } from '@aw-portal/shared-types'

export async function renderReportPreview(container: HTMLElement, params: Record<string, string>) {
  const sessionId = Number(params.id)

  container.innerHTML = `<div class="page-content"><div style="color:var(--gray-400);">Loading report…</div></div>`

  let session: ReportSession
  let calcs: Calculations
  try {
    session = await api.sessions.get(sessionId)
    calcs = await api.sessions.calculate(sessionId)
    store.setCurrentSession(session)
    store.setCalculations(calcs)
  } catch {
    showToast('Failed to load report', 'error')
    go('/')
    return
  }

  container.innerHTML = `
    <div class="page-content">
      <a class="back-link" href="#/clients/${session.client_id}">← Back to Profile</a>

      <div class="page-header">
        <div>
          <div class="page-title">Reports Ready</div>
          <div class="page-subtitle">${session.quarter} · ${session.report_date}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline" id="print-sacs-btn">🖨 Print SACS</button>
          <button class="btn btn-outline" id="print-tcc-btn">🖨 Print TCC</button>
          <button class="btn btn-gold" id="download-both-btn">⬇ Download Both</button>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:20px;">
        <button class="btn btn-primary" id="tab-sacs">View SACS</button>
        <button class="btn btn-outline" id="tab-tcc">View TCC</button>
      </div>

      <div id="report-preview-content"></div>
    </div>
  `

  _renderPreview('sacs', session, calcs)

  document.getElementById('tab-sacs')!.onclick = () => {
    document.getElementById('tab-sacs')!.className = 'btn btn-primary'
    document.getElementById('tab-tcc')!.className = 'btn btn-outline'
    _renderPreview('sacs', session, calcs)
  }
  document.getElementById('tab-tcc')!.onclick = () => {
    document.getElementById('tab-tcc')!.className = 'btn btn-primary'
    document.getElementById('tab-sacs')!.className = 'btn btn-outline'
    _renderPreview('tcc', session, calcs)
  }

  document.getElementById('back-btn')?.addEventListener('click', () => go(`/clients/${session.client_id}`))
  document.getElementById('print-sacs-btn')!.onclick = () => api.sessions.downloadSACS(sessionId)
  document.getElementById('print-tcc-btn')!.onclick = () => api.sessions.downloadTCC(sessionId)
  document.getElementById('download-both-btn')!.onclick = async () => {
    api.sessions.downloadSACS(sessionId)
    setTimeout(() => api.sessions.downloadTCC(sessionId), 800)
  }
}

function _renderPreview(tab: 'sacs' | 'tcc', session: ReportSession, calcs: Calculations) {
  const content = document.getElementById('report-preview-content')!
  if (tab === 'sacs') content.innerHTML = _sacsPreview(session, calcs)
  else content.innerHTML = _tccPreview(session, calcs)
}

function _sacsPreview(session: ReportSession, c: Calculations): string {
  const excess = c.monthly_excess
  const reserveDiff = c.private_reserve_balance - c.private_reserve_target
  const funded = reserveDiff >= 0

  return `
    <div class="report-preview-container">
      <div class="report-page">
        <div class="report-header">
          <div>
            <div class="report-header-logo"><span>W</span>indbrook Solutions</div>
            <div class="report-header-title">Simple Automated Cash Flow System</div>
          </div>
          <div style="text-align:right;">
            <div class="report-header-client">${session.quarter}</div>
            <div class="report-header-date">${session.report_date}</div>
          </div>
        </div>

        <div class="sacs-body">
          <div class="sacs-title">Monthly Cash Flow Overview</div>
          <div class="sacs-diagram">
            <div class="bubble bubble-inflow">
              <div class="bubble-label">Inflow</div>
              <div class="bubble-amount">${_fmt(c.monthly_inflow)}</div>
              <div class="bubble-sub">monthly take-home</div>
            </div>
            <div class="sacs-arrow">
              <div class="sacs-arrow-line green"></div>
              <div style="color:var(--green);font-size:12px;">▼</div>
            </div>
            <div class="bubble bubble-outflow">
              <div class="bubble-label">Outflow</div>
              <div class="bubble-amount">${_fmt(c.monthly_outflow)}</div>
              <div class="bubble-sub">expense budget</div>
            </div>
            <div class="sacs-arrow">
              <div class="sacs-arrow-line navy"></div>
              <div style="color:var(--navy);font-size:12px;">▼</div>
              <div class="sacs-arrow-label">${_fmt(excess)}/mo excess</div>
            </div>
            <div class="bubble bubble-reserve">
              <div class="bubble-label">Private Reserve</div>
              <div class="bubble-amount">${_fmt(c.private_reserve_balance)}</div>
              <div class="bubble-sub">target: ${_fmt(c.private_reserve_target)}</div>
            </div>
          </div>

          <div class="sacs-summary">
            <div class="sacs-summary-title">Investment Summary</div>
            <div class="calc-row">
              <span class="calc-label">Schwab Investment Account</span>
              <span class="calc-value">${_fmt(c.schwab_balance)}</span>
            </div>
            <div class="calc-row">
              <span class="calc-label">Private Reserve Balance</span>
              <span class="calc-value">${_fmt(c.private_reserve_balance)}</span>
            </div>
            <div class="calc-row" style="border-bottom:none;">
              <span class="calc-label">Reserve vs. Target</span>
              <span class="calc-value ${funded ? 'positive' : 'negative'}">
                ${funded ? '✓ Fully Funded' : `${_fmt(reserveDiff)} below target`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style="color:rgba(255,255,255,0.6);font-size:13px;max-width:180px;padding-top:8px;">
        <div style="font-weight:600;color:white;margin-bottom:8px;">SACS Report</div>
        <div style="line-height:1.6;">Shows monthly cash flow from inflow through outflow to private reserve accumulation.</div>
        <div style="margin-top:16px;">
          <button class="btn btn-gold btn-sm" style="width:100%;" id="print-sacs-side">🖨 Print PDF</button>
        </div>
      </div>
    </div>
  `
}

function _tccPreview(session: ReportSession, c: Calculations): string {
  return `
    <div class="report-preview-container">
      <div class="report-page report-page-wide">
        <div class="report-header">
          <div>
            <div class="report-header-logo"><span>W</span>indbrook Solutions</div>
            <div class="report-header-title">Total Client Chart — Net Worth Overview</div>
          </div>
          <div style="text-align:right;">
            <div class="report-header-client">${session.quarter}</div>
            <div class="report-header-date">${session.report_date}</div>
          </div>
        </div>

        <div class="tcc-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
            <div>
              <div class="tcc-section-label">🏦 Client 1 — Retirement</div>
              <div class="acct-bubble">
                <div class="acct-type">Retirement Total</div>
                <div class="acct-balance">${_fmt(c.c1_retirement_total)}</div>
              </div>
              <div class="total-box">
                <div class="total-label">Subtotal</div>
                <div class="total-amount">${_fmt(c.c1_retirement_total)}</div>
              </div>
            </div>
            <div>
              <div class="tcc-section-label">🏦 Client 2 — Retirement</div>
              <div class="acct-bubble">
                <div class="acct-type">Retirement Total</div>
                <div class="acct-balance">${_fmt(c.c2_retirement_total)}</div>
              </div>
              <div class="total-box">
                <div class="total-label">Subtotal</div>
                <div class="total-amount">${_fmt(c.c2_retirement_total)}</div>
              </div>
            </div>
          </div>

          <div style="margin-bottom:12px;">
            <div class="tcc-section-label">📈 Non-Retirement Accounts</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <div class="acct-bubble" style="flex:1;background:var(--navy-mid);">
                <div class="acct-type">Non-Retirement</div>
                <div class="acct-balance">${_fmt(c.non_retirement_total)}</div>
              </div>
              <div class="total-box" style="flex:1;">
                <div class="total-label">Non-Retirement Total</div>
                <div class="total-amount">${_fmt(c.non_retirement_total)}</div>
              </div>
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <div class="tcc-section-label">🏠 Trust / Property</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <div class="acct-bubble" style="flex:1;background:var(--navy-mid);">
                <div class="acct-type">Primary Residence (Zillow Zestimate)</div>
                <div class="acct-balance">${_fmt(c.trust_value)}</div>
              </div>
              <div class="total-box" style="flex:1;">
                <div class="total-label">Trust Value</div>
                <div class="total-amount">${_fmt(c.trust_value)}</div>
              </div>
            </div>
          </div>

          <div class="grand-total-bar">
            <div>
              <div class="label">Grand Total Net Worth</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">
                Retirement + Non-Retirement + Trust
              </div>
            </div>
            <div class="amount">${_fmt(c.grand_total_net_worth)}</div>
          </div>

          <div class="tcc-liabilities">
            <div class="tcc-section-label" style="color:var(--red);margin-bottom:8px;">
              📉 Liabilities (Not Subtracted from Net Worth)
            </div>
            <div class="liability-row">
              <span style="color:var(--gray-600);">Total Liabilities</span>
              <span style="font-weight:600;color:var(--red);">${_fmt(c.liabilities_total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style="color:rgba(255,255,255,0.6);font-size:13px;max-width:180px;padding-top:8px;">
        <div style="font-weight:600;color:white;margin-bottom:8px;">TCC Report</div>
        <div style="line-height:1.6;">Shows total net worth organized by account type. Liabilities are shown separately and not subtracted.</div>
        <div style="margin-top:16px;">
          <button class="btn btn-gold btn-sm" style="width:100%;" id="print-tcc-side">🖨 Print PDF</button>
        </div>
      </div>
    </div>
  `
}

function _fmt(n: number) { return '$' + (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
