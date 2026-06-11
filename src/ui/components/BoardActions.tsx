import type { LocationAction, PlayerState } from '../../engine/types'
import { enlargeCoveredAction } from '../../engine/rules'

// Diamètre d'un bouton rond, en % de la largeur de l'image (carré via aspect-ratio).
const BUTTON_SIZE = 4.9 // %

/**
 * Coordonnées (en % de l'image : x = largeur, y = hauteur) de chaque icône
 * d'action, par vilain → lieu → id d'action. MESURES À AFFINER (comme le pion) :
 * ouvrir l'inspecteur et ajuster left/top de chaque bouton.
 */
const ACTION_POS: Record<string, Record<string, Record<string, { x: number; y: number }>>> = {
  princeJohn: {
    sherwood: {
      'gain-power': { x: 22.5, y: 19.95 },
      discard: { x: 30.41, y: 19.95 },
      'play-card': { x: 22.5, y: 66.8 },
      fate: { x: 30.41, y: 66.8 },
    },
    church: {
      'gain-power': { x: 43.35, y: 19.95 },
      'play-card-top': { x: 51.26, y: 19.95 },
      'play-card-bottom': { x: 43.35, y: 66.8 },
      'move-item-ally': { x: 51.26, y: 66.8 },
    },
    nottingham: {
      fate: { x: 64.19, y: 19.95 },
      'gain-power': { x: 72.1, y: 19.95 },
      vanquish: { x: 64.19, y: 66.8 },
      'play-card': { x: 72.1, y: 66.8 },
    },
    jail: {
      'gain-power': { x: 82.8, y: 66.8 },
      'play-card': { x: 88.7, y: 66.8 },
      discard: { x: 94.6, y: 66.8 },
    },
  },
  // Coordonnées Maléfique : approximatives, calées visuellement à affiner via
  // l'inspecteur (mêmes axes x que PJ — les 4 lieux occupent grosso modo les
  // mêmes positions horizontales sur l'image).
  maleficent: {
    mountains: {
      'move-item-ally': { x: 22.7, y: 20.1 },
      'play-card-top': { x: 30.5, y: 20.6 },
      'gain-power': { x: 22.65, y: 67.8 },
      fate: { x: 30.45, y: 67.8 },
    },
    cottage: {
      'gain-power': { x: 43.5, y: 20.4 },
      'move-item-ally': { x: 51.4, y: 20.35 },
      'play-card': { x: 43.45, y: 67.8 },
      discard: { x: 51.3, y: 67.8 },
    },
    forest: {
      discard: { x: 64.3, y: 20.6 },
      'play-card-top': { x: 72.1, y: 20.8 },
      'gain-power': { x: 64.2, y: 67.8 },
      'play-card-bottom': { x: 72.1, y: 67.8 },
    },
    castle: {
      'gain-power': { x: 85.1, y: 20.5 },
      fate: { x: 92.9, y: 20.5 },
      vanquish: { x: 85, y: 67.8 },
      'play-card': { x: 92.9, y: 67.9 },
    },
  },
  // Slenderman : même gabarit de plateau (panneau objectif à gauche + 4 lieux),
  // colonnes ~22/30 · 43/51 · 64/72 · 85/93 %, rangées haut ~20 % / bas ~68 %.
  // Mesuré sur board.png (Realm) via grille de coordonnées — à affiner si besoin.
  slenderman: {
    foret: {
      'move-item-ally': { x: 22.5, y: 20.1 },
      'gain-power': { x: 30.3, y: 19.9 },
      'play-card': { x: 22.5, y: 67.8 },
      fate: { x: 30.3, y: 67.7 },
    },
    tunnel: {
      'play-card-top': { x: 43.4, y: 20 },
      'gain-power': { x: 51.3, y: 20.35 },
      'play-card-bottom': { x: 43.3, y: 67.4 },
      discard: { x: 51.2, y: 67.8 },
    },
    mine: {
      fate: { x: 64.2, y: 20 },
      'play-card-top': { x: 72.1, y: 20 },
      'play-card-bottom': { x: 64.2, y: 67.8 },
      'gain-power': { x: 72.2, y: 67.9 },
    },
    'maison-perdue': {
      'move-hero': { x: 85.5, y: 20 },
      discard: { x: 93.4, y: 20.3 },
      'play-card': { x: 85.5, y: 67.8 },
      'gain-power': { x: 93.3, y: 67.9 },
    },
  },
  // Jafar : icônes calées sur board.png (panneau objectif à gauche + 4 lieux).
  // Le symbole « nuage + éclair » = action ACTIVER (capacités activées).
  jafar: {
    palais: {
      'play-card': { x: 22.7, y: 19.9 },
      activate: { x: 30.5, y: 19.9 },
      vanquish: { x: 22.7, y: 67 },
      fate: { x: 30.5, y: 67 },
    },
    rues: {
      'gain-power': { x: 43.5, y: 19.9 },
      fate: { x: 51.4, y: 19.9 },
      discard: { x: 43.5, y: 67 },
      'play-card': { x: 51.4, y: 67 },
    },
    oasis: {
      activate: { x: 64.3, y: 19.9 },
      'play-card-top': { x: 72.2, y: 19.9 },
      'gain-power': { x: 64.3, y: 67 },
      'play-card-bottom': { x: 72.2, y: 67 },
    },
    caverne: {
      discard: { x: 85.1, y: 19.9 },
      'gain-power': { x: 93, y: 19.9 },
      'play-card': { x: 85.1, y: 67 },
      'move-item-ally': { x: 93, y: 67 },
    },
  },
  // Reine de Cœur : même gabarit de plateau (panneau objectif + 4 lieux).
  reineCoeur: {
    'cour-palais': {
      discard: { x: 22.7, y: 20.5 },
      'move-item-ally': { x: 30.6, y: 20.5 },
      'gain-power': { x: 22.7, y: 67.9 },
      'play-card': { x: 30.6, y: 67.9 },
    },
    labyrinthe: {
      'play-card-top': { x: 43.5, y: 20.5 },
      activate: { x: 51.4, y: 20.5 },
      'gain-power': { x: 43.5, y: 68 },
      'play-card-bottom': { x: 51.4, y: 68 },
    },
    'foret-tulgey': {
      fate: { x: 64.4, y: 20.5 },
      'play-card': { x: 72.3, y: 20.5 },
      discard: { x: 64.4, y: 68 },
      vanquish: { x: 72.3, y: 68 },
    },
    'maison-lapin': {
      'play-card': { x: 85.3, y: 20.7 },
      'gain-power': { x: 93.1, y: 20.7 },
      activate: { x: 85.2, y: 68 },
      fate: { x: 93, y: 68 },
    },
  },
  // Capitaine Crochet : même gabarit de plateau (panneau objectif + 4 lieux).
  crochet: {
    'jolly-roger': {
      'gain-power': { x: 22.7, y: 20.8 },
      discard: { x: 30.5, y: 20.8 },
      vanquish: { x: 22.7, y: 68 },
      'play-card': { x: 30.5, y: 68 },
    },
    'rocher-crane': {
      'gain-power': { x: 43.5, y: 20.9 },
      'play-card': { x: 51.4, y: 21 },
      fate: { x: 43.6, y: 67.5 },
      discard: { x: 51.3, y: 68.4 },
    },
    'lagune-sirenes': {
      'play-card-top': { x: 64.4, y: 20.8 },
      'move-item-ally': { x: 72.2, y: 21 },
      'gain-power': { x: 64.3, y: 68 },
      'play-card-bottom': { x: 72.2, y: 68.2 },
    },
    'arbre-pendu': {
      fate: { x: 85.2, y: 21 },
      'gain-power': { x: 93, y: 21 },
      'move-hero': { x: 85.1, y: 68.2 },
      'play-card': { x: 93, y: 68.6 },
    },
  },
}

