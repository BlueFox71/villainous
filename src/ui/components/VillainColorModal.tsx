import { useEffect, useRef, useState } from 'react'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { VILLAIN_COLOR } from '../villainColors'

const VILLAIN_KEYS = Object.keys(VILLAIN_REGISTRY) as VillainKey[]

interface Props {
  onClose: () => void
  /** Vilain ciblé à l'ouverture. */
  initialVillain?: VillainKey
}

/** Composante 0–255 → hex 2 chiffres. */
const hx = (v: number) => v.toString(16).padStart(2, '0')
const toHex = (r: number, g: number, b: number) => `#${hx(r)}${hx(g)}${hx(b)}`.toUpperCase()

/**
 * Éditeur de COULEUR du méchant (outils mode test). Affiche la couleur courante et
 * le dos de carte du vilain ; une PIPETTE permet de cliquer un pixel du dos pour en
 * extraire la couleur, puis de valider (réécrit `VILLAIN_COLOR` dans villainColors.ts).
 * Tous les vilains sont éditables.
 */
export function VillainColorModal({ onClose, initialVillain }: Props) {
  const [villain, setVillain] = useState<VillainKey>(
    initialVillain && VILLAIN_KEYS.includes(initialVillain) ? initialVillain : VILLAIN_KEYS[0],
  )
  const [picking, setPicking] = useState(false)
  const [newColor, setNewColor] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const def = VILLAIN_REGISTRY[villain].def
  const currentColor = VILLAIN_COLOR[def.id] ?? '#000000'
  const backSrc = def.backVillainImage

  // Changement de vilain : on repart de zéro (pas de couleur choisie, pioche off).
  const changeVillain = (k: VillainKey) => {
    setVillain(k)
    setPicking(false)
    setNewColor(null)
    setSaveMsg(null)
  }

  // Dessine le dos de carte sur le canvas (à sa taille native → lecture de pixel fidèle).
  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
    }
    img.src = backSrc
    return () => {
      cancelled = true
    }
  }, [backSrc])

  // Clic sur le dos en mode pioche : lit le pixel sous le curseur.
  const pickAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!picking) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width))
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height))
    const d = ctx.getImageData(x, y, 1, 1).data
    setNewColor(toHex(d[0], d[1], d[2]))
    setPicking(false)
    setSaveMsg(null)
  }

  // Réécrit la couleur du vilain dans villainColors.ts (toutes ses clés : id + clé registre).
  const validate = async () => {
    if (!newColor) return
    setSaveMsg('Sauvegarde…')
    const keys = Array.from(new Set([def.id, villain]))
    try {
      const res = await fetch('/__save-villain-color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys, color: newColor }),
      })
      setSaveMsg(res.ok ? '✓ Couleur enregistrée (rechargez pour voir partout)' : `Échec : ${await res.text()}`)
    } catch {
      setSaveMsg('Erreur réseau (serveur de dév requis).')
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl border border-lime-400/40 bg-[#15131f] p-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-black text-lime-200">🎨 Couleur du méchant</span>
          <select
            value={villain}
            onChange={(e) => changeVillain(e.target.value as VillainKey)}
            className="rounded border border-white/25 bg-black/40 px-2 py-1 text-sm text-white"
          >
            {VILLAIN_KEYS.map((k) => (
              <option key={k} value={k}>{VILLAIN_REGISTRY[k].def.name}</option>
            ))}
          </select>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg border border-white/25 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            ✕ Fermer
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          {/* Dos de carte (canvas) : source de la pioche. */}
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-white/50">
              Dos de carte {picking ? '— cliquez un pixel' : ''}
            </span>
            <canvas
              ref={canvasRef}
              onClick={pickAt}
              className={`w-full max-w-xs rounded-lg border border-white/15 ${picking ? 'cursor-crosshair ring-2 ring-lime-400' : ''}`}
            />
          </div>

          {/* Couleurs : courante + nouvelle, et la pipette. */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-white/50">Couleur actuelle</span>
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 rounded border border-white/20" style={{ backgroundColor: currentColor }} />
                <span className="font-mono text-sm text-white/80">{currentColor}</span>
              </div>
            </div>

            <button
              onClick={() => { setPicking((p) => !p); setSaveMsg(null) }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                picking ? 'border-lime-400 bg-lime-400/15 text-lime-200' : 'border-lime-400/60 text-lime-200 hover:bg-lime-500/10'
              }`}
            >
              💧 Pipette {picking ? '(active)' : ''}
            </button>

            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-white/50">Nouvelle couleur</span>
              <div className="flex items-center gap-2">
                <span
                  className="h-8 w-8 rounded border border-white/20"
                  style={{ backgroundColor: newColor ?? 'transparent' }}
                />
                <span className="font-mono text-sm text-white/80">{newColor ?? '—'}</span>
              </div>
            </div>

            <button
              onClick={validate}
              disabled={!newColor}
              title={newColor ? 'Enregistre la couleur' : 'Choisissez d’abord une couleur à la pipette'}
              className="rounded-lg border border-amber-400/60 px-3 py-2 text-sm font-semibold text-amber-200 enabled:hover:bg-amber-500/15 disabled:opacity-40"
            >
              💾 Valider
            </button>
            {saveMsg && <span className="text-xs text-lime-300">{saveMsg}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
