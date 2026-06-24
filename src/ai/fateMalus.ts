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
 *  - Ariel : block-win seulement si un Objet-clé (Couronne/Trident) est exposé sur un
 *    lieu NON verrouillé d'Ursula (sinon elle n'a rien à geler → simple corps).
 *  - Sébastien : ne gêne (slow) que s'il y a un Pacte associé à un Héros à voler.
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
    case 'ariel': {
      // Ariel ne gêne vraiment que s'il y a un Objet-clé (Couronne/Trident) exposé
      // sur un lieu NON verrouillé d'Ursula : sinon elle n'a rien à geler/déplacer.
      const p = state.players[idx]
      const locked = new Set(p.lockedLocations ?? [])
      const exposed = Object.entries(p.board).some(
        ([lid, cards]) =>
          !locked.has(lid) &&
          cards.some((c) => c.type === 'item' && (c.cardId === 'couronne' || c.cardId === 'trident')),
      )
      return exposed ? 'block-win' : 'slow'
    }
    case 'sebastien': {
      // Sébastien ne gêne que s'il y a un Pacte associé à un Héros à lui voler.
      const hasContract = Object.values(state.players[idx].board)
        .flat()
        .some((c) => !!c.attachedTo && c.cardId.startsWith('pacte-'))
      return hasContract ? 'slow' : null
    }
    case 'witches-of-morva':
      // Les Sorcières bloquent la PRISE du Chaudron : bloc dur tant qu'il n'est pas
      // réclamé. Une fois réclamé (claimed/powered), elles ne le « dé-réclament » pas
      // → simple corps F3 (slow).
      return state.players[idx].blackCauldron === 'set-aside' ? 'block-win' : 'slow'
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
    // Un Héros PIÉGÉ est neutralisé (capacité ignorée, ne recouvre plus d'action) → il
    // ne gêne plus le joueur ciblé : ni malus, ni « lieu recouvert ».
    if (cell.some((c) => c.type === 'hero' && !c.trapped)) coveredLocations++
    for (const c of cell) {
      if (c.type !== 'hero' && c.type !== 'item' && c.type !== 'ally') continue
      if (c.type === 'hero' && c.trapped) continue
      const cat = effectiveCategory(state, idx, c, loc.id)
      if (cat) raw += WEIGHT[cat]
    }
  }
  if (coveredLocations > 2) raw += COVER_WEIGHT
  return Math.min(1, raw / MALUS_CAP)
}
