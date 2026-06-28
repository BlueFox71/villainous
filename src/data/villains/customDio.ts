// =============================================================================
// Patch de COMPORTEMENT du vilain PERSONNALISÉ « Dio Brando » (id `custom-dio`).
//
// L'éditeur ne produit que la DONNÉE visuelle des cartes (nom, type, coût, texte…),
// pas les `effects`/champs de jeu. Ce module les rebranche : il transforme le vilain
// custom en version « effective » jouable, en
//   1) remappant chaque id `custom-dio-<slug>` vers l'id NATIF historique (`the-world`,
//      `jotaro-kujo`…) — libre depuis le retrait du Dio natif — pour que TOUTE la
//      machinerie moteur existante (Stands, The World, ZA WARUDO!, retrait des Joestar,
//      objectif DIO_ALL_ACTIONS) le reconnaisse SANS modification ;
//   2) ajoutant les champs de jeu (effects, isStand, attach, onPlace…) repris à
//      l'identique de l'implémentation native ;
//   3) fixant le vrai objectif (DIO_ALL_ACTIONS).
//
// NB : Star Platinum (Stand de Jotaro, qui contrait ZA WARUDO!) n'existe pas dans ce
// deck custom → Jotaro ne va chercher aucun Stand et ZA WARUDO! n'est jamais contré.
// =============================================================================

import type { Effect, ObjectiveDef } from '../../engine/types'
import type { CustomVillain, CustomCard } from '../customVillain'

export const CUSTOM_DIO_ID = 'custom-dio'

const PREFIX = 'custom-dio-'
/** Corrections d'orthographe entre slug custom et id natif. */
const ID_FIX: Record<string, string> = {
  'vanille-ice': 'vanilla-ice',
  'tu-oses-t-approcher-de-moi': 'tu-oses-tapprocher',
}

/** Id natif (historique) d'une carte custom-dio (préfixe retiré + corrections). */
function nativeId(customId: string): string {
  const s = customId.startsWith(PREFIX) ? customId.slice(PREFIX.length) : customId
  return ID_FIX[s] ?? s
}

const e = (...effects: Effect[]) => effects

