// Champs de formulaire réutilisables par les onglets de l'éditeur de vilains.
import { useRef } from 'react'
import { readImageForStorage } from './imageUtils'
import type { CropPos } from '../../data/customVillain'

const CENTER: CropPos = { x: 50, y: 50 }

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

/** Curseurs de cadrage (gauche/droite, haut/bas, zoom) pour une image « cover ». */
export function CropSliders({
  pos,
  onChange,
}: {
  pos: CropPos
  onChange: (p: CropPos) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-4 text-xs text-white/50">
        <span className="w-1/4 shrink-0 font-semibold uppercase tracking-wide">↔ Gauche/Droite</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos.x}
          onChange={(e) => onChange({ ...pos, x: Number(e.target.value) })}
          className="w-32 accent-amber-400"
        />
      </label>
      <label className="flex items-center gap-4 text-xs text-white/50">
        <span className="w-1/4 shrink-0 font-semibold uppercase tracking-wide">↕ Haut/Bas</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos.y}
          onChange={(e) => onChange({ ...pos, y: Number(e.target.value) })}
          className="w-32 accent-amber-400"
        />
      </label>
      <label className="flex items-center gap-4 text-xs text-white/50">
        <span className="w-1/4 shrink-0 font-semibold uppercase tracking-wide">🔍 Zoom</span>
        <input
          type="range"
          min={100}
          max={300}
          step={5}
          value={Math.round((pos.zoom ?? 1) * 100)}
          onChange={(e) => onChange({ ...pos, zoom: Number(e.target.value) / 100 })}
          className="w-32 accent-amber-400"
        />
      </label>
    </div>
  )
}

/** Champ image : aperçu + bouton « Choisir » + « Retirer ». Si `crop` est fourni,
 *  ajoute deux curseurs de cadrage (gauche/droite + haut/bas) et applique le
 *  cadrage à l'aperçu. */
export function ImageField({
  label,
  value,
  onChange,
  aspect = 'square',
  crop,
}: {
  label: string
  value: string | undefined
  onChange: (v: string | undefined) => void
  aspect?: 'square' | 'card' | 'board' | 'pawn'
  crop?: { pos: CropPos; onChange: (p: CropPos) => void }
}) {
  const pos = crop?.pos ?? CENTER
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
            <img
              src={value}
              alt=""
              className="h-full w-full object-cover"
              style={
                crop
                  ? {
                      objectPosition: `${pos.x}% ${pos.y}%`,
                      transform: `scale(${pos.zoom ?? 1})`,
                      transformOrigin: `${pos.x}% ${pos.y}%`,
                    }
                  : undefined
              }
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl text-white/20">🖼️</div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
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
            className="self-start rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
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
          {crop && value && <CropSliders pos={pos} onChange={crop.onChange} />}
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
    <select
      className={inputClass}
      style={{ backgroundColor: '#15131b', color: '#fff' }}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ backgroundColor: '#15131b', color: '#fff' }}>
          {o.label}
        </option>
      ))}
    </select>
  )
  return label ? <Field label={label}>{select}</Field> : select
}
