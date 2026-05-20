export function renderNav(container: HTMLElement) {
  const nav = document.createElement('nav')
  nav.className = 'topnav'
  nav.innerHTML = `
    <div class="topnav-logo"><span>W</span>indbrook</div>
    <div class="topnav-divider"></div>
    <div class="topnav-title">Client Report Portal</div>
    <div class="topnav-right">
      <div class="topnav-user">
        <span>Admin</span>
        <div class="avatar avatar-sm">A</div>
      </div>
    </div>
  `
  container.appendChild(nav)
}
