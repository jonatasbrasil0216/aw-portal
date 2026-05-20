interface FieldOptions {
  label: string
  name: string
  value?: number | string
  prefilled?: boolean
  needsEntry?: boolean
  placeholder?: string
  type?: string
  step?: string
}

export function formField(opts: FieldOptions): string {
  const cls = [
    'field-input',
    opts.prefilled ? 'prefilled' : '',
    opts.needsEntry ? 'needs-entry' : '',
  ].filter(Boolean).join(' ')

  return `
    <div class="field-group">
      <label class="field-label">${opts.label}</label>
      <input
        class="${cls}"
        name="${opts.name}"
        type="${opts.type ?? 'number'}"
        step="${opts.step ?? '0.01'}"
        ${opts.value !== undefined ? `value="${opts.value}"` : ''}
        ${opts.placeholder ? `placeholder="${opts.placeholder}"` : ''}
        ${opts.prefilled ? 'readonly' : ''}
      >
    </div>
  `
}
