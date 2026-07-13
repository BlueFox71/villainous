import { useRef } from 'react'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { enlargeCoveredAction } from '../../engine/rules'
import { coverColorOf } from '../villainColorState'
import { SUGAR_RUSH_TRACK } from './sugarRushTrack'
import { COL_RECTS, BOARD_W } from '../editor/boardLayout'

/** Position (% largeur) d'une colonne de lieu, calée sur le gabarit Realm — pour
 *  superposer l'image de colonne d'une face B (lieux transformables, cf. Atelier).
 *  Les % correspondent EXACTEMENT au découpage opéré au bake (cropColumn). */
const colLeftPct = (i: number) => (COL_RECTS[i].x0 / BOARD_W) * 100
const colWidthPct = (i: number) => ((COL_RECTS[i].x1 - COL_RECTS[i].x0) / BOARD_W) * 100

// Géométrie mesurée sur board.png (Prince Jean). Le panneau de gauche (portrait
// + objectif) décale le 1ᵉʳ lieu, puis les 4 lieux sont régulièrement espacés.
// Centres horizontaux : 26.5 / 47.5 / 68.5 / 89.5 %.
export const PAWN_FIRST_LEFT = 26.5 // % — centre du 1ᵉʳ lieu
export const PAWN_STEP = 21 // % — écart entre deux lieux
export const PAWN_TOP = 42 // %
// Décalage vertical du pion par vilain (présentation pure) : certains plateaux ont
// la « piste » du pion plus haut/bas que le gabarit standard. Défaut = PAWN_TOP.
const PAWN_TOP_BY_VILLAIN: Record<string, number> = {
  patHibulaire: 39,
}
export const LOCATIONS_LEFT = PAWN_FIRST_LEFT - PAWN_STEP / 2 // = 16 %, bord gauche des lieux
// Hauteur de la rangée d'actions du HAUT (en % de l'image) : un Héros la recouvre.
export const TOP_ACTIONS_HEIGHT = 33 // %

// Géométrie (en % de l'image du plateau) du VOILE d'un lieu VERROUILLÉ, réglable par
// vilain → lieu via l'éditeur de positions (mode test). À défaut de réglage, on la
// calcule depuis l'index du lieu (gabarit standard, colonnes régulières). Les blocs
// `BLOCKED_OVERLAY['<id>'] = { … }` ci-dessous sont réécrits par l'endpoint dev
// `/__save-blocked-overlay` — ne pas les éditer à la main.
export interface BlockedGeo { x: number; y: number; width: number; height: number }
const BLOCKED_OVERLAY: Record<string, Record<string, BlockedGeo>> = {}
// >>> BLOCKED_OVERLAY entries (éditeur de positions) — ne pas éditer à la main <<<
BLOCKED_OVERLAY['tabbou'] = {
  emissaire: { x: 79.2, y: 8.1, width: 20.1, height: 70.5 },
}
// Voile par défaut (aucun réglage) : colonne du lieu i, gabarit standard.
// eslint-disable-next-line react-refresh/only-export-components
export const defaultBlockedGeo = (i: number): BlockedGeo => ({
  x: LOCATIONS_LEFT + i * PAWN_STEP,
  y: 8.7,
  width: 20.1,
  height: 70.5,
})
// Lecture des réglages (éditeur de positions du mode test).
// eslint-disable-next-line react-refresh/only-export-components
export function getBlockedOverlay(villain: string): Record<string, BlockedGeo> | undefined {
  return BLOCKED_OVERLAY[villain]
}

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

