// =============================================================================
// La Bonne Fée (Marraine de Shrek) — cartes (deck Méchant : 30 ; Fatalité : 15).
//
// Vilain fan-made (créateur : Jules). Noms / coûts / forces / textes tirés du
// tableur « Villainous Template_Jules.ods » (onglet La_bonne_fée) ; illustrations
// découpées depuis assets/decks/Maraine la bonne fée/générées/. Le TEXTE français
// est la source de vérité.
//
// MÉCANIQUE : son paquet Fatalité contient les héros de l'univers Shrek, posés sur
// SON royaume. OBJECTIF : amener FIONA en Salle de Bal avec ses 2 potions (Filtre
// d'amour + Heureux pour toujours) et le PRINCE CHARMANT, puis activer « Embrasse-la
// tout de suite ! » → victoire. SHREK, tant qu'il est présent, interdit la victoire.
// Pas d'action Vaincre : elle neutralise les Héros en les TRANSFORMANT (Meuble /
// Colombe → force 0) puis en les défaussant (« Nettoyage de fond »).
//
// ÉTAT (phase 1) : données + plateau + câblage. Seuls les effets triviaux et déjà
// gérés sont posés (gagner/perdre du Pouvoir, playWhenRevealed de Fiona, attach des
// Objets). La mécanique inédite (transformation→0, défausse des transformés, victoire
// par activation, Conditions tour-adverse, recherche de potions…) arrive aux phases
// suivantes — ces cartes restent pour l'instant en TEXTE seul.
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/la-bonne-fee/${f}`

export const laBonneFeeCards: CardDef[] = [
  // ==========================================================================
  // DECK MÉCHANT (30)
  // ==========================================================================

  // --- Allié ----------------------------------------------------------------
  {
    id: 'prince',
    name: 'Prince Charmant',
    englishName: 'Prince Charming',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 3,
    copies: 1,
    activatedCost: 0,
    activatedEffects: [{ type: 'GAIN_POWER', amount: 2 }],
    text: 'Activer : Gagnez 2 Jetons Pouvoir.',
    image: img('prince.png'),
  },

  // --- Objets : transformations (force de l'hôte → 0) -----------------------
  {
    id: 'meuble',
    name: 'Héros en Meuble !',
    englishName: 'Hero into Furniture',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 3,
    attach: 'hero',
    zeroesHostStrength: true,
    text: 'Associez cette carte à un Héros, sa force est à 0.',
    image: img('meuble.png'),
  },
  {
    id: 'colombe',
    name: 'Héros en Colombe !',
    englishName: 'Hero into Dove',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 3,
    attach: 'hero',
    zeroesHostStrength: true,
    text: 'Associez cette carte à un Héros, sa force est à 0.',
    image: img('colombe.png'),
  },

  // --- Objets : potions -----------------------------------------------------
  {
    id: 'filtre',
    name: 'Potion « Filtre d\'amour »',
    englishName: 'Love Potion',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    attach: 'hero',
    isPotion: true,
    text: 'Associez cet Objet à un Héros.',
    image: img('filtre.png'),
  },
  {
    id: 'heureux',
    name: 'Potion « Heureux pour toujours »',
    englishName: 'Happily Ever After Potion',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    attach: 'hero',
    isPotion: true,
    text: 'Associez cet Objet à un Héros.',
    image: img('heureux.png'),
  },

  // --- Objets : divers -------------------------------------------------------
  {
    id: 'baguette',
    name: 'Baguette Magique',
    englishName: 'Magic Wand',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    text: 'Les cartes Objets coûtent 1 jeton Pouvoir de moins lorsque vous vous trouvez sur le même lieu que la BAGUETTE MAGIQUE.',
    image: img('baguette.png'),
  },
  {
    id: 'reserve',
    name: 'Réserve de potions',
    englishName: 'Potion Reserve',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    activatedCost: 2,
    activatedEffects: [{ type: 'FETCH_POTION' }],
    text: 'Activer (payez 2 Jetons Pouvoir) : cherchez une Potion dans la pioche ou dans la défausse et ajoutez-la à votre main.',
    image: img('reserve.png'),
  },
  {
    id: 'embrasser',
    name: 'Embrasse-la tout de suite !',
    englishName: 'Kiss Her Now!',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    activatedCost: 0,
    text: 'Cette carte peut être activée uniquement si le PRINCE CHARMANT et FIONA (avec ses 2 potions) sont présents dans la Salle de Bal. Activez cette carte pour gagner la partie !',
    image: img('embrasser.png'),
  },
  {
    id: 'rangement',
    name: 'Nettoyage de fond',
    englishName: 'Deep Cleaning',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 2,
    activatedCost: 1,
    activatedEffects: [{ type: 'DISCARD_TRANSFORMED_HEROES' }],
    text: 'Activer (payez 1 Jeton Pouvoir) : défaussez les Héros transformés en meuble ou en colombe.',
    image: img('rangement.png'),
  },
  {
    id: 'contes',
    name: 'Les contes de fée',
    englishName: 'Fairy Tales',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 2,
    activatedCost: 1,
    activatedEffects: [
      { type: 'RECOVER_FROM_DISCARD_CHOICE', types: ['item', 'effect'], label: 'Les contes de fée' },
    ],
    text: 'Activer (payez 1 Jeton Pouvoir) : cherchez un Objet ou un Événement dans votre défausse et ajoutez-le à votre main.',
    image: img('contes.png'),
  },

  // --- Événements -----------------------------------------------------------
  {
    id: 'chanson',
    name: 'Une petite chanson !',
    englishName: 'A Little Song',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 4,
    effects: [{ type: 'REVEAL_OWN_FATE_PLAY_HERO' }],
    text: 'Dévoilez les cartes Fatalité jusqu\'à ce que vous trouviez un Héros. Jouez-le et défaussez les autres cartes dévoilées.',
    image: img('chanson.png'),
  },
  {
    id: 'as',
    name: 'Plein aux As',
    englishName: 'Flush of Aces',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 2,
    effects: [{ type: 'GAIN_POWER', amount: 3 }],
    text: 'Gagnez 3 Jetons Pouvoir.',
    image: img('as.png'),
  },
  {
    id: 'eliminer',
    name: 'Disparition !',
    englishName: 'Disappearance!',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    effects: [{ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 3 }],
    text: 'Éliminez un Héros de force 3 ou moins.',
    image: img('eliminer.png'),
  },
  {
    id: 'blocage',
    name: 'Blocage',
    englishName: 'Blockade',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    effects: [{ type: 'RELOCATE_OWN_HERO' }],
    text: 'Déplacez un Héros d\'un lieu.',
    image: img('blocage.png'),
  },

  // --- Conditions (jouables pendant le tour d'un adversaire) -----------------
  {
    id: 'fastfood',
    name: 'Fast-Food',
    englishName: 'Fast Food',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 1,
    trigger: { type: 'opponent-items-in-realm-ge', value: 2 },
    effects: [{ type: 'GAIN_POWER', amount: 3 }],
    text: 'Cette carte est jouable pendant le tour d\'un adversaire s\'il possède au moins 2 Objets. Gagnez 3 jetons Pouvoir.',
    image: img('fastfood.png'),
  },
  {
    id: 'ocre',
    name: 'Il n\'y a pas d\'ogre !',
    englishName: 'There Are No Ogres!',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 1,
    trigger: { type: 'opponent-vanquished-hero-strength-le', value: 3 },
    effects: [{ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 3 }],
    text: 'Cette carte est jouable pendant le tour d\'un adversaire s\'il élimine un Héros de force 3 ou moins. Éliminez un Héros de force 3 ou moins.',
    image: img('ocre.png'),
  },
  {
    id: 'observation-fee',
    name: 'Observation',
    englishName: 'Observation',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    trigger: { type: 'opponent-discarded-ge', value: 3 },
    effects: [{ type: 'REVEAL_OWN_FATE_PLAY_HERO' }],
    text: 'Cette carte est jouable pendant le tour d\'un adversaire s\'il défausse au moins 3 cartes. Dévoilez votre première carte Fatalité et jouez-la.',
    image: img('observation-fee.png'),
  },

  // ==========================================================================
  // DECK FATALITÉ (15)
  // ==========================================================================

  // --- Héros ----------------------------------------------------------------
  {
    id: 'shrek',
    name: 'Shrek',
    englishName: 'Shrek',
    deck: 'fate',
    type: 'hero',
    strength: 5,
    copies: 1,
    text: 'Tant que SHREK est présent dans le royaume, vous ne pouvez pas atteindre votre Objectif.',
    image: img('shrek.png'),
  },
  {
    id: 'fiona',
    name: 'Fiona',
    englishName: 'Fiona',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    playWhenRevealed: true,
    text: 'Vous devez immédiatement jouer FIONA dès qu\'elle est dévoilée. Défaussez les autres cartes Fatalité qui ont été dévoilées.',
    image: img('fiona.png'),
  },
  {
    id: 'ane',
    name: 'L\'Âne',
    englishName: 'Donkey',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    activateCostSurchargeHere: 1,
    text: 'Activer la capacité des Objets ou des Alliés sur le lieu où se trouve l\'ÂNE coûte 1 jeton Pouvoir de plus.',
    image: img('ane.png'),
  },
  {
    id: 'chat',
    name: 'Le Chat Potté',
    englishName: 'Puss in Boots',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    onPlace: [{ type: 'LOSE_POWER', amount: 2 }],
    text: 'Perdez 2 jetons Pouvoir.',
    image: img('chat.png'),
  },
  {
    id: 'parents',
    name: 'Harold & Lillian',
    englishName: 'Harold & Lillian',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    blocksAllItemsHere: true,
    text: 'Les Objets ne peuvent pas être joués ou déplacés sur le lieu où se trouvent HAROLD et LILLIAN.',
    image: img('parents.png'),
  },
  {
    id: 'creatures',
    name: 'Les créatures enchantées',
    englishName: 'Enchanted Creatures',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    onPlace: [{ type: 'LOSE_POWER', amount: 1 }],
    text: 'Perdez 1 Jeton Pouvoir.',
    image: img('creatures.png'),
  },

  // --- Objet (Fatalité) -----------------------------------------------------
  {
    id: 'humain',
    name: 'Humainement beau',
    englishName: 'Handsomely Human',
    deck: 'fate',
    type: 'item',
    copies: 2,
    attach: 'hero',
    protectsHostFromCardIds: ['meuble'],
    text: 'Associez cette carte à un Héros, la Bonne Fée ne peut plus lui associer la carte « Héros en Meuble ! ».',
    image: img('humain.png'),
  },

  // --- Événements (Fatalité) ------------------------------------------------
  {
    id: 'beaute',
    name: 'Incarnation de la beauté',
    englishName: 'Beauty Incarnate',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    effects: [{ type: 'FATE_PLAY_HERO_FROM_DISCARD' }],
    text: 'Choisissez un Héros dans la défausse de cartes Fatalité et jouez-le.',
    image: img('beaute.png'),
  },
  {
    id: 'doris',
    name: 'L\'Affreuse Belle-Sœur ? Ah !',
    englishName: 'Doris, the Ugly Stepsister',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    effects: [{ type: 'LOSE_POWER', amount: 2 }],
    text: 'Perdez 2 jetons Pouvoir.',
    image: img('doris.png'),
  },
  {
    id: 'infiltration',
    name: 'Infiltration',
    englishName: 'Infiltration',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    effects: [{ type: 'DISCARD_ONE_OR_LOSE', lose: 3 }],
    text: 'La Bonne Fée doit choisir de défausser une de ses cartes OU de perdre 3 jetons.',
    image: img('infiltration.png'),
  },
  {
    id: 'tasses',
    name: 'Tasses rééchangées',
    englishName: 'Switched Cups',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    effects: [{ type: 'RELOCATE_OWN_HERO' }],
    text: 'Déplacez un Héros d\'un lieu.',
    image: img('tasses.png'),
  },
  {
    id: 'arrive',
    name: 'On est presque arrivé ?',
    englishName: 'Are We There Yet?',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    effects: [{ type: 'CAP_SELF_NEXT_TURN', actions: 2 }],
    text: 'La Bonne Fée ne pourra jouer que 2 actions à son prochain tour.',
    image: img('arrive.png'),
  },
]
