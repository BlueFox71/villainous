// =============================================================================
// Registre central des cartes — résout un CardInstance.cardId vers sa CardDef,
// quel que soit le vilain d'origine. Indispensable dès qu'il y a > 1 vilain
// puisque chaque exemplaire (CardInstance) porte juste son cardId, pas le
// vilain auquel il appartient.
//
// L'unicité des cardId est garantie par les slugs (kebab-case, voir tests
// d'intégrité). Si un futur vilain venait à entrer en collision, on le verrait
// dans les tests.
// =============================================================================

import type { CardDef } from './types'
import { princeJohnCards } from './villains/princeJohn.cards'
import { maleficentCards } from './villains/maleficent.cards'
import { slendermanCards } from './villains/slenderman.cards'
import { jafarCards } from './villains/jafar.cards'
import { reineCoeurCards } from './villains/reineCoeur.cards'

const allCards: CardDef[] = [
  ...princeJohnCards,
  ...maleficentCards,
  ...slendermanCards,
  ...jafarCards,
  ...reineCoeurCards,
]

const byId: Record<string, CardDef> = Object.fromEntries(allCards.map((c) => [c.id, c]))

/** Résout une CardDef depuis son cardId (toutes vilains confondus). Renvoie
 *  undefined si la carte est inconnue (typiquement une carte « truquée » dans
 *  les tests qui n'a pas de fiche). */
export function getCardDef(cardId: string): CardDef | undefined {
  return byId[cardId]
}
