import { api } from '../api'
import { store } from '../store'
import { go } from '../router'
import { showToast } from '../components/Toast'
import type { ClientDetail, BalanceEntry, Calculations, ReportSession } from '@aw-portal/shared-types'

type TccGroup = 'ret_c1' | 'ret_c2' | 'non_ret' | 'trust' | 'liabilities'

export interface FieldDef {
  fieldKey: string
  label: string
  prefilled: boolean
  hint?: string
  value?: number
  accountId?: number
  liabilityId?: number
  tccGroup?: TccGroup
}

export function buildFields(client: ClientDetail): FieldDef[] {
  const fields: FieldDef[] = []

  fields.push({ fieldKey: 'monthly_inflow',   label: 'Monthly Inflow (After-Tax)',       prefilled: true,  hint: 'Pre-filled from client profile', value: client.monthly_inflow })
  fields.push({ fieldKey: 'monthly_outflow',  label: 'Monthly Outflow / Expense Budget', prefilled: true,  hint: 'Pre-filled from client profile', value: client.monthly_outflow })
  fields.push({ fieldKey: 'private_reserve',  label: 'Private Reserve Balance',          prefilled: false, hint: 'From Pinnacle Bank secure email' })
  fields.push({ fieldKey: 'schwab_investment',label: 'Schwab Investment Balance',        prefilled: false, hint: 'From Charles Schwab' })

  const retAccounts = client.accounts.filter(a => a.account_category === 'retirement').sort((a, b) => a.sort_order - b.sort_order)
  for (const acct of retAccounts) {
    const typeLabel: Record<string, string> = { ira: 'IRA', roth_ira: 'Roth IRA', '401k': '401(k)', pension: 'Pension' }
    const label = `${typeLabel[acct.account_type] ?? acct.account_type}${acct.account_number_last4 ? ` ···${acct.account_number_last4}` : ''}`
    fields.push({ fieldKey: `account_${acct.id}`, label, prefilled: false, hint: 'From Schwab statement', accountId: acct.id, tccGroup: acct.owner === 'c2' ? 'ret_c2' : 'ret_c1' })
  }

  const nonRetAccounts = client.accounts.filter(a => a.account_category === 'non_retirement').sort((a, b) => a.sort_order - b.sort_order)
  for (const acct of nonRetAccounts) {
    const typeLabel: Record<string, string> = { brokerage: 'Joint Brokerage', individual_brokerage: 'Individual Brokerage' }
    const label = `${typeLabel[acct.account_type] ?? acct.account_type}${acct.account_number_last4 ? ` ···${acct.account_number_last4}` : ''}`
    fields.push({ fieldKey: `account_${acct.id}`, label, prefilled: false, accountId: acct.id, tccGroup: 'non_ret' })
  }

  const trustAcct = client.accounts.find(a => a.account_category === 'trust')
  if (trustAcct) {
    fields.push({ fieldKey: 'zillow_zestimate', label: 'Zillow Zestimate', prefilled: false, hint: 'Home value from Zillow', accountId: trustAcct.id, tccGroup: 'trust' })
  }

  for (const liab of client.liabilities.sort((a, b) => a.sort_order - b.sort_order)) {
    fields.push({ fieldKey: `liability_${liab.id}`, label: `${liab.liability_type} @ ${liab.interest_rate}`, prefilled: false, liabilityId: liab.id, tccGroup: 'liabilities' })
  }

  return fields
}

