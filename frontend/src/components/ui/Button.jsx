import Spinner from './Spinner'

const VARIANTS = {
  primary: 'btn-primary',
  ghost:   'btn-ghost',
  action:  'btn-action',
  sm:      'btn-sm',
  new:     'btn-new',
  save:    'btn-save',
  danger:  'btn-sm danger',
}

export default function Button({
  variant = 'ghost',
  fullWidth = false,
  loading = false,
  disabled = false,
  children,
  className = '',
  style,
  ...props
}) {
  const base = VARIANTS[variant] || 'btn-ghost'
  return (
    <button
      className={`${base}${fullWidth ? ' w-full' : ''}${className ? ' ' + className : ''}`}
      disabled={disabled || loading}
      style={style}
      {...props}
    >
      {loading ? <Spinner size={12} /> : null}
      {children}
    </button>
  )
}
