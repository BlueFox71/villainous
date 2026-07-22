// =============================================================================
// Hadès — cartes (Deck Vilain de 30 + Deck Fatalité de 15).
//
// Source : images FR du dossier assets/decks/Hadès/ (texte = source de vérité) +
// wiki Villainous (composition des decks, forces des Héros Fatalité).
//
// PÉRIMÈTRE. Implémentés :
//  - Objectif : 3 Titans non entravés sur le Mont Olympe au début du tour.
//  - Titans (Lythos, Hydros, Pyros, Stratos, Argès) : joués sur Les Enfers,
//    déplacés GRATUITEMENT (1 lieu voisin) via l'action « Déplacer un Objet ou un
//    Allié », ou en payant via « Préparez-vous au combat ! » (2 JT / 1 lieu, 5 JT
//    / 2 lieux). Déclencheurs au déplacement
//    (Argès +1 JT, Pyros désentrave, Stratos déplace un Héros — auto ; Lythos
//    signale qu'il peut Éliminer). Entrave par Zeus (arrivée), Héra, Éclairs ;
//    désentrave par Pyros et Alignement des planètes ; verrouillage par Hercule.
//  - Cerbère (Éliminer à distance), Hydre (retour en main), Nessus (+2 JT si
//    Héros ≤3), Panique (réduction de coût), Peine (emmène un Héros).
//  - Potion de mortalité (Titans préservés au Vanquish), Médaillon (+2 force),
//    Œil des Moires (cherche un Allié/Titan), Quel talent ! (JT par Allié en
//    défausse), Talon d'Achille (−2 force), Rage / Sans pitié (Conditions).
//  - Fatalité : Hercule, Mégara, Phil, Pégase, Zeus, Héra, Hermès + De zéro en
//    héros, Éclairs, Du gospel pur, Médaillon.
// INTERACTIF : Char (déplace figurine + Char vers n'importe quel lieu, 1×/tour,
// puis on agit sur le nouveau lieu) ; Stratos / Mégara / Hermès (déplacement de
// Héros au choix via pendingHeroRelocate) ; Héra (entrave) / Pégase (repousse) au
// choix via pendingTitanSelect ; Lythos ouvre un Vanquish facultatif à l'arrivée
// (pendingTrapVanquish). Pour le bot, ces choix sont résolus automatiquement.
// SIMPLIFICATIONS restantes : Éclairs entrave automatiquement le lieu le plus
// fourni ; De zéro en héros repousse automatiquement le Titan le plus avancé ;
// Alignement des planètes désentrave automatiquement (1 JT/Titan, des plus avancés).
// =============================================================================

import type { CardDef } from '../types'

const img = (file: string) => `/cards/hades/${file}`

