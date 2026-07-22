// =============================================================================
// Pool FATALITÉ MARVEL commun.
//
// Ces 11 Héros Marvel forment un pool PARTAGÉ entre tous les vilains d'origine
// « Marvel » : à chaque partie, on en tire 5 AU HASARD que l'on AJOUTE à la
// Fatalité du vilain Marvel (cf. gameStore `setupForKey` → `marvelFateAddon`),
// portant sa pioche Fatalité au format complet (Ultron : 10 → 15).
//
// Ce sont des CardDef comme les autres (data-driven), enregistrées dans le
// registre `allCards` pour que `getCardDef` résolve leurs images. Certains effets
// PASSIFS sont câblés via des champs existants (Vision `reducesPowerGains`, Iron
// Man `activateSurcharge`, Thor `mustDefeatFirst`) ; les effets ACTIFS « à la
// pose » (Black Widow, Hawkeye, Captain America/Marvel, Le Faucon, Hulk, Nick
// Fury, Miss Hulk) restent « texte seul » pour l'instant (à brancher plus tard,
// comme les Héros Fatalité propres d'Ultron).
//
// ⚠️ « Crise/Event » n'existe pas côté Disney Villainous : les cartes qui y
// faisaient référence sont ADAPTÉES à « leur lieu » (Hawkeye, Miss Hulk).
// =============================================================================

import type { CardInstance } from '../engine/types'
import { buildDeckInstances } from './types'
import type { CardDef } from './types'

/** Les 11 Héros du pool Fatalité Marvel (deck `fate`), 1 exemplaire chacun. */
export const MARVEL_FATE_POOL: CardDef[] = [
  {
    id: 'marvel-vision',
    name: 'VISION',
    englishName: 'Vision',
    deck: 'fate',
    type: 'hero',
    copies: 1,
    strength: 4,
    text: 'Tant que VISION est dans votre domaine, à chaque fois que vous devez gagner des jetons Pouvoir, recevez-en 1 de moins.',
    image: '/cards/marvel-fate/vision.webp',
    // Passif : gains de Pouvoir réduits de 1 tant qu'il est dans le royaume.
    reducesPowerGains: true,
    fateMalus: 'slow2',
  },
  {
    id: 'marvel-black-widow',
    name: 'BLACK WIDOW',
    englishName: 'Black Widow',
    deck: 'fate',
    type: 'hero',
    copies: 1,
    strength: 2,
    text: 'Éliminez un Allié sur le lieu où vous jouez BLACK WIDOW.',
    image: '/cards/marvel-fate/black-widow.webp',
    fateMalus: 'slow',
  },
  {
    id: 'marvel-captain-america',
    name: 'CAPTAIN AMERICA',
    englishName: 'Captain America',
    deck: 'fate',
    type: 'hero',
    copies: 1,
    strength: 3,
    text: 'Placez un jeton Force +1 sur CAPTAIN AMERICA ainsi que sur tous les autres Héros présents dans le domaine où il est joué.',
    image: '/cards/marvel-fate/captain-america.webp',
    fateMalus: 'slow2',
  },
  {
    id: 'marvel-captain-marvel',
    name: 'CAPTAIN MARVEL',
    englishName: 'Captain Marvel',
    deck: 'fate',
    type: 'hero',
    copies: 1,
    strength: 6,
    text: 'Transférez tous les Alliés du domaine sur le lieu où vous jouez CAPTAIN MARVEL.',
    image: '/cards/marvel-fate/captain-marvel.webp',
    fateMalus: 'slow2',
  },
  {
    id: 'marvel-le-faucon',
    name: 'LE FAUCON',
    englishName: 'Falcon',
    deck: 'fate',
    type: 'hero',
    copies: 1,
    strength: 2,
    text: 'Transférez un Héros de force 3 ou moins de n’importe quel domaine sur le lieu où vous jouez LE FAUCON.',
    image: '/cards/marvel-fate/le-faucon.webp',
    fateMalus: 'slow',
  },
  {
    id: 'marvel-hawkeye',
    name: 'HAWKEYE',
    englishName: 'Hawkeye',
    deck: 'fate',
    type: 'hero',
    copies: 1,
    strength: 2,
    // Adaptation (sans « Crise ») : cible un Allié sur le lieu où il est joué.
    text: 'Éliminez un Allié sur le lieu où vous jouez HAWKEYE.',
    image: '/cards/marvel-fate/hawkeye.webp',
    fateMalus: 'slow',
  },
  {
    id: 'marvel-hulk',
    name: 'HULK',
    englishName: 'Hulk',
    deck: 'fate',
    type: 'hero',
    copies: 1,
    strength: 5,
    text: 'Rien ne peut être associé à HULK. Si vous éliminez HULK, placez un jeton Force +1 sur lui et transférez-le immédiatement vers le domaine d’un adversaire. Cet effet ne s’applique pas si Hulk est défaussé.',
    image: '/cards/marvel-fate/hulk.webp',
    fateMalus: 'slow3',
  },
  {
    id: 'marvel-iron-man',
    name: 'IRON MAN',
    englishName: 'Iron Man',
    deck: 'fate',
    type: 'hero',
    copies: 1,
    strength: 3,
    text: 'Tant qu’IRON MAN est dans votre domaine, les actions Activer vous coûtent 1 jeton Pouvoir de plus.',
    image: '/cards/marvel-fate/iron-man.webp',
    // Passif : surcoût de 1 Pouvoir sur les actions Activer tant qu'il est là.
    activateSurcharge: 1,
    fateMalus: 'slow',
  },
  {
    id: 'marvel-thor',
    name: 'THOR',
    englishName: 'Thor',
    deck: 'fate',
    type: 'hero',
    copies: 1,
    strength: 5,
    text: 'Vous devez éliminer THOR avant les autres Héros de votre domaine.',
    image: '/cards/marvel-fate/thor.webp',
    // Héros prioritaire : bloque l'élimination des autres Héros tant qu'il est là.
    mustDefeatFirst: true,
    fateMalus: 'slow2',
  },
  {
    id: 'marvel-miss-hulk',
    name: 'MISS HULK',
    englishName: 'She-Hulk',
    deck: 'fate',
    type: 'hero',
    copies: 1,
    strength: 4,
    // Adaptation (sans « Crise ») : verrouille le LIEU où elle est jouée.
    text: 'Tant que MISS HULK est dans votre domaine, vous ne pouvez plus déplacer d’Allié/Objet ni jouer de carte sur son lieu.',
    image: '/cards/marvel-fate/miss-hulk.webp',
    fateMalus: 'block-advance',
  },
  {
    id: 'marvel-nick-fury',
    name: 'NICK FURY',
    englishName: 'Nick Fury',
    deck: 'fate',
    type: 'hero',
    copies: 1,
    strength: 2,
    text: 'L’adversaire chez qui vous jouez NICK FURY perd la moitié de ses jetons Pouvoir, arrondie au supérieur.',
    image: '/cards/marvel-fate/nick-fury.webp',
    fateMalus: 'slow2',
  },
]

