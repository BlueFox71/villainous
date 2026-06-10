import type { LocationId, PlayerState } from '../../engine/types'
import type { Accent } from '../accents'
import { LocationCard } from './LocationCard'
import { LOCATIONS_LEFT } from './BoardImage'
import { VILLAIN_COLOR } from '../villainColors'

interface Props {
  player: PlayerState
  accent: Accent
  legalMoves: LocationId[]
  /** Lieux cliquables comme destination de pose (mode « poser »). */
  placeTargets: LocationId[]
  /** Lieu sur lequel choisir l'Allié porteur (mode « associer »), ou null. */
  attachLocation: LocationId | null
  /** Mode « déplacer » : les Alliés/Objets deviennent sélectionnables. */
  selectableCards: boolean
  /** Mode « éliminer — choix des alliés » : alliés cochables sur le lieu courant. */
  vanquishAllyCandidates?: string[]
  vanquishSelected?: string[]
  onVanquishToggle?: (instanceId: string) => void
  /** Shériffs (instanceId) qui peuvent encore se déplacer ce tour (bouton inline). */
  sheriffMovable?: string[]
  onSheriffMoveStart?: (instanceId: string) => void
  /** Diablo (instanceId) qui peuvent encore se déplacer ce tour. */
  diabloMovable?: string[]
  onDiabloMoveStart?: (instanceId: string) => void
  /** Lieu dont la carte Persifleur clignote (source de l'action recouverte jouable). */
  highlightPersifleurAt?: LocationId | null
  /** Disparition : afficher « Rester ici » sur le lieu courant. */
  canSkipMove?: boolean
  onSkipMove?: () => void
  /** Forces effectives par instanceId (calculées en amont). */
  strengths: Record<string, number>
  /** Décalage de 16 % pour aligner sous l'image (false si placé dans un flex). */
  offset?: boolean
  /** Affiche le serpent sur le lieu courant (joueur actif ET lieu déjà choisi,
   *  c.-à-d. phase ACTION) — décidé par App. */
  showCurrentSnake?: boolean
  /** MODE TEST : ouvre le sélecteur d'insertion pour un lieu (rect du bouton). */
  onLocationInsert?: (locationId: LocationId, rect: DOMRect) => void
  onMove: (to: LocationId) => void
  onPlace: (to: LocationId) => void
  onAttach: (allyInstanceId: string) => void
  onCardPick: (instanceId: string) => void
}

/** Les 4 lieux d'un joueur : déplacement, cartes posées (Héros en haut,
 *  Alliés/Objets en bas), destinations de pose et association. Les actions, elles,
 *  se font sur l'image du plateau (voir BoardActions). Lecture seule côté adverse. */
export function Board({
  player,
  accent,
  legalMoves,
  placeTargets,
  attachLocation,
  selectableCards,
  vanquishAllyCandidates = [],
  vanquishSelected = [],
  onVanquishToggle,
  sheriffMovable = [],
  onSheriffMoveStart,
  diabloMovable = [],
  onDiabloMoveStart,
  highlightPersifleurAt = null,
  canSkipMove = false,
  onSkipMove,
  strengths,
  offset = true,
  showCurrentSnake = false,
  onLocationInsert,
  onMove,
  onPlace,
  onAttach,
  onCardPick,
}: Props) {
  const cellColor = VILLAIN_COLOR[player.villain]

  // Force d'attaque disponible sur un lieu (par index) : Alliés présents + Archers
  // Loups des lieux voisins (qui peuvent éliminer un Héros sur un lieu adjacent).
  const attackTotalAt = (index: number): number => {
    const here = (player.board[player.locations[index].id] ?? [])
      .filter((c) => c.type === 'ally')
      .reduce((n, c) => n + (strengths[c.instanceId] ?? c.strength ?? 0), 0)
    const archersAround = [player.locations[index - 1], player.locations[index + 1]]
      .filter((l): l is NonNullable<typeof l> => !!l)
      .reduce(
        (n, nl) =>
          n +
          (player.board[nl.id] ?? [])
            .filter((c) => c.cardId === 'archers-loups')
            .reduce((m, c) => m + (strengths[c.instanceId] ?? c.strength ?? 0), 0),
        0,
      )
    return here + archersAround
  }

  return (
    // Décalé à droite pour s'aligner sous les lieux de l'image (sauf si déjà placé
    // dans un flex où la marge gauche est occupée par les pioches Vilain).
    <div className="grid grid-cols-4 gap-2" style={offset ? { marginLeft: `${LOCATIONS_LEFT}%` } : undefined}>
      {player.locations.map((loc, index) => {
        const isCurrent = player.pawnLocation === loc.id
        const previewAlign =
          index === 0 ? 'left' : index === player.locations.length - 1 ? 'right' : 'center'
        return (
          <LocationCard
            key={loc.id}
            location={loc}
            accent={accent}
            isCurrent={isCurrent}
            showCurrentSnake={showCurrentSnake}
            isMovable={legalMoves.includes(loc.id)}
            placedCards={player.board[loc.id] ?? []}
            strengths={strengths}
            attackTotal={attackTotalAt(index)}
            blinkPersifleur={loc.id === highlightPersifleurAt}
            locationKey={`${player.villain}:${loc.id}`}
            isPlaceTarget={placeTargets.includes(loc.id)}
            attachHere={attachLocation === loc.id}
            selectableCards={selectableCards}
            vanquishAllyCandidates={vanquishAllyCandidates}
            vanquishSelected={vanquishSelected}
            onVanquishToggle={onVanquishToggle}
            sheriffMovable={sheriffMovable}
            onSheriffMoveStart={onSheriffMoveStart}
            diabloMovable={diabloMovable}
            onDiabloMoveStart={onDiabloMoveStart}
            canSkipMove={canSkipMove}
            onSkipMove={onSkipMove}
            previewAlign={previewAlign}
            cellColor={cellColor}
            onTestInsert={onLocationInsert ? (rect) => onLocationInsert(loc.id, rect) : undefined}
            onMove={() => onMove(loc.id)}
            onPlace={() => onPlace(loc.id)}
            onAttach={onAttach}
            onCardPick={onCardPick}
          />
        )
      })}
    </div>
  )
}