/** Champs de jeu à appliquer, par id NATIF de carte (repris du Dio natif). */
const FIELDS: Record<string, Partial<CustomCard>> = {
  // --- Deck Méchant : Événements / Objets / Alliés ---------------------------
  'za-warudo': {
    playableWithoutAction: true,
    playableOnlyBeforeActions: true,
    effects: e({ type: 'ZA_WARUDO_ACTIVATE' }),
  },
  'tu-oses-tapprocher': { effects: e({ type: 'DIO_REVEAL_FATE_HEROES_AT_PAWN', count: 4 }) },
  jotaro: { effects: e({ type: 'USE_COVERED_ACTIONS_THIS_TURN', exceptFate: true }) },
  vampirisme: { effects: e({ type: 'DIO_DISCARD_ALLY_GAIN', amount: 4 }) },
  'soif-de-sang': { effects: e({ type: 'GAIN_POWER_PER_HERO_IN_REALM', amount: 1 }) },
  'indigne-de-moi': { effects: e({ type: 'GAIN_POWER_PER_FATE_DISCARD_HERO', max: 99 }) },
  'quete-vers-le-paradis': { effects: e({ type: 'DIO_QUEST_FOR_HEAVEN' }) },
  'muda-muda-muda': {
    trigger: { type: 'opponent-fate-targeted-me' },
    effects: e({ type: 'DIO_MUDA', gain: 5 }),
  },
  'masque-de-pierre': { activatedCost: 0, activatedEffects: e({ type: 'DIO_DISCARD_HAND_GAIN_POWER' }) },
  'la-fleche': { activatedCost: 0, activatedEffects: e({ type: 'DRAW_CARDS', count: 4 }) },
  'the-world': { followsPawn: true, cannotBeDiscarded: true },
  'vanilla-ice': { summonsStandCardId: 'cream' },
  'enya-geil': { summonsStandCardId: 'justice', effects: e({ type: 'FETCH_CARD_TO_HAND', cardId: 'la-fleche' }) },

  // --- Deck Fatalité : Héros Joestar (vont chercher leur Stand) --------------
  // Jotaro & Joseph : RETIRÉS DU JEU une fois vaincus (cibles de l'objectif).
  'jotaro-kujo': { removedFromGameOnDefeat: true },
  'joseph-joestar': { removedFromGameOnDefeat: true },
  'jean-pierre-polnareff': {
    onPlace: e({ type: 'FETCH_STAND_ATTACH', standCardId: 'silver-chariot' }),
    mustDefeatFirst: true,
    fateMalus: 'block-advance',
  },
  'noriaki-kakyoin': {
    onPlace: e({ type: 'FETCH_STAND_ATTACH', standCardId: 'hierophant-green' }),
    fateMalus: 'slow2',
  },
  'mohammed-abdul': {
    onPlace: e({ type: 'FETCH_STAND_ATTACH', standCardId: 'magician-red' }),
    fateMalus: 'slow2',
  },
  iggy: { onPlace: e({ type: 'FETCH_STAND_ATTACH', standCardId: 'the-fool' }), fateMalus: 'slow' },

  // --- Deck Fatalité : Événements (ciblent Dio lui-même) ---------------------
  'hermit-purple': { effects: e({ type: 'TARGET_DISCARD_CHOICE', count: 3, label: 'Hermit Purple' }) },
  cartomancie: { effects: e({ type: 'DIO_REDUCE_ALLY_STRENGTH', amount: 2 }) },
  'fondation-speedwagon': { effects: e({ type: 'DIO_DISCARD_ITEM_IN_REALM' }) },
  'ora-ora-ora': { effects: e({ type: 'LOSE_POWER', amount: 4 }) },
  'lumiere-du-soleil': { effects: e({ type: 'DIO_SUNLIGHT_CHOICE', lose: 10 }) },

  // --- Stands (paquet « Stand ») : hors-deck → standPile via isStand. On retire
  //     `group` pour qu'ils ne soient pas écartés au montage, et on les type `item`
  //     (Stands associés), comme le Dio natif. ----------------------------------
  cream: { group: undefined, type: 'item', isStand: true, attach: 'ally', attachStrengthBonus: 6, effects: e({ type: 'DIO_CREAM_DISCARD_HERO' }) },
  justice: { group: undefined, type: 'item', isStand: true, attach: 'ally', attachStrengthBonus: 2, activatedCost: 0, activatedEffects: e({ type: 'RECOVER_TYPE_FROM_DISCARD', types: ['ally'], label: 'Justice' }) },
  'silver-chariot': { group: undefined, type: 'item', isStand: true, attach: 'hero', attachStrengthBonus: 4 },
  'hierophant-green': { group: undefined, type: 'item', isStand: true, attach: 'hero', attachStrengthBonus: 4, playCardCostSurcharge: 1 },
  'magician-red': { group: undefined, type: 'item', isStand: true, attach: 'hero', attachStrengthBonus: 4 },
  'the-fool': { group: undefined, type: 'item', isStand: true, attach: 'hero', attachStrengthBonus: 4, effects: e({ type: 'DIO_THE_FOOL_SCATTER' }) },
}

/** Transforme le vilain custom-dio en version JOUABLE : ids natifs + champs de jeu +
 *  objectif réel. À appliquer à l'enregistrement (cf. registerPublishedVillain). */
export function patchCustomDio(v: CustomVillain): CustomVillain {
  const cards: CustomCard[] = v.cards.map((c) => {
    const nid = nativeId(c.id)
    return { ...c, id: nid, ...(FIELDS[nid] ?? {}) }
  })
  const objective: ObjectiveDef = { type: 'DIO_ALL_ACTIONS', joestarCardIds: ['jotaro-kujo', 'joseph-joestar'] }
  return { ...v, objective, cards }
}
