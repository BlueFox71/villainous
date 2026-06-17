// =============================================================================
// Malus Fatalité du joueur — vu par l'IA.
//
// Mesure (0..1) à quel point un joueur est DÉJÀ gêné par les cartes Fatalité
// durables présentes dans son royaume (Héros / Objets classés dans data/fateMalus).
// Sert à moduler l'agressivité Fatalité du bot : menace réelle = progrès objectif
// − malus. Plus le joueur est bloqué (Mario en jeu, etc.), moins le bot a intérêt
// à empiler des Fatalités → il se concentre sur SON objectif.
//
// L'IA peut lire data/ (seul le moteur en est interdit) : on résout le classement
// via le registre (getCardDef(id).fateMalus).
// =============================================================================

import type { GameState, LocationId } from '../engine/types'
import type { CardInstance } from '../engine/types'
import type { FateMalus } from '../data/types'
import { getCardDef } from '../data/registry'

/** Poids par catégorie (croissant). Un `block-win` sature le malus à lui seul. */
const WEIGHT: Record<FateMalus, number> = {
  slow: 1,
  slow2: 2,
  slow3: 3.5,
  'block-advance': 5,
  'block-advance3': 8,
  'block-win': 12,
}
/** Au-delà de ce total brut, le malus est plafonné à 1 (un block-win suffit). */
const MALUS_CAP = 12
/** Plus de 2 lieux dont l'action est recouverte par un Héros → ralentissement net. */
const COVER_WEIGHT = 4

/**
 * Catégorie EFFECTIVE d'une carte Fatalité durable, conditions appliquées :
 *  - Zeus : block-win seulement au Mont Olympe (entrave les Titans qui arrivent).
 *  - Hercule : block-win seulement HORS du Mont Olympe (bloque le passage des Titans).
 *  - Reine Moustoria : block-win seulement à Buckingham Palace.
 *  - Provocation : block-win si l'hôte n'est PAS Peter Pan et que Peter Pan est en
 *    jeu (force Crochet à le tuer d'abord) ; sur Peter Pan → aucun malus (l'aide).
 * Renvoie null si la carte n'a aucun malus effectif.
 */
function effectiveCategory(
  state: GameState,
  idx: number,
  card: CardInstance,
  locId: LocationId,
): FateMalus | null {
  const base = getCardDef(card.cardId)?.fateMalus
  if (!base) return null
  switch (card.cardId) {
    case 'zeus':
      return locId === 'mont-olympe' ? 'block-win' : 'slow2'
    case 'hercule':
      return locId === 'mont-olympe' ? 'slow' : 'block-win'
    case 'reine-moustoria':
      return locId === 'buckingham-palace' ? 'block-win' : 'slow'
    case 'provocation': {
      const realm = Object.values(state.players[idx].board).flat()
      const host = card.attachedTo ? realm.find((c) => c.instanceId === card.attachedTo) : undefined
      if (host?.cardId === 'peter-pan') return null // sur Peter Pan : ça aide le joueur
      const peterPresent = realm.some((c) => c.cardId === 'peter-pan')
      return peterPresent ? 'block-win' : 'slow'
    }
    default:
      return base
  }
}

/**
 * Malus subi par le joueur `idx` (0..1) d'après l'état COURANT de son royaume :
 * somme pondérée des cartes Fatalité durables présentes + ralentissement générique
 * si > 2 lieux sont recouverts par des Héros. Plafonné à 1.
 */
export function playerMalus(state: GameState, idx: number): number {
  const p = state.players[idx]
  let raw = 0
  let coveredLocations = 0
  for (const loc of p.locations) {
    const cell = p.board[loc.id] ?? []
    if (cell.some((c) => c.type === 'hero')) coveredLocations++
    for (const c of cell) {
      if (c.type !== 'hero' && c.type !== 'item' && c.type !== 'ally') continue
      const cat = effectiveCategory(state, idx, c, loc.id)
      if (cat) raw += WEIGHT[cat]
    }
  }
  if (coveredLocations > 2) raw += COVER_WEIGHT
  return Math.min(1, raw / MALUS_CAP)
}
