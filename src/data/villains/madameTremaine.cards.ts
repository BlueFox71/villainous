// =============================================================================
// Madame de Trémaine — cartes (deck Méchant : 30 ; deck Fatalité : 15).
//
// Noms / coûts / textes / ILLUSTRATIONS tirés des planches du jeu réel (faces
// découpées depuis assets/decks/Madame de Tremaine). La BOUCLE DE VICTOIRE est
// fidèle : Invitation du Roi (déverrouille la Salle de Bal) → fille EN ROBE (remplace
// sa version ordinaire) + Prince dans la Salle de Bal → Cloches de Mariage sans
// Pantoufle de Verre. Pris au piège ! / Sale voleuse ! / Minuit neutralisent
// les Héros ; la Canne retire les Pantoufles. Faces re-découpées des planches
// re-traduites (2026-06-21) — noms mis à jour, effets inchangés.
// STATUT (2026-06-24) : effets Fatalité fidélisés — Jaq défausse un Objet (Cloches/
// Canne), Sweet Nightingale un Allié, Bibbidi-Bobbidi-Boo libère un Héros piégé,
// Marraine la Bonne Fée gèle les déplacements d'Alliés (blocksAllyMoves).
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/madame-tremaine/${f}`

export const madameTremaineCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Alliés (5)
  // ----------------------------------------------------------------------
  {
    id: 'anastasia',
    name: 'Anastasie',
    englishName: 'Anastasia',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 2,
    copies: 1,
    // Seule sa version EN ROBE DE BAL peut entrer dans la Salle de Bal : Anastasie
    // ordinaire ne peut y être ni jouée ni déplacée.
    forbiddenLocations: ['salle-de-bal'],
    text: 'Une des belles-filles de Madame de Trémaine. Peut être remplacée par Anastasie en robe de bal.',
    image: img('anastasia.png'),
  },
  {
    id: 'drizella',
    name: 'Javotte',
    englishName: 'Drizella',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 2,
    copies: 1,
    // Seule sa version EN ROBE DE BAL peut entrer dans la Salle de Bal : Javotte
    // ordinaire ne peut y être ni jouée ni déplacée.
    forbiddenLocations: ['salle-de-bal'],
    text: 'Une des belles-filles de Madame de Trémaine. Peut être remplacée par Javotte en robe de bal.',
    image: img('drizella.png'),
  },
  {
    id: 'ball-gown-anastasia',
    name: 'Anastasie en robe de bal',
    englishName: 'Ball Gown Anastasia',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 4,
    copies: 1,
    replacesCardId: 'anastasia',
    text: 'Défaussez Anastasie pour jouer Anastasie en robe de bal. Prête pour le bal.',
    image: img('ball-gown-anastasia.png'),
  },
  {
    id: 'ball-gown-drizella',
    name: 'Javotte en robe de bal',
    englishName: 'Ball Gown Drizella',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 4,
    copies: 1,
    replacesCardId: 'drizella',
    text: 'Défaussez Javotte pour jouer Javotte en robe de bal. Prête pour le bal.',
    image: img('ball-gown-drizella.png'),
  },
  {
    id: 'lucifer',
    name: 'Lucifer',
    englishName: 'Lucifer',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 3,
    copies: 1,
    text: 'Si un Héros se retrouve sur le même lieu que Lucifer, placez un jeton Enfermé sur ce Héros (il est piégé).',
    image: img('lucifer.png'),
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Objets (4)
  // ----------------------------------------------------------------------
  {
    id: 'invitation-du-roi',
    name: 'Invitation du Roi',
    englishName: 'Invitation from the King',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 1,
    text: 'À la pose : déverrouillez la Salle de Bal et, si le Prince n’est pas déjà dans votre royaume, cherchez-le et jouez-le sur la Salle de Bal. Activer : regardez les 2 premières cartes de votre pioche Fatalité, défaussez-en une, laissez l’autre face cachée sur la pioche.',
    effects: [
      { type: 'UNLOCK_LOCATION', locationId: 'salle-de-bal' },
      { type: 'SUMMON_FATE_HERO_TO_OWN_REALM', heroCardId: 'the-prince', locationId: 'salle-de-bal' },
    ],
    activatedCost: 0,
    image: img('invitation-du-roi.png'),
  },
  {
    id: 'canne-tremaine',
    name: 'Canne de Madame de Trémaine',
    englishName: "Lady Tremaine's Cane",
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 1,
    text: 'Activer : retirez une Pantoufle de Verre de votre royaume (le seul moyen de les retirer).',
    activatedCost: 0,
    image: img('canne-tremaine.png'),
  },
  {
    id: 'la-cle',
    name: 'La Clé',
    englishName: 'The Key',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 1,
    text: 'À la pose : déplacez Cendrillon (si elle est en jeu) sur la Chambre de Cendrillon et placez un jeton Enfermé sur elle. Activer : déplacez un Héros sur la Chambre de Cendrillon et placez un jeton Enfermé sur lui.',
    effects: [{ type: 'MOVE_NAMED_HERO_TO_AND_TRAP', heroCardId: 'cendrillon', locationId: 'chambre-cendrillon' }],
    activatedCost: 0,
    image: img('la-cle.png'),
  },
  {
    id: 'cloches-mariage',
    name: 'Cloches de Mariage',
    englishName: 'Wedding Bells',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 1,
    text: 'Au début de votre tour : si une de vos filles EN ROBE DE BAL et le Prince sont dans la Salle de Bal et qu’aucune Pantoufle de Verre n’est dans votre royaume, vous gagnez la partie.',
    image: img('cloches-mariage.png'),
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Conditions (6)
  // ----------------------------------------------------------------------
  {
    id: 'et-une-chose-encore',
    name: 'J’allais oublier un détail',
    englishName: 'And One More Thing',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Jouable pendant le tour d’un adversaire qui effectue une action Défausser. Vous pouvez défausser n’importe quel nombre de cartes de votre choix, puis piochez pour compléter votre main à quatre cartes.',
    trigger: { type: 'opponent-discarded-ge', value: 1 },
    effects: [{ type: 'DISCARD_ANY_THEN_REFILL', handLimit: 4, label: 'J’allais oublier un détail' }],
    image: img('et-une-chose-encore.png'),
  },
  {
    id: 'enfermes',
    name: 'Enfermée',
    englishName: 'Locked Up',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Jouable pendant le tour d’un adversaire qui effectue une action Éliminer un Héros. Placez un jeton Enfermé sur un Héros de votre royaume (il est piégé).',
    trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 0 },
    image: img('enfermes.png'),
  },
  {
    id: 'vilaines-farces',
    name: 'Plaisanteries douteuses',
    englishName: 'Vicious Practical Jokes',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Jouable pendant le tour d’un adversaire qui vous cible avec une action Fatalité. Choisissez à sa place laquelle des cartes dévoilées est jouée (et, si c’est un Héros, sur quel lieu).',
    trigger: { type: 'opponent-fate-targeted-me' },
    image: img('vilaines-farces.png'),
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Événements (15)
  // ----------------------------------------------------------------------
  {
    id: 'il-y-a-encore-une-chance',
    name: 'Il y a encore une chance',
    englishName: "There's Still a Chance",
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 4,
    text: 'Effectuez une action « Déplacer un Objet ou un Allié » OU une action « Activer » (au choix si les deux sont possibles).',
    effects: [{ type: 'GRANT_FREE_MOVE_OR_ACTIVATE' }],
    image: img('il-y-a-encore-une-chance.png'),
  },
  {
    id: 'je-disais-si',
    name: 'J’ai dit « Si »',
    englishName: 'I Said "If"',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 3,
    text: 'Mélangez votre défausse de Méchant avec votre pioche, puis piochez 2 cartes.',
    effects: [{ type: 'RESHUFFLE_DISCARD_AND_DRAW', count: 2 }],
    image: img('je-disais-si.png'),
  },
  {
    id: 'piege',
    name: 'Pris au piège !',
    englishName: 'Trapped',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: 'Placez un jeton Capturé sur un Héros de votre royaume : sa capacité est ignorée et il ne recouvre plus d’action.',
    effects: [{ type: 'TRAP_HERO' }],
    image: img('piege.png'),
  },
  {
    id: 'je-ne-reviens-jamais',
    name: 'Je ne reviens jamais sur ma parole',
    englishName: 'I Never Go Back on My Word',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Mélangez votre défausse Fatalité dans votre pioche Fatalité, puis regardez les 4 premières cartes et replacez-les dans l’ordre de votre choix sur le dessus.',
    effects: [{ type: 'RESHUFFLE_FATE_THEN_REORDER', count: 4 }],
    image: img('je-ne-reviens-jamais.png'),
  },
  {
    id: 'petite-voleuse',
    name: 'Sale voleuse !',
    englishName: 'You Little Thief!',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 2,
    text: 'Vainquez Cendrillon ou Cendrillon en robe de bal (sans Allié).',
    effects: [
      {
        type: 'INSTANT_VANQUISH_HERO_LE',
        maxStrength: 3,
        onlyCardIds: ['cendrillon', 'ball-gown-cinderella'],
      },
    ],
    image: img('petite-voleuse.png'),
  },
  {
    id: 'minuit-tremaine',
    name: 'Minuit',
    englishName: 'Midnight',
    deck: 'villain',
    type: 'effect',
    cost: 4,
    copies: 1,
    text: 'Vainquez TOUS les Héros de votre royaume (sans Allié), puis cherchez et jouez les deux Pantoufles de Verre.',
    effects: [
      { type: 'INSTANT_VANQUISH_ALL_HEROES' },
      { type: 'FETCH_FATE_ITEMS_TO_REALM', cardIds: ['pantoufle-chambre', 'pantoufle-chateau'] },
    ],
    image: img('minuit-tremaine.png'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros (6) + le Prince (1)
  // ----------------------------------------------------------------------
  {
    id: 'cendrillon',
    name: 'Cendrillon',
    englishName: 'Cinderella',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Les Événements coûtent 2 jetons Pouvoir de plus. Recouvre la rangée du haut de son lieu.',
    image: img('cendrillon.png'),
  },
  {
    id: 'ball-gown-cinderella',
    name: 'Cendrillon en robe de bal',
    englishName: 'Ball Gown Cinderella',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Aucun Allié ne peut entrer dans la Salle de Bal tant qu’elle est en jeu. Recouvre la rangée du haut de son lieu.',
    blocksAlliesAtLocation: 'salle-de-bal',
    image: img('ball-gown-cinderella.png'),
  },
  {
    id: 'fairy-godmother',
    name: 'Marraine la Bonne Fée',
    englishName: 'Fairy Godmother',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: 'Tant qu’elle est en jeu, aucun Allié ne peut être déplacé. Quand elle est jouée, cherchez et jouez Cendrillon en robe de bal. Recouvre la rangée du haut de son lieu.',
    blocksAllyMoves: true,
    onPlace: [{ type: 'SUMMON_FATE_HERO_TO_OWN_REALM', heroCardId: 'ball-gown-cinderella', locationId: 'salle-de-bal' }],
    image: img('fairy-godmother.png'),
  },
  {
    id: 'jaq',
    name: 'Jaq',
    englishName: 'Jaq',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text: 'À son arrivée, défaussez un Objet du royaume de Madame de Trémaine (de préférence les Cloches de Mariage ou la Canne).',
    onPlace: [{ type: 'FATE_DISCARD_STRONGEST_ALLY_OR_ITEM', onlyType: 'item', preferCardIds: ['cloches-mariage', 'canne-tremaine'] }],
    image: img('jaq.png'),
  },
  {
    id: 'gus',
    name: 'Gus',
    englishName: 'Gus',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text: 'Une des souris amies de Cendrillon.',
    image: img('gus.png'),
  },
  {
    id: 'bruno',
    name: 'Pataud',
    englishName: 'Bruno',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Quand Pataud est joué ou déplacé, déplacez Lucifer vers son lieu. Ennemi juré de Lucifer.',
    onPlace: [{ type: 'MOVE_ALLY_TO_HOST', cardId: 'lucifer' }],
    image: img('bruno.png'),
  },
  {
    id: 'the-prince',
    name: 'Le Prince',
    englishName: 'The Prince',
    deck: 'fate',
    type: 'hero',
    strength: 0,
    copies: 1,
    text: 'Quand il est dévoilé, il est obligatoire de le jouer (l’autre carte est défaussée) ; il ne peut être joué que sur la Salle de Bal (verrouillée ou non). Ne recouvre aucune action et peut être déplacé par Madame de Trémaine.',
    forcedFateLocation: 'salle-de-bal',
    image: img('the-prince.png'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Objets (2)
  // ----------------------------------------------------------------------
  {
    id: 'pantoufle-chambre',
    name: 'Pantoufle de Verre',
    englishName: 'Glass Slipper',
    deck: 'fate',
    type: 'item',
    copies: 1,
    forcedFateLocation: 'chambre-cendrillon',
    text: 'Jouée sur la Chambre de Cendrillon (non associée à un Héros). Tant qu’une Pantoufle de Verre est dans le royaume de Madame de Trémaine, le mariage est impossible. Seule la Canne peut la retirer.',
    image: img('pantoufle-chambre.png'),
  },
  {
    id: 'pantoufle-chateau',
    name: 'Pantoufle de Verre',
    englishName: 'Glass Slipper',
    deck: 'fate',
    type: 'item',
    copies: 1,
    forcedFateLocation: 'chateau',
    text: 'Jouée sur le Château (non associée à un Héros). Tant qu’une Pantoufle de Verre est dans le royaume de Madame de Trémaine, le mariage est impossible. Seule la Canne peut la retirer.',
    image: img('pantoufle-chateau.png'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événements (6)
  // ----------------------------------------------------------------------
  {
    id: 'bibbidi-bobbidi-boo',
    name: 'Bibbidi-Bobbidi-Boo',
    englishName: 'Bibbidi-Bobbidi-Boo',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    text: 'La magie de la Bonne Fée : retirez le jeton « piégé » d’un Héros du royaume de Madame de Trémaine (il redevient actif).',
    effects: [{ type: 'UNTRAP_HERO' }],
    image: img('bibbidi-bobbidi-boo.png'),
  },
  {
    id: 'sweet-nightingale',
    name: 'Chante, Rossignol, Chante',
    englishName: 'Sweet Nightingale',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    // Déplacement (PAS défausse) : le joueur qui pose la Fatalité déplace un Allié du
    // royaume de Madame de Trémaine vers n'importe quel lieu (non bloqué). Résolu par
    // un branchement cardId dans resolveFate (pendingAllyRelocate, comme Flèche de Mome
    // Raths) → pas d'`effects` ici.
    text: 'Déplacez un Allié du royaume de Madame de Trémaine vers n’importe quel lieu.',
    image: img('sweet-nightingale.png'),
  },
]
