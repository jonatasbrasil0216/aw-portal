import type { ClientSummary } from '@aw-portal/shared-types'

export function clientCardHtml(c: ClientSummary): string {
  return `
    <div class="card" data-client-id="${c.id}" style="display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div class="avatar avatar-lg">${c.initials}</div>
        <div>
          <div style="font-family:var(--font-display);font-size:1.1rem;color:var(--navy);">${c.display_name}</div>
          <div style="font-size:0.8rem;color:var(--gray-600);margin-top:2px;">
            ${c.account_count} accounts${c.is_married ? ' · Joint' : ''}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:16px;font-size:0.85rem;">
        <div>
          <div style="color:var(--gray-600);">Monthly Inflow</div>
          <div style="font-weight:600;color:var(--green);">$${c.monthly_inflow.toLocaleString()}</div>
        </div>
        <div>
          <div style="color:var(--gray-600);">Last Report</div>
          <div style="font-weight:600;">${c.last_report_quarter ?? '—'}</div>
        </div>
      </div>
    </div>
  `
}
