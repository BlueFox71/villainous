// =============================================================================
// Madame Mim (Merlin l'Enchanteur, Disney) — 1 ★.
// Mécanique inédite : les MÉTAMORPHOSES.
//   - Métamorphoses MIM (deck Méchant) : fonctionnent comme des Alliés, donnent
//     l'action « Éliminer un Héros » à leur lieu, et ne peuvent vaincre QU'UNE
//     Métamorphose de Merlin précise (`transformationTarget`).
//   - Métamorphoses de MERLIN (pioche séparée `merlinDeck`) : fonctionnent comme
//     des Héros, posées au Lieu du Duel (1 au départ ; remplacée à chaque défaite).
// OBJECTIF : vaincre les 7 Métamorphoses de Merlin (DEFEAT_ALL_MERLIN).
// Madame Mim a DEUX pioches Fatalité : la traditionnelle (8, ce que jouent les
// adversaires) et la pioche Merlin (7). Les cartes Merlin portent `deck: 'fate'`
// + `isMerlinTransformation` : createInitialGame les sépare dans `merlinDeck`.
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/madame-mim/${f}`

/** Métamorphose Mim : Allié donnant « Éliminer un Héros » à son lieu, qui ne peut
 *  vaincre que la Métamorphose de Merlin `target`. */
const mim = (
  id: string,
  name: string,
  englishName: string,
  cost: number,
  strength: number,
  target: string,
): CardDef => ({
  id,
  name,
  englishName,
  deck: 'villain',
  type: 'ally',
  cost,
  strength,
  copies: 1,
  isMimTransformation: true,
  transformationTarget: target,
  grantsAction: { type: 'VANQUISH', label: 'Éliminer un Héros (Métamorphose)' },
  text: `Ce lieu gagne l'action « Éliminer un Héros ». Lors d'une action Éliminer un Héros, ${name} ne peut éliminer que sa Métamorphose de Merlin correspondante.`,
  image: img(id + '.webp'),
  journal: `${name} entre dans le duel : {nomLieu} gagne l’action Éliminer un Héros.`,
})

/** Métamorphose de Merlin : « Héros » posé au Lieu du Duel, vaincable seulement par
 *  sa Métamorphose Mim correspondante. */
const merlin = (id: string, name: string, englishName: string, strength: number, byMim: string): CardDef => ({
  id,
  name,
  englishName,
  deck: 'fate',
  type: 'hero',
  strength,
  copies: 1,
  isMerlinTransformation: true,
  text: `${name} ne peut être éliminé que par ${byMim}, lors d'une action Éliminer un Héros.`,
  image: img(id + '.webp'),
  journal: `${name} prend place au Lieu du Duel : seul ${byMim} peut en venir à bout.`,
})

