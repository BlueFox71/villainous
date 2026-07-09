// Champs de formulaire réutilisables par les onglets de l'éditeur de vilains.
import { useEffect, useRef, useState } from 'react'
import { readImageForStorage, fileToDataUrl } from './imageUtils'
import type { CropPos } from '../../data/customVillain'

const CENTER: CropPos = { x: 50, y: 50 }

export const inputClass =
  'rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-300/70'

export function Field({
  label,
  action,
  children,
}: {
  label: string
  /** Élément optionnel affiché à DROITE du libellé (ex. bouton « Réinitialiser »). */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
        <span>{label}</span>
        {action}
      </span>
      {children}
    </label>
  )
}

/** Petit bouton « réinitialiser » (↺) affiché à droite d'un libellé de Field. Ne
 *  s'affiche que si la valeur diffère du défaut (`show`). */
export function ResetButton({ show, onReset }: { show: boolean; onReset: () => void }) {
  if (!show) return null
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onReset()
      }}
      title="Réinitialiser (valeur par défaut)"
      className="rounded px-1 text-white/40 transition hover:text-amber-200"
    >
      ↺
    </button>
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
  fit = 'cover',
  crop,
}: {
  label: string
  value: string | undefined
  onChange: (v: string | undefined) => void
  aspect?: 'square' | 'card' | 'board' | 'pawn' | 'portrait'
  /** Ajustement de l'aperçu : `cover` (remplit, peut rogner) ou `contain` (image
   *  entière, peut laisser des bords). Le recadrage (`crop`) n'a de sens qu'en `cover`. */
  fit?: 'cover' | 'contain'
  crop?: { pos: CropPos; onChange: (p: CropPos) => void }
}) {
  const pos = crop?.pos ?? CENTER
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  // Détecte un fichier glissé N'IMPORTE OÙ sur la fenêtre pour mettre en évidence la
  // zone de dépôt « de loin » (avant même de survoler la petite vignette). `dragover`
  // se répète en continu pendant le drag : un timer court, ré-armé à chaque événement,
  // se déclenche quand le drag cesse (plus d'événement) → fin de la mise en évidence.
  const [fileNearby, setFileNearby] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onDragOver = (e: DragEvent) => {
      if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return
      setFileNearby(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setFileNearby(false), 140)
    }
    const onDrop = () => {
      if (timer) clearTimeout(timer)
      setFileNearby(false)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
      if (timer) clearTimeout(timer)
    }
  }, [])
  const ratio =
    aspect === 'square'
      ? 'aspect-square'
      : aspect === 'card'
        ? 'aspect-[1440/2044]'
        : aspect === 'pawn'
          ? 'aspect-[3/4]'
          : aspect === 'portrait'
            ? 'aspect-[716/1248]'
            : 'aspect-[1.4]'
  const onPick = async (file: File | undefined) => {
    if (!file) return
    const max = aspect === 'board' ? 1600 : aspect === 'card' || aspect === 'portrait' ? 1024 : 800
    onChange(await readImageForStorage(file, max))
  }
  return (
    <Field label={label}>
      <div className="flex flex-col items-start gap-2">
        {/* Aperçu = zone de dépôt (glisser-déposer d'image) ET raccourci de sélection. */}
        <div
          onClick={(e) => {
            // Le champ est dans un <label> (cf. Field) qui contient l'<input file> :
            // sans preventDefault, le label ouvrirait AUSSI le sélecteur → double ouverture.
            e.preventDefault()
            inputRef.current?.click()
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (!dragOver) setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
            if (file) void onPick(file)
          }}
          title="Cliquer ou glisser-déposer une image"
          className={`${ratio} relative w-36 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 bg-black/30 transition ${
            dragOver
              ? 'border-amber-300 ring-2 ring-amber-300/60'
              : fileNearby
                ? 'border-dashed border-amber-300/80 ring-2 ring-amber-300/30'
                : 'border-solid border-white/15 hover:border-amber-300/50'
          }`}
        >
          {value ? (
            <img
              src={value}
              alt=""
              className={`pointer-events-none h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`}
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
          {(dragOver || fileNearby) && (
            <div
              className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center font-semibold text-amber-100 transition ${
                dragOver ? 'bg-amber-300/25' : 'bg-black/45'
              }`}
            >
              <span className="text-2xl leading-none">⬇</span>
              <span className="text-xs">Déposer ici</span>
            </div>
          )}
        </div>
        <div className="flex w-full flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              inputRef.current?.click()
            }}
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

/** Champ audio : bouton « Choisir » + lecteur (écouter / pause) + « Retirer ».
 *  Stocke le fichier en dataURL (comme les images). */
export function AudioField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | undefined
  onChange: (v: string | undefined) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  const onPick = async (file: File | undefined) => {
    if (!file) return
    onChange(await fileToDataUrl(file))
  }

  const toggle = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) void el.play()
    else el.pause()
  }

  return (
    <Field label={label}>
      <div className="flex flex-col items-start gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => void onPick(e.target.files?.[0])}
        />
        <div className="flex items-center gap-2">
          {value && (
            <button
              type="button"
              onClick={toggle}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/50 text-amber-200 transition hover:bg-amber-400/10"
              title={playing ? 'Pause' : 'Écouter'}
            >
              {playing ? '⏸' : '▶'}
            </button>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
          >
            {value ? 'Remplacer le fichier' : 'Choisir un fichier audio'}
          </button>
        </div>
        {value ? (
          <audio
            ref={audioRef}
            src={value}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            className="hidden"
          />
        ) : (
          <span className="text-xs text-white/40">Aucun fichier audio.</span>
        )}
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