export async function renderDataEntry(container: HTMLElement, params: Record<string, string>) {
  const clientId = Number(params.id)
  container.innerHTML = `<div class="page-content"><div style="color:var(--gray-400);">Loading…</div></div>`

  let client: ClientDetail
  try {
    client = await api.clients.get(clientId)
    store.setCurrentClient(client)
  } catch {
    showToast('Failed to load client', 'error')
    go(`/clients/${clientId}`)
    return
  }

  const fields = _buildFieldsFor(client)
  const requiredCount = fields.filter(f => !f.prefilled).length

  container.innerHTML = `
    <div class="page-content">
      <a class="back-link" href="#/clients/${clientId}">← Back to Profile</a>

      <div class="page-header">
        <div>
          <div class="page-title">Generate Report — ${client.display_name}</div>
          <div class="page-subtitle">Enter current balances — all math is calculated automatically</div>
        </div>
        <button class="btn btn-green" id="save-report-btn" disabled>💾 Save Report</button>
      </div>

      <div class="entry-progress">
        <div class="progress-bar">
          <div class="progress-bar-fill" id="progress-fill" style="width:0%"></div>
        </div>
        <div class="progress-label" id="progress-label">0 of ${requiredCount} fields entered</div>
      </div>

      <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;">
        <div style="flex:1;min-width:320px;" id="form-sections"></div>
        <div style="width:280px;flex-shrink:0;" id="calc-panel-wrap"></div>
      </div>
    </div>

    <div class="modal-overlay" id="report-modal" style="display:none;">
      <div class="modal" style="width:min(900px,96vw);max-width:none;height:92vh;overflow:hidden;padding:0;display:flex;flex-direction:column;">
        <!-- Fixed header -->
        <div style="padding:20px 24px 0;flex-shrink:0;background:var(--white);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <div style="font-family:var(--font-display);font-size:20px;color:var(--navy);">Reports Ready</div>
            <button class="btn btn-outline btn-sm" id="close-report-modal">✕</button>
          </div>
          <div id="modal-subtitle" style="font-size:13px;color:var(--gray-400);margin-bottom:12px;"></div>
          <!-- Tab bar -->
          <div style="display:flex;gap:0;border-bottom:2px solid var(--gray-200);">
            <div id="modal-tab-sacs" style="padding:9px 20px;font-size:14px;font-weight:600;cursor:pointer;border-bottom:2px solid var(--navy);margin-bottom:-2px;color:var(--navy);transition:all 0.15s;">SACS — Cash Flow</div>
            <div id="modal-tab-tcc"  style="padding:9px 20px;font-size:14px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--gray-400);transition:all 0.15s;">TCC — Net Worth</div>
          </div>
        </div>
        <!-- Scrollable preview (fills remaining height) -->
        <div id="modal-report-content" class="report-preview-area" style="flex:1;overflow-y:auto;padding:20px 24px;"></div>
        <!-- Fixed footer -->
        <div style="padding:12px 24px;border-top:1px solid var(--gray-200);display:flex;gap:8px;justify-content:flex-end;flex-shrink:0;background:var(--white);">
          <button class="btn btn-outline btn-sm" id="modal-dl-sacs">⬇ SACS PDF</button>
          <button class="btn btn-outline btn-sm" id="modal-dl-tcc">⬇ TCC PDF</button>
          <button class="btn btn-gold btn-sm" id="modal-dl-both">⬇ Download Both</button>
        </div>
      </div>
    </div>
  `

  renderFormSections(fields, {}, client)
  renderCalcPanel(null)
  _updateProgress(fields)

  document.getElementById('save-report-btn')!.addEventListener('click', async () => {
    await _saveAndGenerate(fields, clientId, client)
  })
}

// ── Field building ────────────────────────────────────────────────────────────

function _buildFieldsFor(client: ClientDetail): FieldDef[] {
  return buildFields(client)
}

// ── Form rendering ────────────────────────────────────────────────────────────

const TCC_GROUPS: [TccGroup, string][] = [
  ['ret_c1',      '👤 {c1} Retirement'],
  ['ret_c2',      '👤 {c2} Retirement'],
  ['non_ret',     '📈 Non-Retirement'],
  ['trust',       '🏠 Trust / Zillow'],
  ['liabilities', '📉 Liabilities'],
]

export function renderFormSections(
  fields: FieldDef[],
  balanceMap: Record<string, number>,
  client: ClientDetail,
  readonly = false,
  containerId = 'form-sections'
) {
  const sacsFields = fields.filter(f => !f.tccGroup)
  const tccFields  = fields.filter(f =>  f.tccGroup)

  const tccHtml = TCC_GROUPS.map(([group, labelTpl]) => {
    const gf = tccFields.filter(f => f.tccGroup === group)
    if (!gf.length) return ''
    const label = labelTpl.replace('{c1}', client.c1.first).replace('{c2}', client.c2?.first ?? 'Client 2')
    return `
      <div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:600;color:var(--navy);padding-bottom:8px;border-bottom:1px solid var(--gray-100);margin-bottom:12px;">${label}</div>
        <div class="form-grid">${gf.map(f => _fieldHtml(f, balanceMap[f.fieldKey], readonly)).join('')}</div>
      </div>
    `
  }).join('')

  const el = document.getElementById(containerId)
  if (!el) return
  el.innerHTML = `
    <div class="form-section">
      <div class="form-section-title">💰 SACS — Cash Flow</div>
      <div class="form-grid">${sacsFields.map(f => _fieldHtml(f, balanceMap[f.fieldKey], readonly)).join('')}</div>
    </div>
    <div class="form-section">
      <div class="form-section-title">🏦 TCC — Account Balances</div>
      ${tccHtml}
    </div>
  `

  if (!readonly) {
    document.querySelectorAll('.entry-input').forEach(input => {
      (input as HTMLInputElement).addEventListener('input', () => {
        _recalcLocal(fields, client)
        _updateProgress(fields)
      })
    })
  }
}

