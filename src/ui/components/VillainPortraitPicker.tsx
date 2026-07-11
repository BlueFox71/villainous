import { useEffect, useRef, useState } from 'react'
import { VILLAIN_REGISTRY, villainEntry, type VillainKey } from '../store/gameStore'
import { useCustomVillainStore } from '../store/customVillainStore'
import { villainPortrait } from '../villainArt'
import { VILLAIN_COLOR } from '../villainColors'
import { byRelease } from '../villainOrder'

const BUILTIN_KEYS = (Object.keys(VILLAIN_REGISTRY) as VillainKey[]).sort(byRelease)

/** Nom d'un vilain (natif OU publié `custom-…`), repli sur la clé. */
const nameOf = (key: string): string => villainEntry(key)?.def.name ?? key
/** Couleur thématique d'un vilain par sa clé (VILLAIN_COLOR est indexé par def.id ;
 *  pour un publié, la clé EST son def.id). */
const colorOf = (key: string): string | undefined => VILLAIN_COLOR[villainEntry(key)?.def.id ?? key]

interface Props {
  value: string
  onChange: (key: string) => void
  /** Couleur d'accent (anneau) du bouton — typiquement la couleur du camp. */
  accent?: string
  /** Grise un vilain dans la grille (ex. sans animation) et suffixe son nom. */
  dim?: (key: string) => boolean
}

/**
 * Sélecteur de vilain par GRILLE DE PORTRAITS (outils mode test). Remplace un
 * `<select>` : un bouton affiche le portrait + nom courant ; au clic, une grille
 * de tous les portraits s'ouvre (clic sur un portrait = sélection + fermeture).
 * Liste les vilains natifs PUIS les vilains PUBLIÉS de l'Atelier (jouables/testables).
 */
export function VillainPortraitPicker({ value, onChange, accent, dim }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  // Vilains publiés (réactif : apparaissent dès qu'ils sont chargés/enregistrés).
  const publishedKeys = useCustomVillainStore((s) => s.villains).filter((v) => v.published).map((v) => v.id)
  const keys: string[] = [...BUILTIN_KEYS, ...publishedKeys]

  // Fermeture au clic en dehors / touche Échap.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const color = accent ?? colorOf(value) ?? '#888'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Choisir un vilain"
        className="flex max-w-[10rem] items-center gap-1.5 rounded border border-white/20 bg-black/40 px-1.5 py-1 text-left text-white/90 hover:bg-white/10"
      >
        <img
          src={villainPortrait(value)}
          alt=""
          draggable={false}
          className="h-6 w-6 shrink-0 rounded-full object-cover"
          style={{ boxShadow: `0 0 0 1.5px ${color}` }}
        />
        <span className="min-w-0 truncate text-xs">{nameOf(value)}</span>
        <span className="ml-auto shrink-0 text-[9px] text-white/40">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-[80] mt-1 max-h-[28rem] w-80 overflow-y-auto rounded-lg border border-emerald-400/40 bg-[#15131f] p-2 shadow-2xl">
          <div className="grid grid-cols-4 gap-2">
            {keys.map((k) => {
              const dimmed = dim?.(k) ?? false
              const selected = k === value
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    onChange(k)
                    setOpen(false)
                  }}
                  title={`${nameOf(k)}${dimmed ? ' (pas d’animation)' : ''}`}
                  className={`group relative aspect-square overflow-hidden rounded-md border transition hover:scale-105 ${
                    selected ? 'border-emerald-400 ring-1 ring-emerald-300' : 'border-white/15'
                  } ${dimmed ? 'opacity-40 grayscale' : ''}`}
                >
                  <img
                    src={villainPortrait(k)}
                    alt={nameOf(k)}
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