export const madameMimCards: CardDef[] = [
  // --- Métamorphoses Mim (deck Méchant) -------------------------------------
  mim('mim-poule', 'Mim Poule', 'Chicken Mim', 2, 1, 'merlin-chenille'),
  mim('mim-dragon', 'Mim Dragon', 'Purple Dragon Mim', 2, 4, 'merlin-chevre'),
  mim('mim-serpent', 'Mim Serpent à Sonnette', 'Rattlesnake Mim', 1, 1, 'merlin-souris'),
  mim('mim-rhinoceros', 'Mim Rhinocéros', 'Rhinoceros Mim', 2, 2, 'merlin-crabe'),
  mim('mim-tigre', 'Mim Tigre', 'Tiger Mim', 1, 1, 'merlin-souris'),
  mim('mim-crocodile', 'Mim Crocodile', 'Crocodile Mim', 2, 2, 'merlin-tortue'),
  mim('mim-elephant', 'Mim Éléphant', 'Elephant Mim', 2, 3, 'merlin-morse'),
  mim('mim-renard', 'Mim Renard', 'Fox Mim', 2, 2, 'merlin-lapin'),

  // --- Effets / Conditions (deck Méchant) -----------------------------------
  {
    id: 'pas-de-tricherie',
    name: 'Pas de Tricherie',
    englishName: "I'm Not Cheating",
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 4,
    text: 'Regardez secrètement les 2 premières cartes de votre pioche de Métamorphoses de Merlin, puis replacez-les dans l’ordre de votre choix sur le dessus.',
    image: img('pas-de-tricherie.webp'),
    effects: [{ type: 'REORDER_MERLIN_DECK_TOP2' }],
    journal: 'Pas de Tricherie : les 2 prochaines Métamorphoses de Merlin sont lues et réordonnées.',
  },
  {
    id: 'j-etablis-les-regles',
    name: 'J’établis les règles',
    englishName: "I'll Make the Rules",
    deck: 'villain',
    type: 'effect',
    cost: 4,
    copies: 3,
    text: 'Éliminez une carte Métamorphose de Merlin de votre royaume.',
    image: img('j-etablis-les-regles.webp'),
    effects: [{ type: 'DEFEAT_MERLIN_IN_REALM' }],
    journal: 'J’établis les règles : une Métamorphose de Merlin du royaume est balayée.',
  },
  {
    id: 'magnifique-merveilleuse-ma',
    name: 'Magnifique, Merveilleuse, Ma…',
    englishName: 'Magnificent, Marvelous, Mad',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: 'Mélangez votre défausse dans votre pioche.',
    image: img('magnifique-merveilleuse-ma.webp'),
    effects: [{ type: 'RESHUFFLE_DISCARD_AND_DRAW', count: 0 }],
    journal: 'Magnifique, Merveilleuse, Ma… : la défausse est remélangée dans la pioche.',
  },
  {
    id: 'duel-de-sorcellerie',
    name: 'Duel de Sorcellerie',
    englishName: "Wizard's Duel",
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: 'Placez une carte Métamorphose de Merlin et jouez-la sur le Lieu du Duel.',
    image: img('duel-de-sorcellerie.webp'),
    effects: [{ type: 'PLACE_MERLIN_AT_DUEL' }],
    journal: 'Duel de Sorcellerie : une nouvelle Métamorphose de Merlin est appelée au Lieu du Duel.',
  },
  {
    id: 'bataille-d-esprit',
    name: 'Bataille d’esprits',
    englishName: 'Battle of Wits',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 3,
    text: 'Piochez 4 cartes Méchant, puis défaussez 4 cartes de votre main.',
    image: img('bataille-d-esprit.webp'),
    effects: [{ type: 'DRAW_THEN_DISCARD', draw: 4, discard: 4 }],
    journal: 'Bataille d’esprits : 4 cartes piochées, 4 cartes rendues.',
  },
  {
    id: 'enorme-a-l-infini',
    name: 'Énorme à l’infini',
    englishName: 'As Big as a House',
    deck: 'villain',
    type: 'condition',
    copies: 3,
    text: 'Cette carte est jouable durant le tour d’un adversaire s’il gagne 2 jetons Pouvoir ou plus. Gagnez 2 jetons Pouvoir.',
    image: img('enorme-a-l-infini.webp'),
    trigger: { type: 'opponent-gained-power-ge', value: 2 },
    effects: [{ type: 'GAIN_POWER', amount: 2 }],
    journal: 'Énorme à l’infini : la montée en Pouvoir adverse rapporte 2 JT.',
  },
  {
    id: 'j-aime-le-sport',
    name: 'J’aime le sport',
    englishName: 'A Sporting Chance',
    deck: 'villain',
    type: 'condition',
    copies: 3,
    text: 'Cette carte est jouable durant le tour d’un adversaire s’il effectue une action Éliminer un Héros. Choisissez une carte dans votre défausse et ajoutez-la à votre main.',
    image: img('j-aime-le-sport.webp'),
    trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 0 },
    effects: [{ type: 'RECOVER_FROM_DISCARD_CHOICE', types: ['ally', 'effect', 'condition'], label: 'J’aime le sport' }],
    journal:
      'J’aime le sport : retour en main de {nomCarte}.\n' +
      'J’aime le sport : une carte revient de la défausse en main.',
  },

  // --- Fatalité TRADITIONNELLE (8 ; ce que jouent les adversaires) -----------
  {
    id: 'le-savoir-conduit-puissance',
    name: 'Le Savoir conduit à la Puissance',
    englishName: 'Knowledge and Wisdom',
    deck: 'fate',
    type: 'effect',
    copies: 4,
    text: 'Déplacez une carte Métamorphose de Merlin vers n’importe quel lieu.',
    image: img('le-savoir-conduit-puissance.webp'),
    effects: [{ type: 'MOVE_MERLIN_ANYWHERE' }],
    journal: 'Le Savoir conduit à la Puissance : une Métamorphose de Merlin change de lieu.',
  },
  {
    id: 'merlin',
    name: 'Merlin',
    englishName: 'Merlin',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Prenez une carte Métamorphose de Merlin éliminée au hasard dans la défausse et remélangez-la dans la pioche de Métamorphose de Merlin.',
    image: img('merlin.webp'),
    effects: [{ type: 'RECYCLE_DEFEATED_MERLIN' }],
    journal: 'Merlin : une Métamorphose vaincue retourne dans la pioche de Merlin.',
  },
  {
    id: 'archimede',
    name: 'Archimède',
    englishName: 'Archimedes',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Piochez la première carte Métamorphose de Merlin de la pioche. Choisissez n’importe quelle Métamorphose de Merlin du royaume et remplacez-la par cette carte. Puis mélangez la carte remplacée dans la pioche.',
    image: img('archimede.webp'),
    effects: [{ type: 'SWAP_DUEL_MERLIN' }],
    journal: 'Archimède : une Métamorphose du royaume est remplacée par la suivante de la pioche.',
  },
  {
    id: 'arthur-oiseau',
    name: 'Arthur Oiseau',
    englishName: 'Bird Arthur',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Madame Mim défausse toutes les cartes de sa main puis pioche 2 cartes.',
    image: img('arthur-oiseau.webp'),
    effects: [{ type: 'DISCARD_HAND_DRAW', draw: 2 }],
    journal: 'Arthur Oiseau : la main de Madame Mim part en défausse, et 2 cartes la remplacent.',
  },
  {
    id: 'merlin-microbe',
    name: 'Merlin Microbe',
    englishName: 'Germ Merlin',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Défaussez une carte Métamorphose de Madame Mim.',
    image: img('merlin-microbe.webp'),
    effects: [{ type: 'DISCARD_MIM_TRANSFORMATION' }],
    journal: 'Merlin Microbe : une Métamorphose de Madame Mim est défaussée.',
  },

  // --- Métamorphoses de Merlin (pioche Merlin, 7 ; séparées au setup) --------
  merlin('merlin-souris', 'Merlin Souris', 'Mouse Merlin', 1, 'Mim Serpent à Sonnette ou Mim Tigre'),
  merlin('merlin-lapin', 'Merlin Lapin', 'Rabbit Merlin', 2, 'Mim Renard'),
  merlin('merlin-tortue', 'Merlin Tortue', 'Turtle Merlin', 2, 'Mim Crocodile'),
  merlin('merlin-morse', 'Merlin Morse', 'Walrus Merlin', 3, 'Mim Éléphant'),
  merlin('merlin-chenille', 'Merlin Chenille', 'Caterpillar Merlin', 1, 'Mim Poule'),
  merlin('merlin-crabe', 'Merlin Crabe', 'Crab Merlin', 2, 'Mim Rhinocéros'),
  merlin('merlin-chevre', 'Merlin Chèvre', 'Goat Merlin', 4, 'Mim Dragon'),
]