function _fieldHtml(f: FieldDef, currentVal?: number, readonly = false): string {
  const val = currentVal ?? f.value ?? ''
  const isReadonly = readonly || f.prefilled
  const cls = isReadonly ? 'prefilled' : 'needs-entry'
  return `
    <div class="form-group">
      <label class="form-label">${f.label}${!isReadonly ? ' <span style="color:var(--gold);">●</span>' : ''}</label>
      <input class="form-input${readonly ? '' : ' entry-input'} ${cls}" type="number" step="0.01"
        data-key="${f.fieldKey}" ${isReadonly ? 'readonly' : ''} value="${val}"
        placeholder="${isReadonly ? '' : 'Enter current balance'}">
      ${f.hint ? `<span class="form-hint">${f.hint}</span>` : ''}
    </div>
  `
}

// ── Live calculation (client-side, no API needed) ─────────────────────────────

function _recalcLocal(fields: FieldDef[], client: ClientDetail) {
  const get = (key: string) => {
    const el = document.querySelector(`.entry-input[data-key="${key}"]`) as HTMLInputElement
    return el ? (parseFloat(el.value) || 0) : 0
  }

  const calcs: Calculations = {
    monthly_inflow: client.monthly_inflow,
    monthly_outflow: client.monthly_outflow,
    monthly_excess: client.monthly_inflow - client.monthly_outflow,
    private_reserve_balance: get('private_reserve'),
    private_reserve_target: client.monthly_outflow * client.reserve_target_months,
    schwab_balance: get('schwab_investment'),
    c1_retirement_total: 0, c2_retirement_total: 0,
    non_retirement_total: 0, trust_value: 0,
    grand_total_net_worth: 0, liabilities_total: 0,
  }

  for (const f of fields) {
    if (!f.tccGroup || f.prefilled) continue
    const val = get(f.fieldKey)
    if      (f.tccGroup === 'ret_c1')      calcs.c1_retirement_total  += val
    else if (f.tccGroup === 'ret_c2')      calcs.c2_retirement_total  += val
    else if (f.tccGroup === 'non_ret')     calcs.non_retirement_total += val
    else if (f.tccGroup === 'trust')       calcs.trust_value          += val
    else if (f.tccGroup === 'liabilities') calcs.liabilities_total    += val
  }
  calcs.grand_total_net_worth = calcs.c1_retirement_total + calcs.c2_retirement_total + calcs.non_retirement_total + calcs.trust_value

  renderCalcPanel(calcs)
}

// ── Calc panel ────────────────────────────────────────────────────────────────

