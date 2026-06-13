import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Nom du Dr Facilier (propriétaire de la pioche regardée). */
  targetName: string
  /** Les cartes révélées du dessus de la pioche Vilain de Facilier. */
  cards: CardInstance[]
  /** `toAudelaIds` = cartes envoyées dans la Pile de l'Au-delà ; `deckTopOrder` =
   *  les autres, dans l'ordre où elles reviennent sur le dessus (1ʳᵉ = tout en haut). */
  onResolve: (toAudelaIds: string[], deckTopOrder: string[]) => void
}

/** Talisman et Divination ne peuvent pas entrer dans la Pile de l'Au-delà. */
const canEnterAuDela = (c: CardInstance) =>
  c.cardId !== 'talisman' && c.cardId !== 'divination-facilier'

/**
 * Si près du but / Charlotte (Fatalité contre le Dr Facilier) — regardez les
 * premières cartes de sa pioche, envoyez-en autant que vous voulez (celles qui le
 * peuvent) dans la Pile de l'Au-delà, et remettez les autres sur le dessus de sa
 * pioche dans l'ordre de votre choix.
 */
export function FateScryModal({ targetName, cards, onResolve }: Props) {
  // État par carte : true = vers l'Au-delà, false = remise sur la pioche.
  const [toAudela, setToAudela] = useState<Record<string, boolean>>({})
  // Ordre de retour sur la pioche (cartes NON envoyées dans l'Au-delà), 1ʳᵉ = dessus.
  const [order, setOrder] = useState<string[]>(cards.map((c) => c.instanceId))

  const isAudela = (id: string) => !!toAudela[id]
  const toggle = (c: CardInstance) => {
    if (!canEnterAuDela(c)) return
    setToAudela((m) => ({ ...m, [c.instanceId]: !m[c.instanceId] }))
  }
  const deckOrder = order.filter((id) => !isAudela(id))
  const swap = (i: number, j: number) =>
    setOrder((o) => {
      const next = [...o]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-fuchsia-400/30 bg-[#160a18] p-6 text-white">
        <h2 className="text-xl font-black text-fuchsia-200">Si près du but</h2>
        <p className="text-center text-sm text-white/70">
          Cartes du dessus de la pioche de {targetName}. Clique une carte pour l'envoyer dans la
          <b className="text-fuchsia-300"> Pile de l'Au-delà</b>, ou laisse-la revenir sur la pioche.
        </p>

        <div className="flex flex-wrap items-start justify-center gap-4">
          {order.map((id, i) => {
            const c = cards.find((x) => x.instanceId === id)!
            const def = getCardDef(c.cardId)
            const audela = isAudela(id)
            const locked = !canEnterAuDela(c)
            const deckRank = audela ? -1 : deckOrder.indexOf(id)
            return (
              <div key={id} className="flex flex-col items-center gap-1">
                <span className="h-4 text-[11px] font-bold text-fuchsia-300">
                  {audela ? '→ Au-delà' : deckRank === 0 ? '↑ Dessus' : `pioche ${deckRank + 1}`}
                </span>
                <button type="button" onClick={() => toggle(c)} disabled={locked}>
                  <img
                    src={def?.image}
                    alt={c.name}
                    className={`h-56 w-auto rounded-lg border-2 transition ${
                      audela
                        ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/50'
                        : locked
                          ? 'border-amber-400/60'
                          : 'border-white/25 hover:border-white/60'
                    }`}
                  />
                </button>
                <span className="max-w-[11rem] text-center text-[11px] text-white/70">
                  {c.name}
                  {locked && <span className="block text-amber-300/80">(reste sur la pioche)</span>}
                </span>
                {/* Réordonner les cartes qui reviennent sur la pioche. */}
                {!audela && deckOrder.length > 1 && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => i > 0 && swap(i, i - 1)}
                      className="rounded border border-white/20 px-1.5 text-xs text-white/70 hover:bg-white/10"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => i < order.length - 1 && swap(i, i + 1)}
                      className="rounded border border-white/20 px-1.5 text-xs text-white/70 hover:bg-white/10"
                    >
                      →
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => onResolve(order.filter((id) => isAudela(id)), deckOrder)}
          className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-bold text-white hover:bg-fuchsia-500"
        >
          Valider
        </button>
      </div>
    </div>,
    document.body,
  )
}
