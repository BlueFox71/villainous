// =============================================================================
// Capitaine Crochet — cartes (Deck Vilain de 30 + Deck Fatalité de 15).
//
// Source : images FR du dossier assets/decks/Crochet/ — transcription complète
// dans assets/decks/Crochet/crochet_reference.md.
//
// PÉRIMÈTRE. Implémentés : objectif événementiel (vaincre Peter Pan sur le Jolly
// Roger), Arbre du Pendu verrouillé + déverrouillage (Carte du Pays Imaginaire),
// Peter Pan auto-placé sur l'Arbre quand dévoilé, Enfants Perdus (≥2 Alliés),
// Flibustiers (Vaincre à distance), Provocation (ordre d'élimination), bonus de
// force (Monsieur Mouche, Wendy, Jean, Michel, Sabre d'Abordage, Poussière de
// Fée). Objets « ce lieu gagne l'action X » (Canon→Vaincre, Boîte à Crochets→
// Gagner 1, Ingénieux Mécanisme→Déplacer un Héros). Digne Adversaire / Obsession
// (piocher un Héros dans son propre deck Fatalité et le jouer). Monsieur Starkey
// (déplacer un Héros), Clochette (défausser un Allié), Tic Tac (défausse de la
// main), Pas de Quartier ! (déplacer un Allié +2), Faites-leur peur ! (sonde sa
// pioche Fatalité), Ruse (jouer un Allié gratuit en réaction).
// SIMPLIFICATIONS (auto vs choix complet) : Faites-leur peur ! défausse
// automatiquement les non-Héros du dessus ; Pas de Quartier ! / Digne Adversaire
// choisissent l'Allié/le lieu de façon heuristique.
// =============================================================================

import type { CardDef } from '../types'

const img = (file: string) => `/cards/crochet/${file}`