// Gaston — emplacements des 2 jetons OBSTACLE par lieu (calés visuellement sur sa
// board.png : losanges marqués). Indexés par lieu ; le k-ième Obstacle restant
// occupe le k-ième emplacement.
const OBSTACLE_SLOTS: Record<string, Record<string, { x: number; y: number }[]>> = {
  gaston: {
    'maison-belle': [
      { x: 20.2, y: 46 },
      { x: 33.2, y: 47 },
    ],
    taverne: [
      { x: 41, y: 47 },
      { x: 54, y: 46 },
    ],
    bois: [
      { x: 62, y: 46 },
      { x: 75, y: 46.7 },
    ],
    'chateau-bete': [
      { x: 82.8, y: 46.9 },
      { x: 96, y: 47 },
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
  /** Gaston — lieux dont un jeton Obstacle est cliquable (retrait interactif). */
  obstacleTargets?: string[]
  /** Handler de clic sur un jeton Obstacle (retire un Obstacle de ce lieu). */
  onObstacleClick?: (locationId: string) => void
  /** Le Seigneur des clés — contrainte de ramassage interactif : une clé posée est
   *  cliquable si elle satisfait `locationId` (si défini) ET `color` (si défini).
   *  `{locationId}` = Toute Puissance ; `{color}` = Obtenir une clé / 00:00 ;
   *  `{locationId,color}` = Pierre tombale. */
  keyPick?: { locationId?: string; color?: string } | null
  /** Handler de clic sur une clé posée (la ramasse). */
  onKeyClick?: (keyId: string) => void
  /** Le pion est saisissable (glisser-déposer) pour se déplacer — tour humain,
   *  phase MOVE, au moins un lieu légal. Remplace l'ancien bouton « Choisir ». */
  pawnDraggable?: boolean
  /** Masque le pion réel pendant le glissé (le fantôme le remplace). */
  pawnDragging?: boolean
  /** Mode test (éditeur de pion) : remplace la hauteur du pion en direct (px). */
  pawnHeightOverride?: number
  onPawnDragStart?: (x: number, y: number) => void
  onPawnDragMove?: (x: number, y: number) => void
  onPawnDragDrop?: (x: number, y: number) => void
  onPawnDragCancel?: () => void
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
  obstacleTargets,
  onObstacleClick,
  keyPick,
  onKeyClick,
  pawnDraggable = false,
  pawnDragging = false,
  pawnHeightOverride,
  onPawnDragStart,
  onPawnDragMove,
  onPawnDragDrop,
  onPawnDragCancel,
}: Props) {
  // Geste de glissé du pion (même schéma que les cartes : seuil de 6 px avant de
  // déclencher, capture du pointeur, clic droit = annulation).
  const pawnDragRef = useRef<{ startX: number; startY: number; dragging: boolean } | null>(null)
  const pawnIndex = player.locations.findIndex((l) => l.id === player.pawnLocation)
  // Recouvrement : couleur DÉDIÉE du vilain custom si définie, sinon sa couleur thématique.
  const coverColor = coverColorOf(player.villain) ?? '#000000'
  const cover = HERO_COVER[player.villain] ?? { top: 0, height: TOP_ACTIONS_HEIGHT }

  // Sa Sucrerie — CIRCUIT EN HUIT : le pion ne change pas de lieu mais avance sur la
  // boucle (index `trackPos`, 0–17). On le place donc sur la case du circuit, pas en
  // colonne de lieu. Le jeton Pilote suit `racerPos`. Le déplacement passe par la
  // bannière 1–4 (pas de glisser-déposer du pion ici).
  const isSugarRush = player.villain === 'sa-sucrerie'
  const trackPos = ((player.trackPos ?? 0) % SUGAR_RUSH_TRACK.length + SUGAR_RUSH_TRACK.length) % SUGAR_RUSH_TRACK.length
  const trackCell = SUGAR_RUSH_TRACK[trackPos]
  // Le pion de Sa Sucrerie est saisissable comme les autres : il se glisse sur une case
  // atteignable du circuit (1–4 en avant), géré par App (trackCaseUnderPointer).
  const canDragPawn = pawnDraggable
  const pawnLeft = isSugarRush ? trackCell.x : PAWN_FIRST_LEFT + pawnIndex * PAWN_STEP
  const pawnTop = isSugarRush ? trackCell.y : (PAWN_TOP_BY_VILLAIN[player.villain] ?? PAWN_TOP)

  return (
    <div className="relative" data-board>
      <img
        src={player.boardImage}
        alt={`Plateau de ${player.villainName}`}
        className={`w-full rounded-lg ${imgClassName}`}
        style={{ borderColor: `color-mix(in srgb, ${coverColor}, white 45%)`, transition: 'border-color var(--villain-color-fade, 0s) ease-out' }}
      />

      {/* Lieux TRANSFORMÉS (face B active) : on superpose l'image de colonne bakée de
          la face B sur la colonne correspondante. Rendu JUSTE après le plateau (avant
          pion/héros) pour rester SOUS eux. Les bordures dorées (identiques A/B) restent
          celles du plateau de base → raccord invisible. */}
      {player.locations.map((loc, i) =>
        loc.version === 'b' && loc.bColumnImage && i < COL_RECTS.length ? (
          <img
            key={`colB-${loc.id}`}
            src={loc.bColumnImage}
            alt=""
            className="pointer-events-none absolute top-0 h-full"
            style={{ left: `${colLeftPct(i)}%`, width: `${colWidthPct(i)}%` }}
          />
        ) : null,
      )}

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
          draggable={false}
          title={
            canDragPawn
              ? isSugarRush
                ? 'Glissez le pion de 1 à 4 cases sur le circuit'
                : 'Glissez le pion sur un lieu pour vous y déplacer'
              : isSugarRush
                ? `Pion sur le circuit (case ${trackPos} / ${SUGAR_RUSH_TRACK.length})`
                : player.villain === 'seigneur-cles'
                  ? 'Pion (survolez pour voir les clés en dessous)'
                  : 'Pion'
          }
          // Déplacement par glissé : quand `pawnDraggable`, le pion capte le pointeur
          // et se saisit (curseur grab). Sinon, comportement antérieur — Le Seigneur
          // des clés : au survol, le pion devient quasi transparent pour révéler les
          // clés posées en dessous (les clés cliquables passent au-dessus de lui).
          className={`absolute z-20 w-auto -translate-x-1/2 -translate-y-1/2 transition-[left,top,opacity] duration-500 ease-in-out ${
            pawnDragging
              ? 'pointer-events-none opacity-0'
              : canDragPawn
                ? 'cursor-grab touch-none pointer-events-auto active:cursor-grabbing hover:scale-110'
                : player.villain === 'seigneur-cles'
                  ? 'cursor-help hover:opacity-10 hover:duration-150'
                  : 'pointer-events-none'
          }`}
          onPointerDown={
            canDragPawn
              ? (e) => {
                  if (e.button !== 0) return
                  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                  pawnDragRef.current = { startX: e.clientX, startY: e.clientY, dragging: false }
                }
              : undefined
          }
          onPointerMove={
            canDragPawn
              ? (e) => {
                  const d = pawnDragRef.current
                  if (!d) return
                  if (!d.dragging) {
                    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return
                    d.dragging = true
                    onPawnDragStart?.(e.clientX, e.clientY)
                  }
                  onPawnDragMove?.(e.clientX, e.clientY)
                }
              : undefined
          }
          onPointerUp={
            canDragPawn
              ? (e) => {
                  const d = pawnDragRef.current
                  pawnDragRef.current = null
                  if (d?.dragging) onPawnDragDrop?.(e.clientX, e.clientY)
                }
              : undefined
          }
          onContextMenu={
            canDragPawn
              ? (e) => {
                  // Clic droit pendant le glissé : annule (le pion reste sur place).
                  if (pawnDragRef.current?.dragging) {
                    e.preventDefault()
                    pawnDragRef.current = null
                    onPawnDragCancel?.()
                  }
                }
              : undefined
          }
          style={{
            height: `${pawnHeightOverride ?? player.pawnHeightPx}px`,
            left: `${pawnLeft}%`,
            top: `${pawnTop}%`,
            // Contour doux (drop-shadows flous) à la couleur du camp ; halo plus marqué
            // quand le pion est saisissable, pour signaler qu'on peut le glisser.
            filter: canDragPawn
              ? `drop-shadow(0 0 2px ${pawnOutline}) drop-shadow(0 0 6px #facc15)`
              : `drop-shadow(0 0 1px ${pawnOutline}) drop-shadow(0 0 2.5px ${pawnOutline})`,
          }}
        />
      )}

      {/* Sa Sucrerie — JETON PILOTE (Vanellope) : pendant la course, il court contre
          King Candy le long du circuit. Posé sur la case `racerPos` (il recouvre cette
          action, qui devient inaccessible). Disparaît hors course. */}
      {isSugarRush && player.raceActive && player.racerPos != null && (() => {
        const rp = ((player.racerPos % SUGAR_RUSH_TRACK.length) + SUGAR_RUSH_TRACK.length) % SUGAR_RUSH_TRACK.length
        const cell = SUGAR_RUSH_TRACK[rp]
        return (
          <img
            src="/racer-token.png"
            alt="Jeton Pilote"
            draggable={false}
            title={`Jeton Pilote de Vanellope (case ${rp} / ${SUGAR_RUSH_TRACK.length}) — recouvre cette action`}
            className="pointer-events-none absolute z-[18] w-auto -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-500 ease-in-out"
            style={{
              left: `${cell.x}%`,
              top: `${cell.y}%`,
              height: `${Math.round(player.pawnHeightPx * 0.8)}px`,
              filter: 'drop-shadow(0 0 2px #fff) drop-shadow(0 0 6px #22d3ee)',
            }}
          />
        )
      })()}

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

      {/* Cruella d'Enfer — TUILES CHIOTS posées sur les lieux (état `board`).
          Chaque tuile affiche sa face (valeur 11/22) ; image dérivée du lieu d'origine. */}
      {(() => {
        const tiles = (player.puppyTiles ?? []).filter((t) => t.state === 'board')
        if (tiles.length === 0) return null
        const shortLoc = (homeLocation: string) =>
          homeLocation === 'maison-radcliff' ? 'maison' : homeLocation
        // Regroupe par lieu courant pour les disposer côte à côte.
        const byLoc = new Map<string, typeof tiles>()
        for (const t of tiles) byLoc.set(t.location, [...(byLoc.get(t.location) ?? []), t])
        return [...byLoc.entries()].flatMap(([locId, locTiles]) => {
          const i = player.locations.findIndex((l) => l.id === locId)
          if (i < 0) return []
          const center = PAWN_FIRST_LEFT + i * PAWN_STEP
          const m = locTiles.length
          const spread = Math.min(16, 5 * m) // étalement horizontal (%)
          return locTiles.map((t, k) => {
            const left = m > 1 ? center - spread / 2 + ((k + 0.5) / m) * spread : center
            return (
              <img
                key={`puppy-${t.id}`}
                src={`/cards/cruella/tuile-${shortLoc(t.homeLocation)}-${t.value}.png`}
                alt={`Tuile Chiots ${t.value}`}
                title={`Tuile Chiots — ${t.value} chiots`}
                className="pointer-events-none absolute z-[14] w-auto -translate-x-1/2 -translate-y-1/2 rounded-sm border border-black/40 shadow"
                style={{
                  left: `${left}%`,
                  top: '47%',
                  height: `${Math.round(player.pawnHeightPx * 0.5)}px`,
                }}
              />
            )
          })
        })
      })()}

      {/* Gaston — JETONS OBSTACLE restants par lieu (2 max), posés sur leurs
          emplacements marqués (OBSTACLE_SLOTS). Ils disparaissent à mesure que Gaston
          les retire (objectif : 0). */}
      {(() => {
        if (!player.obstacles) return null
        const slots = OBSTACLE_SLOTS[player.villain]
        if (!slots) return null
        return player.locations.flatMap((l) => {
          const n = player.obstacles![l.id] ?? 0
          const locSlots = slots[l.id] ?? []
          const clickable = (obstacleTargets ?? []).includes(l.id)
          return Array.from({ length: Math.min(n, locSlots.length) }, (_, k) => (
            <img
              key={`obstacle-${l.id}-${k}`}
              src="/cards/gaston/obstacle.png"
              alt="Obstacle"
              title={clickable ? `Cliquez pour retirer un Obstacle de ${l.name}` : `Obstacle — ${n} sur ${l.name}`}
              onClick={clickable ? () => onObstacleClick?.(l.id) : undefined}
              className={`absolute z-[14] w-auto -translate-x-1/2 -translate-y-1/2 ${
                clickable ? 'cursor-pointer transition-transform hover:scale-110' : 'pointer-events-none drop-shadow'
              }`}
              style={{
                left: `${locSlots[k].x}%`,
                top: `${locSlots[k].y}%`,
                height: `${Math.round(player.pawnHeightPx * 0.625)}px`,
                filter: clickable
                  ? 'drop-shadow(0 0 4px #fde047) drop-shadow(0 0 9px #facc15)'
                  : undefined,
              }}
            />
          ))
        })
      })()}

      {/* Le Seigneur des clés — CLÉS posées sur les lieux (k.location !== null).
          Petits jetons colorés (6 couleurs) étalés au centre du lieu. Cliquables
          (halo doré) quand le lieu figure dans keyTargets (ramassage interactif). */}
      {(() => {
        const keys = (player.keys ?? []).filter((k) => k.location !== null && !k.stolenBy)
        if (keys.length === 0) return null
        const byLoc = new Map<string, typeof keys>()
        for (const k of keys) byLoc.set(k.location!, [...(byLoc.get(k.location!) ?? []), k])
        return [...byLoc.entries()].flatMap(([locId, locKeys]) => {
          const i = player.locations.findIndex((l) => l.id === locId)
          if (i < 0) return []
          const center = PAWN_FIRST_LEFT + i * PAWN_STEP
          const m = locKeys.length
          const spread = Math.min(15, 5 * m)
          // Taille des clés indépendante de la réduction du pion (≈ 62 px).
          const size = Math.round(player.pawnHeightPx * 0.78)
          return locKeys.map((k, j) => {
            // Cliquable si elle satisfait la contrainte de ramassage (lieu et/ou couleur).
            const clickable =
              !!keyPick &&
              (keyPick.locationId === undefined || locId === keyPick.locationId) &&
              (keyPick.color === undefined || k.color === keyPick.color)
            const left = m > 1 ? center - spread / 2 + ((j + 0.5) / m) * spread : center
            return (
              <img
                key={`key-${k.id}`}
                src={`/cards/seigneur-cles/cle-${k.color}.png`}
                alt={`Clé ${k.color}`}
                onClick={clickable ? () => onKeyClick?.(k.id) : undefined}
                title={clickable ? `Cliquez pour ramasser la clé ${k.color}` : `Clé ${k.color}`}
                className={`absolute w-auto -translate-x-1/2 -translate-y-1/2 ${
                  clickable ? 'z-30 cursor-pointer animate-pulse hover:scale-110' : 'z-[14] pointer-events-none'
                }`}
                style={{
                  left: `${left}%`,
                  top: '48%',
                  height: `${size}px`,
                  filter: clickable
                    ? 'drop-shadow(0 0 4px #fde047) drop-shadow(0 0 9px #facc15)'
                    : 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
                }}
              />
            )
          })
        })
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

      {!isSugarRush && player.locations.flatMap((loc, i) => {
        // Persifleur : on révèle les actions du haut de ce lieu (pas de recouvrement).
        if (loc.id === unmaskHeroLocationId) return []
        // Mêmes règles que coveredTopActionIdsAt : un Héros hypnotisé (contrôlé), COUCHÉ/K.O.
        // (Team Rocket) ou le Prince (allié de Trémaine) ne recouvre AUCUNE action. Un Héros
        // PIÉGÉ (jeton Enfermé), lui, CONTINUE de recouvrir (seule sa capacité est désactivée).
        const heroes = (player.board[loc.id] ?? []).filter(
          (c) =>
            c.type === 'hero' &&
            !c.attachedTo && // Grand Councilwoman — STITCH enfermé (associé à la CAGE) ne recouvre plus rien.
            !c.hypnotized &&
            !c.loved &&
            !c.pokemonKO &&
            c.cardId !== 'the-prince' &&
            !hiddenHeroInstanceIds.includes(c.instanceId),
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
                transition: 'background-color var(--villain-color-fade, 0s) ease-out',
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
                  transition: 'background-color var(--villain-color-fade, 0s) ease-out',
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
            !c.loved &&
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
                transition: 'background-color var(--villain-color-fade, 0s) ease-out',
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
        // Géométrie réglée par vilain (éditeur de positions) sinon calcul par index.
        const geo = BLOCKED_OVERLAY[player.villain]?.[lockedId] ?? defaultBlockedGeo(i)
        return (
          <div
            key={`lock-${lockedId}`}
            className="blocked-location pointer-events-none absolute z-[5] flex items-center justify-center"
            style={{
              left: `${geo.x}%`,
              top: `${geo.y}%`,
              width: `${geo.width}%`,
              height: `${geo.height}%`,
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
