import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { enlargeCoveredAction } from '../../engine/rules'
import { VILLAIN_COLOR } from '../villainColors'

// Géométrie mesurée sur board.png (Prince Jean). Le panneau de gauche (portrait
// + objectif) décale le 1ᵉʳ lieu, puis les 4 lieux sont régulièrement espacés.
// Centres horizontaux : 26.5 / 47.5 / 68.5 / 89.5 %.
export const PAWN_FIRST_LEFT = 26.5 // % — centre du 1ᵉʳ lieu
export const PAWN_STEP = 21 // % — écart entre deux lieux
export const PAWN_TOP = 42 // %
export const LOCATIONS_LEFT = PAWN_FIRST_LEFT - PAWN_STEP / 2 // = 16 %, bord gauche des lieux
// Hauteur de la rangée d'actions du HAUT (en % de l'image) : un Héros la recouvre.
export const TOP_ACTIONS_HEIGHT = 33 // %

// Emplacements des Étoiles (en % de board.png : x = largeur, y = hauteur), par
// vilain → lieu → 4 slots. Les Étoiles de l'Observatoire occupent les 1ᵉʳˢ slots de
// son lieu. Calés sur l'Observatoire (centre ≈ 68,5 % : décalages −5,5/+4,5 en haut
// y 38, −7,5/+6,5 en bas y 50) ; même logique reportée sur les autres lieux
// (centres 26,5 / 47,5 / 89,5).
const STAR_SLOTS: Record<string, Record<string, { x: number; y: number }[]>> = {
  bowser: {
    'chateau-bowser': [
      { x: 21, y: 38 },
      { x: 31, y: 38 },
      { x: 19, y: 50 },
      { x: 33, y: 50 },
    ],
    galaxies: [
      { x: 42, y: 38 },
      { x: 52, y: 38 },
      { x: 40, y: 50 },
      { x: 54, y: 50 },
    ],
    observatoire: [
      { x: 63, y: 38 },
      { x: 73, y: 38 },
      { x: 61, y: 50 },
      { x: 75, y: 50 },
    ],
    'chateau-peach': [
      { x: 84, y: 38 },
      { x: 94, y: 38 },
      { x: 82, y: 50 },
      { x: 96, y: 50 },
    ],
  },
}

// L'Imposteur — géométrie des COÉQUIPIERS sur le plateau (mesurée sur sa board.png).
// Demi-écart horizontal entre les 2 cases (actions) du HAUT, par rapport au centre
// du lieu (≈ position des icônes d'action).
const CREW_SLOT = 3.9 // %
// Centre vertical d'un jeton selon sa rangée et son état. « Normal » = au-dessus de
// l'icône (ne recouvre rien) ; « suspect » = SUR l'icône d'action (la recouvre).
const CREW_Y: Record<'top' | 'bottom', { normal: number; suspect: number }> = {
  top: { normal: 7, suspect: 21 },
  bottom: { normal: 49, suspect: 61 },
}

// Géométrie du masque « recouvrement Héros » par vilain (les traits des actions
// ne sont pas au même endroit selon le plateau). `top` = décalage vertical,
// `height` = hauteur du masque (en % de l'image). À affiner visuellement.
const HERO_COVER: Record<string, { top: number; height: number }> = {
  princeJohn: { top: 0, height: TOP_ACTIONS_HEIGHT },
  maleficent: { top: 0, height: 38 },
  slenderman: { top: 0, height: 38 },
}

interface Props {
  player: PlayerState
  /** Affiche le pion sur le lieu courant. */
  showPawn?: boolean
  /** Affiche les cartes Héros sur l'image (sinon, simple masque des actions). */
  heroesOnImage?: boolean
  /** Classes additionnelles pour l'<img> (ex. couleur de bordure du camp). */
  imgClassName?: string
  /** Couleur du contour du pion (bleu joueur / rouge adverse). */
  pawnOutline?: string
  /** instanceIds des Héros à masquer (showcases en attente / en cours de vol). */
  hiddenHeroInstanceIds?: string[]
  /** Lieu dont on NE dessine PAS le recouvrement Héros (Persifleur : on révèle
   *  les actions du haut tant que le joueur n'a pas choisi). */
  unmaskHeroLocationId?: string | null
  /** L'Imposteur — Tuer : couleurs des Coéquipiers sélectionnables (cliquables). */
  crewmateCandidates?: string[]
  /** Handler de clic sur un Coéquipier candidat (couleur). */
  onCrewmateClick?: (color: string) => void
  /** Verbe affiché au survol d'un candidat (« Défausser » / « Rassurer »…). */
  crewmateSelectVerb?: string
}