/** Table d'accès par id (pour le registre et les tests). */
export const MARVEL_FATE_BY_ID: Record<string, CardDef> = Object.fromEntries(
  MARVEL_FATE_POOL.map((c) => [c.id, c]),
)

/** Tire `count` Héros AU HASARD parmi les 11 du pool et en construit les instances Fatalité
 *  (préfixées comme la Fatalité du joueur). Sert à COMPLÉTER la Fatalité d'un vilain Marvel
 *  (Ultron : 10 → 15). Tirage de SETUP (`Math.random`, comme le seed de partie) : varie d'une
 *  partie à l'autre. Fonction pure hors aléa — testable pour le nombre/la distinction. */
export function drawMarvelFateAddon(fatePrefix: string, count = 5): CardInstance[] {
  const all = buildDeckInstances(MARVEL_FATE_POOL, 'fate', fatePrefix)
  // Fisher-Yates puis `count` premières.
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all.slice(0, count)
}

/** Tire des addons Fatalité Marvel PARTAGÉS pour plusieurs joueurs Marvel : le pool des 11
 *  Héros est mélangé UNE seule fois puis distribué SANS DOUBLON — chaque joueur reçoit `count`
 *  Héros DISTINCTS des autres. Ainsi, quand deux vilains Marvel s'affrontent, un même Héros
 *  (ex. Thor) ne peut apparaître que dans UNE des deux Fatalités. Retourne un tableau
 *  d'instances par préfixe (dans l'ordre reçu). Tirage de SETUP (`Math.random`). */
export function drawSharedMarvelFateAddons(fatePrefixes: string[], count = 5): CardInstance[][] {
  const pool = [...MARVEL_FATE_POOL]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const out: CardInstance[][] = []
  let offset = 0
  for (const prefix of fatePrefixes) {
    const slice = pool.slice(offset, offset + count)
    offset += count
    out.push(slice.flatMap((c) => buildDeckInstances([c], 'fate', prefix)))
  }
  return out
}
