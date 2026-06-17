import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'

interface Props {
  /** Dos de carte Fatalité (les cartes sont présentées FACE CACHÉE). */
  backImage: string
  /** Nom du lieu de la pioche choisie (pour le titre). */
  locationName: string
  /** Cartes de la pioche (remélangée) — on n'affiche que leur dos. */
  cards: CardInstance[]
  /** Nombre exact de cartes à choisir (1 ou 2). */
  count: number
  /** Valider la sélection (instanceIds des cartes à défausser). */
  onConfirm: (instanceIds: string[]) => void
}

/**
 * Marteau (Yzma) — le joueur choisit lui-même les cartes à défausser, mais elles
 * sont FACE CACHÉE (« au hasard ») : on ne voit que les dos. Il en sélectionne
 * exactement `count`, puis valide ; elles sont alors dévoilées et défaussées.
 */
export function YzmaHammerModal({ backImage, locationName, cards, count, onConfirm }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (id: string) =>
    setSelected((sel) =>
      sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < count ? [...sel, id] : sel,
    )
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#1a1226] p-6 text-white">
        <h2 className="text-xl font-black text-amber-200">Je l’écraserai avec un marteau</h2>
        <p className="text-center text-sm text-white/70">
          Pioche de <b>{locationName}</b> — choisissez <b>{count}</b> carte{count > 1 ? 's' : ''} à
          défausser. Elles sont <b>face cachée</b> (au hasard) : vous ne voyez que les dos.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {cards.map((c, i) => {
            const isSel = selected.includes(c.instanceId)
            return (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => toggle(c.instanceId)}
                title={`Carte ${i + 1} (face cachée)`}
                className={`relative rounded-lg border-2 p-1 transition ${
                  isSel ? 'border-amber-300 ring-2 ring-amber-300' : 'border-white/20 hover:border-amber-300/60'
                }`}
              >
                <img src={backImage} alt={`Carte ${i + 1}`} className="h-40 w-auto rounded" />
                {isSel && (
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-purple-950">
                    {selected.indexOf(c.instanceId) + 1}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          disabled={selected.length !== count}
          onClick={() => onConfirm(selected)}
          className="rounded-xl border border-amber-300/70 bg-amber-400/20 px-5 py-2 text-sm font-bold text-amber-100 hover:bg-amber-400/30 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Défausser {selected.length}/{count}
        </button>
      </div>
    </div>,
    document.body,
  )
}
