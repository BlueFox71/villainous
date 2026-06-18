// =============================================================================
// Pat Hibulaire (Pete) — plateau (Realm). Vilain officiel (extension « Cruellement
// Infects » / Perfectly Wretched). 4 étoiles : sa mise en place tire 4 tuiles
// Objectif au hasard parmi 5, ce qui rend chaque partie différente.
//
// Source : images FR du dossier assets/decks/Pat Hibulaire/ (texte recopié
// fidèlement) + wiki Villainous (https://disney-villainous.fandom.com/wiki/Pete).
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Frontier Town    haut: Jouer · Gagner 2      bas: Déplacer · Éliminer
//   Station Service  haut: Gagner 1 · Jouer       bas: Fatalité · Défausser
//   Aéroport         haut: Déplacer · Fatalité    bas: Jouer · Gagner 1
//   Ponton           haut: Défausser · Jouer       bas: Jouer · Gagner 3
//
// Objectif (unique, voir ObjectiveDef 'COMPLETE_GOAL_TOKENS') : remplir les 4
// tuiles Objectif tirées à la mise en place (une par lieu). Mickey présent dans le
// royaume interdit toute complétion.
// =============================================================================

import type { PeteGoalKind, VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/pat-hibulaire/${f}`

export const patHibulaire: VillainDef = {
  id: 'patHibulaire',
  name: 'Pat Hibulaire',
  objective: { type: 'COMPLETE_GOAL_TOKENS', blockerHeroCardId: 'mickey' },
  objectiveDescription:
    'À la mise en place, 4 de vos 5 tuiles Objectif sont posées face cachée, une ' +
    'sur chaque lieu. Remplissez vos 4 tuiles pour gagner. Tant que Mickey est ' +
    'présent dans votre royaume, vous ne pouvez remplir aucune tuile Objectif.',
  boardImage: img('board.png'),
  pawnImage: '/pion_pat-hibulaire.png',
  pawnHeightPx: 116,
  backVillainImage: img('back-villain.png'),
  backFateImage: img('back-fate.png'),
  goalKinds: ['win-big', 'power-play', 'strike-it-rich', 'round-up', 'rule-the-realm'],
  locations: [
    {
      id: 'frontier-town',
      name: 'Frontier Town',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
      ],
    },
    {
      id: 'station-service',
      name: 'Station Service',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
      ],
    },
    {
      id: 'aeroport',
      name: 'Aéroport',
      actions: [
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
      ],
    },
    {
      id: 'ponton',
      name: 'Ponton',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
      ],
    },
  ],
}

/** Présentation des 5 tuiles Objectif (nom FR, texte recopié, image). Le MOTEUR
 *  ne s'en sert pas (il raisonne sur `PeteGoalKind`) ; l'UI l'utilise pour rendre
 *  les tuiles. */
export const PAT_GOAL_INFO: Record<
  PeteGoalKind,
  { name: string; englishName: string; text: string; image: string }
> = {
  'win-big': {
    name: 'Jackpot',
    englishName: 'Win Big',
    text: 'Gagner au moins 4 jetons Pouvoir en jouant UNE PETITE PARTIE ? sur ce lieu.',
    image: img('goal-jackpot.png'),
  },
  'power-play': {
    name: 'Soif de Pouvoir',
    englishName: 'Power Play',
    text: 'Dépenser au moins 6 jetons Pouvoir en un seul tour quand Pat Hibulaire se trouve sur ce lieu.',
    image: img('goal-soif-pouvoir.png'),
  },
  'strike-it-rich': {
    name: 'Signe de Richesse',
    englishName: 'Strike It Rich',
    text: 'Posséder au moins 3 Objets sur ce lieu au début de votre tour.',
    image: img('goal-signe-richesse.png'),
  },
  'round-up': {
    name: 'Bande Puissante',
    englishName: 'Round Up',
    text: "Posséder des Alliés d'une force totale de 10 ou plus sur ce lieu au début de votre tour.",
    image: img('goal-bande-puissante.png'),
  },
  'rule-the-realm': {
    name: 'Main Basse sur la Ville',
    englishName: 'Rule the Realm',
    text: 'Posséder plus d’Alliés que de Héros sur chaque lieu de votre royaume au début de votre tour.',
    image: img('goal-main-basse.png'),
  },
}
