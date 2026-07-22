import type { CardInstance, LocationId, PlayerState } from '../../engine/types'
import type { Accent } from '../accents'
import { LocationCard } from './LocationCard'
import { LOCATIONS_LEFT } from './BoardImage'
import { villainColor } from '../villainColorState'

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
  /** Restriction PRÉCISE des cartes cliquables (instanceId) pour les modes limités
   *  aux Alliés (épuisement d'énergie, Tendre un Piège). null = pas de restriction
   *  (logique par type habituelle). */
  selectableCardIds?: string[] | null
  /** Mode « éliminer — choix des alliés » : alliés cochables sur le lieu courant. */
  vanquishAllyCandidates?: string[]
  vanquishSelected?: string[]
  onVanquishToggle?: (instanceId: string) => void
  /** Ratigan — pose d'Objet : Engrenages (instanceId) cochables sur le plateau. */
  engrenagesCandidates?: string[]
  engrenagesSelected?: string[]
  onEngrenagesToggle?: (instanceId: string) => void
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
  /** Capitaine Crochet : ids d'actions accordées disponibles + handler de clic. */
  grantedActionIds?: string[]
  onGrantedAction?: (card: CardInstance) => void
  /** Capitaine Crochet : la Carte du Pays Imaginaire est utilisable + handler. */
  mapUsable?: boolean
  onUseMap?: (instanceId: string) => void
  /** Mère Gothel : la Couronne est utilisable + handler (défausse → 1 Confiance). */
  crownUsable?: boolean
  onUseCrown?: (instanceId: string) => void
  /** Glisser-déposer du déplacement : action « Déplacer un Objet/Allié » dispo (id) et
   *  ids des cartes déplaçables → elles deviennent saisissables vers un lieu voisin. */
  dragMoveActionId?: string
  movableDragIds?: string[]
  onCardDragStart?: (instanceId: string, x: number, y: number) => void
  onCardDragMove?: (x: number, y: number) => void
  onCardDragDrop?: (instanceId: string, x: number, y: number) => void
  onCardDragCancel?: () => void
  draggingInstanceId?: string | null
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
  selectableCardIds = null,
  vanquishAllyCandidates = [],
  vanquishSelected = [],
  onVanquishToggle,
  engrenagesCandidates = [],
  engrenagesSelected = [],
  onEngrenagesToggle,
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
  grantedActionIds = [],
  onGrantedAction,
  mapUsable = false,
  onUseMap,
  crownUsable = false,
  onUseCrown,
  dragMoveActionId,
  movableDragIds = [],
  onCardDragStart,
  onCardDragMove,
  onCardDragDrop,
  onCardDragCancel,
  draggingInstanceId = null,
}: Props) {
  const cellColor = villainColor(player.villain)

  // Sa Sucrerie — le circuit (sugar-rush) n'est PAS une zone de cartes : la grille du
  // bas n'affiche que les 4 zones de pose (Alliés/Objets/Héros). Les actions du circuit
  // sont sur l'image (BoardActions) ; le pion avance sur le circuit (BoardImage).
  const displayLocations =
    player.villain === 'sa-sucrerie'
      ? player.locations.filter((l) => l.id !== 'sugar-rush')
      : player.locations

  // Force d'attaque disponible sur un lieu (par index) : Alliés présents + Alliés « à
  // distance » des lieux voisins (donnée `reachesAdjacentVanquish` : Archers Loups,
  // Flibustiers, Cavaliers du roi, Les Vouivres…) qui peuvent éliminer un Héros adjacent.
  const reachesAdjacent = (c: CardInstance): boolean =>
    c.type === 'ally' &&
    !c.isWicket &&
    (c.reachesAdjacentVanquish || c.cardId === 'archers-loups' || c.cardId === 'flibustiers')
  const attackTotalAt = (index: number): number => {
    const here = (player.board[displayLocations[index].id] ?? [])
      .filter((c) => c.type === 'ally' && !c.isWicket)
      .reduce((n, c) => n + (strengths[c.instanceId] ?? c.strength ?? 0), 0)
    const archersAround = [displayLocations[index - 1], displayLocations[index + 1]]
      .filter((l): l is NonNullable<typeof l> => !!l)
      .reduce(
        (n, nl) =>
          n +
          (player.board[nl.id] ?? [])
            .filter(reachesAdjacent)
            .reduce((m, c) => m + (strengths[c.instanceId] ?? c.strength ?? 0), 0),
        0,
      )
    // Team Rocket — Persian (reachesAnyLocationVanquish) : compte sur CHAQUE lieu, où qu'il soit.
    const anyLocAround = displayLocations
      .filter((_, i) => i !== index)
      .reduce(
        (n, nl) =>
          n +
          (player.board[nl.id] ?? [])
            .filter((c) => c.type === 'ally' && !c.isWicket && c.reachesAnyLocationVanquish)
            .reduce((m, c) => m + (strengths[c.instanceId] ?? c.strength ?? 0), 0),
        0,
      )
    return here + archersAround + anyLocAround
  }

  return (
    // Décalé à droite pour s'aligner sous les lieux de l'image (sauf si déjà placé
    // dans un flex où la marge gauche est occupée par les pioches Vilain).
    <div className="grid grid-cols-4 gap-2" style={offset ? { marginLeft: `${LOCATIONS_LEFT}%` } : undefined}>
      {displayLocations.map((loc, index) => {
        const isCurrent = player.pawnLocation === loc.id
        const previewAlign =
          index === 0 ? 'left' : index === displayLocations.length - 1 ? 'right' : 'center'
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
            tempForce={player.locationTempForce?.[loc.id] ?? 0}
            attackTotal={attackTotalAt(index)}
            blinkPersifleur={loc.id === highlightPersifleurAt}
            locationKey={`${player.villain}:${loc.id}`}
            isPlaceTarget={placeTargets.includes(loc.id)}
            attachHere={attachLocation === loc.id}
            selectableCards={selectableCards}
            selectableCardIds={selectableCardIds}
            vanquishAllyCandidates={vanquishAllyCandidates}
            vanquishSelected={vanquishSelected}
            onVanquishToggle={onVanquishToggle}
            engrenagesCandidates={engrenagesCandidates}
            engrenagesSelected={engrenagesSelected}
            onEngrenagesToggle={onEngrenagesToggle}
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
            grantedActionIds={grantedActionIds}
            onGrantedAction={onGrantedAction}
            mapUsable={mapUsable}
            onUseMap={onUseMap}
            crownUsable={crownUsable}
            onUseCrown={onUseCrown}
            dragMoveActionId={dragMoveActionId}
            movableDragIds={movableDragIds}
            onCardDragStart={onCardDragStart}
            onCardDragMove={onCardDragMove}
            onCardDragDrop={onCardDragDrop}
            onCardDragCancel={onCardDragCancel}
            draggingInstanceId={draggingInstanceId}
          />
        )
      })}
    </div>
  )
}
