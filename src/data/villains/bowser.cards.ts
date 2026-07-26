// =============================================================================
// Bowser — cartes (Deck Vilain de 30 + Deck Fatalité de 15). Vilain « collab »
// (hors gamme officielle), thème Super Mario Galaxy.
//
// Source : feuille « Bowser » de assets/decks/Villainous Template_Jules.ods
// (voir assets/decks/LISEZ-MOI-decks.md pour la convention de colonnes) + images
// du dossier assets/decks/Bowser/.
//
// Composition :
//   Vilain (30)   = Festival des éclats d'étoiles ×2, Besoin de renfort ×2,
//                   épuisement d'énergie ×4, Impuissance ×2, Te revoilà ! ×3,
//                   Vol du château ×4, Galaxie hantée ×2, Réacteur galactique ×2,
//                   Galaxie en verre ×2, Bateau ×1, + 6 Alliés ×1.
//   Fatalité (15) = Mario, Peach, Luigi, Harmonie, Luma (héros) + Vous avez
//                   obtenu une grande étoile ! ×2, Comète farceuse ×2,
//                   Transformation ×2, Anneau étoile ×2, Goinfre ×2.
//
// MÉCANIQUE CENTRALE : les ÉTOILES. L'Observatoire de la Comète démarre avec 4
// Étoiles ; les cartes Vilain les drainent vers les Alliés, les Héros/Fatalité
// les y remettent. Objectif : Observatoire à 0 Étoile ET Peach capturée (via
// Impuissance uniquement). Voir engine pour la mécanique (étapes B/C).
//
// PÉRIMÈTRE : quasiment tout est câblé — mécanique des Étoiles (drain via
// épuisement d'énergie, remise via Mario / grande étoile / Luigi, Dino Piranha /
// Kamella), capture de Peach (Impuissance), capacités activées (Galaxie hantée,
// Bowser Jr.), Fatalités (grande étoile, Goinfre, Comète, Anneau étoile),
// utilitaires (Te revoilà !, Vol du château, Besoin de renfort), passifs
// (Harmonie garde la dernière Étoile, Bowser Jr. pioche quand fatalisé), auras
// de force et Conditions.
//
// ⚠️ Non câblés (capacités optionnelles / complexes) — la carte reste jouable
// comme corps (Allié / Objet) mais sans son mouvement spécial :
//   - Grand Terrier : « vous pouvez déplacer un Allié voisin » (optionnel).
//   - Bateau : déplacement figurine + Bateau + action, une fois par tour.
// =============================================================================

import type { CardDef } from '../types'

const img = (file: string) => `/cards/bowser/${file}`

