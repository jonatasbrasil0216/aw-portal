import type { Calculations } from '@aw-portal/shared-types'

export function calcPanelHtml(calcs: Calculations | null): string {
  if (!calcs) {
    return `
      <div class="card" style="background:var(--navy);color:#fff;">
        <div style="font-family:var(--font-display);font-size:1rem;color:var(--gold);margin-bottom:12px;">Live Calculations</div>
        <div style="color:rgba(255,255,255,0.5);font-size:0.875rem;">Enter balances to see calculations update in real time.</div>
      </div>
    `
  }

  const fmt = (n: number) => '$' + (n ?? 0).toLocaleString()
  const row = (label: string, val: number, color?: string) => `
    <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
      <span style="font-size:0.8rem;color:rgba(255,255,255,0.65);">${label}</span>
      <span style="font-weight:600;color:${color ?? '#fff'}">${fmt(val)}</span>
    </div>
  `

  return `
    <div class="card" style="background:var(--navy);color:#fff;">
      <div style="font-family:var(--font-display);font-size:1rem;color:var(--gold);margin-bottom:14px;">Live Calculations</div>
      <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.4);margin-bottom:6px;">SACS</div>
      ${row('Monthly Inflow', calcs.monthly_inflow, '#a8e6c1')}
      ${row('Monthly Outflow', calcs.monthly_outflow, '#f4a7a0')}
      ${row('Monthly Excess', calcs.monthly_excess, calcs.monthly_excess >= 0 ? '#a8e6c1' : '#f4a7a0')}
      ${row('Reserve Balance', calcs.private_reserve_balance)}
      ${row('Reserve Target', calcs.private_reserve_target, 'var(--gold)')}
      <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.4);margin:12px 0 6px;">TCC</div>
      ${row('C1 Retirement', calcs.c1_retirement_total)}
      ${row('C2 Retirement', calcs.c2_retirement_total)}
      ${row('Non-Retirement', calcs.non_retirement_total)}
      ${row('Trust / Property', calcs.trust_value)}
      <div style="display:flex;justify-content:space-between;padding:10px 0;margin-top:4px;border-top:1px solid rgba(255,255,255,0.15);">
        <span style="font-weight:700;color:var(--gold);">Grand Total</span>
        <span style="font-size:1rem;font-weight:700;color:var(--gold);">${fmt(calcs.grand_total_net_worth)}</span>
      </div>
      ${row('Liabilities (separate)', calcs.liabilities_total, '#f4a7a0')}
    </div>
  `
}
