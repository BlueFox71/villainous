// =============================================================================
// Patch de COMPORTEMENT du vilain PERSONNALISÉ « Gul'dan » (id `custom-gul-dan`).
//
// L'éditeur de l'Atelier ne produit que la DONNÉE VISUELLE des cartes (nom, type,
// coût, texte, illustrations…), pas les `effects`/champs de jeu. Ce module les
// REBRANCHE par cardId : appliqué à l'enregistrement du vilain (cf.
// `registerPublishedVillain`, y compris au ▶ Tester d'un brouillon local), il
// fusionne les effets/flags sur les cartes de l'auteur SANS toucher aux images.
//
// Mécanique : jouer les 4 ARTÉFACTS (pile façon Ingrédients), CORROMPRE les lieux
// (chaque Corruption reste posée + passe le lieu en face B ; à 3 lieux corrompus la
// PORTE DES TÉNÈBRES se déverrouille), puis, avec les 4 Artéfacts + les 4 lieux
// corrompus + le pion sur la Porte, jouer OUVERTURE pour l'emporter.
// =============================================================================

import type { ObjectiveDef } from '../../engine/types'
import type { CustomVillain, CustomCard } from '../customVillain'

export const CUSTOM_GULDAN_ID = 'custom-gul-dan'

const P = 'custom-gul-dan-'

/** Champs de jeu à appliquer, par cardId (identiques à ceux de l'export édité). */
const FIELDS: Record<string, Partial<CustomCard>> = {
  // --- ARTÉFACTS (rejoignent la pile Artéfacts à la pose) --------------------
  [`${P}livre-de-medivh`]: {
    isArtifact: true,
    effects: [{ type: 'REVEAL_DECK_UNTIL_TYPE', cardType: 'item', cardTypes: ['item', 'effect'], keepOnTop: true, title: 'Livre de Medivh' }],
  },
  [`${P}l-il-de-dalaran`]: {
    isArtifact: true,
    effects: [{ type: 'GAIN_POWER_PER_TYPE_IN_DISCARD', cardType: 'item', cardTypes: ['item', 'effect'], amount: 1, cap: 6 }],
  },
  [`${P}sceptre-de-sargeras`]: {
    isArtifact: true,
    cost: 0,
    effects: [{ type: 'GAIN_POWER_PER_HERO_IN_REALM', amount: 1, atPawn: true }],
  },
  [`${P}crane-de-gul-dan`]: {
    isArtifact: true,
    effects: [{ type: 'RECOVER_TYPE_FROM_DISCARD', types: ['item', 'effect'], label: "Crâne de Gul'dan" }],
  },

  // --- CORRUPTION & VICTOIRE -------------------------------------------------
  [`${P}corruption`]: {
    staysOnLocationOnPlay: true,
    effects: [
      { type: 'SWITCH_LOCATION_VERSION', atPlayedLocation: true, to: 'b' },
      { type: 'UNLOCK_LAST_LOCATION_IF_CORRUPTED', count: 3 },
    ],
  },
  [`${P}ouverture-de-la-porte-des-tenebres`]: {
    effects: [{ type: 'DARK_PORTAL_WIN' }],
  },

  // --- Autres cartes Vilain --------------------------------------------------
  [`${P}membres-du-conseil-des-ombres`]: {
    // Capacité ACTIVÉE (payer 1 Pouvoir via l'action Activer) : cherche un Trait du Chaos
    // dans la pioche/défausse et l'ajoute à la main. (Pas un effet « à la pose ».)
    activatedCost: 1,
    activatedEffects: [{ type: 'FETCH_CARD_TO_HAND', cardId: `${P}trait-du-chaos` }],
  },
  [`${P}trait-du-chaos`]: {
    effects: [{ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 99 }],
  },
  [`${P}magie-gangrene`]: {
    // Capacité ACTIVÉE (sticker Activer, gratuite) : pioche 2 cartes, en garde autant qu'on
    // veut (0, 1 ou 2 — choix interactif via pendingLookTop), défausse le reste. `take: 2`
    // = borne haute → on peut tout garder OU tout défausser. Dans activatedEffects (pas
    // effects) pour ne PAS se déclencher à la pose de l'Objet.
    activatedCost: 0,
    activatedEffects: [{ type: 'LOOK_TOP_DRAW_DISCARD', look: 2, take: 2, title: 'Magie Gangrené' }],
  },
  [`${P}drain-d-ame`]: {
    effects: [{ type: 'DISCARD_ALLY_DRAW', draw: 2, bonusCardId: `${P}esclave-draenei`, bonusPower: 2 }],
  },
  [`${P}connexion`]: {
    effects: [{ type: 'DISCARD_ANY_FOR_POWER', amount: 1 }],
  },
  [`${P}manipulation`]: {
    // Comme Foudre (Méchante Reine), mais reproduit un ARTÉFACT déjà joué et la
    // reproduction est GRATUITE (la carte a payé son coût fixe de 1 à la pose).
    effects: [{ type: 'DUPLICATE_INGREDIENT', zone: 'artifacts', freeDuplication: true }],
  },
  // Membres de la Horde / Esclave : aucune capacité (rien à brancher).

  // --- FATALITÉ --------------------------------------------------------------
  [`${P}liam-wrynn`]: { strengthMod: { target: 'heroes-realm', delta: 1 } }, // Llane Wrynn : +1 aux autres Héros
  [`${P}mot-de-pouvoir-robustesse`]: { attach: 'hero', attachStrengthBonus: 2 },
  [`${P}anduin-lothar`]: { mustDefeatFirst: true },
  [`${P}medivh`]: { increasesArtifactCost: 2 },
  [`${P}illidan-hurlorage`]: { blocksCardIds: [`${P}crane-de-gul-dan`] },
  [`${P}khadgar`]: { nullifiesArtifacts: true }, // Artéfacts sans effet + Manipulation injouable tant qu'il est là
  // Défaite (×3) : le fataliseur choisit Alliés OU Objets → défausse tout ce type du royaume.
  [`${P}defaite`]: { effects: [{ type: 'FATE_DISCARD_TYPE_CHOICE' }] },
  // Kil'jaeden : posé sur un lieu (recouvre rien), −1 Pouvoir au début de chaque tour de
  // Gul'dan ; défaussable seulement une fois les 4 lieux corrompus (gratuit).
  [`${P}kil-jaeden`]: { fateAttachesToLocation: true, drainsPowerAtTurnStart: 1, discardWhenAllCorrupted: true },
  // Armée de la Lumière (×2) : posée sur un lieu, empêche sa corruption ; défaussable
  // à tout moment contre 3 Pouvoir.
  [`${P}lumiere-des-naaru`]: { fateAttachesToLocation: true, blocksCorruptionHere: true, fateRemovalPowerCost: 3 },
  // Prophète Velen : à la pose, va chercher « Armée de la Lumière » dans la défausse
  // Fatalité et la rejoue (choix du lieu par le fataliseur).
  [`${P}prophete-velen`]: { onPlace: [{ type: 'FATE_REPLAY_CARD_FROM_DISCARD', cardId: `${P}lumiere-des-naaru` }] },
}

