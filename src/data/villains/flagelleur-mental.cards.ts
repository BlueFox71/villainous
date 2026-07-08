// =============================================================================
// LE FLAGELLEUR MENTAL (Mind Flayer — Stranger Things) — cartes (deck Méchant :
// 30 ; Fatalité : 15). Vilain fan-made (créateur : Jules).
//
// Source de vérité : assets/custom-exports/custom-flagelleur-mental.json (données
// de jeu) + illustrations brutes de assets/decks/Flagelleur Mental/ (recopiées
// provisoirement dans public/cards/flagelleur-mental/ — à remplacer par les faces
// bakées de l'Atelier). Le TEXTE français est la source de vérité « humaine ».
//
// OBJECTIF : ouvrir le Monde à l'Envers. Poser 3 TUNNELS DE HAWKINS sur les 3
// premiers lieux, amener ONZE (Eleven, Héros Fatalité récupéré par BILLY) sur le
// lieu de l'ENTRÉE DU MONDE À L'ENVERS, puis ACTIVER l'ENTRÉE → victoire. MAX,
// tant qu'elle est présente, empêche BILLY d'aller chercher ONZE.
//
// ÉTAT (phase 1) : données + plateau + câblage + images provisoires + test
// d'intégrité. Seuls les effets DÉJÀ gérés par le moteur sont posés (auras de
// force, attach, gagner/perdre du Pouvoir, récupération en défausse, déplacement
// d'Allié/Héros, condition « adversaire ≥ 4 Pouvoir », surcoût d'activation local
// de Lucas, double-Fatalité de Dustin). Les mécaniques inédites (Tunnels + coût
// en Alliés, +3 Pouvoir à 3 Tunnels, déblocage du 4ᵉ lieu par 3 FLAYED, gain au
// déplacement du Démogorgon, verrou de lieu par Will Byers, fetch d'Eleven par
// Billy, activation-victoire de l'Entrée, scry deck, défausse d'Allié Fatalité,
// Intrus, Nancy) arrivent en PHASE 2 — ces cartes restent pour l'instant en TEXTE
// seul (aucun `effects`, ou `effects` partiels clairement notés).
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/flagelleur-mental/${f}`

export const flagelleurMentalCards: CardDef[] = [
  // ==========================================================================
  // DECK MÉCHANT (30)
  // ==========================================================================

  // --- Conditions (jouables pendant le tour d'un adversaire) ----------------
  {
    id: 'a-travers-les-yeux-de-will',
    name: 'À TRAVERS LES YEUX DE WILL',
    englishName: 'Through Will\'s Eyes',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il possède au moins 4 Jetons Pouvoir. Gagnez 2 Jetons Pouvoir.",
    image: img('travers_les_yeux.png'),
    trigger: { type: 'opponent-power-ge', value: 4 },
    effects: [{ type: 'GAIN_POWER', amount: 2 }],
  },
  {
    id: 'intrus-dans-le-monde-a-l-envers',
    name: "INTRUS DANS LE MONDE À L'ENVERS",
    englishName: 'Intruder in the Upside Down',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il joue un Allié. Jouez un Allié gratuitement puis piochez une carte.",
    image: img('intrus.png'),
    // Jouable quand l'adversaire joue un Allié ET qu'on a un Allié en main. Pose un
    // Allié gratuitement puis pioche (résolu dans applyPlayCondition, comme Lâcheté).
    trigger: { type: 'opponent-played-ally', requiresOwnAlly: true },
  },

  // --- Événements -----------------------------------------------------------
  {
    id: 'passage-secret-entre-deux-mondes',
    name: 'PASSAGE SECRÈTE ENTRE DEUX MONDES',
    englishName: 'Secret Passage Between Worlds',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: 'Récupérez une carte dans votre défausse et ajoutez-la à votre main.',
    image: img('passage.png'),
    effects: [{ type: 'RECOVER_ANY_FROM_DISCARD', label: 'Passage secrète' }],
  },
  {
    id: 'will-sous-emprise',
    name: 'WILL SOUS EMPRISE',
    englishName: 'Will Possessed',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Regardez les 4 premières cartes dans votre deck Méchant ou votre deck Fatalités (coûte 1 Jeton Pouvoir supplémentaire) et changez l\'ordre si vous souhaitez. Puis remettre sur le dessus de votre deck.',
    image: img('sous_emprise.png'),
    // Regarde + réordonne (interactif) les 4 premières cartes de la pioche Méchant.
    // (L'option « ou deck Fatalité, +1 Pouvoir » reste à ajouter — couche de choix.)
    effects: [{ type: 'FLAYER_WILL_SCRY', count: 4 }],
  },

  // --- Objets ---------------------------------------------------------------
  {
    // NB : le nom vient tel quel de l'export Atelier (« évite de bouger »).
    id: 'une-nouvelle-personne-sous-emprise',
    name: 'évite de bouger',
    englishName: 'A New Person Possessed',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 2,
    attach: 'hero',
    zeroesHostStrength: true,
    text: 'Associez cette carte à un Héros, sa force est à 0.',
    image: img('nouvelle_personne.png'),
  },
  {
    id: 'froid',
    name: 'FROID',
    englishName: 'Cold',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 2,
    text: 'Les Alliés qui se trouvent sur le même lieu que cet Objet ont une force augmentée de 1.',
    image: img('froid.png'),
    // Aura passive : +1 à la Force des Alliés présents sur le lieu de l'Objet.
    strengthMod: { target: 'allies-here', delta: 1 },
  },
  {
    id: 'tunnel-de-hawkins',
    name: 'TUNNEL DE HAWKINS',
    englishName: 'Hawkins Tunnel',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 5,
    text: 'Défaussez 2 Alliés pour placer cet Objet dans le Royaume (à part du MONDE À L\'ENVERS). Gagnez 3 Jetons Pouvoir s\'il y a 3 TUNNELS dans votre Royaume.',
    image: img('tunnel.png'),
    // Posé sur un lieu (jamais le Monde à l'Envers). Coût = 2 Pouvoir + défausse de
    // 2 Alliés (3 si ONZE présente, cf. surchargeHeroCardId), choisis à la pose. +3
    // Pouvoir en atteignant 3 Tunnels dans le royaume.
    forbiddenLocations: ['monde-envers'],
    effects: [
      {
        type: 'FLAYER_PLACE_TUNNEL',
        baseAllies: 2,
        surchargeHeroCardId: 'onze',
        tunnelCardId: 'tunnel-de-hawkins',
        rewardAtCount: 3,
        rewardPower: 3,
      },
    ],
  },
  {
    id: 'entree-du-monde-a-l-envers',
    name: "ENTRÉE DU MONDE À L'ENVERS",
    englishName: 'Gate to the Upside Down',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 1,
    text: 'Cette carte peut être activée si ONZE est sur le même lieu que l\'ENTRÉE DU MONDE À L\'ENVERS et que 3 TUNNELS DE HAWKINS sont placés sur les 3 premiers lieux.',
    image: img('entree.png'),
    // Capacité ACTIVÉE = VICTOIRE (objectif FLAYER_GATE) : ONZE sur le lieu de l'Entrée
    // + un Tunnel sur chacun des 3 premiers lieux. Grisée tant que non réunies.
    activatedCost: 0,
  },

  // --- Alliés ---------------------------------------------------------------
  {
    id: 'demogorgon',
    name: 'DÉMOGORGON',
    englishName: 'Demogorgon',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 4,
    copies: 3,
    text: 'Gagnez 1 jeton Pouvoir à chaque fois que le DÉMOGORGON soit déplacé.',
    image: img('demogorgon.png'),
    // +1 Pouvoir à chaque déplacement de cet Allié (au déplacement seulement).
    powerOnMove: 1,
  },
  {
    id: 'billy-sous-emprise',
    name: 'BILLY SOUS EMPRISE',
    englishName: 'Billy Possessed',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 1,
    text: 'Vous pouvez déplacer un Allié. Ne peut pas être défaussé pour utiliser le TUNNEL DE HAWKINS. Payez 3 jetons Pouvoir : Trouvez ONZE et jouez-la.',
    image: img('billy.png'),
    // Non défaussable pour payer un Tunnel (cf. cannotDiscardForTunnel).
    // À la pose : « vous pouvez déplacer un Allié » (voisin, comme Vignes).
    // Capacité ACTIVÉE (3 Pouvoir) : chercher ONZE dans la Fatalité et la poser sur le
    // lieu de Billy — bloquée tant que MAX est présente (cf. activatableCards).
    cannotDiscardForTunnel: true,
    effects: [{ type: 'MOVE_OWN_ALLY_ADJACENT' }],
    activatedCost: 3,
    activatedEffects: [{ type: 'FLAYER_FETCH_ONZE', heroCardId: 'onze', blockerHeroCardId: 'max-mayfield' }],
  },
  {
    id: 'vignes',
    name: 'VIGNES',
    englishName: 'Vines',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 1,
    copies: 3,
    text: 'Vous pouvez déplacer un Allié sur un lieu voisin.',
    image: img('vignes.png'),
    // À la pose : déplacer (facultatif) un Allié du royaume vers un lieu voisin.
    effects: [{ type: 'MOVE_OWN_ALLY_ADJACENT' }],
  },
  {
    id: 'the-flayed',
    name: 'THE FLAYED',
    englishName: 'The Flayed',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 4,
    text: 'Si 3 cartes The FLAYED sont posées dans votre royaume, débloquez le lieu MONDE À L\'ENVERS.',
    image: img('flayed.png'),
    // À 3 exemplaires réunis, déverrouille (définitivement) le Monde à l'Envers — sauf
    // si WILL BYERS le re-verrouille tant qu'il est présent.
    effects: [
      { type: 'FLAYER_FLAYED_UNLOCK', flayedCardId: 'the-flayed', count: 3, locationId: 'monde-envers', willCardId: 'will-byers' },
    ],
  },

  // ==========================================================================
  // DECK FATALITÉ (15) — les héros de Hawkins et leurs alliés/objets
  // ==========================================================================

  // --- Héros ----------------------------------------------------------------
  {
    id: 'mike-wheeler',
    name: 'MIKE WHEELER',
    englishName: 'Mike Wheeler',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'La force de tous les autres Héros augmente de 1.',
    image: img('mike.png'),
    // Aura : +1 à la Force des AUTRES Héros du royaume.
    strengthMod: { target: 'heroes-realm', delta: 1 },
  },
  {
    id: 'will-byers',
    name: 'WILL BYERS',
    englishName: 'Will Byers',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: "Tant que WILL BYERS est présent, le lieu MONDE À L'ENVERS est bloqué.",
    image: img('will.png'),
    // Verrouille le Monde à l'Envers à sa pose ; le redéverrouille à sa défaite (si les
    // 3 THE FLAYED avaient déjà été réunis).
    onPlace: [{ type: 'FLAYER_GATE_LOCK', locationId: 'monde-envers' }],
    onVanquish: [{ type: 'FLAYER_GATE_REFRESH', locationId: 'monde-envers', willCardId: 'will-byers' }],
  },
  {
    id: 'lucas-sinclair',
    name: 'LUCAS SINCLAIR',
    englishName: 'Lucas Sinclair',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Activer la capacité des Objets sur le lieu où se trouve LUCAS coûte 1 jeton Pouvoir de plus.',
    image: img('lucas.png'),
    // Renchérit de 1 le coût de l'action « Activer » sur SON lieu (comme l'Âne).
    activateCostSurchargeHere: 1,
  },
  {
    id: 'dustin-henderson',
    name: 'DUSTIN HENDERSON',
    englishName: 'Dustin Henderson',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: "Si DUSTIN HENDERSON fait partie des deux cartes dévoilées lors d'une action Fatalité, vous pouvez les jouer tous les deux.",
    image: img('dustin.png'),
    // Si dévoilé parmi les 2 cartes d'une Fatalité, le fataliseur peut jouer les deux.
    fatePlayBoth: true,
  },
  {
    id: 'onze',
    name: 'ONZE',
    englishName: 'Eleven',
    deck: 'fate',
    type: 'hero',
    strength: 5,
    copies: 1,
    text: 'Il faut désormais défausser 3 Alliés pour placer un TUNNEL DE HAWKINS.',
    image: img('onze.png'),
    // Phase 2 : tant qu'ONZE est en jeu, un TUNNEL coûte 3 Alliés (au lieu de 2).
    // Cible-clé de l'objectif (à amener sur l'ENTRÉE via BILLY).
  },
  {
    id: 'max-mayfield',
    name: 'MAX MAYFIELD',
    englishName: 'Max Mayfield',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: "Tant que MAX est présente, BILLY ne peut pas aller chercher ONZE.",
    image: img('max.png'),
    // Phase 2 : tant que MAX est en jeu, la capacité d'ONZE de BILLY est bloquée.
  },

  // --- Effets Fatalité ------------------------------------------------------
  {
    id: 'frissons',
    name: 'FRISSONS',
    englishName: 'Chills',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Déplacez un Héros sur le lieu voisin.',
    image: img('frisson.png'),
    effects: [{ type: 'RELOCATE_HERO_ADJACENT' }],
  },
  {
    id: 'nancy-armee',
    name: 'NANCY ARMÉE',
    englishName: 'Nancy Armed',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Déplacez un Objet sur le lieu voisin.',
    image: img('guirlandes.png'),
    // Déplace un Objet (ou Héros) vers un lieu voisin (primitif partagé « Fuite »).
    effects: [{ type: 'MOVE_HERO_OR_ITEM_ADJACENT' }],
  },
  {
    id: 'chaleur',
    name: 'CHALEUR',
    englishName: 'Heat',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Défaussez un Allié.',
    image: img('chaleur.png'),
    // Le fataliseur défausse un Allié (au choix) du royaume du Flagelleur.
    effects: [{ type: 'DISCARD_ALLY_OR_ITEM', onlyType: 'ally', cardName: 'Chaleur' }],
  },
  {
    id: 'telekinesie',
    name: 'TÉLÉKINÉSIE',
    englishName: 'Telekinesis',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Perdez 2 jetons Pouvoir.',
    image: img('telekinesie.png'),
    effects: [{ type: 'LOSE_POWER', amount: 2 }],
  },

  // --- Objet Fatalité -------------------------------------------------------
  {
    id: 'batte-de-baseball',
    name: 'BATTE DE BASEBALL',
    englishName: 'Baseball Bat',
    deck: 'fate',
    type: 'item',
    copies: 2,
    attach: 'hero',
    attachStrengthBonus: 1,
    text: 'Associez cet Objet à un Héros. Sa force augmente de 1.',
    image: img('batte.png'),
  },
]
