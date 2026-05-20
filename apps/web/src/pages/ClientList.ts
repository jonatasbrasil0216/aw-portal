import { api } from '../api'
import { store } from '../store'
import { go } from '../router'
import { showToast } from '../components/Toast'
import type { CreateClientInput } from '@aw-portal/shared-types'

export async function renderClientList(container: HTMLElement) {
  container.innerHTML = `
    <div class="page-content">
      <div class="page-header">
        <div>
          <div class="page-title">Clients</div>
          <div class="page-subtitle">Manage client profiles and generate quarterly reports</div>
        </div>
        <button class="btn btn-primary" id="add-client-btn">＋ Add Client</button>
      </div>
      <div class="clients-grid" id="clients-grid">
        <div style="color:var(--gray-400);padding:40px;text-align:center;grid-column:1/-1;">Loading clients…</div>
      </div>
    </div>
    <div id="add-client-modal" style="display:none;">
      ${_addClientModal()}
    </div>
  `

  document.getElementById('add-client-btn')!.onclick = () => {
    const modal = document.getElementById('add-client-modal')!
    modal.style.display = 'flex'
    modal.className = 'modal-overlay'
  }

  try {
    const clients = await api.clients.list()
    store.setClients(clients)
    const grid = document.getElementById('clients-grid')!
    grid.innerHTML = clients.map(c => _clientCard(c)).join('') + _addCard()
    _bindCardEvents()
  } catch (e) {
    showToast('Failed to load clients', 'error')
  }

  _bindModalEvents()
}

function _clientCard(c: ReturnType<typeof store.getClients>[0]): string {
  return `
    <div class="client-card">
      <div class="client-initials">${c.initials}</div>
      <div class="client-name">${c.display_name}</div>
      <div class="client-meta">
        ${c.is_married ? 'Married couple' : 'Individual'} · Last report: ${c.last_report_quarter ?? '—'}
      </div>
      <div class="client-stats">
        <div class="client-stat">
          <strong>${_fmt(c.monthly_inflow)}</strong>Monthly Inflow
        </div>
        <div class="client-stat">
          <strong>${c.account_count}</strong>Accounts
        </div>
      </div>
      <div class="client-actions">
        <button class="btn btn-primary btn-sm" data-generate="${c.id}">⚡ Generate Report</button>
        <button class="btn btn-outline btn-sm" data-profile="${c.id}">View Profile</button>
      </div>
    </div>
  `
}

function _addCard(): string {
  return `
    <div class="add-client-card" id="add-client-card">
      <div style="font-size:32px;">＋</div>
      <div style="font-size:15px;font-weight:500;">Add New Client</div>
      <div style="font-size:13px;color:var(--gray-400);">Set up a new client profile</div>
    </div>
  `
}

function _bindCardEvents() {
  document.querySelectorAll('[data-generate]').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation()
      _startNewSession(Number((btn as HTMLElement).dataset.generate))
    }
  })
  document.querySelectorAll('[data-profile]').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation()
      const id = (btn as HTMLElement).dataset.profile
      go(`/clients/${id}`)
    }
  })
  document.getElementById('add-client-card')?.addEventListener('click', () => {
    const modal = document.getElementById('add-client-modal')!
    modal.style.display = 'flex'
    modal.className = 'modal-overlay'
  })
}

function _startNewSession(clientId: number) {
  go(`/clients/${clientId}/entry`)
}

function _addClientModal(): string {
  return `
    <div class="modal">
      <div class="modal-title">Add New Client</div>
      <form id="add-client-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">First Name *</label>
            <input class="form-input" name="c1_first" required placeholder="e.g. James">
          </div>
          <div class="form-group">
            <label class="form-label">Last Name *</label>
            <input class="form-input" name="c1_last" required placeholder="e.g. Anderson">
          </div>
          <div class="form-group">
            <label class="form-label">Date of Birth *</label>
            <input class="form-input" name="c1_dob" type="date" required>
          </div>
          <div class="form-group">
            <label class="form-label">SSN Last 4 *</label>
            <input class="form-input" name="c1_ssn_last4" maxlength="4" pattern="[0-9]{4}" required placeholder="XXXX">
          </div>
          <div class="form-group">
            <label class="form-label">Monthly Inflow ($) *</label>
            <input class="form-input" name="monthly_inflow" type="number" step="0.01" required placeholder="e.g. 15000">
          </div>
          <div class="form-group">
            <label class="form-label">Monthly Outflow ($) *</label>
            <input class="form-input" name="monthly_outflow" type="number" step="0.01" required placeholder="e.g. 11000">
          </div>
        </div>
        <hr style="margin:16px 0;border:none;border-top:1px solid var(--gray-200);">
        <div style="font-size:13px;color:var(--gray-600);margin-bottom:12px;font-weight:500;">Spouse / Co-Client (optional)</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">First Name</label>
            <input class="form-input" name="c2_first" placeholder="Optional">
          </div>
          <div class="form-group">
            <label class="form-label">Last Name</label>
            <input class="form-input" name="c2_last" placeholder="Optional">
          </div>
          <div class="form-group">
            <label class="form-label">Date of Birth</label>
            <input class="form-input" name="c2_dob" type="date">
          </div>
          <div class="form-group">
            <label class="form-label">SSN Last 4</label>
            <input class="form-input" name="c2_ssn_last4" maxlength="4" pattern="[0-9]{4}" placeholder="XXXX">
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="cancel-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Client</button>
        </div>
      </form>
    </div>
  `
}

function _bindModalEvents() {
  document.getElementById('cancel-modal')?.addEventListener('click', () => {
    document.getElementById('add-client-modal')!.style.display = 'none'
  })

  document.getElementById('add-client-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const data: CreateClientInput = {
      c1_first: fd.get('c1_first') as string,
      c1_last: fd.get('c1_last') as string,
      c1_dob: fd.get('c1_dob') as string,
      c1_ssn_last4: fd.get('c1_ssn_last4') as string,
      monthly_inflow: parseFloat(fd.get('monthly_inflow') as string),
      monthly_outflow: parseFloat(fd.get('monthly_outflow') as string),
    }
    const c2_first = fd.get('c2_first') as string
    if (c2_first) {
      data.c2_first = c2_first
      data.c2_last = fd.get('c2_last') as string
      data.c2_dob = fd.get('c2_dob') as string
      data.c2_ssn_last4 = fd.get('c2_ssn_last4') as string
    }
    try {
      await api.clients.create(data)
      showToast('Client created successfully', 'success')
      document.getElementById('add-client-modal')!.style.display = 'none'
      const clients = await api.clients.list()
      store.setClients(clients)
      const grid = document.getElementById('clients-grid')!
      grid.innerHTML = clients.map(c => _clientCard(c)).join('') + _addCard()
      _bindCardEvents()
    } catch (err) {
      showToast('Failed to create client', 'error')
    }
  })
}

function _fmt(n: number) { return '$' + n.toLocaleString() }
