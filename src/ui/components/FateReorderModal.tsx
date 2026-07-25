import { useState } from 'react'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Cartes Fatalité du dessus à réordonner (ordre actuel). */
  cards: CardInstance[]
  /** Replace les cartes sur le dessus dans l'ordre choisi (1ʳᵉ = dessus de la pioche). */
  onResolve: (orderedIds: string[]) => void
  /** Titre de la modale (défaut : Je ne reviens jamais). */
  title?: string
  /** Nom de la pioche concernée (défaut : « Fatalité »). */
  deckLabel?: string
}

/**
 * Madame de Trémaine — Je ne reviens jamais : on clique les cartes dans l'ordre
 * souhaité (la 1ʳᵉ cliquée sera SUR LE DESSUS de la pioche Fatalité, donc tirée en
 * premier). Une fois toutes choisies, on valide.
 */
export function FateReorderModal({ cards, onResolve, title = 'Je ne reviens jamais sur ma parole', deckLabel = 'Fatalité' }: Props) {
  const [order, setOrder] = useState<string[]>([])
  const remaining = cards.filter((c) => !order.includes(c.instanceId))
  const rank = (id: string) => order.indexOf(id)

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4">
      {/* max-w-4xl : jusqu'à 4 cartes (Niveau Inachevé) en grand sur une seule rangée. */}
      <div className="flex w-full max-w-4xl flex-col gap-4 rounded-2xl border border-white/15 bg-[#15101f] p-6 text-white shadow-2xl">
        <h2 className="text-center text-lg font-bold text-amber-200">{title}</h2>
        <p className="text-center text-sm text-white/75">
          Clique les cartes dans l’ordre où tu veux les remettre — la 1ʳᵉ choisie sera sur le
          <b className="text-amber-200"> dessus</b> de ta pioche {deckLabel} (tirée en premier).
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {cards.map((c) => {
            const r = rank(c.instanceId)
            const picked = r >= 0
            return (
              <button
                key={c.instanceId}
                type="button"
                disabled={picked}
                onClick={() => setOrder((o) => [...o, c.instanceId])}
                className={`relative rounded-lg border p-1 transition hover:z-10 ${
                  picked ? 'border-amber-400 opacity-50' : 'border-white/25 hover:border-amber-400 hover:bg-white/10'
                }`}
              >
                {/* Illustrations en GRAND (le texte de la carte doit rester lisible) +
                    agrandissement au survol, au-dessus des voisines. */}
                <img
                  src={getCardDef(c.cardId)?.image}
                  alt={c.name}
                  className="w-40 rounded transition-transform duration-150 ease-out hover:scale-[1.35]"
                />
                <span className="mt-0.5 block text-center text-xs text-white/70">{c.name}</span>
                {picked && (
                  <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-purple-950">
                    {r + 1}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-center gap-3">
          {order.length > 0 && (
            <button
              type="button"
              onClick={() => setOrder([])}
              className="rounded border border-white/25 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
            >
              Réinitialiser
            </button>
          )}
          <button
            type="button"
            disabled={remaining.length > 0}
            onClick={() => onResolve(order)}
            className="rounded-lg border border-amber-400/60 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Valider l’ordre
          </button>
        </div>
      </div>
    </div>
  )
}
