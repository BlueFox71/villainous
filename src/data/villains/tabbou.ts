// =============================================================================
// Tabbou — plateau (VillainDef). Vilain collab thème « Super Smash Bros. /
// Émissaire Subspatial » (conçu par Jules, tableur Villainous Template_Jules.ods,
// onglet « Tabbou »).
//
// MÉCANIQUE INÉDITE : une pioche de TUILES COMBATTANTS colorées. Tabbou les
// DÉVOILE (pioche → réserve commune, action custom REVEAL_FIGHTER de l'Émissaire +
// cartes Destin/Primides/Flèche) puis les TUE par couleur (cartes Collection/Coup
// Fatal/Bowser). Objectif : avoir TUÉ ≥ 20 Combattants au début de son tour (30 tant
// que Samus est présente). Le 4ᵉ lieu (Émissaire Subspatial) est VERROUILLÉ au départ
// et se débloque en posant 3 Orbes subspatiaux sur les 3 autres lieux.
//
// Plateau décodé depuis Realm.png (haut = rangée recouvrable par un Héros).
// =============================================================================

import type { FighterColor, VillainDef } from '../../engine/types'

// --- Pioche de tuiles Combattants -------------------------------------------
// 35 tuiles (arts découpés dans assets/decks/Tabbou/, fond de couleur = groupe).
// Répartition des couleurs relevée sur les illustrations.
const FIGHTER_COLORS: FighterColor[] = [
  'magenta', 'magenta', 'magenta', // 1-3
  'orange', 'orange', // 4-5
  'rouge', 'rouge', 'rouge', 'rouge', // 6-9
  'marron', 'marron', // 10-11
  'bleu', 'bleu', // 12-13
  'violet', 'violet', 'violet', 'violet', // 14-17
  'vert', 'vert', 'vert', 'vert', // 18-21
  'jaune', 'jaune', 'jaune', // 22-24
  'gris', 'gris', 'gris', 'gris', 'gris', 'gris', 'gris', 'gris', 'gris', 'gris', 'gris', // 25-35
]

// Nom du combattant (Super Smash Bros.) de chaque tuile, dans l'ordre des illustrations
// (combattant-1 → 35). Les groupes de couleur suivent les franchises (Kirby=magenta,
// Kong=orange, Mario=rouge, Fire Emblem=marron, EarthBound=bleu, Pokémon=violet,
// Zelda=vert, Star Fox=jaune, divers=gris).
const FIGHTER_NAMES: string[] = [
  'Meta Knight', 'Kirby', 'Roi Dadidou', // 1-3 (magenta)
  'Diddy Kong', 'Donkey Kong', // 4-5 (orange)
  'Luigi', 'Mario', 'Peach', 'Bowser', // 6-9 (rouge)
  'Ike', 'Marth', // 10-11 (marron)
  'Ness', 'Lucas', // 12-13 (bleu)
  'Dresseur de Pokémon', 'Pikachu', 'Lucario', 'Rondoudou', // 14-17 (violet)
  'Zelda / Sheik', 'Link', 'Ganondorf', 'Link Cartoon', // 18-21 (vert)
  'Fox', 'Wolf', 'Falco', // 22-24 (jaune)
  'Olimar', 'Mr. Game & Watch', 'Captain Falcon', 'Ice Climbers', 'Pit', 'R.O.B.', // 25-30 (gris)
  'Yoshi', 'Sonic', 'Wario', 'Snake', 'Samus', // 31-35 (gris)
]

const fighterTiles = FIGHTER_COLORS.map((color, i) => ({
  color,
  art: `/cards/tabbou/tuiles/combattant-${i + 1}.png`,
  name: FIGHTER_NAMES[i],
}))

export const tabbou: VillainDef = {
  id: 'tabbou',
  name: 'Tabbou',
  objective: { type: 'KILL_FIGHTERS', threshold: 20, raiseHeroCardId: 'samus', raiseTo: 30 },
  boardObjective: 'Au début de votre tour, vous devez avoir tué au moins 20 Combattants.',
  objectiveDescription:
    "Au début de votre tour, avoir TUÉ au moins 20 Combattants (30 tant que Samus est " +
    "présente). Dévoilez des tuiles Combattants (Émissaire Subspatial, Destin, Primides…) " +
    "vers la réserve, puis tuez-les par couleur (Collection, Coup Fatal, Bowser). Débloquez " +
    "l'Émissaire en posant 3 Orbes subspatiaux sur les 3 autres lieux.",
  boardImage: '/cards/tabbou/board.png',
  pawnImage: '/pion_tabbou.png',
  pawnHeightPx: 96,
  backVillainImage: '/cards/tabbou/back_villain.png',
  backFateImage: '/cards/tabbou/back_fatality.png',
  lockedLocationsAtStart: ['emissaire'],
  fighterSetup: {
    tiles: fighterTiles,
    emissaireLocationId: 'emissaire',
    orbLocationIds: ['stade', 'chateau', 'halberd'],
  },
  locations: [
    {
      id: 'stade',
      name: 'Stade',
      actions: [
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
      ],
    },
    {
      id: 'chateau',
      name: 'Château',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Vaincre' },
      ],
    },
    {
      id: 'halberd',
      name: 'Halberd',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
      ],
    },
    {
      id: 'emissaire',
      name: 'Émissaire Subspatial',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'reveal-fighter', type: 'REVEAL_FIGHTER', row: 'bottom', label: 'Dévoiler une tuile Combattant' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
      ],
    },
  ],
}
