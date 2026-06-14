import { createPortal } from 'react-dom'
import type { CardInstance, PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Joueur qui a joué Vol du château (et va poser la carte). */
  player: PlayerState
  /** L'Allié/Objet dévoilé à poser. */
  found: CardInstance
  /** Cartes dévoilées AVANT (remises sur le dessus de la pioche), montrées pour info. */
  revealed: CardInstance[]
  /** L'Objet s'associe (à un Allié/Héros) → va en main, pas de choix de lieu. */
  toHand: boolean
  /** `true` si c'est CE joueur (humain) qui choisit ; sinon affichage spectateur. */
  interactive: boolean
  /** Pose la carte sur le lieu choisi (ou en main si associable). */
  onResolve: (to?: string) => void
}

/**
 * Vol du château — on a dévoilé la pioche jusqu'à un Allié/Objet. On montre les
 * cartes dévoilées et la carte trouvée (affichage visible des DEUX côtés), puis le
 * joueur qui l'a jouée choisit le lieu où la poser (ou elle rejoint sa main si elle
 * s'associe). Côté spectateur (l'adversaire joue la carte) : affichage seul.
 */
export function CastleTheftModal({ player, found, revealed, toHand, interactive, onResolve }: Props) {
  const def = getCardDef(found.cardId)
  const locked = new Set(player.lockedLocations ?? [])
  const destinations = player.locations.filter((l) => !locked.has(l.id))

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#0b0a12] p-6 text-white">
        <h2 className="text-xl font-black text-amber-200">
          Vol du château — {player.villainName}
        </h2>

        <div className="flex items-end justify-center gap-5">
          {/* Cartes dévoilées (remises sur la pioche), pour information. */}
          {revealed.length > 0 && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-white/50">Dévoilées (remises sur la pioche) :</span>
              <div className="flex gap-1">
                {revealed.map((c) => (
                  <img
                    key={c.instanceId}
                    src={getCardDef(c.cardId)?.image}
                    alt={c.name}
                    title={c.name}
                    className="h-28 w-auto rounded border border-white/15 opacity-60"
                  />
                ))}
              </div>
            </div>
          )}
          {/* La carte trouvée, mise en avant. */}
          <div className="flex flex-col items-center">
            <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-300">À jouer</span>
            <img src={def?.image} alt={found.name} className="h-64 w-auto rounded-lg border-2 border-amber-300 shadow-[0_0_18px_rgba(250,204,21,0.5)]" />
            <span className="mt-1 text-sm font-bold">
              {found.name}
              {found.type === 'ally' && found.strength != null ? ` (force ${found.strength})` : ''}
            </span>
          </div>
        </div>

        {toHand ? (
          <div className="flex flex-col items-center gap-3">
            <span className="text-sm text-white/70">Cet Objet s'associe : il rejoint la main.</span>
            {interactive && (
              <button
                type="button"
                onClick={() => onResolve(undefined)}
                className="rounded-lg border border-amber-300/60 px-5 py-2 text-sm font-bold text-amber-100 hover:bg-amber-400/20"
              >
                Reprendre en main
              </button>
            )}
          </div>
        ) : interactive ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm text-white/70">Sur quel lieu la poser ?</span>
            <div className="flex flex-wrap justify-center gap-2">
              {destinations.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onResolve(l.id)}
                  className="rounded-lg border border-emerald-300/60 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-400/20"
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-sm text-white/50">{player.villainName} choisit où la poser…</span>
        )}
      </div>
    </div>,
    document.body,
  )
}
