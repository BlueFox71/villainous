import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Les cartes révélées du dessus de la pioche. */
  cards: CardInstance[]
  /** Nombre de cartes à garder (Tour de passe-passe : 1). */
  take: number
  /** Titre affiché (défaut : « Tour de passe-passe »). */
  title?: string
  /** Michael — Lumière mourrante : proposer, pour les cartes NON gardées, de les défausser
   *  OU de les remettre sur le dessus de la pioche (deux boutons). */
  offerTopOrDiscard?: boolean
  /** Renvoie les instanceIds gardés (`toTop` = remettre le reste sur le dessus). */
  onResolve: (keepInstanceIds: string[], toTop?: boolean) => void
}

/**
 * Tour de passe-passe (Dr Facilier) — regarde les premières cartes de la pioche,
 * en garde `take` (cliquez pour sélectionner) ; les autres sont défaussées.
 */
export function LookTopModal({ cards, take, title = 'Tour de passe-passe', offerTopOrDiscard, onResolve }: Props) {
  const [picked, setPicked] = useState<string[]>([])

  const toggle = (id: string) =>
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length < take ? [...p, id] : take === 1 ? [id] : p,
    )

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-fuchsia-400/30 bg-[#160a18] p-6 text-white">
        <h2 className="text-xl font-black text-fuchsia-200">{title}</h2>
        <p className="text-center text-sm text-white/70">
          {offerTopOrDiscard
            ? `Choisissez ${take === 1 ? 'la carte' : `jusqu’à ${take} cartes`} à ajouter à votre main, puis choisissez le sort du reste.`
            : take === 1
              ? 'Choisissez la carte à ajouter à votre main ; les autres sont défaussées.'
              : `Choisissez jusqu’à ${take} cartes à ajouter à votre main ; les autres sont défaussées.`}
        </p>

        <div className="flex flex-wrap items-start justify-center gap-4">
          {cards.map((c) => {
            const def = getCardDef(c.cardId)
            const sel = picked.includes(c.instanceId)
            return (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => toggle(c.instanceId)}
                className="flex flex-col items-center gap-1"
              >
                <span className="h-4 text-[11px] font-bold text-fuchsia-300">{sel ? '✓ Gardée' : ''}</span>
                <img
                  src={def?.image}
                  alt={c.name}
                  className={`h-60 w-auto rounded-lg border-2 transition ${
                    sel ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/50' : 'border-white/20 hover:border-white/50'
                  }`}
                />
                <span className="max-w-[12rem] text-center text-xs font-semibold text-white/80">{c.name}</span>
              </button>
            )
          })}
        </div>

        {offerTopOrDiscard ? (
          <div className="flex gap-3">
            <button
              type="button"
              disabled={take === 1 && picked.length === 0}
              onClick={() => onResolve(picked, false)}
              className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-bold text-white hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Défausser le reste
            </button>
            <button
              type="button"
              disabled={take === 1 && picked.length === 0}
              onClick={() => onResolve(picked, true)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Remettre le reste sur le dessus
            </button>
          </div>
        ) : (
          <button
            type="button"
            // take === 1 : on garde obligatoirement 1 carte. take > 1 (« jusqu'à N ») :
            // on peut en garder 0 à N (valider même sans sélection = tout défausser).
            disabled={take === 1 && picked.length === 0}
            onClick={() => onResolve(picked)}
            className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-bold text-white hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Valider
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