export function renderCalcPanel(calcs: Calculations | null, wrapperId = 'calc-panel-wrap') {
  const wrap = document.getElementById(wrapperId)
  if (!wrap) return
  if (!calcs) {
    wrap.innerHTML = `
      <div class="form-section" style="position:sticky;top:24px;">
        <div class="form-section-title">⚡ Live Calculations</div>
        <div style="color:var(--gray-400);font-size:13px;padding:8px 0;">Enter balances to see calculations update in real time.</div>
      </div>
    `
    return
  }
  const row = (label: string, val: string, cls = '', bold = false) => `
    <div class="calc-row">
      <span class="calc-label" ${bold ? 'style="font-weight:600;"' : ''}>${label}</span>
      <span class="calc-value ${cls}">${val}</span>
    </div>
  `
  wrap.innerHTML = `
    <div class="form-section" style="position:sticky;top:24px;">
      <div class="form-section-title">⚡ Live Calculations</div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-400);margin-bottom:8px;">SACS Summary</div>
      ${row('Inflow',         _fmt(calcs.monthly_inflow),  'positive')}
      ${row('Outflow',        _fmt(calcs.monthly_outflow), 'negative')}
      <hr class="calc-divider">
      ${row('Monthly Excess', _fmt(calcs.monthly_excess),  calcs.monthly_excess >= 0 ? 'positive' : 'negative')}
      ${row('Reserve Target', _fmt(calcs.private_reserve_target))}
      <hr style="border:none;border-top:1px solid var(--gray-200);margin:14px 0;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-400);margin-bottom:8px;">TCC Summary</div>
      ${row('Client 1 Retirement', _fmt(calcs.c1_retirement_total))}
      ${row('Client 2 Retirement', _fmt(calcs.c2_retirement_total))}
      ${row('Non-Retirement',      _fmt(calcs.non_retirement_total))}
      ${row('Trust / Property',    _fmt(calcs.trust_value))}
      <hr class="calc-divider">
      ${row('Grand Total', _fmt(calcs.grand_total_net_worth), '', true)}
      <div class="calc-row">
        <span class="calc-label" style="color:var(--red);">Liabilities (separate)</span>
        <span class="calc-value negative">${_fmt(calcs.liabilities_total)}</span>
      </div>
    </div>
  `
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function _updateProgress(fields: FieldDef[]) {
  const required = fields.filter(f => !f.prefilled)
  const filled = required.filter(f => {
    const el = document.querySelector(`.entry-input[data-key="${f.fieldKey}"]`) as HTMLInputElement
    return el && el.value !== '' && !isNaN(parseFloat(el.value))
  })
  const pct = required.length ? (filled.length / required.length) * 100 : 100
  const fill = document.getElementById('progress-fill')
  const label = document.getElementById('progress-label')
  if (fill) fill.style.width = pct + '%'
  if (label) label.textContent = `${filled.length} of ${required.length} fields entered`
  const btn = document.getElementById('save-report-btn') as HTMLButtonElement
  if (btn) btn.disabled = filled.length < required.length
}

// ── Save: create session then generate ────────────────────────────────────────

async function _saveAndGenerate(fields: FieldDef[], clientId: number, client: ClientDetail) {
  const btn = document.getElementById('save-report-btn') as HTMLButtonElement
  btn.disabled = true
  btn.textContent = 'Saving…'

  const entries: BalanceEntry[] = fields.map(f => {
    const inputEl = document.querySelector(`.entry-input[data-key="${f.fieldKey}"]`) as HTMLInputElement
    const balance = inputEl ? (parseFloat(inputEl.value) || 0) : (f.value ?? 0)
    return { field_key: f.fieldKey, balance, account_id: f.accountId, liability_id: f.liabilityId }
  })

  try {
    const today = new Date()
    const quarter = `Q${Math.ceil((today.getMonth() + 1) / 3)} ${today.getFullYear()}`
    const session = await api.sessions.create(clientId, { quarter, report_date: today.toISOString().split('T')[0] })
    store.setCurrentSession(session)

    await api.sessions.updateBalances(session.id, entries)
    await api.sessions.generateSACS(session.id)
    await api.sessions.generateTCC(session.id)
    const calcs = await api.sessions.calculate(session.id)
    store.setCalculations(calcs)

    renderCalcPanel(calcs)
    _openReportModal(session, calcs, session.id, client)
    showToast('Report saved!', 'success')
  } catch (e: any) {
    const msg = e?.message ?? String(e)
    showToast(msg.length < 120 ? msg : 'Failed to save report — check API console', 'error')
    btn.disabled = false
    btn.textContent = '💾 Save Report'
  }
}

// ── Report modal ──────────────────────────────────────────────────────────────

function _openReportModal(session: ReportSession, calcs: Calculations, sessionId: number, client: ClientDetail) {
  const modal   = document.getElementById('report-modal')!
  const content = document.getElementById('modal-report-content')!
  const tabSacs = document.getElementById('modal-tab-sacs')!
  const tabTcc  = document.getElementById('modal-tab-tcc')!

  document.getElementById('modal-subtitle')!.textContent =
    `${client.display_name}  ·  ${session.quarter}  ·  ${session.report_date}`

  const ACTIVE_STYLE   = 'padding:9px 20px;font-size:14px;font-weight:600;cursor:pointer;border-bottom:2px solid var(--navy);margin-bottom:-2px;color:var(--navy);transition:all 0.15s;'
  const INACTIVE_STYLE = 'padding:9px 20px;font-size:14px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--gray-400);transition:all 0.15s;'

  const fadeIn = (html: string) => {
    content.classList.add('fading')
    setTimeout(() => {
      content.innerHTML = html
      content.scrollTop = 0
      content.classList.remove('fading')
    }, 180)
  }

  const showSacs = () => {
    tabSacs.style.cssText = ACTIVE_STYLE
    tabTcc.style.cssText  = INACTIVE_STYLE
    fadeIn(_sacsHtml(session, calcs))
  }
  const showTcc = () => {
    tabTcc.style.cssText  = ACTIVE_STYLE
    tabSacs.style.cssText = INACTIVE_STYLE
    fadeIn(_tccHtml(session, calcs))
  }

  tabSacs.onclick = showSacs
  tabTcc.onclick  = showTcc
  document.getElementById('close-report-modal')!.onclick = () => { modal.style.display = 'none' }
  document.getElementById('modal-dl-sacs')!.onclick  = () => api.sessions.downloadSACS(sessionId)
  document.getElementById('modal-dl-tcc')!.onclick   = () => api.sessions.downloadTCC(sessionId)
  document.getElementById('modal-dl-both')!.onclick  = () => {
    api.sessions.downloadSACS(sessionId)
    setTimeout(() => api.sessions.downloadTCC(sessionId), 600)
  }

  // Show SACS first (no fade on initial open)
  tabSacs.style.cssText = ACTIVE_STYLE
  tabTcc.style.cssText  = INACTIVE_STYLE
  content.innerHTML = _sacsHtml(session, calcs)
  modal.style.display = 'flex'
}

// ── Report preview HTML ───────────────────────────────────────────────────────

function _sacsHtml(session: ReportSession, c: Calculations): string {
  const funded = c.private_reserve_balance >= c.private_reserve_target
  const diff   = c.private_reserve_balance - c.private_reserve_target

  const metric = (label: string, val: string, color = 'var(--gray-800)') => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--gray-100);">
      <span style="font-size:13px;color:var(--gray-600);">${label}</span>
      <span style="font-weight:700;font-size:15px;color:${color};">${val}</span>
    </div>
  `

  return `
    <div style="display:flex;flex-direction:column;min-height:100%;border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-md);">
      <!-- Navy header -->
      <div style="background:var(--navy);color:white;padding:20px 32px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
        <div>
          <div style="font-family:var(--font-display);font-size:18px;"><span style="color:var(--gold);">W</span>indbrook Solutions</div>
          <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-top:2px;">Simple Automated Cash Flow System</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:var(--font-display);font-size:14px;">${session.quarter}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.55);">${session.report_date}</div>
        </div>
      </div>

      <!-- Content fills remaining space -->
      <div style="flex:1;background:var(--cream);padding:32px 40px;display:flex;gap:48px;align-items:flex-start;">

        <!-- Left: bubble diagram centered -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:0;flex-shrink:0;">
          <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray-400);margin-bottom:20px;font-weight:600;">Monthly Cash Flow</div>

          <div style="width:170px;height:170px;border-radius:50%;background:var(--green);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:white;">
            <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;margin-bottom:3px;">Inflow</div>
            <div style="font-family:var(--font-display);font-size:22px;font-weight:700;">${_fmt(c.monthly_inflow)}</div>
            <div style="font-size:9px;opacity:0.7;margin-top:2px;">monthly take-home</div>
          </div>

          <div style="display:flex;flex-direction:column;align-items:center;margin:4px 0;">
            <div style="width:2px;height:32px;background:var(--green);"></div>
            <div style="color:var(--green);font-size:14px;">▼</div>
          </div>

          <div style="width:150px;height:150px;border-radius:50%;background:var(--red);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:white;">
            <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;margin-bottom:3px;">Outflow</div>
            <div style="font-family:var(--font-display);font-size:20px;font-weight:700;">${_fmt(c.monthly_outflow)}</div>
            <div style="font-size:9px;opacity:0.7;margin-top:2px;">expense budget</div>
          </div>

          <div style="display:flex;flex-direction:column;align-items:center;margin:4px 0;">
            <div style="width:2px;height:24px;background:var(--navy);"></div>
            <div style="font-size:10px;color:var(--gray-400);letter-spacing:0.06em;text-transform:uppercase;background:var(--cream);padding:2px 8px;">${_fmt(c.monthly_excess)}/mo excess</div>
            <div style="width:2px;height:24px;background:var(--navy);"></div>
            <div style="color:var(--navy);font-size:14px;">▼</div>
          </div>

          <div style="width:160px;height:160px;border-radius:50%;background:var(--navy);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:white;">
            <div style="font-size:9px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;margin-bottom:3px;">Private Reserve</div>
            <div style="font-family:var(--font-display);font-size:20px;font-weight:700;">${_fmt(c.private_reserve_balance)}</div>
            <div style="font-size:9px;opacity:0.65;margin-top:2px;">target: ${_fmt(c.private_reserve_target)}</div>
          </div>
        </div>

        <!-- Right: metrics -->
        <div style="flex:1;padding-top:40px;">
          <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-400);margin-bottom:4px;font-weight:600;">SACS Summary</div>
          ${metric('Monthly Inflow',  _fmt(c.monthly_inflow),  'var(--green)')}
          ${metric('Monthly Outflow', _fmt(c.monthly_outflow), 'var(--red)')}
          ${metric('Monthly Excess',  _fmt(c.monthly_excess),  c.monthly_excess >= 0 ? 'var(--green)' : 'var(--red)')}
          ${metric('Reserve Target',  _fmt(c.private_reserve_target))}

          <div style="margin-top:24px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-400);margin-bottom:4px;font-weight:600;">Investment Accounts</div>
          ${metric('Schwab Investment',    _fmt(c.schwab_balance))}
          ${metric('Private Reserve',      _fmt(c.private_reserve_balance))}
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--gray-100);">
            <span style="font-size:13px;color:var(--gray-600);">Reserve vs. Target</span>
            <span style="font-weight:700;font-size:14px;color:${funded ? 'var(--green)' : 'var(--red)'};">${funded ? '✓ Fully Funded' : `${_fmt(diff)} below target`}</span>
          </div>
        </div>
      </div>
    </div>
  `
}

function _tccHtml(session: ReportSession, c: Calculations): string {
  const acctCard = (label: string, amount: string, bg = 'var(--navy)') => `
    <div style="background:${bg};border-radius:10px;padding:16px 20px;color:white;">
      <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.65;margin-bottom:6px;">${label}</div>
      <div style="font-family:var(--font-display);font-size:20px;font-weight:700;">${amount}</div>
    </div>
  `

  return `
    <div style="display:flex;flex-direction:column;min-height:100%;border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-md);">
      <!-- Navy header -->
      <div style="background:var(--navy);color:white;padding:20px 32px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
        <div>
          <div style="font-family:var(--font-display);font-size:18px;"><span style="color:var(--gold);">W</span>indbrook Solutions</div>
          <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-top:2px;">Total Client Chart — Net Worth Overview</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:var(--font-display);font-size:14px;">${session.quarter}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.55);">${session.report_date}</div>
        </div>
      </div>

      <!-- Content -->
      <div style="flex:1;background:var(--cream);padding:28px 32px;">
        <!-- Retirement row -->
        <div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-400);font-weight:600;margin-bottom:10px;">Retirement Accounts</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          ${acctCard('Client 1 — Retirement', _fmt(c.c1_retirement_total))}
          ${acctCard('Client 2 — Retirement', _fmt(c.c2_retirement_total))}
        </div>

        <!-- Non-retirement + Trust row -->
        <div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-400);font-weight:600;margin-bottom:10px;">Other Assets</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          ${acctCard('Non-Retirement Accounts', _fmt(c.non_retirement_total), 'var(--navy-mid)')}
          ${acctCard('Trust / Property (Zillow)', _fmt(c.trust_value), 'var(--navy-mid)')}
        </div>

        <!-- Grand total -->
        <div style="background:var(--navy);border-radius:12px;padding:20px 28px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;box-shadow:var(--shadow-md);">
          <div>
            <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.6);">Grand Total Net Worth</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:3px;">Retirement + Non-Retirement + Trust</div>
          </div>
          <div style="font-family:var(--font-display);font-size:28px;color:var(--gold);font-weight:700;">${_fmt(c.grand_total_net_worth)}</div>
        </div>

        <!-- Liabilities -->
        <div style="background:var(--red-light);border-radius:12px;padding:18px 24px;border-left:4px solid var(--red);">
          <div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--red);font-weight:700;margin-bottom:10px;">📉 Liabilities — Shown Separately, Not Subtracted</div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:14px;color:var(--gray-600);">Total Liabilities</span>
            <span style="font-family:var(--font-display);font-size:20px;font-weight:700;color:var(--red);">${_fmt(c.liabilities_total)}</span>
          </div>
        </div>
      </div>
    </div>
  `
}

function _fmt(n: number) { return '$' + (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