export const bowserCards: CardDef[] = [
  // ==========================================================================
  // DECK FATALITÉ (15)
  // ==========================================================================

  // --- Héros ---------------------------------------------------------------
  {
    id: 'mario',
    name: 'Mario',
    englishName: 'Mario',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: "Remettez une Étoile dans l'Observatoire de la Comète. Tant que MARIO est présent, Bowser ne peut pas gagner la partie.",
    image: img('mario.webp'),
    // À la pose : remet 1 Étoile à l'Observatoire (le blocage « tant que Mario est
    // présent » est géré par l'objectif, cf. blockerHeroCardId).
    onPlace: [{ type: 'RETURN_STAR_TO_OBSERVATORY', amount: 1 }],
  },
  {
    id: 'peach',
    name: 'Peach',
    englishName: 'Peach',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: "Vous devez immédiatement jouer PEACH au Château de Peach dès qu'elle est dévoilée. Défaussez les autres cartes Fatalité qui ont été dévoilées.",
    image: img('peach.webp'),
    // Pose OBLIGATOIRE au Château de Peach : tous les autres lieux sont interdits
    // (data-driven via heroPlacementLocations ; pas de branchement par cardId).
    forbiddenLocations: ['chateau-bowser', 'galaxies', 'observatoire'],
  },
  {
    id: 'luigi',
    name: 'Luigi',
    englishName: 'Luigi',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: "Défaussez tous les Alliés qui se trouvent sur le même lieu que LUIGI. Si un ou plusieurs Alliés contiennent au moins une Étoile, remettez-la à l'Observatoire.",
    image: img('luigi.webp'),
    // À la pose : défausse les Alliés du lieu de Luigi et renvoie leurs Étoiles.
    onPlace: [{ type: 'DISCARD_ALLIES_AND_RETURN_STARS_AT_HOST' }],
  },
  {
    id: 'harmonie',
    name: 'Harmonie',
    englishName: 'Rosalina',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: "Tant qu'HARMONIE est présente, l'Observatoire de la Comète doit contenir au moins une Étoile (si ce lieu n'est pas bloqué).",
    image: img('harmonie.webp'),
  },
  {
    id: 'luma',
    name: 'Luma',
    englishName: 'Luma',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'La force de tous les autres Héros augmente de 1.',
    image: img('luma.webp'),
    // Aura : +1 à TOUS les autres Héros du royaume (data-driven, déjà gérée).
    strengthMod: { target: 'heroes-realm', delta: 1, excludeSelf: true },
  },

  // --- Fatalité (non-héros) ------------------------------------------------
  {
    id: 'gain-grand-star',
    name: 'Vous avez obtenu une grande étoile !',
    englishName: 'You Got a Grand Star!',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: "Si un Allié possède une Étoile, retirez-en une et remettez-la sur l'Observatoire de la Comète.",
    image: img('gain-grand-star.webp'),
    effects: [{ type: 'RETURN_STAR_TO_OBSERVATORY', amount: 1 }],
  },
  {
    id: 'comete',
    name: 'Comète farceuse',
    englishName: 'Prankster Comet',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Défaussez un Objet.',
    image: img('comete.webp'),
    effects: [{ type: 'DISCARD_ONE_ITEM' }],
  },
  {
    id: 'transformation',
    name: 'Transformation',
    englishName: 'Transformation',
    deck: 'fate',
    type: 'item',
    copies: 2,
    text: 'Associez cet Objet à un Héros. Sa force augmente de 1.',
    image: img('transformation.webp'),
    // Objet Fatalité associé à un Héros : +1 à la force de l'hôte (déjà géré).
    attach: 'hero',
    attachStrengthBonus: 1,
  },
  {
    id: 'anneau',
    name: 'Anneau étoile',
    englishName: 'Star Ring',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Déplacez Bowser sur le lieu de votre choix.',
    image: img('anneau.webp'),
  },
  {
    id: 'monnaie',
    name: 'Goinfre',
    englishName: 'Glutton',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Perdez 2 jetons Pouvoir.',
    image: img('monnaie.webp'),
    effects: [{ type: 'LOSE_POWER', amount: 2 }],
  },

  // ==========================================================================
  // DECK VILAIN (30)
  // ==========================================================================

  // --- Conditions ----------------------------------------------------------
  {
    id: 'nuit',
    name: "Festival des éclats d'étoiles",
    englishName: 'Star Bit Festival',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: "Jouable pendant le tour d'un adversaire s'il possède au moins 6 jetons Pouvoir. Gagnez 3 jetons Pouvoir.",
    image: img('nuit.webp'),
    trigger: { type: 'opponent-power-ge', value: 6 },
    effects: [{ type: 'GAIN_POWER', amount: 3 }],
  },
  {
    id: 'renforts',
    name: 'Besoin de renfort',
    englishName: 'Need for Reinforcements',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: "Jouable pendant le tour d'un adversaire s'il possède au moins 3 Alliés. Jouez un Allié gratuitement.",
    image: img('renforts.webp'),
    // requiresOwnAlly : injouable sans Allié en main (sinon l'effet serait nul).
    trigger: { type: 'opponent-allies-in-realm-ge', value: 3, requiresOwnAlly: true },
  },

  // --- Événements ----------------------------------------------------------
  {
    id: 'puissance-stellaire',
    name: "épuisement d'énergie",
    englishName: 'Power Drain',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 4,
    text: "Retirez une Étoile de l'Observatoire de la Comète et placez-la sur un Allié situé sur le même lieu. Cette Étoile est défaussée si l'Allié est utilisé pour éliminer un Héros.",
    image: img('puissance-stellaire.webp'),
    // Draine 1 Étoile de l'Observatoire vers un Allié choisi (sur le lieu du pion).
    effects: [{ type: 'DRAIN_STAR_TO_ALLY' }],
  },
  {
    id: 'impuissance',
    name: 'Impuissance',
    englishName: 'Helplessness',
    deck: 'villain',
    type: 'effect',
    cost: 3,
    copies: 2,
    text: 'Éliminez un Héros de force 3 ou moins OU capturez Peach.',
    image: img('impuissance.webp'),
    // Choix interactif à la pose (cf. UI / enumerate) : Vaincre un Héros ≤3 OU capturer Peach.
    effects: [{ type: 'IMPUISSANCE_RESOLVE', peachCardId: 'peach', maxStrength: 3 }],
  },
  {
    id: 'rencontre',
    name: 'Te revoilà !',
    englishName: 'There You Are!',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: 'Récupérez une carte dans votre défausse et ajoutez-la à votre main.',
    image: img('rencontre.webp'),
    effects: [{ type: 'RECOVER_ANY_FROM_DISCARD' }],
  },
  {
    id: 'decoupage',
    name: 'Vol du château',
    englishName: 'Castle Theft',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 4,
    text: "Dévoilez les cartes de votre pioche jusqu'à ce que vous trouviez un Allié ou un Objet. Jouez-le et remettez les autres cartes sur le dessus de votre pioche.",
    image: img('decoupage.webp'),
    effects: [{ type: 'REVEAL_UNTIL_PLAY_ALLY_OR_ITEM' }],
  },

  // --- Objets --------------------------------------------------------------
  {
    id: 'ghostly',
    name: 'Galaxie hantée',
    englishName: 'Haunted Galaxy',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 2,
    text: 'Activer : regardez les 4 premières cartes de votre pioche. Ajoutez-en une à votre main et défaussez les autres.',
    image: img('ghostly.webp'),
    attach: 'location',
    // Porte le symbole « Activer » (capacité dispatchée par cardId à l'étape C).
    activatedCost: 0,
  },
  {
    id: 'boule-feu',
    name: 'Réacteur galactique',
    englishName: 'Galactic Reactor',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 2,
    text: "Ce lieu gagne l'action : Gagner 1 jeton Pouvoir.",
    image: img('boule-feu.webp'),
    attach: 'location',
    // Objet qui DONNE une action à son lieu (mécanique « grantsAction », déjà gérée).
    grantsAction: { type: 'GAIN_POWER', amount: 1, label: 'Gagner 1 pouvoir' },
  },
  {
    id: 'boule-verre',
    name: 'Galaxie en verre',
    englishName: 'Glass Galaxy',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 2,
    text: "Ce lieu gagne l'action : Déplacer un objet ou un allié.",
    image: img('boule-verre.webp'),
    attach: 'location',
    grantsAction: { type: 'MOVE_ITEM_ALLY', label: 'Déplacer un objet ou un allié' },
  },
  {
    id: 'bateau',
    name: 'Bateau',
    englishName: 'Starship Mario',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 1,
    text: "Lorsque vous êtes sur le même lieu que le BATEAU, vous pouvez, une fois par tour, déplacer votre figurine et le BATEAU vers n'importe quel lieu et y effectuer une action disponible, en dehors d'une action Fatalité.",
    image: img('bateau.webp'),
    attach: 'location',
    // Véhicule : même mécanisme que le Char d'Hadès (déplacement figurine + Objet
    // + 1 action hors Fatalité, 1×/tour — applyChariotMove via CHARIOT_MOVE).
    ridesWithPawn: true,
  },

  // --- Alliés --------------------------------------------------------------
  {
    id: 'bowser-jr',
    name: 'Bowser Jr.',
    englishName: 'Bowser Jr.',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    text: 'Piochez une carte à chaque fois que vous êtes la cible d\'une action Fatalité. Activer (payez 3 jetons Pouvoir) : trouvez PEACH et jouez-la.',
    drawCardOnFateTargeted: true,
    image: img('bowser-jr.webp'),
    // Capacité activée (coût 3) dispatchée par cardId à l'étape C.
    activatedCost: 3,
  },
  {
    id: 'dino-piranha',
    name: 'Dino Piranha',
    englishName: 'Dino Piranha',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    text: "Si DINO PIRANHA est joué sur l'Observatoire de la Comète, vous pouvez retirer une Étoile et la placer sur DINO PIRANHA.",
    image: img('dino-piranha.webp'),
    // À la pose : s'il arrive sur l'Observatoire, prend 1 Étoile (résolu post-placement).
    effects: [{ type: 'DRAIN_STAR_TO_SELF_IF_AT_OBSERVATORY' }],
  },
  {
    id: 'bouldergeist',
    name: 'Bouldergeist',
    englishName: 'Bouldergeist',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 4,
    copies: 1,
    text: "Lors d'une action Éliminer un Héros, BOULDERGEIST peut être utilisé pour éliminer un Héros sur son lieu ou sur un lieu voisin.",
    image: img('bouldergeist.webp'),
    // Portée de Vaincre étendue au lieu voisin (data-driven, déjà gérée).
    reachesAdjacentVanquish: true,
  },
  {
    id: 'kamella',
    name: 'Kamella',
    englishName: 'Kamella',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 1,
    text: "Si KAMELLA est jouée sur l'Observatoire de la Comète, vous pouvez retirer une Étoile et la placer sur KAMELLA.",
    image: img('kamella.webp'),
    effects: [{ type: 'DRAIN_STAR_TO_SELF_IF_AT_OBSERVATORY' }],
  },
  {
    id: 'roi-kaliente',
    name: 'Roi Kaliente',
    englishName: 'King Kaliente',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 4,
    copies: 1,
    text: 'Diminue de 1 la force des Héros qui se trouvent sur le même lieu que le ROI KALIENTE.',
    image: img('roi-kaliente.webp'),
    // Aura : -1 à la force des Héros du même lieu (data-driven, déjà gérée).
    strengthMod: { target: 'heroes-here', delta: -1 },
  },
  {
    id: 'grand-terrier',
    name: 'Grand Terrier',
    englishName: 'Major Burrows',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 1,
    text: 'Vous pouvez déplacer un Allié sur un lieu voisin.',
    image: img('grand-terrier.webp'),
    // À la pose : déplacement FACULTATIF d'un Allié vers un lieu voisin (réutilise
    // MOVE_ALLY_BUFF avec +0 force ; `optional` autorise « Ne pas déplacer »).
    effects: [{ type: 'MOVE_ALLY_BUFF', amount: 0, label: 'Grand Terrier', optional: true }],
  },
]
