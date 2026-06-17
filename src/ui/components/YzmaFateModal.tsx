import { createPortal } from 'react-dom'
import type { CardInstance, PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Yzma (la cible) : pour lister ses 4 pioches (par lieu) et leurs cartes. */
  target: PlayerState
  /** Phase courante du choix. */
  phase: 'deck' | 'card'
  /** Cartes de la pioche choisie (phase 'card'). */
  cards?: CardInstance[]
  /** Choisir la pioche d'un lieu (phase 'deck'). */
  onChooseDeck: (locationId: string) => void
  /** Jouer la carte choisie, ou aucune (phase 'card'). */
  onChooseCard: (instanceId: string | null) => void
}

/**
 * Fatalité d'Yzma — l'adversaire choisit l'une des 4 pioches (par lieu, non vides),
 * voit toutes ses cartes, puis en joue une sur ce lieu (ou aucune).
 */
export function YzmaFateModal({ target, phase, cards, onChooseDeck, onChooseCard }: Props) {
  const decks = target.fateDecks ?? {}
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#1a1226] p-6 text-white">
        {phase === 'deck' ? (
          <>
            <h2 className="text-xl font-black text-amber-200">Fatalité d’Yzma — choisissez une pioche</h2>
            <p className="text-center text-sm text-white/70">
              Chaque lieu a sa pioche Fatalité. Choisissez-en une (non vide) : vous verrez toutes ses
              cartes et en jouerez une sur ce lieu.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {target.locations.map((l) => {
                const n = (decks[l.id] ?? []).length
                return (
                  <button
                    key={l.id}
                    type="button"
                    disabled={n === 0}
                    onClick={() => onChooseDeck(l.id)}
                    className="rounded-lg border border-amber-300/60 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {l.name}
                    <span className="block text-[10px] text-amber-200/60">{n} carte{n > 1 ? 's' : ''}</span>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-black text-amber-200">Fatalité d’Yzma — jouez une carte</h2>
            <p className="text-center text-sm text-white/70">
              Choisissez une carte à jouer sur ce lieu (le reste est remélangé et replacé).
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {(cards ?? []).map((c) => {
                const def = getCardDef(c.cardId)
                return (
                  <button
                    key={c.instanceId}
                    type="button"
                    onClick={() => onChooseCard(c.instanceId)}
                    className="flex flex-col items-center gap-1 rounded-lg border-2 border-amber-300/50 p-1 hover:border-amber-300"
                  >
                    {def?.image ? (
                      <img src={def.image} alt={c.name} className="h-40 w-auto rounded" />
                    ) : (
                      <span className="px-2 py-6 text-sm">{c.name}</span>
                    )}
                    <span className="text-[11px] font-bold text-amber-100">
                      {c.name}
                      {c.type === 'hero' ? ` (F${c.strength ?? 0})` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => onChooseCard(null)}
              className="rounded-xl border border-white/25 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Ne rien jouer
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
