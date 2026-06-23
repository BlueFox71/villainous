// =============================================================================
// Cartes de Lotso (Toy Story 3, Disney/Pixar).
// Deck Méchant : 30 cartes. Deck Fatalité : 15 cartes.
// La tuile BUZZ L'ÉCLAIR (2 faces : Gardien / Mode Démo) est HORS deck (copies: 0) :
// elle existe au registre pour le rendu, et est posée par createInitialGame
// (guardianSetup, cf. lotso.ts).
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/lotso/${f}`

export const lotsoCards: CardDef[] = [
  // ----------------------------------------------------------------- Alliés ---
  {
    id: 'big-baby',
    name: 'Big Baby',
    englishName: 'Big Baby',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 3,
    copies: 1,
    text:
      'Capacité activée : dévoilez les cartes de votre pioche Fatalité jusqu’à ce que vous trouviez un Héros, ' +
      'puis jouez-le sur n’importe quel lieu en dehors de la Salle des Chenilles. Défaussez les autres cartes dévoilées.',
    image: img('big-baby.png'),
    // Capacité ACTIVÉE (symbole Activer) : déclenchée par l'action « Activer une capacité »
    // (Bibliothèque), pas à la pose. Dispatchée par cardId dans applyActivateCore.
    activatedCost: 0,
  },
  {
    id: 'tchac',
    name: 'Tchac',
    englishName: 'Chunk',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 1,
    copies: 1,
    text: 'Si VULCAIN se trouve dans le royaume, la force de TCHAC augmente de 1.',
    image: img('tchac.png'),
    selfStrengthMods: [{ kind: 'if-card', cardId: 'vulcain', scope: 'realm', delta: 1 }],
  },
  {
    id: 'vulcain',
    name: 'Vulcain',
    englishName: 'Sparks',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 1,
    copies: 1,
    text: 'Si TWITCH se trouve dans le royaume, la force de VULCAIN augmente de 1.',
    image: img('vulcain.png'),
    selfStrengthMods: [{ kind: 'if-card', cardId: 'twitch', scope: 'realm', delta: 1 }],
  },
  {
    id: 'twitch',
    name: 'Twitch',
    englishName: 'Twitch',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 2,
    copies: 1,
    text: 'Si TCHAC se trouve dans le royaume, la force de TWITCH augmente de 1.',
    image: img('twitch.png'),
    selfStrengthMods: [{ kind: 'if-card', cardId: 'tchac', scope: 'realm', delta: 1 }],
  },
  {
    id: 'flex',
    name: 'Flex',
    englishName: 'Stretch',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    text: 'Capacité activée : déplacez un Héros ou un Gardien du lieu où se trouve Flex vers n’importe quel autre lieu.',
    image: img('flex.png'),
    // Capacité ACTIVÉE (action « Activer une capacité », Bibliothèque) : dispatchée par cardId
    // 'flex' dans applyActivateCore → pendingLotsoFlex (choix carte puis lieu).
    activatedCost: 0,
  },
  // ----------------------------------------------------------------- Objet ---
  {
    id: 'chapeau-de-woody',
    name: 'Chapeau de Woody',
    englishName: "Woody's Hat",
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 1,
    text: 'La force de tous les Héros, à l’exception de WOODY, est réduite de 1.',
    image: img('chapeau-de-woody.png'),
    strengthMod: { target: 'heroes-realm', delta: -1, exceptCardId: 'woody' },
  },
  // ------------------------------------------------------------- Événements ---
  {
    id: 'enfermes-lotso',
    name: 'Enfermés',
    englishName: 'Locked Up',
    deck: 'villain',
    type: 'effect',
    cost: 3,
    copies: 3,
    text: 'Ajoutez un jeton Force −1 sur tous les Héros présents sur la Salle des Chenilles.',
    image: img('enfermes.png'),
    effects: [{ type: 'LOTSO_REDUCE', scope: 'room', target: 'all', amount: 1 }],
  },
  {
    id: 'pas-l-age-minimum',
    name: 'Pas l’âge minimum requis',
    englishName: 'Not Age Appropriate',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 3,
    text: 'Déplacez un Héros ou la tuile BUZZ L’ÉCLAIR sur la Salle des Chenilles.',
    image: img('pas-l-age-minimum.png'),
    effects: [{ type: 'LOTSO_MOVE', scope: 'to-room', includeBuzz: true }],
  },
  {
    id: 'le-bibliothecaire',
    name: 'Le Bibliothécaire',
    englishName: 'The Bookworm',
    deck: 'villain',
    type: 'effect',
    // Coût VARIABLE : on ne paie rien à la pose ; chaque −1 de force coûte 1 jeton Pouvoir,
    // dépensé pendant la répartition interactive (LOTSO_BOOKWORM / pendingLotsoBookworm).
    cost: 0,
    copies: 3,
    text:
      'Dépensez autant de jetons Pouvoir que vous voulez. Pour chaque jeton dépensé, ajoutez un jeton ' +
      'Force −1 à un Héros de votre choix (vous pouvez répartir ces jetons entre plusieurs Héros).',
    image: img('le-bibliothecaire.png'),
    effects: [{ type: 'LOTSO_BOOKWORM' }],
  },
  {
    id: 'bienvenue-a-sunnyside',
    name: 'Bienvenue à Sunnyside',
    englishName: 'Welcome to Sunnyside',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 3,
    text:
      'Dévoilez les cartes de votre pioche Fatalité jusqu’à trouver un Héros, puis jouez-le sur la Salle ' +
      'des Chenilles. Défaussez les autres cartes dévoilées.',
    image: img('bienvenue-a-sunnyside.png'),
    effects: [{ type: 'LOTSO_REVEAL_HERO', atRoom: true }],
  },
  {
    id: 'patrouille-de-nuit',
    name: 'Patrouille de nuit',
    englishName: 'Patrolling All Night Long',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Choisissez un Héros se trouvant en dehors de la Salle des Chenilles, puis ajoutez-lui un jeton Force −1.',
    image: img('patrouille-de-nuit.png'),
    effects: [{ type: 'LOTSO_REDUCE', scope: 'not-room', target: 'one', amount: 1 }],
  },
  {
    id: 'reglages-usine',
    name: 'Réinitialisation',
    englishName: 'Original Factory Settings',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text:
      'Ajoutez un jeton Force −1 sur les Héros. Retournez la tuile BUZZ L’ÉCLAIR sur sa face MODE DÉMO et ' +
      'déplacez-le vers un lieu de la partie inférieure de votre royaume.',
    image: img('reinitialisation.png'),
    effects: [
      { type: 'LOTSO_REDUCE', scope: 'all', target: 'all', amount: 1 },
      { type: 'LOTSO_FLIP_BUZZ', to: 'demo', moveTo: 'bottom' },
    ],
  },
  {
    id: 'nouveaux-jouets',
    name: 'Les nouveaux jouets n’ont pas la moindre chance',
    englishName: "New Toys Don't Stand a Chance",
    deck: 'villain',
    type: 'effect',
    cost: 4,
    copies: 1,
    text:
      'À l’aide de jetons Force, réduisez la force de tous les Héros présents sur la Salle des Chenilles du ' +
      'nombre de Héros qui s’y trouvent.',
    image: img('nouveaux-jouets.png'),
    effects: [{ type: 'LOTSO_REDUCE', scope: 'room', target: 'all', byRoomCount: true }],
  },
  // -------------------------------------------------------------- Conditions ---
  {
    id: 'quelque-chose-se-brisa',
    name: 'Quelque chose se brisa',
    englishName: 'Something Snapped',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 3,
    text:
      'Jouable pendant le tour d’un adversaire s’il défausse au moins une carte. Déplacez tous les Héros sur ' +
      'la Salle des Chenilles.',
    image: img('quelque-chose-se-brisa.png'),
    trigger: { type: 'opponent-discarded-ge', value: 1 },
    effects: [{ type: 'LOTSO_MOVE', scope: 'all-to-room' }],
  },
  {
    id: 'parfume-a-la-fraise',
    name: 'Parfumé à la fraise',
    englishName: 'Smells Like Strawberries',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text:
      'Jouable pendant le tour d’un adversaire s’il gagne des jetons Pouvoir. Mélangez votre défausse et ' +
      'votre pioche.',
    image: img('parfume-a-la-fraise.png'),
    trigger: { type: 'opponent-gained-power-ge', value: 1 },
    effects: [{ type: 'RESHUFFLE_DISCARD_AND_DRAW', count: 0 }],
  },
  {
    id: 'bien-le-bonjour',
    name: 'Bien le bonjour à ton enfant !',
    englishName: "Where's Your Kid Now?",
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text:
      'Jouable pendant le tour d’un adversaire s’il élimine un Héros de force 2 ou plus. Ajoutez des jetons ' +
      'Force −1 à un Héros présent sur le lieu de votre figurine, jusqu’à réduire sa force à 0.',
    image: img('bien-le-bonjour.png'),
    trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 2 },
    effects: [{ type: 'LOTSO_REDUCE', scope: 'at-pawn', target: 'one', toZero: true }],
  },

  // ========================================================= Tuile Gardien Buzz =
  // Hors deck (copies: 0) : posée par createInitialGame (guardianSetup).
  {
    id: 'buzz-l-eclair',
    name: 'Buzz l’Éclair',
    englishName: 'Buzz Lightyear',
    deck: 'villain',
    type: 'ally',
    strength: 4,
    copies: 0,
    text:
      'BUZZ L’ÉCLAIR et les Héros qui se trouvent sur ce lieu ne peuvent pas être la cible d’une action ' +
      'Éliminer un Héros.',
    image: img('buzz-l-eclair.png'),
  },
  {
    id: 'buzz-mode-demo',
    name: 'Buzz l’Éclair en mode démo',
    englishName: 'Demo Mode Buzz Lightyear',
    deck: 'villain',
    type: 'ally',
    strength: 1,
    copies: 0,
    text:
      'Ne peut participer à une action Éliminer un Héros que si un autre Allié y participe aussi. Le Héros ' +
      'ainsi éliminé voit sa force réduite à 0 et est placé sur la Salle des Chenilles. N’est pas défaussé ' +
      'lorsqu’il est utilisé pour éliminer un Héros.',
    image: img('buzz-mode-demo.png'),
  },

  // ============================================================ Fatalité (15) =
  {
    id: 'rex',
    name: 'Rex',
    englishName: 'Rex',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text:
      'Tant qu’il se trouve sur le même lieu qu’un autre Héros, REX ne peut pas être la cible d’une action ' +
      'Éliminer un Héros et sa force ne peut pas être réduite par des jetons Force −1.',
    image: img('rex.png'),
    protectedWithOtherHero: true,
  },
  {
    id: 'woody',
    name: 'Woody',
    englishName: 'Woody',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text:
      'Si le CHAPEAU DE WOODY se trouve dans le royaume, défaussez-le. Puis vous pouvez déplacer les Héros ' +
      'présents sur la Salle des Chenilles vers n’importe quels lieux.',
    image: img('woody.png'),
    onPlace: [{ type: 'WOODY_RELEASE' }],
  },
  {
    id: 'bayonne',
    name: 'Bayonne',
    englishName: 'Hamm',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Lotso doit utiliser au moins 2 Alliés pour éliminer BAYONNE.',
    image: img('bayonne.png'),
    minAlliesToVanquish: 2,
  },
  {
    id: 'jessie',
    name: 'Jessie',
    englishName: 'Jessie',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Vous pouvez défausser un Allié.',
    image: img('jessie.png'),
    onPlace: [{ type: 'LOTSO_FATE_DISCARD_ALLY' }],
  },
  {
    id: 'medaillon-de-daisy',
    name: 'Médaillon de Daisy',
    englishName: "Daisy's Locket",
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Si BIG BABY est dans le royaume, défaussez-le. Puis mélangez la défausse et la pioche de cartes Fatalité.',
    image: img('medaillon-de-daisy.png'),
    effects: [{ type: 'DAISY_LOCKET' }],
  },
  {
    id: 'andy-nous-cherche',
    name: 'Andy nous cherche',
    englishName: "Andy's Looking For Us",
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Ajoutez deux jetons Force +1 à tous les Héros dont la force n’a pas été réduite à 0.',
    image: img('andy-nous-cherche.png'),
    effects: [{ type: 'LOTSO_BOOST_NONZERO', amount: 2 }],
  },
  {
    id: 'lotso-etait-son-prefere',
    name: 'Lotso était son préféré',
    englishName: 'Lotso Was Special',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Défaussez un Allié.',
    image: img('lotso-etait-son-prefere.png'),
    effects: [{ type: 'LOTSO_FATE_DISCARD_ALLY' }],
  },
  {
    id: 'jouets-de-bonnie',
    name: 'Jouets de Bonnie',
    englishName: "Bonnie's Toys",
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Retirez tous les jetons Force de valeur négative d’un Héros.',
    image: img('jouets-de-bonnie.png'),
    effects: [{ type: 'LOTSO_RESTORE_HERO' }],
  },
  {
    id: 'un-seul-moyen-de-sortir',
    name: 'Un seul moyen de sortir',
    englishName: 'One Way Out',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Déplacez un Héros de la Salle des Chenilles vers n’importe quel lieu.',
    image: img('un-seul-moyen-de-sortir.png'),
    effects: [{ type: 'LOTSO_MOVE', scope: 'from-room' }],
  },
  {
    id: 'le-grappin',
    name: 'Le Grappin',
    englishName: 'The Claw',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Défaussez un Héros de force 0, puis mélangez la défausse et la pioche de cartes Fatalité.',
    image: img('le-grappin.png'),
    effects: [{ type: 'LOTSO_DISCARD_ZERO_HERO' }],
  },
  {
    id: 'mode-espagnol',
    name: 'Mode espagnol',
    englishName: 'Spanish Mode',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text:
      'Retournez BUZZ L’ÉCLAIR sur sa face Gardien et déplacez-le dans la partie supérieure de la Cour de ' +
      'Récréation. Si JESSIE est dans le royaume, ajoutez un jeton Force +1 à cette dernière.',
    image: img('mode-espagnol.png'),
    effects: [{ type: 'LOTSO_FLIP_BUZZ', to: 'guardian', moveTo: 'cour-top' }],
  },
]
