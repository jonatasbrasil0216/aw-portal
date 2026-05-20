type ToastType = 'success' | 'error' | 'info'

function getContainer(): HTMLElement {
  let c = document.getElementById('toast-container')
  if (!c) {
    c = document.createElement('div')
    c.id = 'toast-container'
    c.className = 'toast-container'
    document.body.appendChild(c)
  }
  return c
}

export function showToast(message: string, type: ToastType = 'info', duration = 3000) {
  const container = getContainer()
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.textContent = message
  container.appendChild(toast)
  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transition = 'opacity 0.3s'
    setTimeout(() => toast.remove(), 300)
  }, duration)
}