export const hadesCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK VILAIN — Titans (5, joués sur Les Enfers)
  // ----------------------------------------------------------------------
  {
    id: 'lythos',
    name: 'Lythos',
    englishName: 'Lythos',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 4,
    isTitan: true,
    playOnlyAt: 'enfers',
    copies: 1,
    text: 'Jouez Lythos sur Les Enfers. Après avoir déplacé Lythos, vous pouvez immédiatement effectuer une action Éliminer un Héros sur son lieu d’arrivée. Lythos doit y participer.',
    image: img('lythos.webp'),
  },
  {
    id: 'hydros',
    name: 'Hydros',
    englishName: 'Hydros',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    isTitan: true,
    playOnlyAt: 'enfers',
    // Les Héros sur le même lieu qu'Hydros voient leur force réduite de 1.
    strengthMod: { target: 'heroes-here', delta: -1 },
    copies: 1,
    text: 'Jouez Hydros sur Les Enfers. Les Héros sur le même lieu qu’Hydros ne peuvent plus être déplacés par des cartes Fatalité et leur force est réduite de 1.',
    image: img('hydros.webp'),
  },
  {
    id: 'pyros',
    name: 'Pyros',
    englishName: 'Pyros',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 4,
    isTitan: true,
    playOnlyAt: 'enfers',
    copies: 1,
    text: 'Jouez Pyros sur Les Enfers. À chaque fois que Pyros est déplacé, vous pouvez désentraver 1 Titan sur son lieu d’arrivée.',
    image: img('pyros.webp'),
  },
  {
    id: 'stratos',
    name: 'Stratos',
    englishName: 'Stratos',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    isTitan: true,
    playOnlyAt: 'enfers',
    copies: 1,
    text: 'Jouez Stratos sur Les Enfers. À chaque fois que Stratos est déplacé, choisissez un Héros sur son lieu de départ ou d’arrivée et déplacez-le vers un lieu voisin.',
    image: img('stratos.webp'),
  },
  {
    id: 'arges',
    name: 'Argès',
    englishName: 'Arges',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 4,
    isTitan: true,
    playOnlyAt: 'enfers',
    copies: 1,
    text: 'Jouez Argès sur Les Enfers. À chaque fois qu’Argès est déplacé, gagnez 1 jeton Pouvoir.',
    image: img('arges.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Alliés (6)
  // ----------------------------------------------------------------------
  {
    id: 'cerbere',
    name: 'Cerbère',
    englishName: 'Cerberus',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 4,
    reachesAdjacentVanquish: true,
    copies: 1,
    text: 'Lors d’une action Éliminer un Héros, Cerbère peut être utilisé pour éliminer un Héros sur son lieu ou sur un lieu voisin.',
    image: img('cerbere.webp'),
  },
  {
    id: 'hydre',
    name: 'Hydre',
    englishName: 'Hydra',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    returnToHandOnVanquish: true,
    copies: 1,
    text: 'L’Hydre retourne dans votre main au lieu d’être défaussée quand vous l’utilisez pour éliminer un Héros.',
    image: img('hydre.webp'),
  },
  {
    id: 'nessus',
    name: 'Nessus',
    englishName: 'Nessus',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 4,
    copies: 1,
    text: 'Gagnez 2 jetons Pouvoir lorsque vous éliminez un Héros de force 3 ou moins avec Nessus.',
    image: img('nessus.webp'),
  },
  {
    id: 'panique',
    name: 'Panique',
    englishName: 'Panic',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 2,
    copies: 1,
    text: 'Les cartes Objets, Alliés et Titans vous coûtent 1 jeton Pouvoir de moins lorsque vous les jouez sur le même lieu que Panique.',
    image: img('panique.webp'),
  },
  {
    id: 'peine',
    name: 'Peine',
    englishName: 'Pain',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    text: 'Lorsque Peine est déplacé, vous pouvez déplacer un Héros du même lieu avec lui.',
    image: img('peine.webp'),
  },
  {
    id: 'char',
    name: 'Char',
    englishName: 'Chariot',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 1,
    text: 'Lorsque vous êtes sur le même lieu que le Char, vous pouvez, une fois par tour, déplacer votre figurine et le Char vers n’importe quel lieu et y effectuer une action disponible, en dehors d’une action Fatalité.',
    image: img('char.webp'),
    // Véhicule : déplacement figurine + Objet + 1 action, 1×/tour (applyChariotMove).
    ridesWithPawn: true,
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Objets (3)
  // ----------------------------------------------------------------------
  {
    id: 'potion-mortalite',
    name: 'Potion de mortalité',
    englishName: 'Vial of Mortality',
    deck: 'villain',
    type: 'item',
    cost: 2,
    attach: 'hero',
    copies: 3,
    text: 'Associez cette carte à un Héros. Les Titans utilisés pour éliminer ce Héros ne sont pas défaussés.',
    image: img('potion-mortalite.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Événements (10)
  // ----------------------------------------------------------------------
  {
    id: 'preparez-combat',
    name: 'Préparez-vous au combat !',
    englishName: 'Get Ready to Rumble!',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 3,
    text: 'Payez 2 jetons Pouvoir pour déplacer un Titan non entravé vers un lieu voisin, ou payez 5 jetons Pouvoir pour le déplacer de 2 lieux.',
    image: img('preparez-combat.webp'),
    effects: [{ type: 'MOVE_TITAN_INTERACTIVE', paid: true, maxSteps: 2 }],
  },
  {
    id: 'alignement-planetes',
    name: 'Alignement des planètes',
    englishName: 'Planetary Alignment',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    costVariable: true, // coût = nombre de Titans désentravés → pastille « ? »
    copies: 3,
    text: 'Désentravez 1 ou plusieurs Titans. Le coût de cette carte est égal au nombre de Titans que vous désentravez.',
    image: img('alignement-planetes.webp'),
    effects: [{ type: 'UNTRAP_TITANS_PAY' }],
  },
  {
    id: 'oeil-moires',
    name: 'Œil des Moires',
    englishName: 'Eye of the Fates',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Dévoilez les cartes de votre pioche jusqu’à ce que vous trouviez un Allié ou un Titan. Ajoutez-le à votre main et défaussez les autres.',
    image: img('oeil-moires.webp'),
    effects: [{ type: 'REVEAL_VILLAIN_UNTIL_TYPE', cardType: 'ally' }],
  },
  {
    id: 'quel-talent',
    name: 'Quel talent !',
    englishName: 'A True Hero',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 2,
    text: 'Gagnez 1 jeton Pouvoir pour chaque Allié et Titan dans votre défausse.',
    image: img('quel-talent.webp'),
    effects: [{ type: 'GAIN_POWER_PER_TYPE_IN_DISCARD', cardType: 'ally', amount: 1 }],
  },
  {
    id: 'talon-achille',
    name: 'Talon d’Achille',
    englishName: 'Achilles Heel',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Choisissez un Héros. Sa force est réduite de 2 jusqu’à la fin de votre tour.',
    image: img('talon-achille.webp'),
    effects: [{ type: 'REDUCE_HERO_STRENGTH_TEMP', amount: 2 }],
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Conditions (4)
  // ----------------------------------------------------------------------
  {
    id: 'rage',
    name: 'Rage',
    englishName: 'Rage',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Cette carte est jouable pendant le tour d’un adversaire s’il élimine un Héros de force 3 ou plus. Déplacez un Héros n’importe où dans votre royaume.',
    image: img('rage.webp'),
    trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 3 },
  },
  {
    id: 'sans-pitie',
    name: 'Sans pitié',
    englishName: 'No Mercy',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Cette carte est jouable pendant le tour d’un adversaire s’il possède au moins 6 jetons Pouvoir. Jouez gratuitement un Allié ou un Titan de votre main.',
    image: img('sans-pitie.webp'),
    trigger: { type: 'opponent-power-ge', value: 6 },
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros (7)
  // ----------------------------------------------------------------------
  {
    id: 'hercule',
    name: 'Hercule',
    englishName: 'Hercules',
    deck: 'fate',
    type: 'hero',
    strength: 5,
    // +1 si Phil est dans le royaume (réciproque de l'aura de Phil).
    selfStrengthMods: [{ kind: 'if-card', cardId: 'phil', scope: 'realm', delta: 1 }],
    copies: 1,
    text: 'Les Titans ne peuvent pas quitter le lieu où se trouve Hercule.',
    image: img('hercule.webp'),
  },
  {
    id: 'megara',
    name: 'Mégara',
    englishName: 'Megara',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Vous pouvez déplacer un Héros du lieu où vous jouez Mégara vers n’importe quel lieu.',
    image: img('megara.webp'),
    onPlace: [{ type: 'MOVE_HERO_FROM_HOST_ANYWHERE' }],
  },
  {
    id: 'phil',
    name: 'Phil',
    englishName: 'Phil',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    selfStrengthMods: [{ kind: 'if-card', cardId: 'hercule', scope: 'realm', delta: 1 }],
    copies: 1,
    text: 'Si Hercule se trouve dans le royaume, sa force et celle de Phil augmentent de 1.',
    image: img('phil.webp'),
  },
  {
    id: 'pegase',
    name: 'Pégase',
    englishName: 'Pegasus',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Vous pouvez déplacer un Titan non entravé vers un lieu voisin.',
    image: img('pegase.webp'),
    onPlace: [{ type: 'OPEN_TITAN_SELECT', kind: 'push', pushSteps: 1 }],
  },
  {
    id: 'zeus',
    name: 'Zeus',
    englishName: 'Zeus',
    deck: 'fate',
    type: 'hero',
    strength: 5,
    copies: 1,
    text: 'Les Titans qui se déplacent sur le lieu où se trouve Zeus sont immédiatement entravés et leur capacité est ignorée.',
    image: img('zeus.webp'),
  },
  {
    id: 'hera',
    name: 'Héra',
    englishName: 'Hera',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: 'Lorsque Héra est jouée ou déplacée, vous pouvez entraver un Titan sur son lieu d’arrivée.',
    image: img('hera.webp'),
    onPlace: [{ type: 'OPEN_TITAN_SELECT', kind: 'trap', atHost: true }],
  },
  {
    id: 'hermes',
    name: 'Hermès',
    englishName: 'Hermes',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Cherchez Zeus dans les cartes Fatalité et placez-le sur le dessus de la pioche. S’il est déjà présent dans le royaume, vous pouvez le déplacer sur n’importe quel lieu.',
    image: img('hermes.webp'),
    onPlace: [{ type: 'SEARCH_FATE_HERO_TO_TOP', heroCardId: 'zeus' }],
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Objets (2)
  // ----------------------------------------------------------------------
  {
    id: 'medaillon',
    name: 'Médaillon',
    englishName: 'Medallion',
    deck: 'fate',
    type: 'item',
    attach: 'hero',
    attachStrengthBonus: 2,
    copies: 2,
    text: 'Associez cette carte à un Héros, sa force augmente de 2.',
    image: img('medaillon.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événements (6)
  // ----------------------------------------------------------------------
  {
    id: 'de-zero-heros',
    name: 'De zéro en héros !',
    englishName: 'Go the Distance',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Déplacez un Héros vers n’importe quel lieu, ou déplacez un Titan non entravé de 2 lieux, en ignorant les capacités des Héros et Titans.',
    image: img('de-zero-heros.webp'),
  },
  {
    id: 'eclairs',
    name: 'Éclairs',
    englishName: 'Lightning Bolt',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Entravez tous les Titans d’un lieu au choix.',
    image: img('eclairs.webp'),
  },
  {
    id: 'du-gospel-pur',
    name: 'Du gospel pur !',
    englishName: 'The Gospel Truth',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Défaussez un Allié ou un Objet.',
    image: img('du-gospel-pur.webp'),
  },
]
