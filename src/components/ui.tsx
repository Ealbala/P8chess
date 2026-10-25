// Small reusable UI pieces.
import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10 ${className}`}>{children}</div>
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{children}</h2>
      {right}
    </div>
  )
}

export function ProgressBar({ value, color = 'bg-green-500' }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
    </Card>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const styles = {
    primary: 'bg-green-600 text-white hover:bg-green-700 shadow-[0_3px_0_#15803d] active:translate-y-0.5 active:shadow-none',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-slate-800',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2.5 font-semibold transition disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex w-full rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
            o.value === value ? 'bg-white shadow-sm dark:bg-slate-600' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base dark:border-slate-600 dark:bg-slate-800'

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  )
}
