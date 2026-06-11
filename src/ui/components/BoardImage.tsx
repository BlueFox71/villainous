import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'
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
}: Props) {
  const pawnIndex = player.locations.findIndex((l) => l.id === player.pawnLocation)
  const coverColor = VILLAIN_COLOR[player.villain] ?? '#000000'
  const cover = HERO_COVER[player.villain] ?? { top: 0, height: TOP_ACTIONS_HEIGHT }

  return (
    <div className="relative">
      <img
        src={player.boardImage}
        alt={`Plateau de ${player.villainName}`}
        className={`w-full rounded-lg ${imgClassName}`}
      />

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

      {player.locations.map((loc, i) => {
        // Persifleur : on révèle les actions du haut de ce lieu (pas de recouvrement).
        if (loc.id === unmaskHeroLocationId) return null
        const heroes = (player.board[loc.id] ?? []).filter(
          (c) => c.type === 'hero' && !c.hypnotized && !hiddenHeroInstanceIds.includes(c.instanceId),
        )
        if (heroes.length === 0) return null
        return (
          <div
            key={loc.id}
            className="absolute flex items-center justify-center gap-0.5 overflow-hidden rounded-b"
            style={{
              left: `${LOCATIONS_LEFT + i * PAWN_STEP}%`,
              top: `${cover.top}%`,
              width: `${PAWN_STEP}%`,
              height: `${cover.height}%`,
              backgroundColor: coverColor,
            }}
            title={heroes.map((h) => h.name).join(', ')}
          >
            {heroesOnImage ? (
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
              <span className="text-lg">🦸{heroes.length > 1 ? `×${heroes.length}` : ''}</span>
            )}
          </div>
        )
      })}

      {/* Lieux VERROUILLÉS (Jafar : Caverne aux Merveilles) : voile sombre + tuile
          cadenas pour signifier que le lieu est bloqué tant qu'il n'est pas ouvert. */}
      {(player.lockedLocations ?? []).map((lockedId) => {
        const i = player.locations.findIndex((l) => l.id === lockedId)
        if (i < 0) return null
        return (
          <div
            key={`lock-${lockedId}`}
            className="pointer-events-none absolute z-30 flex items-center justify-center"
            style={{
              left: `${LOCATIONS_LEFT + i * PAWN_STEP}%`,
              top: '3%',
              width: `${PAWN_STEP}%`,
              height: '90%',
            }}
            title="Lieu verrouillé — Caverne aux Merveilles"
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
