// =============================================================================
// Cartes de Syndrome (Les Indestructibles, Disney/Pixar).
// Deck Méchant : 30 cartes. Deck Fatalité : 15 cartes.
// Les tuiles Omnidroïde (v.X8/v.X9/v.10) sont HORS deck (copies: 0) : elles
// existent dans le registre pour le rendu, mais sont posées par createInitialGame
// via `omnidroidSetup` (cf. syndrome.ts).
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/syndrome/${f}`

export const syndromeCards: CardDef[] = [
  // ----------------------------------------------------------------- Alliés ---
  {
    id: 'mirage',
    name: 'Mirage',
    englishName: 'Mirage',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 2,
    copies: 1,
    text:
      'Dévoilez les cartes de votre pioche Fatalité jusqu’à ce que vous trouviez un Héros, ' +
      'puis jouez-le sur le même lieu que Mirage. Défaussez toutes les autres cartes dévoilées.',
    image: img('mirage.webp'),
    effects: [{ type: 'REVEAL_FATE_HERO_AT_PAWN' }],
  },
  {
    id: 'securite',
    name: 'Sécurité',
    englishName: 'Security Guard',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 2,
    copies: 2,
    text: 'Aucune capacité.',
    image: img('securite.webp'),
  },
  {
    id: 'gardes',
    name: 'Gardes',
    englishName: 'Guards',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 1,
    copies: 3,
    text: 'La force des cartes GARDES augmente de 1 pour chaque autre Allié sur le même lieu qu’elles.',
    image: img('gardes.webp'),
    selfStrengthMods: [{ kind: 'per-other-type-here', cardType: 'ally', delta: 1 }],
  },
  {
    id: 'patrouille-en-velocipode',
    name: 'Patrouille en Vélocipode',
    englishName: 'Velocipod Patrol',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 3,
    text:
      'Lors d’une action Éliminer un Héros, la PATROUILLE EN VÉLOCIPODE peut être utilisée pour ' +
      'éliminer un Héros sur son lieu ou un lieu voisin.',
    image: img('patrouille-en-velocipode.webp'),
    reachesAdjacentVanquish: true,
  },
  // ----------------------------------------------------------------- Objets ---
  {
    id: 'telecommande-de-syndrome',
    name: 'Télécommande de Syndrome',
    englishName: "Syndrome's Remote",
    deck: 'villain',
    type: 'item',
    cost: 0,
    copies: 1,
    text:
      'Ce lieu gagne l’action : Activer. Cette carte n’est activable que si votre figurine et ' +
      'l’OMNIDROÏDE v.10 se trouvent sur ce lieu. Activez cette carte pour défausser l’OMNIDROÏDE v.10.',
    image: img('telecommande-de-syndrome.webp'),
    activatedCost: 0,
    grantsAction: { type: 'ACTIVATE', label: 'Activer (Télécommande)' },
    // Compte comme Objet pour les conditions adverses, mais immunisée aux effets visant
    // les Alliés/Objets (défausser/déplacer) — comme l'Omnidroïde.
    alsoItem: true,
    immuneToAllyItemEffects: true,
  },
  {
    id: 'modification-majeure',
    name: 'Modification Majeure',
    englishName: 'Major Modification',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 4,
    text: 'Aucune capacité. (Défaussée pour faire évoluer l’Omnidroïde.)',
    image: img('modification-majeure.webp'),
  },
  {
    id: 'energie-au-point-zero',
    name: 'Énergie au Point Zéro',
    englishName: 'Zero Point Energy',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 2,
    attach: 'hero',
    attachStrengthBonus: -2,
    immobilizesHostHero: true,
    text: 'Associez cette carte à un Héros : sa force est réduite de 2 et il ne peut plus être déplacé.',
    image: img('energie-au-point-zero.webp'),
  },
  // ------------------------------------------------------------- Événements ---
  {
    id: 'identification-je-vous-prie',
    name: 'Identification, je vous prie',
    englishName: 'Identification Please',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Déplacez un Allié ou un Objet sur n’importe quel lieu où se trouve au moins un Héros.',
    image: img('identification-je-vous-prie.webp'),
    effects: [{ type: 'MOVE_ALLY_OR_ITEM_TO_HERO_LOCATION' }],
  },
  {
    id: 'unite-de-confinement',
    name: 'Unité de Confinement',
    englishName: 'Containment Unit',
    deck: 'villain',
    type: 'effect',
    cost: 4,
    copies: 2,
    text: 'Réduisez la force d’un Héros à 0 à l’aide de jetons Force.',
    image: img('unite-de-confinement.webp'),
    effects: [{ type: 'REDUCE_HERO_FORCE_TO_ZERO' }],
  },
  // -------------------------------------------------------------- Conditions ---
  {
    id: 'qui-est-le-plus-super',
    name: 'Qui est le plus super ?',
    englishName: "Who's Super Now?",
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text:
      'Jouable pendant le tour d’un adversaire s’il joue une carte. Gagnez autant de jetons ' +
      'Pouvoir que le coût de la carte jouée par cet adversaire.',
    image: img('qui-est-le-plus-super.webp'),
    trigger: { type: 'opponent-played-cards-ge', value: 1 },
    effects: [{ type: 'GAIN_POWER_EQUAL_LAST_PLAYED_COST' }],
  },
  {
    id: 'sonde-bio',
    name: 'Sonde Bio',
    englishName: 'Bio Probe',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text:
      'Jouable pendant le tour d’un adversaire s’il élimine un Héros. Éliminez un Héros de force ' +
      'égale ou inférieure à celui éliminé.',
    image: img('sonde-bio.webp'),
    trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 0 },
    effects: [{ type: 'DEFEAT_REALM_HERO_AUTO', useLastVanquishStrength: true }],
  },
  {
    id: '15-ans-plus-tard',
    name: '15 ans plus tard',
    englishName: '15 Years Later',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 3,
    text:
      'Jouable pendant le tour d’un adversaire s’il gagne des jetons Pouvoir. Dévoilez les cartes de ' +
      'votre pioche Fatalité jusqu’à ce que vous trouviez un Héros, jouez-le sur le lieu de votre choix ' +
      'et réduisez sa force de 2. Défaussez les autres cartes dévoilées.',
    image: img('15-ans-plus-tard.webp'),
    trigger: { type: 'opponent-gained-power-ge', value: 1 },
    effects: [{ type: 'REVEAL_FATE_HERO_CHOOSE_LOC', weakenBy: 2 }],
  },
  {
    id: 'je-travaille-en-solo',
    name: 'Je travaille en solo',
    englishName: 'I Work Alone',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 3,
    text:
      'Jouable pendant le tour d’un adversaire s’il défausse au moins une carte. Piochez autant de ' +
      'cartes que le nombre de cartes défaussées par cet adversaire.',
    image: img('je-travaille-en-solo.webp'),
    trigger: { type: 'opponent-discarded-ge', value: 1 },
    effects: [{ type: 'DRAW_PER_OPPONENT_DISCARD' }],
  },

  // ====================================================== Tuiles Omnidroïde ===
  // Hors deck (copies: 0) : posées par createInitialGame via omnidroidSetup.
  {
    id: 'omnidroide-v-x8',
    name: 'Omnidroïde v.X8',
    englishName: 'Omnidroid v.X8',
    deck: 'villain',
    type: 'ally',
    strength: 5,
    copies: 0,
    text:
      'Lorsqu’il participe à une action Éliminer un Héros, retirez l’OMNIDROÏDE v.X8 de votre ' +
      'royaume, puis mélangez votre défausse et votre pioche.',
    image: img('omnidroide-v-x8.webp'),
  },
  {
    id: 'omnidroide-v-x9',
    name: 'Omnidroïde v.X9',
    englishName: 'Omnidroid v.X9',
    deck: 'villain',
    type: 'ally',
    strength: 6,
    copies: 0,
    text:
      'Vous devez défausser une MODIFICATION MAJEURE de votre royaume pour jouer l’OMNIDROÏDE v.X9 ' +
      'sur n’importe quel lieu. Lorsqu’il participe à une action Éliminer un Héros, retirez-le, puis ' +
      'cherchez la TÉLÉCOMMANDE DE SYNDROME et ajoutez-la à votre main.',
    image: img('omnidroide-v-x9.webp'),
  },
  {
    id: 'omnidroide-v-x10',
    name: 'Omnidroïde v.10',
    englishName: 'Omnidroid v.10',
    deck: 'villain',
    type: 'ally',
    strength: 7,
    copies: 0,
    text:
      'Vous devez défausser 3 MODIFICATIONS MAJEURES pour jouer l’OMNIDROÏDE v.10 sur Métroville. ' +
      'Il n’est PAS défaussé lorsqu’il participe à une action Éliminer un Héros.',
    image: img('omnidroide-v-x10.webp'),
  },
  {
    // Face « dos » de l'Omnidroïde v.10 : reste sur Métroville après l'activation de la
    // Télécommande (l'Omnidroïde est RETOURNÉ, pas défaussé). Hors deck (copies: 0).
    id: 'omnidroide-v-x10-detruit',
    name: 'Omnidroïde v.10 détruit',
    englishName: 'Omnidroid v.10 (Destroyed)',
    deck: 'villain',
    type: 'ally',
    copies: 0,
    text:
      'L’OMNIDROÏDE v.10 est actuellement éliminé. Si aucun Héros ne se trouve dans votre royaume, ' +
      'vous gagnez la partie.',
    image: img('omnidroide-v-x10-detruit.webp'),
  },

  // ============================================================ Fatalité (15) =
  {
    id: 'm-indestructible',
    name: 'M. Indestructible',
    englishName: 'Mr. Incredible',
    deck: 'fate',
    type: 'hero',
    strength: 6,
    copies: 1,
    text:
      'Si la TÉLÉCOMMANDE DE SYNDROME est dans le royaume, associez-la à cette carte. La force de ' +
      'M. INDESTRUCTIBLE augmente de 1 pour chaque autre Héros sur le même lieu que lui.',
    image: img('m-indestructible.webp'),
    selfStrengthMods: [{ kind: 'per-other-hero-here', delta: 1 }],
    onPlace: [{ type: 'ATTACH_REMOTE_IF_IN_REALM' }],
  },
  {
    id: 'jack-jack',
    name: 'Jack-Jack',
    englishName: 'Jack-Jack',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text:
      'À l’aide de jetons Force, augmentez la force de JACK-JACK jusqu’à ce qu’elle soit égale à ' +
      'celle du Héros le plus fort sur le même lieu.',
    image: img('jack-jack.webp'),
    selfStrengthMods: [{ kind: 'match-strongest-hero-here' }],
  },
  {
    id: 'frozone',
    name: 'Frozone',
    englishName: 'Frozone',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text:
      'Si la TÉLÉCOMMANDE DE SYNDROME est dans le royaume, associez-la à cette carte. Les Alliés ne ' +
      'peuvent pas quitter le lieu où se trouve FROZONE.',
    image: img('frozone.webp'),
    blocksAllyMovesHere: true,
    onPlace: [{ type: 'ATTACH_REMOTE_IF_IN_REALM' }],
  },
  {
    id: 'violette',
    name: 'Violette',
    englishName: 'Violet',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text:
      'Si la TÉLÉCOMMANDE DE SYNDROME est dans le royaume, associez-la à cette carte. Défaussez ' +
      'toutes les cartes ÉNERGIE AU POINT ZÉRO.',
    image: img('violette.webp'),
    onPlace: [
      { type: 'ATTACH_REMOTE_IF_IN_REALM' },
      { type: 'DISCARD_ALL_OF_CARDID_IN_REALM', cardId: 'energie-au-point-zero' },
    ],
  },
  {
    id: 'fleche',
    name: 'Flèche',
    englishName: 'Dash',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text:
      'Si la TÉLÉCOMMANDE DE SYNDROME est dans le royaume, associez-la à cette carte. Vous pouvez ' +
      'déplacer un Héros sur le lieu où se trouve FLÈCHE.',
    image: img('fleche.webp'),
    onPlace: [{ type: 'ATTACH_REMOTE_IF_IN_REALM' }, { type: 'MOVE_HERO_TO_HOST' }],
  },
  {
    id: 'elastigirl',
    name: 'Elastigirl',
    englishName: 'Elastigirl',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text:
      'Si la TÉLÉCOMMANDE DE SYNDROME est dans le royaume, associez-la à cette carte. Vous pouvez ' +
      'défausser un Allié sur le lieu où se trouve ELASTIGIRL.',
    image: img('elastigirl.webp'),
    onPlace: [{ type: 'ATTACH_REMOTE_IF_IN_REALM' }, { type: 'DISCARD_ONE_ALLY_AT_HOST' }],
  },
  {
    id: 'champ-de-force',
    name: 'Champ de Force',
    englishName: 'Force Field',
    deck: 'fate',
    type: 'item',
    copies: 2,
    attach: 'hero',
    shieldHeroFromVanquish: true,
    text: 'Associez cette carte à un Héros. Si ce Héros doit être éliminé, défaussez cet Objet à la place.',
    image: img('champ-de-force.webp'),
  },
  {
    id: 'alors-ca-truc-de-dingue',
    name: 'Alors ça, c’est un truc de dingue !',
    englishName: 'That Was Totally Wicked!',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Défaussez tous les Alliés et Objets, à l’exception du CHAMP DE FORCE.',
    image: img('alors-ca-truc-de-dingue.webp'),
    effects: [{ type: 'DISCARD_VILLAIN_BOARD_EXCEPT', exceptCardId: 'champ-de-force' }],
  },
  {
    id: 'travail-d-equipe',
    name: 'Travail d’équipe',
    englishName: 'Teamwork',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text:
      'Jouez l’autre carte Fatalité que vous avez piochée, puis regardez secrètement les 6 premières ' +
      'cartes Fatalité du dessus de la pioche et replacez-les dans l’ordre de votre choix. Cette ' +
      'Fatalité n’est pas jouable si l’autre carte Fatalité n’est pas jouable.',
    image: img('travail-d-equipe.webp'),
    fatePlayBoth: true,
    effects: [{ type: 'REORDER_FATE_TOP', count: 6 }],
  },
  {
    id: 'intrusion',
    name: 'Intrusion',
    englishName: 'Infiltrate',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Syndrome doit révéler sa main à tous les joueurs.',
    image: img('intrusion.webp'),
    effects: [{ type: 'REVEAL_HAND' }],
  },
  {
    id: 'pas-de-capes',
    name: 'Pas de Capes !',
    englishName: 'No Capes!',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text:
      'Au début de son prochain tour, au lieu de se déplacer, Syndrome reste sur le même lieu ' +
      '(il perd son déplacement).',
    image: img('pas-de-capes.webp'),
    effects: [{ type: 'FORCE_SKIP_NEXT_MOVE' }],
  },
  {
    id: 'monologue',
    name: 'Monologue',
    englishName: 'Monologuing',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Syndrome défausse 3 cartes de sa main (au choix).',
    image: img('monologue.webp'),
    effects: [{ type: 'TARGET_DISCARD_CHOICE', count: 3 }],
  },
]
