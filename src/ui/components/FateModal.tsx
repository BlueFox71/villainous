import { useState } from 'react'
import type { CardInstance, PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { Scroller } from './Scroller'

interface Props {
  /** Les 2 cartes Fatalité révélées (du deck de la cible). */
  revealed: CardInstance[]
  /** Joueur ciblé (pour le nom et la liste des lieux où poser un Héros). */
  target: PlayerState
  /** Résout : carte choisie + lieu de destination (Héros) ou héros cible
   *  (Voler aux Riches / Déguisement). */
  onResolve: (instanceId: string, to?: string, targetHeroId?: string) => void
  /** Ouvre la vue plateau (loupe) de la cible pour décider où poser. */
  onViewBoard: () => void
}

/** Cartes Fatalité non-héros qui ciblent un Héros adverse. */
function needsTargetHero(card: CardInstance): boolean {
  return (
    card.cardId === 'voler-riches' ||
    card.cardId === 'deguisement' ||
    card.cardId === 'epee-verite'
  )
}

/**
 * Modale de résolution de Fatalité. Trois étapes selon le type de carte :
 *  1. Choisir une des 2 cartes révélées (l'autre est défaussée).
 *  2a. Héros → choisir un lieu chez la cible (boutons grisés pour les lieux interdits).
 *  2b. Voler aux Riches / Déguisement → choisir un Héros adverse à cibler. Si la
 *      cible n'a aucun Héros, on résout direct (la carte est défaussée sans effet).
 */
export function FateModal({ revealed, target, onResolve, onViewBoard }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const selectedCard = revealed.find((c) => c.instanceId === selected)

  // Héros éligibles pour la carte sélectionnée. L'Épée de Vérité exige un Héros
  // SANS autre Objet associé ; les autres ciblent n'importe quel Héros.
  const eligibleHeroesFor = (card: CardInstance): CardInstance[] => {
    const all = Object.entries(target.board).flatMap(([locId, cards]) =>
      cards.filter((c) => c.type === 'hero').map((h) => ({ h, locId })),
    )
    if (card.cardId !== 'epee-verite') return all.map(({ h }) => h)
    return all
      .filter(({ h, locId }) => !(target.board[locId] ?? []).some((c) => c.attachedTo === h.instanceId && c.type === 'item'))
      .map(({ h }) => h)
  }

  const choose = (c: CardInstance) => {
    if (c.type === 'hero') return setSelected(c.instanceId)
    if (needsTargetHero(c)) {
      const eligible = eligibleHeroesFor(c)
      if (eligible.length === 0) return onResolve(c.instanceId) // défausse silencieuse
      if (eligible.length === 1) return onResolve(c.instanceId, undefined, eligible[0].instanceId)
      return setSelected(c.instanceId)
    }
    onResolve(c.instanceId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <Scroller className="max-h-full w-full max-w-2xl rounded-2xl border border-white/20 bg-[#0b0a12] p-4">
        <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-white">Fatalité contre {target.villainName}</h2>
          <button
            onClick={onViewBoard}
            className="shrink-0 rounded-lg border border-white/20 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
          >
            🔍 Voir le plateau adverse
          </button>
        </div>
        <p className="text-xs text-white/60">
          {selectedCard
            ? selectedCard.type === 'hero'
              ? `Choisis le lieu où poser ${selectedCard.name}.`
              : `Choisis un Héros adverse à cibler avec ${selectedCard.name}.`
            : 'Choisis une carte à jouer — l’autre est défaussée.'}
        </p>

        <div className="flex justify-center gap-3">
          {revealed.map((c) => {
            const def = getCardDef(c.cardId)
            const isSel = selected === c.instanceId
            return (
              <button
                key={c.instanceId}
                onClick={() => choose(c)}
                className={`rounded-lg border-2 p-1 transition ${
                  isSel ? 'border-white ring-2 ring-white' : 'border-white/15 hover:border-white/60'
                }`}
              >
                <img
                  src={def?.image}
                  alt={c.name}
                  title={`${c.name}${def ? ` — ${def.text}` : ''}`}
                  className="h-64 w-auto rounded"
                />
                <div className="mt-1 text-center text-[11px] text-white/70">
                  {c.type === 'hero' ? `🦸 Héros (force ${c.strength ?? '?'})` : 'Carte Fatalité'}
                </div>
              </button>
            )
          })}
        </div>

        {selectedCard?.type === 'hero' && (() => {
          const forbidden = new Set(selectedCard.forbiddenLocations ?? [])
          return (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-white/60">Poser sur :</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {target.locations.map((loc) => {
                  const isForbidden = forbidden.has(loc.id)
                  return (
                    <button
                      key={loc.id}
                      onClick={() => !isForbidden && onResolve(selectedCard.instanceId, loc.id)}
                      disabled={isForbidden}
                      title={isForbidden ? `${selectedCard.name} ne peut pas y être posé(e).` : undefined}
                      className={`rounded-lg border px-2 py-2 text-xs ${
                        isForbidden
                          ? 'cursor-not-allowed border-white/10 text-white/30'
                          : 'border-white/40 text-white hover:bg-white/10'
                      }`}
                    >
                      {loc.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {selectedCard && selectedCard.type !== 'hero' && needsTargetHero(selectedCard) && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-white/60">Héros cible :</span>
            <div className="flex flex-wrap gap-2">
              {eligibleHeroesFor(selectedCard).map((h) => {
                const def = getCardDef(h.cardId)
                return (
                  <button
                    key={h.instanceId}
                    onClick={() => onResolve(selectedCard.instanceId, undefined, h.instanceId)}
                    className="rounded-lg border border-white/40 p-1 text-xs text-white hover:bg-white/10"
                  >
                    {def && (
                      <img src={def.image} alt={h.name} className="mb-1 h-32 w-auto rounded" />
                    )}
                    {h.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        </div>
      </Scroller>
    </div>
  )
}