/**
 * Image du plateau d'un joueur avec, en surimpression : le pion (optionnel) et,
 * pour chaque lieu portant un Héros, un **masque de la rangée d'actions du haut**
 * (le Héros la recouvre). En mode `heroesOnImage`, la carte Héros est posée dans
 * ce masque ; sinon une simple icône 🦸 indique le recouvrement.
 */
export function BoardImage({
  player,
  showPawn = false,
  heroesOnImage = false,
  imgClassName = '',
  pawnOutline = '#ffffff',
  hiddenHeroInstanceIds = [],
  unmaskHeroLocationId = null,
  crewmateCandidates,
  onCrewmateClick,
  crewmateSelectVerb = 'Défausser',
}: Props) {
  const pawnIndex = player.locations.findIndex((l) => l.id === player.pawnLocation)
  const coverColor = VILLAIN_COLOR[player.villain] ?? '#000000'
  const cover = HERO_COVER[player.villain] ?? { top: 0, height: TOP_ACTIONS_HEIGHT }

  return (
    <div className="relative" data-board>
      <img
        src={player.boardImage}
        alt={`Plateau de ${player.villainName}`}
        className={`w-full rounded-lg ${imgClassName}`}
        style={{ borderColor: `color-mix(in srgb, ${coverColor}, white 45%)` }}
      />

      {/* Ratigan — tuile Objectif posée dans le panneau gauche du plateau (qui
          porte l'emplacement « Placez la tuile Objectif ici »). Côté « L'Esprit
          Supérieur » (souris) par défaut ; bascule côté « Le Rat » dès que la Reine
          Robot a été défaussée (drapeau becameTheRat). */}
      {player.villain === 'ratigan' && (
        <img
          src={player.becameTheRat ? '/cards/ratigan/objectif-rat.png' : '/cards/ratigan/objectif-souris.png'}
          alt={player.becameTheRat ? 'Objectif : Le Rat' : 'Objectif : L’Esprit Supérieur'}
          title={player.objectiveDescription}
          className="pointer-events-none absolute z-[5] rounded-l-lg"
          style={{ left: '0%', top: '0.3%', width: '15.8%', height: '99.2%', objectFit: 'fill' }}
        />
      )}

      {showPawn && pawnIndex >= 0 && (
        <img
          src={player.pawnImage}
          alt="Pion"
          title="Pion"
          className="pointer-events-none absolute z-20 w-auto -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-500 ease-in-out"
          style={{
            height: `${player.pawnHeightPx}px`,
            left: `${PAWN_FIRST_LEFT + pawnIndex * PAWN_STEP}%`,
            top: `${PAWN_TOP}%`,
            // Contour doux (drop-shadows flous) à la couleur du camp.
            filter: `drop-shadow(0 0 1px ${pawnOutline}) drop-shadow(0 0 2.5px ${pawnOutline})`,
          }}
        />
      )}

      {/* Bowser — ÉTOILES : les Étoiles restantes de l'Observatoire
          (`observatoryStars`) occupent les 1ᵉʳˢ emplacements de `starLocationId`
          définis dans STAR_SLOTS. */}
      {(() => {
        const slots = STAR_SLOTS[player.villain]
        if (!slots) return null
        const stars = player.observatoryStars ?? 0
        if (stars <= 0 || !player.starLocationId) return null
        const locSlots = slots[player.starLocationId] ?? []
        return Array.from({ length: Math.min(stars, locSlots.length) }, (_, k) => (
          <img
            key={`star-${k}`}
            src="/cards/bowser/etoile.png"
            alt="Étoile"
            title={`Étoile ${k + 1}/${stars} sur l'Observatoire`}
            className="pointer-events-none absolute z-[15] w-auto -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${locSlots[k].x}%`,
              top: `${locSlots[k].y}%`,
              height: `${Math.round(player.pawnHeightPx * 0.42)}px`,
              // Halo doux doré (mêmes drop-shadows flous que le pion).
              filter: 'drop-shadow(0 0 1px #fde047) drop-shadow(0 0 3px #facc15)',
            }}
          />
        ))
      })()}

      {/* L'Imposteur — ses 8 COÉQUIPIERS, posés SUR leur case d'action (slot
          gauche/droite). On voit ainsi quelle action ils occupent ; suspect = halo
          rouge SUR l'icône (action recouverte). Deux Coéquipiers sur la même case
          sont légèrement décalés côte à côte. Sélectionnable = halo jaune cliquable. */}
      {(() => {
        const live = (player.crewmates ?? []).filter((c) => !c.discarded)
        return live.map((crew) => {
          const i = player.locations.findIndex((l) => l.id === crew.locationId)
          if (i < 0) return null
          const center = PAWN_FIRST_LEFT + i * PAWN_STEP
          const slotX = center + (crew.slot === 0 ? -CREW_SLOT : CREW_SLOT)
          // Coéquipiers sur la MÊME case (lieu + slot) : décalage interne pour les
          // voir tous les deux sur l'action.
          const sameCell = [...live]
            .filter((c) => c.locationId === crew.locationId && c.slot === crew.slot)
            .sort((a, b) => (a.color < b.color ? -1 : 1))
          const m = sameCell.length
          const k = sameCell.findIndex((c) => c.color === crew.color)
          const spread = 2.4 // étalement interne d'une case (%)
          const left = m > 1 ? slotX - spread / 2 + ((k + 0.5) / m) * spread : slotX
          const top = CREW_Y[crew.row][crew.suspect ? 'suspect' : 'normal']
          const selectable = crewmateCandidates?.includes(crew.color) ?? false
          const glow = selectable
            ? 'drop-shadow(0 0 4px #fde047) drop-shadow(0 0 9px #facc15)'
            : crew.suspect
              ? 'drop-shadow(0 0 3px #ff2d2d) drop-shadow(0 0 6px #ff0000)'
              : 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))'
          const sizeFactor = m > 1 ? 0.38 : 0.5
          return (
            <img
              key={`crew-${crew.color}`}
              src={`/cards/imposteur/crew-${crew.color}.png`}
              alt={`Coéquipier ${crew.color}`}
              title={
                selectable
                  ? `${crewmateSelectVerb} le Coéquipier ${crew.color}`
                  : `Coéquipier ${crew.color}${crew.suspect ? ' — suspect (recouvre l’action)' : ' — normal'}`
              }
              onClick={selectable ? () => onCrewmateClick?.(crew.color) : undefined}
              className={`absolute z-10 w-auto -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-500 ease-in-out ${
                selectable ? 'cursor-pointer animate-pulse' : 'pointer-events-none'
              }`}
              style={{
                height: `${Math.round(player.pawnHeightPx * sizeFactor)}px`,
                left: `${left}%`,
                top: `${top}%`,
                filter: glow,
              }}
            />
          )
        })
      })()}

      {player.locations.flatMap((loc, i) => {
        // Persifleur : on révèle les actions du haut de ce lieu (pas de recouvrement).
        if (loc.id === unmaskHeroLocationId) return []
        const heroes = (player.board[loc.id] ?? []).filter(
          (c) => c.type === 'hero' && !c.hypnotized && !hiddenHeroInstanceIds.includes(c.instanceId),
        )
        if (heroes.length === 0) return []
        const tops = loc.actions.filter((a) => a.row === 'top')
        const title = heroes.map((h) => h.name).join(', ')
        const renderContent = () =>
          heroesOnImage ? (
            heroes.map((h) => (
              <img
                key={h.instanceId}
                src={getCardDef(h.cardId)?.image}
                alt={h.name}
                title={`${h.name} (force ${h.strength ?? '?'})`}
                className="h-full w-auto max-w-none rounded border border-white/60"
              />
            ))
          ) : (
            <span className="flex items-center gap-0.5">
              <img src="/jeton_fatality.png" alt="Héros" className="h-10 w-10" />
              {heroes.length > 1 && <span className="text-sm font-bold text-white">×{heroes.length}</span>}
            </span>
          )
        // Au moins un Héros normal/agrandi → recouvrement PLEIN de la rangée du haut.
        if (heroes.some((h) => h.heroSize !== 'shrunk')) {
          return [
            <div
              key={loc.id}
              className="absolute z-[8] flex items-center justify-center gap-0.5 overflow-hidden rounded-b"
              style={{
                left: `${LOCATIONS_LEFT + i * PAWN_STEP}%`,
                top: `${cover.top}%`,
                width: `${PAWN_STEP}%`,
                height: `${cover.height}%`,
                backgroundColor: coverColor,
              }}
              title={title}
            >
              {renderContent()}
            </div>,
          ]
        }
        // Uniquement des Héros RAPETISSÉS : demi-masque sur le côté de l'action
        // recouverte (celle qu'ils NE libèrent PAS). Action de gauche (index 0) →
        // moitié gauche ; action de droite → moitié droite.
        const coveredIds = new Set<string>()
        for (const h of heroes) {
          const freed = h.shrunkFreeActionId ?? tops[0]?.id
          for (const a of tops) if (a.id !== freed) coveredIds.add(a.id)
        }
        return tops
          .filter((a) => coveredIds.has(a.id))
          .map((a) => {
            const idx = tops.indexOf(a)
            const left = LOCATIONS_LEFT + i * PAWN_STEP + (idx === 0 ? 0 : PAWN_STEP / 2)
            return (
              <div
                key={`${loc.id}:${a.id}`}
                className="absolute z-[8] flex items-center justify-center overflow-hidden rounded-b"
                style={{
                  left: `${left}%`,
                  top: `${cover.top}%`,
                  width: `${PAWN_STEP / 2}%`,
                  height: `${cover.height}%`,
                  backgroundColor: coverColor,
                }}
                title={title}
              >
                {renderContent()}
              </div>
            )
          })
      })}

      {/* Reine de Cœur — Agrandir : un Héros agrandi déborde sur la MOITIÉ du lieu
          voisin (le bord vers lequel il pivote), recouvrant la 3ᵉ action. Même
          masque que le recouvrement Héros, mais demi-largeur (PAWN_STEP / 2). */}
      {player.locations.flatMap((loc, i) => {
        const enlarged = (player.board[loc.id] ?? []).filter(
          (c) =>
            c.type === 'hero' &&
            !c.hypnotized &&
            c.heroSize === 'enlarged' &&
            !hiddenHeroInstanceIds.includes(c.instanceId),
        )
        return enlarged.flatMap((h) => {
          const cov = enlargeCoveredAction(player, h)
          if (!cov) return []
          const j = player.locations.findIndex((l) => l.id === cov.locationId)
          if (j < 0) return []
          // Voisin de droite → moitié GAUCHE du voisin (bord adjacent) ; voisin de
          // gauche → moitié DROITE.
          const rightNeighbor = j > i
          const left = LOCATIONS_LEFT + j * PAWN_STEP + (rightNeighbor ? 0 : PAWN_STEP / 2)
          return [
            <div
              key={`enlarge:${h.instanceId}`}
              className="pointer-events-none absolute z-[8] overflow-hidden rounded-b"
              style={{
                left: `${left}%`,
                top: `${cover.top}%`,
                width: `${PAWN_STEP / 2}%`,
                height: `${cover.height}%`,
                backgroundColor: coverColor,
              }}
              title={`${h.name} (agrandi) déborde sur ce lieu`}
            />,
          ]
        })
      })}

      {/* Lieux VERROUILLÉS (Jafar : Caverne aux Merveilles) : voile sombre + tuile
          cadenas pour signifier que le lieu est bloqué tant qu'il n'est pas ouvert. */}
      {(player.lockedLocations ?? []).map((lockedId) => {
        const i = player.locations.findIndex((l) => l.id === lockedId)
        if (i < 0) return null
        return (
          <div
            key={`lock-${lockedId}`}
            className="blocked-location pointer-events-none absolute z-[5] flex items-center justify-center"
            style={{
              left: `${LOCATIONS_LEFT + i * PAWN_STEP}%`,
              top: '8.7%',
              width: '20.1%',
              height: '70.5%',
            }}
            title={`Lieu verrouillé — ${player.locations[i].name}`}
          >
            <div className="flex h-full w-full items-center justify-center rounded-lg bg-black/55 backdrop-grayscale">
              <img
                src="/cards/jafar/lock.png"
                alt="Lieu verrouillé"
                className="w-1/5 opacity-95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
