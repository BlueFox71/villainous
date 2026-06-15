import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Objets/Ingrédients éligibles présents dans la PIOCHE. */
  deckCards: CardInstance[]
  /** Objets/Ingrédients éligibles présents dans la DÉFAUSSE. */
  discardCards: CardInstance[]
  /** Reprend la carte choisie en main (puis la pioche est mélangée). */
  onPick: (instanceId: string) => void
}

const TYPE_LABEL: Record<string, string> = { item: 'Objet', ingredient: 'Ingrédient' }

/**
 * Magie noire (La Méchante Reine) — choisir un Objet ou un Ingrédient à reprendre
 * en main, depuis la PIOCHE ou la DÉFAUSSE (onglets), puis la pioche est mélangée.
 */
export function BlackMagicModal({ deckCards, discardCards, onPick }: Props) {
  // Onglet par défaut : celui qui contient des cartes (pioche en priorité).
  const [tab, setTab] = useState<'deck' | 'discard'>(deckCards.length > 0 ? 'deck' : 'discard')
  const cards = tab === 'deck' ? deckCards : discardCards
  const tabClass = (id: 'deck' | 'discard') =>
    `rounded-lg px-3 py-1 text-sm font-semibold transition ${
      tab === id ? 'bg-fuchsia-500/30 text-fuchsia-100 ring-1 ring-fuchsia-400/60' : 'text-white/60 hover:bg-white/10'
    }`

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex max-h-full w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-fuchsia-400/30 bg-[#160a18] p-6 text-white">
        <h2 className="text-xl font-black text-fuchsia-200">Magie noire</h2>
        <p className="text-center text-sm text-white/70">
          Choisis un Objet ou un Ingrédient à reprendre en main. Ta pioche sera ensuite mélangée.
        </p>

        <div className="flex gap-2 rounded-xl border border-white/15 bg-black/30 p-1">
          <button type="button" onClick={() => setTab('deck')} className={tabClass('deck')}>
            Pioche ({deckCards.length})
          </button>
          <button type="button" onClick={() => setTab('discard')} className={tabClass('discard')}>
            Défausse ({discardCards.length})
          </button>
        </div>

        {cards.length === 0 ? (
          <p className="py-8 text-sm text-white/50">
            Aucun Objet ni Ingrédient {tab === 'deck' ? 'dans la pioche' : 'dans la défausse'}.
          </p>
        ) : (
          <div className="flex max-h-[60vh] flex-wrap items-start justify-center gap-4 overflow-y-auto">
            {cards.map((c) => {
              const def = getCardDef(c.cardId)
              return (
                <button
                  key={c.instanceId}
                  type="button"
                  onClick={() => onPick(c.instanceId)}
                  className="flex flex-col items-center gap-1"
                >
                  <span className="h-4 text-[10px] font-bold uppercase tracking-wide text-fuchsia-300">
                    {TYPE_LABEL[c.type] ?? c.type}
                  </span>
                  <img
                    src={def?.image}
                    alt={c.name}
                    className="h-56 w-auto rounded-lg border-2 border-white/20 transition hover:border-fuchsia-400 hover:ring-2 hover:ring-fuchsia-400/50"
                  />
                  <span className="max-w-[12rem] text-center text-xs font-semibold text-white/80">{c.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
