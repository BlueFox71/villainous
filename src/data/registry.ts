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
import { FATE_MALUS } from './fateMalus'
import { princeJohnCards } from './villains/princeJohn.cards'
import { maleficentCards } from './villains/maleficent.cards'
import { slendermanCards } from './villains/slenderman.cards'
import { jafarCards } from './villains/jafar.cards'
import { reineCoeurCards } from './villains/reineCoeur.cards'
import { crochetCards } from './villains/crochet.cards'
import { ursulaCards } from './villains/ursula.cards'
import { hadesCards } from './villains/hades.cards'
import { facilierCards } from './villains/facilier.cards'
import { imposteurCards } from './villains/imposteur.cards'
import { bowserCards } from './villains/bowser.cards'
import { mechanteReineCards } from './villains/mechanteReine.cards'
import { scarCards } from './villains/scar.cards'
import { yzmaCards } from './villains/yzma.cards'
import { ratiganCards } from './villains/ratigan.cards'
import { sombraCards } from './villains/sombra.cards'

/** Toutes les cartes, tous vilains confondus. Source unique : ajouter un vilain
 *  ici le fait entrer dans le registre ET dans les tests d'intégrité globaux
 *  (unicité des cardId), qui importent cette liste plutôt que de ré-énumérer. */
export const allCards: CardDef[] = [
  ...princeJohnCards,
  ...maleficentCards,
  ...slendermanCards,
  ...jafarCards,
  ...reineCoeurCards,
  ...crochetCards,
  ...ursulaCards,
  ...hadesCards,
  ...facilierCards,
  ...imposteurCards,
  ...bowserCards,
  ...mechanteReineCards,
  ...scarCards,
  ...yzmaCards,
  ...ratiganCards,
  ...sombraCards,
]

// On attache le classement « malus Fatalité » (data IA) au CardDef, sans muter
// les définitions d'origine : le registre est la source de `getCardDef`.
const byId: Record<string, CardDef> = Object.fromEntries(
  allCards.map((c) => [c.id, FATE_MALUS[c.id] ? { ...c, fateMalus: FATE_MALUS[c.id] } : c]),
)

/** Résout une CardDef depuis son cardId (toutes vilains confondus). Renvoie
 *  undefined si la carte est inconnue (typiquement une carte « truquée » dans
 *  les tests qui n'a pas de fiche). */
export function getCardDef(cardId: string): CardDef | undefined {
  return byId[cardId]
}
