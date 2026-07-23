import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { plural } from '../../engine/plural'

interface Props {
  /** Les (jusqu'à 2) cartes Fatalité révélées, dans l'ordre actuel de la pioche
   *  (la 1ʳᵉ est le dessus). */
  cards: CardInstance[]
  /** Renvoie les instanceIds à remettre sur le dessus, dans l'ordre (1ʳᵉ = tout
   *  en haut) ; les autres sont défaussées. Liste vide = tout défausser. */
  onResolve: (topInstanceIds: string[]) => void
  /** Titre (nom de la carte source). Défaut neutre — plusieurs cartes partagent ce
   *  sondage (Faites-leur peur !, La vie n'est pas juste, …). */
  title?: string
  /** Sombra — Pas si vite ! : sémantique INVERSÉE. Le joueur ne « garde » pas des
   *  cartes pour SA pioche : il CHOISIT laquelle des cartes révélées l'adversaire
   *  jouera CONTRE lui (l'autre est défaussée). UI dédiée « choisir une carte ». */
  pasSiVite?: boolean
}

/**
 * Faites-leur peur ! — regarde les 2 premières cartes Fatalité, puis :
 *  - défaussez celles que vous ne voulez pas (bouton « Défausser » sur la carte),
 *  - réordonnez celles que vous gardez (bouton ⇄),
 *  - validez : les cartes gardées repartent sur le dessus dans l'ordre affiché.
 */
export function ScryModal({ cards, onResolve, title = 'Sondage de la pioche Fatalité', pasSiVite = false }: Props) {
  const [order, setOrder] = useState<string[]>(cards.map((c) => c.instanceId))
  const [discarded, setDiscarded] = useState<Set<string>>(new Set())

  // Sombra — Pas si vite ! : on choisit directement QUELLE carte l'adversaire joue
  // contre nous (clic sur la carte) ; l'autre est défaussée. Sémantique propre.
  if (pasSiVite) {
    return createPortal(
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
        <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-fuchsia-400/30 bg-[#0b1020] p-6 text-white">
          <h2 className="text-xl font-black text-fuchsia-200">Pas si vite !</h2>
          <p className="text-center text-sm text-white/70">
            Vous choisissez à la place de l'adversaire : sélectionnez la carte Fatalité qui sera
            <b> jouée contre vous</b>. L'autre est défaussée.
          </p>
          <div className="flex items-center justify-center gap-4">
            {cards.map((c) => {
              const def = getCardDef(c.cardId)
              return (
                <button
                  key={c.instanceId}
                  type="button"
                  onClick={() => onResolve([c.instanceId])}
                  className="flex flex-col items-center gap-1 rounded-lg border-2 border-sky-300/60 p-1 transition hover:border-fuchsia-300 hover:bg-fuchsia-500/10"
                >
                  <img src={def?.image} alt={c.name} className="h-56 w-auto rounded-lg" />
                  <span className="text-xs font-bold text-fuchsia-200">Choisir {c.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  const kept = order.filter((id) => !discarded.has(id))
  const discardedCount = cards.length - kept.length
  const swap = () => order.length === 2 && setOrder([order[1], order[0]])
  const toggleDiscard = (id: string) =>
    setDiscarded((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#0b1020] p-6 text-white">
        <h2 className="text-xl font-black text-sky-200">{title}</h2>
        <p className="text-center text-sm text-white/70">
          Les {cards.length} {plural(cards.length, 'première')} {plural(cards.length, 'carte')} de votre pioche Fatalité. Défaussez-les, ou
          remettez-les sur le dessus dans l'ordre de votre choix (la 1ʳᵉ sera piochée en premier).
        </p>

        <div className="flex items-center justify-center gap-4">
          {order.map((id) => {
            const c = cards.find((x) => x.instanceId === id)!
            const def = getCardDef(c.cardId)
            const isDiscarded = discarded.has(id)
            const keptRank = kept.indexOf(id)
            return (
              <div key={id} className="flex flex-col items-center gap-1">
                <span className="text-[11px] font-bold text-sky-300">
                  {isDiscarded ? '— défaussée' : keptRank === 0 ? '↑ Dessus' : `${keptRank + 1}ᵉ`}
                </span>
                <img
                  src={def?.image}
                  alt={c.name}
                  className={`h-56 w-auto rounded-lg border-2 transition ${
                    isDiscarded ? 'border-red-500/70 opacity-40 grayscale' : 'border-sky-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => toggleDiscard(id)}
                  className={`rounded-lg border px-2 py-1 text-xs ${
                    isDiscarded
                      ? 'border-emerald-400/60 text-emerald-200 hover:bg-emerald-400/10'
                      : 'border-red-400/60 text-red-200 hover:bg-red-400/10'
                  }`}
                >
                  {isDiscarded ? '↩ Garder' : '🗑 Défausser'}
                </button>
              </div>
            )
          })}
        </div>

        {kept.length === 2 && (
          <button
            type="button"
            onClick={swap}
            className="rounded-lg border border-white/25 px-3 py-1 text-sm text-white/80 hover:bg-white/10"
          >
            ⇄ Inverser l'ordre
          </button>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onResolve(kept)}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-500"
          >
            {kept.length === 0
              ? 'Valider — tout défausser'
              : discardedCount === 0
                ? `Valider — ${kept.length} sur le dessus`
                : `Valider — ${kept.length} sur le dessus, ${discardedCount} défaussée${discardedCount > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