/** Rebranche les effets/champs de jeu de Gul'dan sur la donnée (visuelle) de l'auteur,
 *  fixe l'objectif (victoire par la Porte des Ténèbres, seuil Pouvoir hors d'atteinte)
 *  et garantit que la Porte (dernier lieu) démarre verrouillée. Les images sont
 *  conservées telles quelles. À appliquer à l'enregistrement (registerPublishedVillain). */
export function patchCustomGuldan(v: CustomVillain): CustomVillain {
  const cards: CustomCard[] = v.cards.map((c) => ({ ...c, ...(FIELDS[c.id] ?? {}) }))
  // La victoire passe par OUVERTURE (effet DARK_PORTAL_WIN) : le seuil de Pouvoir est
  // rendu inatteignable pour éviter toute victoire parasite au début du tour.
  const objective: ObjectiveDef = { type: 'POWER_THRESHOLD', threshold: 999 }
  const objectiveDescription =
    'Possédez les 4 Artéfacts, corrompez les 4 lieux, amenez votre pion sur la Porte des Ténèbres et jouez OUVERTURE DE LA PORTE DES TÉNÈBRES.'
  // La Porte des Ténèbres (dernier lieu) démarre verrouillée (déverrouillée à 3 lieux corrompus).
  const locations = v.locations.map((l, i) => (i === v.locations.length - 1 ? { ...l, lockedAtStart: true } : l))
  return { ...v, objective, objectiveDescription, cards, locations }
}
