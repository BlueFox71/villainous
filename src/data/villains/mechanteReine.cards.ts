// =============================================================================
// La Méchante Reine — cartes (deck Méchant + deck Fatalité).
//
// Source : images FR du dossier assets/decks/Méchante Reine/ (texte recopié
// fidèlement) + wiki Villainous. Le TEXTE est la source de vérité ; les `effects`
// sont ajoutés au fil de l'eau (certaines cartes restent purement « texte » en
// attendant leur mécanique dédiée).
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/mechante-reine/${f}`

export const mechanteReineCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Événements
  // ----------------------------------------------------------------------
  {
    id: 'croque',
    name: 'Croque !',
    englishName: 'Take a Bite',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 5,
    text: "Choisissez un Héros sur le lieu où vous vous trouvez. Défaussez autant de jetons Poison que sa force pour l'éliminer.",
    image: img('croque.webp'),
    effects: [{ type: 'TAKE_A_BITE' }],
  },
  {
    id: 'broyer-os',
    name: 'Je vais vous broyer les os !',
    englishName: "I'll Crush Your Bones!",
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 3,
    text: 'Durant ce tour, vous pouvez aussi effectuer les actions recouvertes par un Héros sur le lieu où vous vous trouvez.',
    image: img('broyer-os.webp'),
    effects: [{ type: 'USE_COVERED_ACTIONS_THIS_TURN' }],
  },
  {
    id: 'foudre',
    name: 'Foudre',
    englishName: 'Thunderbolt',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    costVariable: true, // coût = coût de l'Ingrédient dupliqué → pastille « ? »
    copies: 2,
    text: "Dupliquez la capacité d'un Ingrédient déjà joué. Le coût de cette carte est égal au coût de l'Ingrédient dupliqué.",
    image: img('foudre.webp'),
    effects: [{ type: 'DUPLICATE_INGREDIENT' }],
  },
  {
    id: 'magie-noire',
    name: 'Magie noire',
    englishName: 'Black Magic',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Choisissez une carte Objet ou Ingrédient de votre pioche ou de votre défausse et ajoutez-la à votre main. Puis mélangez votre pioche.',
    image: img('magie-noire.webp'),
    effects: [{ type: 'BLACK_MAGIC_TUTOR' }],
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Ingrédients
  // ----------------------------------------------------------------------
  {
    id: 'caquet-megere',
    name: 'Caquet de vieille mégère',
    englishName: "Old Hag's Cackle",
    deck: 'villain',
    type: 'ingredient',
    cost: 0,
    copies: 2,
    text: 'Gagnez 1 jeton Pouvoir par lieu où se trouve au moins un Héros.',
    image: img('caquet-megere.webp'),
    effects: [{ type: 'GAIN_POWER_PER_LOCATION_WITH_HERO', amount: 1 }],
  },
  {
    id: 'hurlement-effroi',
    name: "Hurlement d'effroi",
    englishName: 'Scream of Fright',
    deck: 'villain',
    type: 'ingredient',
    cost: 2,
    copies: 2,
    text: 'Choisissez un lieu non bloqué. Vous pouvez déplacer chaque Héros de force 3 ou moins de ce lieu vers un lieu voisin non bloqué.',
    image: img('hurlement-effroi.webp'),
    effects: [{ type: 'SCREAM_OF_FRIGHT' }],
  },
  {
    id: 'noir-de-nuit',
    name: 'Noir de nuit',
    englishName: 'Black of Night',
    deck: 'villain',
    type: 'ingredient',
    cost: 1,
    copies: 2,
    text: "Vous pouvez effectuer une seconde fois l'une des actions de votre lieu, en dehors d'une action Fatalité.",
    image: img('noir-de-nuit.webp'),
    // « en dehors d'une action Fatalité » : la Fatalité n'est pas rejouable ici
    // (Carte Temps, elle, n'exclut aucune action).
    effects: [{ type: 'GRANT_REPEAT_ACTION', exceptFate: true }],
  },
  {
    id: 'poussiere-momie',
    name: 'Poussière de momie',
    englishName: 'Mummy Dust',
    deck: 'villain',
    type: 'ingredient',
    cost: 1,
    copies: 2,
    text: 'Jusqu’au début de votre prochain tour, chaque action Fatalité dont vous êtes la cible ajoute 1 jeton Pouvoir de la réserve à vos jetons Poison.',
    image: img('poussiere-momie.webp'),
    effects: [{ type: 'POISON_ON_FATE_TARGETED' }],
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Conditions
  // ----------------------------------------------------------------------
  {
    id: 'jalousie',
    name: 'Jalousie',
    englishName: 'Jealousy',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Jouable pendant le tour d’un adversaire s’il gagne au moins 3 jetons Pouvoir. Ajoutez 1 jeton Pouvoir de la réserve à vos jetons Poison.',
    image: img('jalousie.webp'),
    trigger: { type: 'opponent-gained-power-ge', value: 3 },
    effects: [{ type: 'GAIN_POISON', amount: 1 }],
  },
  {
    id: 'vanite',
    name: 'Vanité',
    englishName: 'Vanity',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Jouable pendant le tour d’un adversaire s’il possède au moins 2 Objets dans son royaume. Dévoilez les 3 premières cartes de votre pioche : défaussez-en autant que vous voulez et replacez les autres sur le dessus dans l’ordre de votre choix.',
    image: img('vanite.webp'),
    trigger: { type: 'opponent-items-in-realm-ge', value: 2 },
    effects: [{ type: 'SCRY_OWN_DECK', count: 3 }],
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Allié
  // ----------------------------------------------------------------------
  {
    id: 'chasseur',
    name: 'Chasseur',
    englishName: 'The Huntsman',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 4,
    copies: 1,
    text: 'La force des Héros sur le lieu du Chasseur est réduite de 1. Vous pouvez déplacer le Chasseur vers un lieu non bloqué.',
    image: img('chasseur.webp'),
    strengthMod: { target: 'heroes-here', delta: -1 },
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Objets
  // ----------------------------------------------------------------------
  {
    id: 'trone',
    name: 'Trône',
    englishName: 'Throne',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    text: 'Ajoutez 1 jeton Pouvoir de la réserve à vos jetons Poison.',
    image: img('trone.webp'),
    activatedCost: 0,
  },
  {
    id: 'ecrin',
    name: 'Écrin',
    englishName: 'The Box',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 1,
    text: 'Gagnez 1 jeton Pouvoir par Héros dans la défausse de cartes Fatalité (max. 3 jetons).',
    image: img('ecrin.webp'),
    activatedCost: 0,
  },
  {
    id: 'grimoires-magiques',
    name: 'Grimoires magiques',
    englishName: 'Magic Tomes',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 2,
    text: 'Regardez les 4 premières cartes de votre pioche. Ajoutez-en une à votre main et défaussez les autres.',
    image: img('grimoires-magiques.webp'),
    activatedCost: 0,
  },
  {
    id: 'miroir-magique',
    name: 'Miroir magique',
    englishName: 'Magic Mirror',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 1,
    text: 'Piochez une carte chaque fois que vous êtes la cible d’une action Fatalité. Activer (payez 3 Pouvoir) : trouvez Blanche-Neige et jouez-la.',
    image: img('miroir-magique.webp'),
    activatedCost: 3,
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événements
  // ----------------------------------------------------------------------
  {
    id: 'animaux-foret',
    name: 'Animaux de la forêt',
    englishName: 'Forest Animals',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'La Méchante Reine révèle sa main : choisissez-y une carte et défaussez-la.',
    image: img('animaux-foret.webp'),
    effects: [{ type: 'DISCARD_FROM_TARGET_HAND' }],
  },
  {
    id: 'premier-baiser',
    name: "Premier baiser d'amour",
    englishName: "True Love's First Kiss",
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Défaussez 1 jeton Poison, puis choisissez un Héros dans la défausse et placez-le sur le dessus de la pioche de cartes Fatalité.',
    image: img('premier-baiser.webp'),
    effects: [{ type: 'LOVES_FIRST_KISS' }],
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Objets
  // ----------------------------------------------------------------------
  {
    id: 'pioche',
    name: 'Pioche',
    englishName: 'Pick',
    deck: 'fate',
    type: 'item',
    copies: 2,
    text: 'Associez cette carte à un Héros : sa force augmente de 2.',
    image: img('pioche.webp'),
    attach: 'hero',
    attachStrengthBonus: 2,
  },
  {
    id: 'puits-souhaits',
    name: 'Puits aux souhaits',
    englishName: 'Wishing Well',
    deck: 'fate',
    type: 'item',
    copies: 1,
    text: 'Associez le puits à un Héros. La Méchante Reine perd 1 jeton Poison chaque fois qu’elle se déplace sur le lieu où il se trouve.',
    image: img('puits-souhaits.webp'),
    attach: 'hero',
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros (les 7 Nains + Blanche-Neige)
  // ----------------------------------------------------------------------
  {
    id: 'blanche-neige',
    name: 'Blanche-Neige',
    englishName: 'Snow White',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text: 'Jouée immédiatement à la Maison des Nains (verrouillée ou non) dès qu’elle est dévoilée. Sa force augmente de 1 pour chaque autre Héros dans le royaume.',
    image: img('blanche-neige.webp'),
    selfStrengthMods: [{ kind: 'per-other-hero-realm', delta: 1 }],
    forcedFateLocation: 'maison-des-nains',
  },
  {
    id: 'atchoum',
    name: 'Atchoum',
    englishName: 'Sneezy',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Vous pouvez défausser un Objet sur le lieu où vous jouez Atchoum.',
    image: img('atchoum.webp'),
    onPlace: [{ type: 'DISCARD_ITEM_AT_HOST', preferCardId: 'miroir-magique' }],
  },
  {
    id: 'dormeur',
    name: 'Dormeur',
    englishName: 'Sleepy',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Si Dormeur fait partie des deux cartes dévoilées lors d’une action Fatalité, vous pouvez les jouer toutes les deux.',
    image: img('dormeur.webp'),
    fatePlayBoth: true,
  },
  {
    id: 'grincheux',
    name: 'Grincheux',
    englishName: 'Grumpy',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'La force de Grincheux augmente de 1 s’il n’y a aucun autre Héros sur le lieu où il se trouve.',
    image: img('grincheux.webp'),
    selfStrengthMods: [{ kind: 'if-alone-here', delta: 1 }],
  },
  {
    id: 'joyeux',
    name: 'Joyeux',
    englishName: 'Happy',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Défaussez autant de jetons Poison que de Héros présents dans le royaume.',
    image: img('joyeux.webp'),
    onPlace: [{ type: 'DISCARD_POISON_PER_HERO_IN_REALM' }],
  },
  {
    id: 'prof',
    name: 'Prof',
    englishName: 'Doc',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'La Méchante Reine doit éliminer Prof avant les autres Héros.',
    image: img('prof.webp'),
    mustDefeatFirst: true,
  },
  {
    id: 'simplet',
    name: 'Simplet',
    englishName: 'Dopey',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'La force de tous les autres Héros augmente de 1.',
    image: img('simplet.webp'),
    strengthMod: { target: 'heroes-realm', delta: 1, excludeSelf: true },
  },
  {
    id: 'timide',
    name: 'Timide',
    englishName: 'Bashful',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'L’action « Préparer du Poison » coûte désormais 1 jeton Pouvoir.',
    image: img('timide.webp'),
  },
]

/** Index par cardId (pratique pour les tests et les fabriques d'exemplaires). */
export const mechanteReineCardById: Record<string, CardDef> = Object.fromEntries(
  mechanteReineCards.map((c) => [c.id, c]),
)
