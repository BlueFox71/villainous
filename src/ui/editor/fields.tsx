// Champs de formulaire réutilisables par les onglets de l'éditeur de vilains.
import { useRef } from 'react'
import { readImageForStorage } from './imageUtils'

export const inputClass =
  'rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-300/70'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/50">{label}</span>
      {children}
    </label>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  textarea?: boolean
}) {
  return (
    <Field label={label}>
      {textarea ? (
        <textarea
          className={`${inputClass} min-h-[5rem] resize-y`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={inputClass}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number | undefined
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        className={`${inputClass} w-24`}
        value={value ?? 0}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  )
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-white/15 bg-transparent"
        />
        <input
          className={`${inputClass} w-28 font-mono`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </Field>
  )
}

/** Champ image : aperçu + bouton « Choisir » + « Retirer ». */
export function ImageField({
  label,
  value,
  onChange,
  aspect = 'square',
}: {
  label: string
  value: string | undefined
  onChange: (v: string | undefined) => void
  aspect?: 'square' | 'card' | 'board' | 'pawn'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const ratio =
    aspect === 'square'
      ? 'aspect-square'
      : aspect === 'card'
        ? 'aspect-[1440/2044]'
        : aspect === 'pawn'
          ? 'aspect-[3/4]'
          : 'aspect-[1.4]'
  const onPick = async (file: File | undefined) => {
    if (!file) return
    const max = aspect === 'board' ? 1600 : aspect === 'card' ? 1024 : 800
    onChange(await readImageForStorage(file, max))
  }
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <div
          className={`${ratio} w-24 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-black/30`}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl text-white/20">🖼️</div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
          >
            Choisir une image
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-left text-xs text-white/40 transition hover:text-red-300"
            >
              Retirer
            </button>
          )}
        </div>
      </div>
    </Field>
  )
}

/** Liste déroulante générique typée. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const select = (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
  return label ? <Field label={label}>{select}</Field> : select
}