interface Props {
  player: PlayerState
  /** Ids des actions disponibles (lieu courant) → bouton jaune cliquable. */
  availableActionIds: string[]
  /** Ids des actions déjà utilisées ce tour (lieu courant) → bouton assombri. */
  usedActionIds: string[]
  /** Lieu dont les actions du HAUT clignotent (Persifleur : choisir une action
   *  recouverte). */
  blinkTopAtLocation?: string | null
  onActionClick: (action: LocationAction) => void
}

/**
 * Boutons ronds quasi transparents superposés aux icônes d'action de l'image du
 * plateau. Jaune = disponible (cliquable) ; assombri = déjà utilisée ce tour ;
 * neutre sinon (lieu non courant ou action pas encore prise en charge).
 */
export function BoardActions({
  player,
  availableActionIds,
  usedActionIds,
  blinkTopAtLocation = null,
  onActionClick,
}: Props) {
  const layout = ACTION_POS[player.villain]
  if (!layout) return null

  // Actions recouvertes par le débordement d'un Héros agrandi voisin (Reine de
  // Cœur — Agrandir) : on masque leur bouton (le demi-masque de BoardImage les
  // recouvre déjà visuellement), comme pour les actions du haut d'un lieu à Héros.
  const enlargeCovered = new Set(
    player.locations.flatMap((loc) =>
      (player.board[loc.id] ?? []).flatMap((c) => {
        const cov = enlargeCoveredAction(player, c)
        return cov ? [`${cov.locationId}:${cov.actionId}`] : []
      }),
    ),
  )

  return (
    <>
      {player.locations.flatMap((loc) =>
        loc.actions.map((a) => {
          const pos = layout[loc.id]?.[a.id]
          if (!pos) return null
          const isCurrent = player.pawnLocation === loc.id
          const available = isCurrent && availableActionIds.includes(a.id)
          const used = isCurrent && usedActionIds.includes(a.id)
          // Un Héros posé recouvre la rangée du HAUT de son lieu : on masque ces
          // boutons (sauf s'ils restent jouables, ex. Persifleur → available).
          const heroHere = (player.board[loc.id] ?? []).some((c) => c.type === 'hero')
          if (a.row === 'top' && heroHere && !available) return null
          // Action recouverte par un Héros agrandi voisin → bouton masqué.
          if (enlargeCovered.has(`${loc.id}:${a.id}`)) return null
          // Persifleur : les actions du HAUT du lieu clignotent (choisir l'une d'elles).
          const blink = a.row === 'top' && loc.id === blinkTopAtLocation && available
          const tone = available
            ? 'border-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/30 cursor-pointer'
            : used
              ? 'border-black/70 bg-black/55'
              : 'border-white/20 bg-white/5'
          return (
            <button
              key={`${loc.id}:${a.id}`}
              type="button"
              disabled={!available}
              onClick={() => onActionClick(a)}
              title={a.label}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors ${tone}`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${BUTTON_SIZE}%`,
                aspectRatio: '1',
                ...(blink ? { animation: 'persifleurBlink 0.8s ease-in-out infinite' } : {}),
              }}
            />
          )
        }),
      )}
      {/* Actions ACCORDÉES par un Objet (Capitaine Crochet : Canon, Boîte à
          Crochets, Ingénieux Mécanisme). Pas d'icône imprimée → pastille visible
          centrée sur le lieu (empilées si plusieurs). */}
      {player.locations.flatMap((loc) => {
        const cells = layout[loc.id]
        if (!cells) return []
        const xs = Object.values(cells).map((p) => p.x)
        const centerX = xs.reduce((a, b) => a + b, 0) / xs.length
        const granted = (player.board[loc.id] ?? []).filter((c) => c.grantsAction)
        const isCurrent = player.pawnLocation === loc.id
        return granted.map((c, i) => {
          const g = c.grantsAction!
          const id = `granted:${c.instanceId}`
          const available = isCurrent && availableActionIds.includes(id)
          const used = isCurrent && usedActionIds.includes(id)
          const short =
            g.type === 'VANQUISH' ? '⚔ Vaincre' : g.type === 'MOVE_HERO' ? '↪ Héros' : `+${g.amount ?? 1} ⚡`
          return (
            <button
              key={`${loc.id}:${id}`}
              type="button"
              disabled={!available}
              onClick={() =>
                onActionClick({ id, type: g.type, label: g.label, amount: g.amount, row: 'bottom', grantedBy: c.instanceId })
              }
              title={g.label}
              className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border-2 px-1.5 py-0.5 text-[8px] font-bold transition-colors ${
                available
                  ? 'border-yellow-400 bg-yellow-400/30 text-yellow-50 hover:bg-yellow-400/50 cursor-pointer'
                  : used
                    ? 'border-black/70 bg-black/60 text-white/40'
                    : 'border-white/25 bg-black/50 text-white/70'
              }`}
              style={{ left: `${centerX}%`, top: `${44 + i * 11}%` }}
            >
              {short}
            </button>
          )
        })
      })}
      <style>{`
        @keyframes persifleurBlink {
          0%, 100% { box-shadow: 0 0 0 0 rgba(250,204,21,0); border-color: rgba(250,204,21,1); background-color: rgba(250,204,21,0.1); }
          50% { box-shadow: 0 0 12px 4px rgba(250,204,21,0.9); border-color: #fff; background-color: rgba(250,204,21,0.5); }
        }
      `}</style>
    </>
  )
}