export const crochetCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK VILAIN — Alliés (10)
  // ----------------------------------------------------------------------
  {
    id: 'boucanier',
    name: 'Boucanier',
    englishName: 'Swashbuckler',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 2,
    copies: 3,
    text: 'Aucune capacité.',
    image: img('boucanier.webp'),
  },
  {
    id: 'flibustiers',
    name: 'Flibustiers',
    englishName: 'Boarding Party',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 3,
    text: 'Les Flibustiers peuvent éliminer un Héros sur leur lieu ou sur un lieu voisin non bloqué.',
    image: img('flibustiers.webp'),
  },
  {
    id: 'brute',
    name: 'Brute',
    englishName: 'Pirate Brute',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 4,
    copies: 2,
    text: 'Aucune capacité.',
    image: img('brute.webp'),
  },
  {
    id: 'monsieur-mouche',
    name: 'Monsieur Mouche',
    englishName: 'Mr. Smee',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    text: 'La force de Monsieur Mouche augmente de 2 quand il se trouve sur le Jolly Roger.',
    image: img('monsieur-mouche.webp'),
  },
  {
    id: 'monsieur-starkey',
    name: 'Monsieur Starkey',
    englishName: 'Mr. Starkey',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    text: 'Vous pouvez déplacer un Héros du lieu où vous jouez Monsieur Starkey vers un lieu voisin non bloqué.',
    image: img('monsieur-starkey.webp'),
    effects: [{ type: 'RELOCATE_OWN_HERO' }],
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Objets (8)
  // ----------------------------------------------------------------------
  {
    id: 'canon',
    name: 'Canon',
    englishName: 'Cannon',
    deck: 'villain',
    type: 'item',
    cost: 2,
    attach: 'location',
    copies: 2,
    text: 'Ce lieu gagne l’action : Éliminer un héros.',
    image: img('canon.webp'),
    grantsAction: { type: 'VANQUISH', label: 'Éliminer un héros (Canon)' },
  },
  {
    id: 'sabre-abordage',
    name: 'Sabre d’Abordage',
    englishName: 'Cutlass',
    deck: 'villain',
    type: 'item',
    cost: 1,
    attach: 'ally',
    copies: 2,
    text: 'Associez cette carte à un Allié, sa force augmente de 2.',
    image: img('sabre-abordage.webp'),
  },
  {
    id: 'boite-crochets',
    name: 'Boîte à Crochets',
    englishName: "Hook's Case",
    deck: 'villain',
    type: 'item',
    cost: 2,
    attach: 'location',
    copies: 2,
    text: 'Ce lieu gagne l’action : Gagner 1 pouvoir.',
    image: img('boite-crochets.webp'),
    grantsAction: { type: 'GAIN_POWER', amount: 1, label: 'Gagner 1 pouvoir (Boîte à Crochets)' },
  },
  {
    id: 'ingenieux-mecanisme',
    name: 'Ingénieux Mécanisme',
    englishName: 'Ingenious Device',
    deck: 'villain',
    type: 'item',
    cost: 2,
    attach: 'location',
    copies: 1,
    text: 'Ce lieu gagne l’action : Déplacer un héros.',
    image: img('ingenieux-mecanisme.webp'),
    grantsAction: { type: 'MOVE_HERO', label: 'Déplacer un héros (Ingénieux Mécanisme)' },
  },
  {
    id: 'carte-pays-imaginaire',
    name: 'Carte du Pays Imaginaire',
    englishName: 'Never Land Map',
    deck: 'villain',
    type: 'item',
    cost: 4,
    attach: 'location',
    copies: 1,
    text: "Retirez la tuile Cadenas de l'Arbre du Pendu. Retirez cette carte de votre royaume pour jouer un Objet de votre main gratuitement.",
    image: img('carte-pays-imaginaire.webp'),
    effects: [{ type: 'UNLOCK_LOCATION', locationId: 'arbre-pendu' }],
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Événements (8)
  // ----------------------------------------------------------------------
  {
    id: 'faites-leur-peur',
    name: 'Faites-leur peur !',
    englishName: 'Give Them a Scare',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: 'Regardez secrètement les 2 premières cartes Fatalité de votre pioche. Défaussez-les ou remettez-les sur le dessus dans l’ordre de votre choix.',
    image: img('faites-leur-peur.webp'),
    effects: [{ type: 'SCRY_OWN_FATE_TOP2' }],
  },
  {
    id: 'digne-adversaire',
    name: 'Digne Adversaire',
    englishName: 'Worthy Opponent',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 3,
    text: 'Gagnez 2 jetons Pouvoir. Puis dévoilez des cartes Fatalité de votre deck jusqu’à trouver un Héros. Jouez-le et défaussez les autres cartes dévoilées.',
    image: img('digne-adversaire.webp'),
    effects: [{ type: 'GAIN_POWER', amount: 2 }, { type: 'REVEAL_OWN_FATE_PLAY_HERO' }],
  },
  {
    id: 'pas-de-quartier',
    name: 'Pas de Quartier !',
    englishName: 'Aye, Aye Sir!',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Déplacez un Allié vers un lieu voisin non bloqué. La force de cet Allié augmente de 2 jusqu’à la fin de votre tour.',
    image: img('pas-de-quartier.webp'),
    effects: [{ type: 'MOVE_ALLY_BUFF', amount: 2 }],
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Conditions (4)
  // ----------------------------------------------------------------------
  {
    id: 'ruse',
    name: 'Ruse',
    englishName: 'Cunning',
    deck: 'villain',
    type: 'condition',
    copies: 2,
    text: 'Jouable pendant le tour d’un adversaire s’il joue un Allié de force 4 ou plus. Jouez gratuitement un Allié de votre main.',
    image: img('ruse.webp'),
    // Déclencheur approché (pas encore de « l'adversaire a joué un Allié ≥4 »).
    trigger: { type: 'opponent-allies-in-realm-ge', value: 4 },
  },
  {
    id: 'obsession',
    name: 'Obsession',
    englishName: 'Obsession',
    deck: 'villain',
    type: 'condition',
    copies: 2,
    text: 'Jouable pendant le tour d’un adversaire s’il élimine un Héros de force 4 ou plus. Dévoilez des cartes Fatalité de votre deck jusqu’à trouver un Héros, jouez-le et défaussez les autres.',
    image: img('obsession.webp'),
    trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 4 },
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros (8)
  // ----------------------------------------------------------------------
  {
    id: 'peter-pan',
    name: 'Peter Pan',
    englishName: 'Peter Pan',
    deck: 'fate',
    type: 'hero',
    strength: 8,
    copies: 1,
    text: "Dès qu'il est dévoilé, jouez immédiatement Peter Pan sur l'Arbre du Pendu (débloqué ou non). Défaussez les autres cartes Fatalité dévoilées.",
    image: img('peter-pan.webp'),
    forcedFateLocation: 'arbre-pendu',
  },
  {
    id: 'wendy',
    name: 'Wendy',
    englishName: 'Wendy',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'La force de tous les autres Héros augmente de 1.',
    image: img('wendy.webp'),
    strengthMod: { target: 'heroes-realm', delta: 1, excludeSelf: true },
  },
  {
    id: 'jean',
    name: 'Jean',
    englishName: 'John',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Si au moins un Objet est associé à Jean, sa force augmente de 1.',
    image: img('jean.webp'),
    selfStrengthMods: [{ kind: 'if-attached-item', delta: 1 }],
  },
  {
    id: 'michel',
    name: 'Michel',
    englishName: 'Michael',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text: 'La force de Michel augmente de 1 par lieu occupé par au moins un Héros (le sien compris).',
    image: img('michel.webp'),
    selfStrengthMods: [{ kind: 'per-location-with-hero', delta: 1 }],
  },
  {
    id: 'tic-tac',
    name: 'Tic Tac',
    englishName: 'Tick Tock',
    deck: 'fate',
    type: 'hero',
    strength: 5,
    copies: 1,
    text: 'Si le Capitaine Crochet se déplace sur le lieu de Tic Tac, il défausse immédiatement toute sa main.',
    image: img('tic-tac.webp'),
  },
  {
    id: 'clochette',
    name: 'Clochette',
    englishName: 'Tinker Bell',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Défaussez un Allié sur le lieu où vous jouez Clochette.',
    image: img('clochette.webp'),
    onPlace: [{ type: 'DISCARD_ALLY_AT_HOST' }],
  },
  {
    id: 'enfants-perdus',
    name: 'Enfants Perdus',
    englishName: 'Lost Boys',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 2,
    text: 'Le Capitaine Crochet doit utiliser au moins 2 Alliés pour éliminer les Enfants Perdus.',
    image: img('enfants-perdus.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Objets (5)
  // ----------------------------------------------------------------------
  {
    id: 'poussiere-fee',
    name: 'Poussière de Fée',
    englishName: 'Pixie Dust',
    deck: 'fate',
    type: 'item',
    attach: 'hero',
    copies: 3,
    text: 'Associez cette carte à un Héros, sa force augmente de 2.',
    image: img('poussiere-fee.webp'),
  },
  {
    id: 'provocation',
    name: 'Provocation',
    englishName: 'Taunt',
    deck: 'fate',
    type: 'item',
    attach: 'hero',
    copies: 2,
    text: 'Associez cette carte à un Héros. Le Capitaine Crochet doit éliminer les Héros provocateurs avant les autres Héros.',
    image: img('provocation.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Effets (2)
  // ----------------------------------------------------------------------
  {
    id: 'migraine-atroce',
    name: 'Migraine Atroce',
    englishName: 'Splitting Headache',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Défaussez un Objet de votre choix du royaume de la cible.',
    image: img('migraine-atroce.webp'),
  },
]
