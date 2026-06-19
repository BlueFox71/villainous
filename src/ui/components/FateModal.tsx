import { useEffect, useState } from 'react'
import type { CardInstance, PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { Scroller } from './Scroller'
import { DiscardModal } from './DeckPiles'

interface Props {
  /** Les 2 cartes Fatalité révélées (du deck de la cible). */
  revealed: CardInstance[]
  /** Joueur ciblé (pour le nom et la liste des lieux où poser un Héros). */
  target: PlayerState
  /** Résout : carte choisie + lieu de destination (Héros) ou héros cible
   *  (Voler aux Riches / Déguisement) + sens du pivot (Agrandir : enlargeToward). */
  onResolve: (instanceId: string, to?: string, targetHeroId?: string, enlargeToward?: string) => void
  /** Combo « jouer les deux » (Ray/Dormeur) : 2ᵉ carte FACULTATIVE → propose un
   *  bouton « Passer » (appelle `onPass`). */
  optional?: boolean
  onPass?: () => void
}

/** Cartes Fatalité non-héros qui ciblent un Héros adverse : Voler aux Riches,
 *  Agrandir, et tout Objet « associé à un Héros » (attach: 'hero' : Déguisement,
 *  Épée de Vérité, Lampe de poche, Provocation, Poussière de Fée, Vœu…). */
function needsTargetHero(card: CardInstance): boolean {
  return (
    card.cardId === 'voler-riches' ||
    card.cardId === 'agrandir' ||
    (card.type === 'item' && card.attach === 'hero')
  )
}

/**
 * Modale de résolution de Fatalité. Trois étapes selon le type de carte :
 *  1. Choisir une des 2 cartes révélées (l'autre est défaussée).
 *  2a. Héros → choisir un lieu chez la cible (boutons grisés pour les lieux interdits).
 *  2b. Voler aux Riches / Déguisement → choisir un Héros adverse à cibler. Si la
 *      cible n'a aucun Héros, on résout direct (la carte est défaussée sans effet).
 */
export function FateModal({ revealed, target, onResolve, optional = false, onPass }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const selectedCard = revealed.find((c) => c.instanceId === selected)
  // Agrandir : Héros choisi en attente du SENS du pivot (gauche/droite).
  const [enlargeHero, setEnlargeHero] = useState<CardInstance | null>(null)
  // Voir la défausse Fatalité de la cible (modale superposée, lecture seule).
  const [showDiscard, setShowDiscard] = useState(false)
  // « Voir le plateau » : tant que le bouton est MAINTENU enfoncé, on masque la
  // modale pour laisser voir le plateau en entier ; au relâchement, elle revient.
  const [peeking, setPeeking] = useState(false)
  useEffect(() => {
    if (!peeking) return
    const stop = () => setPeeking(false)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [peeking])

  const heroLocationId = (h: CardInstance): string | undefined =>
    target.locations.find((l) => (target.board[l.id] ?? []).some((c) => c.instanceId === h.instanceId))?.id
  const neighborsOf = (locId: string) => {
    const i = target.locations.findIndex((l) => l.id === locId)
    return [target.locations[i - 1], target.locations[i + 1]].filter(Boolean) as PlayerState['locations']
  }
  // Clic sur un Héros pour Agrandir : s'il est rapetissé → simple retour normal ;
  // s'il a deux voisins → on demande le sens ; sinon (un seul voisin) on résout direct.
  const chooseAgrandirHero = (h: CardInstance) => {
    if (!selectedCard) return
    if (h.heroSize === 'shrunk') return onResolve(selectedCard.instanceId, undefined, h.instanceId)
    const locId = heroLocationId(h)
    const neigh = locId ? neighborsOf(locId) : []
    if (neigh.length < 2) return onResolve(selectedCard.instanceId, undefined, h.instanceId, neigh[0]?.id)
    setEnlargeHero(h)
  }

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

  // Une carte Fatalité est-elle jouable contre la cible (a-t-elle un effet
   // possible) ? Sert à griser celles sans cible valide quand l'AUTRE est jouable.
  const playable = (c: CardInstance): boolean => {
    const realm = Object.values(target.board).flat()
    // Apparence Retrouvée : il faut un Héros (force ≤4) dans la défausse Fatalité.
    if (c.cardId === 'apparence-retrouvee')
      return target.fateDiscard.some((x) => x.type === 'hero' && (x.strength ?? 0) <= 4)
    if (c.cardId === 'migraine-atroce') return realm.some((x) => x.type === 'item')
    // Réinitialisation (Sombra) : il faut un Piratage à retirer.
    if (c.cardId === 'reinitialisation') return realm.some((x) => x.isPiratage)
    // Sabotage : il faut un Objet (≤3, non associé) sur un lieu portant un Héros.
    if (c.cardId === 'sabotage') {
      return target.locations.some((l) => {
        const cell = target.board[l.id] ?? []
        return cell.some((x) => x.type === 'hero') && cell.some((x) => x.type === 'item' && !x.attachedTo && (x.cost ?? 0) <= 3)
      })
    }
    if (c.cardId === 'ko') return realm.some((x) => x.type === 'ally' && !x.isWicket && (x.strength ?? 0) <= 3)
    // Premier baiser d'amour : sans effet si la cible n'a ni Poison ni Héros dans
    // sa défausse Fatalité.
    if (c.cardId === 'premier-baiser')
      return (target.poison ?? 0) > 0 || target.fateDiscard.some((x) => x.type === 'hero')
    // Il était un Rêve : il faut une Malédiction sur un lieu portant un Héros.
    if (c.cardId === 'il-etait-un-reve') {
      return target.locations.some((l) => {
        const cell = target.board[l.id] ?? []
        return cell.some((x) => x.type === 'hero') && cell.some((x) => x.type === 'curse')
      })
    }
    if (c.type === 'hero') {
      const forbidden = new Set(c.forbiddenLocations ?? [])
      const locked = new Set(target.lockedLocations ?? [])
      return target.locations.some((l) => !forbidden.has(l.id) && !locked.has(l.id))
    }
    if (needsTargetHero(c)) return eligibleHeroesFor(c).length > 0
    return true
  }
  // On ne grise que si une AUTRE carte est jouable (sinon il faut bien en jouer une).
  const anyPlayable = revealed.some(playable)

  const choose = (c: CardInstance) => {
    if (c.type === 'hero') return setSelected(c.instanceId)
    if (needsTargetHero(c)) {
      const eligible = eligibleHeroesFor(c)
      if (eligible.length === 0) return onResolve(c.instanceId) // défausse silencieuse
      // Agrandir : toujours passer par l'étape Héros (puis éventuellement le sens),
      // même avec un seul Héros éligible. Les autres cartes résolvent direct.
      if (eligible.length === 1 && c.cardId !== 'agrandir')
        return onResolve(c.instanceId, undefined, eligible[0].instanceId)
      return setSelected(c.instanceId)
    }
    onResolve(c.instanceId)
  }

  // « Voir le plateau » maintenu : on masque temporairement la modale (mais le
  // composant reste monté → la sélection en cours est préservée).
  if (peeking) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <Scroller className="max-h-full w-full max-w-2xl rounded-2xl border border-white/20 bg-[#0b0a12] p-4">
        <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-white">Fatalité contre {target.villainName}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowDiscard(true)}
              className="rounded-lg border border-white/25 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
            >
              Défausse Fatalité ({target.fateDiscard.length})
            </button>
            <button
              type="button"
              onPointerDown={() => setPeeking(true)}
              className="select-none rounded-lg border border-white/25 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
              title="Maintiens le bouton pour voir le plateau ; relâche pour revenir"
            >
              👁 Voir le plateau (maintenir)
            </button>
          </div>
        </div>
        <p className="text-xs text-white/60">
          {enlargeHero
            ? `Vers quel lieu voisin ${enlargeHero.name} déborde-t-il ? (il recouvrira l’action du haut la plus proche)`
            : selectedCard
            ? selectedCard.type === 'hero'
              ? `Choisis le lieu où poser ${selectedCard.name}.`
              : `Choisis un Héros adverse à cibler avec ${selectedCard.name}.`
            : optional
              ? 'Tu peux jouer cette 2ᵉ carte (Dormeur/Ray) ou passer.'
              : 'Choisis une carte à jouer — l’autre est défaussée.'}
        </p>

        <div className="flex justify-center gap-3">
          {revealed.map((c) => {
            const def = getCardDef(c.cardId)
            const isSel = selected === c.instanceId
            const disabled = anyPlayable && !playable(c)
            return (
              <button
                key={c.instanceId}
                onClick={() => !disabled && choose(c)}
                disabled={disabled}
                title={disabled ? `${c.name} — non jouable (aucune cible valide)` : `${c.name}${def ? ` — ${def.text}` : ''}`}
                className={`rounded-lg border-2 p-1 transition ${
                  disabled
                    ? 'cursor-not-allowed border-white/10 opacity-40'
                    : isSel
                      ? 'border-white ring-2 ring-white'
                      : 'border-white/15 hover:border-white/60'
                }`}
              >
                <img src={def?.image} alt={c.name} className="h-64 w-auto rounded" />
                <div className="mt-1 text-center text-[11px] text-white/70">
                  {disabled
                    ? 'Non jouable'
                    : c.type === 'hero'
                      ? `🦸 Héros (force ${c.strength ?? '?'})`
                      : 'Carte Fatalité'}
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

        {selectedCard && selectedCard.type !== 'hero' && needsTargetHero(selectedCard) && !enlargeHero && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-white/60">Héros cible :</span>
            <div className="flex flex-wrap gap-2">
              {eligibleHeroesFor(selectedCard).map((h) => {
                const def = getCardDef(h.cardId)
                const onClick =
                  selectedCard.cardId === 'agrandir'
                    ? () => chooseAgrandirHero(h)
                    : () => onResolve(selectedCard.instanceId, undefined, h.instanceId)
                return (
                  <button
                    key={h.instanceId}
                    onClick={onClick}
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

        {selectedCard?.cardId === 'agrandir' && enlargeHero && (() => {
          const locId = heroLocationId(enlargeHero)
          const neigh = locId ? neighborsOf(locId) : []
          const heroLocIdx = locId ? target.locations.findIndex((l) => l.id === locId) : -1
          return (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-white/60">Sens du pivot ({enlargeHero.name}) :</span>
              <div className="flex flex-wrap gap-2">
                {neigh.map((n) => {
                  const nIdx = target.locations.findIndex((l) => l.id === n.id)
                  const dir = nIdx < heroLocIdx ? '← Gauche' : 'Droite →'
                  return (
                    <button
                      key={n.id}
                      onClick={() => onResolve(selectedCard.instanceId, undefined, enlargeHero.instanceId, n.id)}
                      className="rounded-lg border border-white/40 px-3 py-2 text-xs text-white hover:bg-white/10"
                    >
                      {dir} — {n.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {optional && onPass && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onPass}
              className="rounded-lg border border-white/30 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Passer (ne pas jouer)
            </button>
          </div>
        )}
        </div>
      </Scroller>

      {showDiscard && (
        <DiscardModal
          cards={target.fateDiscard}
          label={`Défausse Fatalité — ${target.villainName}`}
          onClose={() => setShowDiscard(false)}
        />
      )}
    </div>
  )
}
