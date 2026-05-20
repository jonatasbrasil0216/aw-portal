import './styles/base.css'
import './styles/components.css'
import { initRouter } from './router'
import { renderNav } from './components/Nav'
import { renderClientList } from './pages/ClientList'
import { renderClientProfile } from './pages/ClientProfile'
import { renderDataEntry } from './pages/DataEntry'
import { renderReportPreview } from './pages/ReportPreview'
import { renderReportHistory } from './pages/ReportHistory'
import { renderSessionView } from './pages/SessionView'
import { api } from './api'

const app = document.getElementById('app')!

renderNav(app)

const shell = document.createElement('div')
shell.className = 'shell'

const sidebar = document.createElement('aside')
sidebar.className = 'sidebar'
sidebar.id = 'app-sidebar'
sidebar.innerHTML = `
  <div>
    <div class="sidebar-section-label">Navigation</div>
    <div class="sidebar-item" id="nav-clients" data-href="/">
      <span class="sidebar-icon">👥</span> Clients
    </div>
    <div class="sidebar-item" id="nav-reports" data-href="/reports">
      <span class="sidebar-icon">📄</span> Report History
    </div>
  </div>
  <div style="margin-top:auto;padding:20px;border-top:1px solid var(--gray-200);">
    <div style="font-size:12px;color:var(--gray-400);" id="sidebar-footer">Loading…</div>
  </div>
`

const main = document.createElement('main')
main.className = 'main'
main.id = 'page-container'

shell.appendChild(sidebar)
shell.appendChild(main)
app.appendChild(shell)

sidebar.querySelector('[data-href="/"]')!.addEventListener('click', () => { location.hash = '/' })
sidebar.querySelector('[data-href="/reports"]')!.addEventListener('click', () => { location.hash = '/reports' })

// Sidebar footer: current quarter + live client count
const today = new Date()
const currentQuarter = `Q${Math.ceil((today.getMonth() + 1) / 3)} ${today.getFullYear()}`

async function refreshSidebarFooter() {
  try {
    const clients = await api.clients.list()
    const active = clients.length
    document.getElementById('sidebar-footer')!.textContent = `${currentQuarter} · ${active} active client${active !== 1 ? 's' : ''}`
  } catch {
    document.getElementById('sidebar-footer')!.textContent = currentQuarter
  }
}
refreshSidebarFooter()

function updateSidebarActive() {
  const hash = location.hash || '#/'
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'))
  if (hash === '#/reports') {
    document.getElementById('nav-reports')?.classList.add('active')
  } else {
    document.getElementById('nav-clients')?.classList.add('active')
  }
}

window.addEventListener('hashchange', updateSidebarActive)
updateSidebarActive()

initRouter({
  '/': () => { renderClientList(main); refreshSidebarFooter() },
  '/reports': () => renderReportHistory(main),
  '/clients/:id': (p) => renderClientProfile(main, p),
  '/clients/:id/entry': (p) => renderDataEntry(main, p),
  '/sessions/:id/report': (p) => renderReportPreview(main, p),
  '/sessions/:id/view':   (p) => renderSessionView(main, p),
})
