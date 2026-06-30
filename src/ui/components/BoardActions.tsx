import { useRef } from 'react'
import type { LocationAction, PlayerState } from '../../engine/types'
import { enlargeCoveredAction } from '../../engine/rules'
import { SUGAR_RUSH_TRACK } from './sugarRushTrack'
import { customActionPosFor } from './customActionPos'
import { COL_RECTS, HERO_BAND, BOARD_W, BOARD_H } from '../editor/boardLayout'

// Diamètre d'un bouton rond, en % de la largeur de l'image (carré via aspect-ratio).
const BUTTON_SIZE = 4.9 // %

/**
 * Coordonnées (en % de l'image : x = largeur, y = hauteur) de chaque icône
 * d'action, par vilain → lieu → id d'action. MESURES À AFFINER (comme le pion) :
 * ouvrir l'inspecteur et ajuster left/top de chaque bouton.
 */
const ACTION_POS: Record<string, Record<string, Record<string, { x: number; y: number }>>> = {
  princeJohn: {
    sherwood: {
      'gain-power': { x: 22.5, y: 19.95 },
      discard: { x: 30.41, y: 19.95 },
      'play-card': { x: 22.5, y: 66.8 },
      fate: { x: 30.41, y: 66.8 },
    },
    church: {
      'gain-power': { x: 43.35, y: 19.95 },
      'play-card-top': { x: 51.26, y: 19.95 },
      'play-card-bottom': { x: 43.35, y: 66.8 },
      'move-item-ally': { x: 51.26, y: 66.8 },
    },
    nottingham: {
      fate: { x: 64.19, y: 19.95 },
      'gain-power': { x: 72.1, y: 19.95 },
      vanquish: { x: 64.19, y: 66.8 },
      'play-card': { x: 72.1, y: 66.8 },
    },
    jail: {
      'gain-power': { x: 82.8, y: 66.8 },
      'play-card': { x: 88.7, y: 66.8 },
      discard: { x: 94.6, y: 66.8 },
    },
  },
  // Coordonnées Maléfique : approximatives, calées visuellement à affiner via
  // l'inspecteur (mêmes axes x que PJ — les 4 lieux occupent grosso modo les
  // mêmes positions horizontales sur l'image).
  maleficent: {
    mountains: {
      'move-item-ally': { x: 22.7, y: 20.1 },
      'play-card-top': { x: 30.5, y: 20.6 },
      'gain-power': { x: 22.65, y: 67.8 },
      fate: { x: 30.45, y: 67.8 },
    },
    cottage: {
      'gain-power': { x: 43.5, y: 20.4 },
      'move-item-ally': { x: 51.4, y: 20.35 },
      'play-card': { x: 43.45, y: 67.8 },
      discard: { x: 51.3, y: 67.8 },
    },
    forest: {
      discard: { x: 64.3, y: 20.6 },
      'play-card-top': { x: 72.1, y: 20.8 },
      'gain-power': { x: 64.2, y: 67.8 },
      'play-card-bottom': { x: 72.1, y: 67.8 },
    },
    castle: {
      'gain-power': { x: 85.1, y: 20.5 },
      fate: { x: 92.9, y: 20.5 },
      vanquish: { x: 85, y: 67.8 },
      'play-card': { x: 92.9, y: 67.9 },
    },
  },
  // Slenderman : même gabarit de plateau (panneau objectif à gauche + 4 lieux),
  // colonnes ~22/30 · 43/51 · 64/72 · 85/93 %, rangées haut ~20 % / bas ~68 %.
  // Mesuré sur board.png (Realm) via grille de coordonnées — à affiner si besoin.
  slenderman: {
    foret: {
      'move-item-ally': { x: 22.5, y: 20.1 },
      'gain-power': { x: 30.3, y: 19.9 },
      'play-card': { x: 22.5, y: 67.8 },
      fate: { x: 30.3, y: 67.7 },
    },
    tunnel: {
      'play-card-top': { x: 43.4, y: 20 },
      'gain-power': { x: 51.3, y: 20.35 },
      'play-card-bottom': { x: 43.3, y: 67.4 },
      discard: { x: 51.2, y: 67.8 },
    },
    mine: {
      fate: { x: 64.2, y: 20 },
      'play-card-top': { x: 72.1, y: 20 },
      'play-card-bottom': { x: 64.2, y: 67.8 },
      'gain-power': { x: 72.2, y: 67.9 },
    },
    'maison-perdue': {
      'move-hero': { x: 85.5, y: 20 },
      discard: { x: 93.4, y: 20.3 },
      'play-card': { x: 85.5, y: 67.8 },
      'gain-power': { x: 93.3, y: 67.9 },
    },
  },
  // Jafar : icônes calées sur board.png (panneau objectif à gauche + 4 lieux).
  // Le symbole « nuage + éclair » = action ACTIVER (capacités activées).
  jafar: {
    palais: {
      'play-card': { x: 22.7, y: 19.9 },
      activate: { x: 30.5, y: 19.9 },
      vanquish: { x: 22.7, y: 67 },
      fate: { x: 30.5, y: 67 },
    },
    rues: {
      'gain-power': { x: 43.5, y: 19.9 },
      fate: { x: 51.4, y: 19.9 },
      discard: { x: 43.5, y: 67 },
      'play-card': { x: 51.4, y: 67 },
    },
    oasis: {
      activate: { x: 64.3, y: 19.9 },
      'play-card-top': { x: 72.2, y: 19.9 },
      'gain-power': { x: 64.3, y: 67 },
      'play-card-bottom': { x: 72.2, y: 67 },
    },
    caverne: {
      discard: { x: 85.1, y: 19.9 },
      'gain-power': { x: 93, y: 19.9 },
      'play-card': { x: 85.1, y: 67 },
      'move-item-ally': { x: 93, y: 67 },
    },
  },
  // Reine de Cœur : même gabarit de plateau (panneau objectif + 4 lieux).
  reineCoeur: {
    'cour-palais': {
      discard: { x: 22.7, y: 20.5 },
      'move-item-ally': { x: 30.6, y: 20.5 },
      'gain-power': { x: 22.7, y: 67.9 },
      'play-card': { x: 30.6, y: 67.9 },
    },
    labyrinthe: {
      'play-card-top': { x: 43.5, y: 20.5 },
      activate: { x: 51.4, y: 20.5 },
      'gain-power': { x: 43.5, y: 68 },
      'play-card-bottom': { x: 51.4, y: 68 },
    },
    'foret-tulgey': {
      fate: { x: 64.4, y: 20.5 },
      'play-card': { x: 72.3, y: 20.5 },
      discard: { x: 64.4, y: 68 },
      vanquish: { x: 72.3, y: 68 },
    },
    'maison-lapin': {
      'play-card': { x: 85.3, y: 20.7 },
      'gain-power': { x: 93.1, y: 20.7 },
      activate: { x: 85.2, y: 68 },
      fate: { x: 93, y: 68 },
    },
  },
  // Capitaine Crochet : même gabarit de plateau (panneau objectif + 4 lieux).
  crochet: {
    'jolly-roger': {
      'gain-power': { x: 22.7, y: 20.8 },
      discard: { x: 30.5, y: 20.8 },
      vanquish: { x: 22.7, y: 68 },
      'play-card': { x: 30.5, y: 68 },
    },
    'rocher-crane': {
      'gain-power': { x: 43.5, y: 20.9 },
      'play-card': { x: 51.4, y: 21 },
      fate: { x: 43.6, y: 67.5 },
      discard: { x: 51.3, y: 68.4 },
    },
    'lagune-sirenes': {
      'play-card-top': { x: 64.4, y: 20.8 },
      'move-item-ally': { x: 72.2, y: 21 },
      'gain-power': { x: 64.3, y: 68 },
      'play-card-bottom': { x: 72.2, y: 68.2 },
    },
    'arbre-pendu': {
      fate: { x: 85.2, y: 21 },
      'gain-power': { x: 93, y: 21 },
      'move-hero': { x: 85.1, y: 68.2 },
      'play-card': { x: 93, y: 68.6 },
    },
  },
  // Ursula : même gabarit de plateau (panneau objectif + 4 lieux).
  ursula: {
    repaire: {
      'gain-power': { x: 22.7, y: 20.3 },
      activate: { x: 30.6, y: 20.4 },
      'move-item-ally': { x: 22.7, y: 68 },
      'play-card': { x: 30.5, y: 68 },
    },
    navire: {
      'gain-power': { x: 43.6, y: 20.6 },
      'play-card': { x: 51.4, y: 20 },
      fate: { x: 43.5, y: 68 },
      discard: { x: 51.4, y: 68 },
    },
    rivage: {
      'play-card-top': { x: 64.35, y: 20.5 },
      discard: { x: 72.2, y: 20.2 },
      'gain-power': { x: 64.4, y: 67.6 },
      'play-card-bottom': { x: 72.1, y: 68 },
    },
    palais: {
      'move-item-ally': { x: 85.15, y: 20.3 },
      fate: { x: 92.95, y: 20.3 },
      'move-hero': { x: 85.1, y: 68 },
      'gain-power': { x: 92.95, y: 67.5 },
    },
  },
  // Hadès : même gabarit de plateau (panneau objectif à gauche + 4 lieux).
  // Ordre gauche|droite conforme à la disposition (Enfers, Thèbes, Jardins, Mont Olympe).
  hades: {
    enfers: {
      'play-card-top': { x: 22.9, y: 19.3 },
      'gain-power': { x: 30.77, y: 19.4 },
      vanquish: { x: 22.9, y: 66 },
      'move-item-ally': { x: 30.6, y: 66 },
    },
    thebes: {
      'gain-power': { x: 43.68, y: 19.2 },
      'play-card-top': { x: 51.5, y: 19.4 },
      fate: { x: 43.8, y: 66 },
      discard: { x: 51.5, y: 66.5 },
    },
    jardins: {
      discard: { x: 64.5, y: 19.4 },
      'play-card-top': { x: 72.35, y: 19.5 },
      'gain-power': { x: 64.5, y: 66.6 },
      'play-card-bottom': { x: 72.3, y: 67 },
    },
    'mont-olympe': {
      fate: { x: 85.3, y: 19.5 },
      'move-item-ally': { x: 93.15, y: 19.6 },
      'play-card-bottom': { x: 85.3, y: 66.8 },
      'gain-power': { x: 93.1, y: 66.8 },
    },
  },
  // Dr Facilier : même plateau physique qu'Hadès (boîte « Mauvais jusqu'à l'os »),
  // donc mêmes colonnes/rangées ; seuls les ids d'action diffèrent.
  facilier: {
    'royaume-vaudou': {
      'gain-power': { x: 22.9, y: 19.9 },
      fate: { x: 30.77, y: 19.7 },
      vanquish: { x: 22.9, y: 67.6 },
      'play-card': { x: 30.7, y: 67.5 },
    },
    parade: {
      'gain-power': { x: 43.69, y: 19.9 },
      'play-card-top': { x: 51.5, y: 20 },
      discard: { x: 43.6, y: 67.5 },
      'move-item-ally': { x: 51.5, y: 67.5 },
    },
    'chez-tiana': {
      discard: { x: 64.5, y: 20.5 },
      'gain-power': { x: 72.3, y: 20.2 },
      'play-card': { x: 64.45, y: 67.5 },
      fate: { x: 72.2, y: 67.6 },
    },
    bayou: {
      'move-item-ally': { x: 85.3, y: 20.5 },
      'play-card-top': { x: 93.1, y: 20.5 },
      'play-card-bottom': { x: 85.2, y: 67.8 },
      'gain-power': { x: 93, y: 67.7 },
    },
  },
  // L'Imposteur : plateau Among Us (panneau objectif à gauche + 4 lieux). Icônes
  // en 2×2 par lieu ; colonnes ~22.9/30.77 · 43.68/51.5 · 64.5/72.35 · 85.3/93.15,
  // rangées haut ~21.5 % / bas ~65 %. Mesuré sur board.png.
  imposteur: {
    electrical: {
      fate: { x: 22.5, y: 20 },
      'play-card-top': { x: 30.4, y: 20 },
      'gain-power': { x: 22.5, y: 67.5 },
      activate: { x: 30.4, y: 67.5 },
    },
    reacteur: {
      'move-item-ally': { x: 43.4, y: 20 },
      'gain-power': { x: 51.25, y: 20 },
      'play-card-bottom': { x: 43.4, y: 67.5 },
      discard: { x: 51.2, y: 67.5 },
    },
    admin: {
      'play-card-top': { x: 64.3, y: 20 },
      activate: { x: 72.1, y: 20 },
      'play-card-bottom': { x: 64.3, y: 67.2 },
      'gain-power': { x: 72.15, y: 67.3 },
    },
    cafeteria: {
      'gain-power': { x: 85.3, y: 20 },
      discard: { x: 93.1, y: 20 },
      fate: { x: 85.3, y: 67.5 },
      'play-card-bottom': { x: 93.1, y: 67.4 },
    },
  },
  // Bowser : centres mesurés directement sur board.png (détection des anneaux des
  // icônes). L'éclair = Fatalité (confirmé au Château de Peach), pas Activer.
  bowser: {
    'chateau-bowser': {
      'play-card': { x: 22.5, y: 19.8 },
      fate: { x: 30.4, y: 19.8 },
      'gain-power': { x: 22.5, y: 67.6 },
      'move-item-ally': { x: 30.4, y: 67.2 },
    },
    galaxies: {
      'play-card': { x: 43.4, y: 20 },
      'gain-power': { x: 51.2, y: 20 },
      activate: { x: 43.3, y: 67.4 },
      discard: { x: 51.1, y: 67.5 },
    },
    observatoire: {
      discard: { x: 64.2, y: 20 },
      'play-card-top': { x: 72.2, y: 20 },
      'gain-power': { x: 64.3, y: 67.3 },
      'play-card-bottom': { x: 72.2, y: 67.4 },
    },
    'chateau-peach': {
      'play-card': { x: 85.1, y: 20 },
      'move-hero': { x: 93, y: 20.2 },
      vanquish: { x: 85.1, y: 67.5 },
      fate: { x: 92.9, y: 67.5 },
    },
  },
  // La Méchante Reine : même gabarit (panneau objectif à gauche + 4 lieux),
  // colonnes ~22.5/30.4 · 43.4/51.3 · 64.2/72.2 · 85.3/93.1. Particularité : le
  // Laboratoire porte 3 actions en bas (Jouer · Fatalité · Préparer du poison).
  // MESURES À AFFINER via l'inspecteur.
  'mechante-reine': {
    laboratoire: {
      'gain-power': { x: 22.5, y: 20 },
      'move-hero': { x: 30.4, y: 20 },
      'play-card': { x: 20.5, y: 67.5 },
      fate: { x: 26.5, y: 67.5 },
      'brew-poison': { x: 32.5, y: 67.5 },
    },
    foret: {
      'gain-power': { x: 43.4, y: 20 },
      activate: { x: 51.3, y: 20 },
      discard: { x: 43.4, y: 67.5 },
      'play-card': { x: 51.3, y: 67.5 },
    },
    mine: {
      'play-card-top': { x: 64.2, y: 20 },
      activate: { x: 72.2, y: 20 },
      'gain-power': { x: 64.2, y: 67.5 },
      'play-card-bottom': { x: 72.2, y: 67.5 },
    },
    'maison-des-nains': {
      discard: { x: 85.3, y: 20 },
      fate: { x: 93.1, y: 20 },
      'play-card': { x: 85.3, y: 67.5 },
      'gain-power': { x: 93.1, y: 67.5 },
    },
  },
  // Scar : même gabarit (panneau Succession à gauche + 4 lieux), colonnes
  // ~22.5/30.4 · 43.4/51.3 · 64.2/72.2 · 85.3/93.1, rangées haut ~20 / bas ~67.5.
  // MESURES À AFFINER via l'inspecteur si besoin.
  scar: {
    'rocher-lions': {
      'gain-power': { x: 22.5, y: 20 },
      'play-card-top': { x: 30.4, y: 20 },
      'play-card-bottom': { x: 22.5, y: 67.5 },
      'move-item-ally': { x: 30.4, y: 67.5 },
    },
    savane: {
      'play-card-top': { x: 43.4, y: 20 },
      fate: { x: 51.3, y: 20 },
      discard: { x: 43.4, y: 67.5 },
      'gain-power': { x: 51.3, y: 67.5 },
    },
    'cimetiere-elephants': {
      discard: { x: 64.2, y: 20 },
      'play-card-top': { x: 72.2, y: 20 },
      'play-card-bottom': { x: 64.2, y: 67.5 },
      'gain-power': { x: 72.2, y: 67.5 },
    },
    gorge: {
      'move-item-ally': { x: 85.3, y: 20 },
      'play-card-top': { x: 93.1, y: 20 },
      vanquish: { x: 85.3, y: 67.5 },
      fate: { x: 93.1, y: 67.5 },
    },
  },
  // Yzma : gabarit standard (4 lieux × 2 colonnes × 2 rangées). À affiner via l'inspecteur.
  yzma: {
    palais: {
      'gain-power': { x: 22.5, y: 20 },
      'move-item-ally': { x: 30.4, y: 20 },
      vanquish: { x: 22.5, y: 67.5 },
      'play-card': { x: 30.4, y: 67.5 },
    },
    'maison-pacha': {
      'play-card': { x: 43.4, y: 20 },
      'gain-power': { x: 51.3, y: 20 },
      'move-item-ally': { x: 43.4, y: 67.5 },
      fate: { x: 51.3, y: 67.5 },
    },
    jungle: {
      'play-card-top': { x: 64.2, y: 20 },
      discard: { x: 72.2, y: 20 },
      'gain-power': { x: 64.2, y: 67.5 },
      'play-card-bottom': { x: 72.2, y: 67.5 },
    },
    'poele-mudka': {
      'gain-power': { x: 85.3, y: 20 },
      fate: { x: 93.1, y: 20 },
      discard: { x: 85.3, y: 67.5 },
      'play-card': { x: 93.1, y: 67.5 },
    },
  },
  // Ratigan : plateau « Perfectly Wretched ». Mesuré sur board.png via grille de %.
  // Particularités : Repaire secret a la rangée HAUTE vide et 3 actions en bas
  // (Fatalité · Jouer · Activer) ; Buckingham Palace a 3 actions en bas
  // (Déplacer · Gagner 1 · Défausser). Le symbole éclair = Fatalité ; la carte à
  // encoches = Activer. MESURES À AFFINER via l'inspecteur si besoin.
  ratigan: {
    'repaire-secret': {
      fate: { x: 20.4, y: 68 },
      'play-card': { x: 26.7, y: 68 },
      activate: { x: 32.9, y: 68 },
    },
    'magasin-flaversham': {
      'play-card-top': { x: 43.7, y: 20.2 },
      discard: { x: 51.5, y: 20.2 },
      'gain-power': { x: 43.7, y: 68 },
      'play-card-bottom': { x: 51.5, y: 68 },
    },
    'big-ben': {
      'gain-power': { x: 64.6, y: 20.5 },
      'move-item-ally': { x: 72.3, y: 20.4 },
      'play-card': { x: 64.5, y: 68 },
      vanquish: { x: 72.4, y: 68 },
    },
    'buckingham-palace': {
      fate: { x: 85.3, y: 20.5 },
      'play-card': { x: 93.1, y: 20.2 },
      'move-item-ally': { x: 83, y: 68 },
      'gain-power': { x: 89.2, y: 68 },
      discard: { x: 95.5, y: 68 },
    },
  },
  // Sombra : même gabarit de plateau que Maléfique/Slenderman (panneau objectif à
  // gauche + 4 lieux). Colonnes ~22,7/30,5 · 43,5/51,4 · 64,3/72,1 · 85,1/92,9 % ;
  // rangées haut ~20,4 % / bas ~67,8 %.
  sombra: {
    castillo: {
      'play-card-top': { x: 22.7, y: 20.4 },
      'gain-power': { x: 30.5, y: 20.4 },
      discard: { x: 22.7, y: 67.8 },
      activate: { x: 30.5, y: 67.8 },
    },
    'los-muertos': {
      'gain-power': { x: 43.5, y: 20.4 },
      'move-item-ally': { x: 51.4, y: 20.4 },
      'play-card': { x: 43.5, y: 67.8 },
      fate: { x: 51.4, y: 67.8 },
    },
    dorado: {
      discard: { x: 64.3, y: 20.4 },
      'play-card-top': { x: 72.1, y: 20.4 },
      'gain-power': { x: 64.3, y: 67.8 },
      'play-card-bottom': { x: 72.1, y: 67.8 },
    },
    lumerico: {
      fate: { x: 85.1, y: 20.4 },
      activate: { x: 92.9, y: 20.4 },
      'move-hero': { x: 85.1, y: 67.8 },
      'gain-power': { x: 92.9, y: 67.8 },
    },
  },
  // Cruella d'Enfer : même gabarit (panneau objectif à gauche + 4 lieux). Castel
  // D'Enfer porte 3 actions en bas (Jouer · Gagner 1 · Défausser). MESURES À AFFINER.
  cruella: {
    'maison-radcliff': {
      fate: { x: 22.7, y: 20 },
      activate: { x: 30.5, y: 20 },
      vanquish: { x: 22.7, y: 67.8 },
      'play-card': { x: 30.5, y: 67.8 },
    },
    campagne: {
      'play-card-top': { x: 43.5, y: 20 },
      'move-item-ally': { x: 51.4, y: 20 },
      'gain-power': { x: 43.5, y: 67.8 },
      'play-card-bottom': { x: 51.4, y: 67.8 },
    },
    laiterie: {
      discard: { x: 64.3, y: 20 },
      'gain-power': { x: 72.1, y: 20 },
      'play-card': { x: 64.3, y: 67.8 },
      fate: { x: 72.1, y: 67.8 },
    },
    castel: {
      'move-item-ally': { x: 85.1, y: 20 },
      activate: { x: 92.9, y: 20 },
      'play-card': { x: 83, y: 67.8 },
      'gain-power': { x: 89.2, y: 67.8 },
      discard: { x: 95.5, y: 67.8 },
    },
  },
  // Gaston : même gabarit (panneau objectif/portrait à gauche + 4 lieux ; board.png
  // 4455×1248, ratio ~ celui de Cruella). Colonnes standard ~22,7/30,5 · 43,5/51,4 ·
  // 64,3/72,1 · 85,1/92,9 % ; rangées haut ~20 / bas ~68. MESURES À AFFINER.
  gaston: {
    'maison-belle': {
      vanquish: { x: 22.7, y: 19 },
      'play-card-top': { x: 30.5, y: 19 },
      discard: { x: 22.7, y: 66.8 },
      'gain-power': { x: 30.5, y: 66.8 },
    },
    taverne: {
      activate: { x: 43.5, y: 19 },
      'gain-power': { x: 51.4, y: 19 },
      'play-card': { x: 43.5, y: 66.8 },
      vanquish: { x: 51.4, y: 66.8 },
    },
    bois: {
      'play-card-top': { x: 64.5, y: 19 },
      discard: { x: 72.4, y: 19 },
      fate: { x: 64.5, y: 66.8 },
      'gain-power': { x: 72.5, y: 66.8 },
    },
    'chateau-bete': {
      'play-card-top': { x: 85.5, y: 19 },
      fate: { x: 93.4, y: 19 },
      'play-card-bottom': { x: 85.5, y: 66.8 },
      'gain-power': { x: 93.4, y: 66.8 },
    },
  },
  // Mère Gothel : plateau large (panneau Confiance à gauche + 4 lieux). Tour & Corona
  // en 2×2 ; Le Canard boiteux & Forêt en 1 (haut) + 3 (bas). Rangées haut ~23 % /
  // bas ~60 %. MESURES À AFFINER via l'inspecteur si besoin.
  gothel: {
    tour: {
      'move-item-ally': { x: 22.8, y: 19 },
      fate: { x: 30.6, y: 19 },
      'play-card': { x: 22.8, y: 66.6 },
      vanquish: { x: 30.6, y: 66.5 },
    },
    'canard-boiteux': {
      'play-card-top': { x: 47.5, y: 18.5 },
      'gain-power': { x: 41.2, y: 66.9 },
      'play-card-bottom': { x: 47.5, y: 66.9 },
      discard: { x: 53.8, y: 66.8 },
    },
    foret: {
      'play-card-top': { x: 68.2, y: 18.5 },
      'gain-power': { x: 61.85, y: 66 },
      'play-card-bottom': { x: 68.1, y: 66 },
      'move-item-ally': { x: 74.4, y: 66 },
    },
    corona: {
      'gain-power': { x: 85.15, y: 18.6 },
      discard: { x: 93, y: 18.5 },
      'play-card': { x: 85.1, y: 66.3 },
      fate: { x: 92.9, y: 66 },
    },
  },
  // Pat Hibulaire : même gabarit que Scar (board.png 4492×1256, ratio quasi
  // identique), 4 lieux × 2 colonnes × 2 rangées. Colonnes ~22.5/30.4 · 43.4/51.3
  // · 64.2/72.2 · 85.3/93.1, rangées haut ~20 / bas ~67.5. Calé visuellement sur
  // board.png (icônes alignées) — à affiner via l'inspecteur si besoin.
  patHibulaire: {
    'frontier-town': {
      'play-card': { x: 22.8, y: 18.8 },
      'gain-power': { x: 30.7, y: 18.7 },
      'move-item-ally': { x: 22.75, y: 66.2 },
      vanquish: { x: 30.6, y: 66.2 },
    },
    'station-service': {
      'gain-power': { x: 43.7, y: 18.5 },
      'play-card': { x: 51.5, y: 18.8 },
      fate: { x: 43.6, y: 66.5 },
      discard: { x: 51.45, y: 66.5 },
    },
    aeroport: {
      'move-item-ally': { x: 64.45, y: 19 },
      fate: { x: 72.3, y: 19 },
      'play-card': { x: 64.4, y: 66.6 },
      'gain-power': { x: 72.3, y: 66.6 },
    },
    ponton: {
      discard: { x: 85.3, y: 19.4 },
      'play-card-top': { x: 93.2, y: 19.4 },
      'play-card-bottom': { x: 85.2, y: 67.1 },
      'gain-power': { x: 93.1, y: 67.4 },
    },
  },
  // Le Seigneur des clés : gabarit standard (panneau objectif à gauche + 4 lieux),
  // colonnes ~22.7/30.5 · 43.5/51.4 · 64.3/72.1 · 85.1/92.9 %, rangées haut ~20 /
  // bas ~67.8. La Crypte porte 2 actions « Jouer » en haut et Gagner 3 · Obtenir une
  // clé en bas. MESURES À AFFINER via l'inspecteur.
  'seigneur-cles': {
    crypte: {
      'play-card-top': { x: 23, y: 20 },
      'play-card-top2': { x: 31, y: 20.5 },
      'gain-power': { x: 23, y: 67.8 },
      'obtain-key': { x: 30.9, y: 68 },
    },
    cachot: {
      'play-card-top': { x: 43.5, y: 20 },
      'gain-power': { x: 51.3, y: 20 },
      'play-card-bottom': { x: 43.3, y: 67.8 },
      discard: { x: 51.2, y: 67.8 },
    },
    cimetiere: {
      discard: { x: 64.3, y: 20 },
      'gain-power': { x: 72.1, y: 20 },
      'play-card': { x: 64.2, y: 67.5 },
      fate: { x: 72.1, y: 67.8 },
    },
    'fosse-commune': {
      fate: { x: 88.8, y: 20 },
      'move-hero': { x: 95.2, y: 67 },
      vanquish: { x: 82.6, y: 67.8 },
      'gain-power': { x: 88.9, y: 67.5 },
    },
  },
  // Madame de Trémaine : gabarit standard (panneau objectif à gauche + 4 lieux),
  // colonnes ~22.7/30.5 · 43.5/51.4 · 64.3/72.1 · 85.1/92.9 %, rangées haut ~20 /
  // bas ~67.8. La Salle de Bal n'a que 3 actions (en bas : Activer · Jouer · Déplacer).
  // MESURES À AFFINER via l'inspecteur.
  'madame-tremaine': {
    'chambre-cendrillon': {
      'play-card': { x: 22.7, y: 20 },
      'move-item-ally': { x: 30.5, y: 20 },
      discard: { x: 22.7, y: 67.8 },
      'gain-power': { x: 30.5, y: 67.8 },
    },
    'salle-musique': {
      fate: { x: 43.5, y: 20 },
      'gain-power': { x: 51.4, y: 20 },
      'play-card': { x: 43.5, y: 67.8 },
      'play-card2': { x: 51.4, y: 67.8 },
    },
    chateau: {
      'play-card': { x: 64.3, y: 20 },
      discard: { x: 72.1, y: 20 },
      fate: { x: 64.3, y: 67.8 },
      'gain-power': { x: 72.1, y: 67.8 },
    },
    'salle-de-bal': {
      activate: { x: 83, y: 67.8 },
      'play-card': { x: 89.2, y: 67.8 },
      'move-item-ally': { x: 95.5, y: 67.8 },
    },
  },
  // Le Seigneur des Ténèbres : gabarit standard (board.png 4480×1248, ratio 3,59 —
  // identique à Gaston/Cruella). Panneau objectif à gauche + 4 lieux ; colonnes
  // ~22.7/30.5 · 43.5/51.4 · 64.3/72.1 · 85.1/92.9 %, rangées haut ~20 / bas ~67.8.
  // Emplacements « Gagner pouvoir » repérés par les nombres imprimés (1/3/2).
  // MESURES À AFFINER via l'inspecteur si besoin.
  'seigneur-tenebres': {
    morva: {
      'play-card': { x: 22.7, y: 20 },
      fate: { x: 30.5, y: 20 },
      discard: { x: 22.7, y: 67.8 },
      'gain-power': { x: 30.5, y: 67.8 },
    },
    'royaume-petit-peuple': {
      'play-card-top': { x: 43.5, y: 20 },
      'gain-power': { x: 51.4, y: 20 },
      'play-card-bottom': { x: 43.5, y: 67.8 },
      vanquish: { x: 51.4, y: 67.8 },
    },
    cachots: {
      'play-card': { x: 64.3, y: 20 },
      'move-item-ally': { x: 72.1, y: 20 },
      fate: { x: 64.3, y: 67.8 },
      'gain-power': { x: 72.1, y: 67.8 },
    },
    'salle-trone': {
      vanquish: { x: 85.1, y: 20 },
      discard: { x: 92.9, y: 20 },
      'play-card': { x: 85.1, y: 67.8 },
      'move-item-ally': { x: 92.9, y: 67.8 },
    },
  },
  // Madame Mim : plateau standard (4460×1256). Particularité : 1 action en HAUT
  // (centrée) + 3 en BAS par lieu ; le Lieu du Duel a le HAUT vide. Centres de lieu
  // 26.5 / 47.5 / 68.5 / 89.5 ; bas étalé à ±7 %. MESURES À AFFINER via l'inspecteur.
  'madame-mim': {
    'the-woods': {
      'gain-power': { x: 26.7, y: 20 },
      'play-card': { x: 20.3, y: 67 },
      fate: { x: 26.7, y: 67 },
      'move-item-ally': { x: 33.1, y: 67 },
    },
    cabane: {
      'play-card': { x: 47.6, y: 20 },
      'gain-power': { x: 41.2, y: 67 },
      'move-item-ally': { x: 47.6, y: 67 },
      'move-hero': { x: 54, y: 67 },
    },
    'lieu-duel': {
      'gain-power': { x: 62, y: 67 },
      discard: { x: 68.4, y: 67 },
      fate: { x: 74.8, y: 67 },
    },
    marais: {
      'play-card': { x: 89.3, y: 19.7 },
      'gain-power': { x: 83, y: 67 },
      'play-card-bottom': { x: 89.3, y: 67 },
      discard: { x: 95.7, y: 67 },
    },
  },
  // Syndrome : plateau standard (4464×1256). 2 actions HAUT + 2 BAS par lieu. Centres de
  // lieu ≈ 26.6 / 47.4 / 68.2 / 89.0 ; colonnes à ±3,9 % ; rangées y 20 (haut) / 67.8 (bas).
  syndrome: {
    'maison-des-parr': {
      'play-card': { x: 22.7, y: 20 },
      fate: { x: 30.5, y: 20 },
      vanquish: { x: 22.7, y: 67.8 },
      'gain-power': { x: 30.5, y: 67.8 },
    },
    'ile-nomanisan': {
      'gain-power': { x: 43.5, y: 20 },
      'play-card': { x: 51.4, y: 20 },
      discard: { x: 43.5, y: 67.8 },
      'play-card-bottom': { x: 51.4, y: 67.8 },
    },
    'base-syndrome': {
      'play-card': { x: 64.3, y: 20 },
      vanquish: { x: 72.1, y: 20 },
      'play-card-bottom': { x: 64.3, y: 67.8 },
      'move-item-ally': { x: 72.1, y: 67.8 },
    },
    metroville: {
      discard: { x: 85.1, y: 20 },
      'play-card': { x: 92.9, y: 20 },
      fate: { x: 85.1, y: 67.8 },
      'gain-power': { x: 92.9, y: 67.8 },
    },
  },
  // Lotso : plateau standard. La Salle des Chenilles n'a pas d'action HAUT (les Héros s'y
  // réunissent) ; ses 3 actions sont alignées au milieu/bas.
  lotso: {
    'salle-des-chenilles': {
      discard: { x: 20.4, y: 66 },
      'play-card': { x: 26.8, y: 66 },
      'gain-power': { x: 33.1, y: 65.9 },
    },
    bibliotheque: {
      fate: { x: 43.6, y: 19 },
      'gain-power': { x: 51.5, y: 19 },
      'play-card': { x: 43.5, y: 66.8 },
      activate: { x: 51.5, y: 66.8 },
    },
    'cour-de-recreation': {
      'play-card': { x: 64.3, y: 19 },
      discard: { x: 72.1, y: 19 },
      fate: { x: 64.3, y: 65.8 },
      'gain-power': { x: 72.1, y: 65.8 },
    },
    'decharge-municipale': {
      'play-card': { x: 85.1, y: 19 },
      vanquish: { x: 92.9, y: 19 },
      'play-card-bottom': { x: 85.1, y: 65.8 },
      'move-item-ally': { x: 92.9, y: 66.8 },
    },
  },
}

// Sa Sucrerie — les 18 cases du CIRCUIT EN HUIT (a0..a17) sont positionnées par
// SUGAR_RUSH_TRACK (cf. BoardImage). On dérive l'entrée ACTION_POS du circuit pour
// que les boutons d'action se posent sur leurs icônes. Les 3 cases accessibles
// (derrière/dessus/devant) s'allument en jaune comme partout ailleurs.
ACTION_POS['sa-sucrerie'] = {
  'sugar-rush': Object.fromEntries(SUGAR_RUSH_TRACK.map((p, i) => [`a${i}`, p])),
}

// Shere Khan — 4 lieux alignés comme Prince Jean (panneau portrait à gauche).
// Coordonnées approximatives, calées visuellement (à affiner via l'inspecteur).
ACTION_POS['shere-khan'] = {
  riviere: {
    discard: { x: 26.5, y: 21 },
    fate: { x: 20.3, y: 66.3 },
    'play-card': { x: 26.7, y: 66.6 },
    vanquish: { x: 33.1, y: 66.6 },
  },
  'rocher-conseil': {
    fate: { x: 47.6, y: 21 },
    'play-card': { x: 41.3, y: 67 },
    'gain-power': { x: 47.7, y: 66 },
    move: { x: 54, y: 66 },
  },
  'ruines-anciennes': {
    'gain-power': { x: 68.5, y: 21 },
    'play-card': { x: 62.1, y: 66.6 },
    activate: { x: 68.5, y: 66.4 },
    discard: { x: 74.9, y: 66.7 },
  },
  'terres-desolees': {
    activate: { x: 85.5, y: 21 },
    'play-card': { x: 93.5, y: 21 },
    'gain-power': { x: 85.5, y: 66 },
    'play-card2': { x: 93.2, y: 66 },
  },
}

// Davy Jones — positions ESTIMÉES (à caler via l'inspecteur). 4 lieux, 2 actions par
// rangée (haut recouvrable / bas), de gauche à droite.
ACTION_POS['davy-jones'] = {
  'hollandais-volant': {
    'play-card': { x: 22.5, y: 21.5 },
    fate: { x: 30.5, y: 21.8 },
    'gain-power': { x: 22.5, y: 67 },
    vanquish: { x: 30.5, y: 67 },
  },
  'sous-le-pont': {
    'gain-power': { x: 43.4, y: 21.5 },
    'play-card': { x: 51.2, y: 21.5 },
    discard: { x: 43.5, y: 67 },
    'play-card2': { x: 51.3, y: 67 },
  },
  'quartiers-davy-jones': {
    move: { x: 64.2, y: 21.8 },
    'play-card': { x: 72, y: 21.5 },
    'play-card2': { x: 64.3, y: 67 },
    'gain-power': { x: 72.2, y: 67 },
  },
  'hauts-fonds': {
    discard: { x: 85.1, y: 22 },
    move: { x: 93, y: 22 },
    fate: { x: 85, y: 67 },
    'play-card': { x: 93, y: 67 },
  },
}

// Oogie Boogie — gabarit standard (board.png 4481×1254, ratio 3,57). Centres des
// pastilles vertes MESURÉS directement sur l'image (détection des anneaux). L'Antre
// n'a pas de rangée HAUT (prison de Sandy Claws) et porte 3 actions en bas, étalées.
ACTION_POS['oogie-boogie'] = {
  'ville-halloween': {
    'play-card': { x: 22.8, y: 20.2 },
    'gain-power': { x: 30.7, y: 20.4 },
    discard: { x: 22.8, y: 67.7 },
    'play-card2': { x: 30.65, y: 67.8 },
  },
  'cabane-trio': {
    'move-item-ally': { x: 43.6, y: 20.4 },
    fate: { x: 51.4, y: 20.3 },
    'gain-power': { x: 43.6, y: 67.8 },
    'play-card': { x: 51.5, y: 67.8 },
  },
  cimetiere: {
    vanquish: { x: 64.4, y: 20.4 },
    discard: { x: 72.2, y: 20.5 },
    'play-card': { x: 64.4, y: 67.6 },
    fate: { x: 72.1, y: 68 },
  },
  antre: {
    vanquish: { x: 82.7, y: 67.9 },
    'play-card': { x: 89.1, y: 67.8 },
    'gain-power': { x: 95.5, y: 67.8 },
  },
}

// Tamatoa — coordonnées estimées (gabarit standard 4 lieux × 2 actions HAUT + 2 BAS).
ACTION_POS['tamatoa'] = {
  'falaises-impossibles': {
    discard: { x: 22.5, y: 21.5 },
    'play-card': { x: 30.5, y: 21.5 },
    'gain-power': { x: 22.5, y: 67 },
    'play-card-bottom': { x: 30.5, y: 67 },
  },
  lalotai: {
    'gain-power': { x: 43.4, y: 21.5 },
    'play-card': { x: 51.2, y: 21.5 },
    discard: { x: 43.5, y: 67 },
    'move-item-ally': { x: 51.3, y: 67 },
  },
  'repaire-tamatoa': {
    'move-item-ally': { x: 64.2, y: 21.8 },
    fate: { x: 72, y: 21.5 },
    'play-card': { x: 64.3, y: 67 },
    'gain-power': { x: 72.2, y: 67 },
  },
  'cage-d-os': {
    'gain-power': { x: 85.1, y: 22 },
    'play-card': { x: 93, y: 22 },
    fate: { x: 85, y: 67 },
    vanquish: { x: 93, y: 67 },
  },
}

// Dio Brando — coordonnées calées sur la planche (objectif à gauche + 4 lieux).
// Manoir : Fatalité/Gagner 1 (haut), Jouer/Activer (bas) ; Le Caire : Jouer/Jouer (haut),
// Défausser/Gagner 3 (bas) ; Singapour : Défausser/Jouer (haut), Activer/Fatalité (bas) ;
// Tokyo : Déplacer un Héros/Jouer (haut), Éliminer/Gagner 2 (bas).
ACTION_POS['dio'] = {
  manoir: {
    fate: { x: 23.5, y: 24 },
    'gain-power': { x: 32, y: 24 },
    'play-card': { x: 23.5, y: 68 },
    activate: { x: 32, y: 68 },
  },
  'le-caire': {
    'play-card-top-1': { x: 44.5, y: 24 },
    'play-card-top-2': { x: 53, y: 24 },
    discard: { x: 44.5, y: 68 },
    'gain-power': { x: 53, y: 68 },
  },
  singapour: {
    discard: { x: 65, y: 24 },
    'play-card': { x: 73.5, y: 24 },
    activate: { x: 65, y: 68 },
    fate: { x: 73.5, y: 68 },
  },
  tokyo: {
    'move-hero': { x: 85.7, y: 24 },
    'play-card': { x: 94.2, y: 24 },
    vanquish: { x: 85.7, y: 68 },
    'gain-power': { x: 94.2, y: 68 },
  },
}

// Team Rocket — 4 lieux (panneau objectif à gauche). Coordonnées approximatives,
// mesurées sur Realm.png (à affiner via l'inspecteur). Le Labo a 3 actions en bas
// (Gagner / Déplacer / Attraper).
ACTION_POS['team-rocket'] = {
  labo: {
    fate: { x: 22.4, y: 19.6 },
    'play-card': { x: 30.3, y: 19.6 },
    'gain-power': { x: 20.1, y: 67.3 },
    'move-hero': { x: 26.5, y: 67.6 },
    catch: { x: 32.8, y: 67.6 },
  },
  foret: {
    'play-card': { x: 43.4, y: 19.4 },
    discard: { x: 51.2, y: 19.7 },
    'gain-power': { x: 43.4, y: 67.5 },
    'play-card2': { x: 51.2, y: 67.3 },
  },
  'centre-pokemon': {
    'play-card': { x: 64.3, y: 19.6 },
    'play-card2': { x: 72.1, y: 19.6 },
    'move-item-ally': { x: 64.3, y: 67.5 },
    fate: { x: 72.1, y: 67.7 },
  },
  arene: {
    'play-card': { x: 85.1, y: 19.6 },
    'gain-power': { x: 92.9, y: 19.6 },
    vanquish: { x: 85.1, y: 67.5 },
    discard: { x: 92.9, y: 67.5 },
  },
}

// La Bonne Fée — même gabarit de plateau que Team Rocket (Realm.png 4455×1248).
ACTION_POS['la-bonne-fee'] = {
  marais: {
    fate: { x: 22.5, y: 19.5 },
    'play-card': { x: 30.3, y: 19.6 },
    'gain-power': { x: 22.5, y: 67.1 },
    discard: { x: 30.3, y: 67.5 },
  },
  'pomme-empoisonnee': {
    'play-card': { x: 43.4, y: 19.6 },
    discard: { x: 51.2, y: 19.6 },
    'gain-power': { x: 43.4, y: 67.5 },
    'play-card2': { x: 51.2, y: 67.5 },
  },
  'usine-potions': {
    'move-item-ally': { x: 64.3, y: 19.6 },
    activate: { x: 72.1, y: 19.6 },
    'play-card': { x: 64.3, y: 67.5 },
    fate: { x: 72.1, y: 67.5 },
  },
  'salle-de-bal': {
    'play-card': { x: 82.7, y: 67.5 },
    activate: { x: 89.1, y: 67.6 },
    'gain-power': { x: 95.4, y: 67.5 },
  },
}

ACTION_POS['princeJohn'] = {
  sherwood: {
    'gain-power': { x: 22.5, y: 20 },
    discard: { x: 30.4, y: 20 },
    'play-card': { x: 22.5, y: 67.4 },
    fate: { x: 30.3, y: 66.9 },
  },
  church: {
    'gain-power': { x: 43.4, y: 20 },
    'play-card-top': { x: 51.3, y: 20 },
    'play-card-bottom': { x: 43.3, y: 67.4 },
    'move-item-ally': { x: 51.2, y: 67.2 },
  },
  nottingham: {
    fate: { x: 64.2, y: 20 },
    'gain-power': { x: 72.1, y: 20 },
    vanquish: { x: 64.2, y: 67.1 },
    'play-card': { x: 72.1, y: 66.8 },
  },
  jail: {
    'gain-power': { x: 82.8, y: 66.8 },
    'play-card': { x: 88.8, y: 67.1 },
    discard: { x: 94.7, y: 67.1 },
  },
}

interface Props {
  player: PlayerState
  /** Mr. Monopoly — MAISONS posées par l'adversaire sur les lieux de CE plateau (clé =
   *  id du lieu, valeur = nombre, 4 = hôtel). Affichées en surcouche sur la bande haute. */
  housesHere?: Record<string, number>
  /** Ids des actions disponibles (lieu courant) → bouton jaune cliquable. */
  availableActionIds: string[]
  /** Ids des actions déjà utilisées ce tour (lieu courant) → bouton assombri. */
  usedActionIds: string[]
  /** Lieu dont les actions du HAUT clignotent (Persifleur : choisir une action
   *  recouverte). */
  blinkTopAtLocation?: string | null
  /** Lieu « actif » pour les actions (par défaut le lieu du pion ; Colère
   *  Titanesque d'Ursula le déplace temporairement vers un lieu voisin). */
  activeLocationId?: string
  /** Clé `lieu:action` de l'action à mettre en surbrillance (flash jaune one-shot)
   *  — sert à montrer, une par une, les actions que le bot vient de jouer. */
  flashKey?: string | null
  /** N'afficher QUE le bouton en flash (rien d'autre) : utilisé sur le plateau du
   *  bot, qui ne montre pas ses pastilles d'action en temps normal. */
  flashOnly?: boolean
  onActionClick: (action: LocationAction) => void
  /** Dio — ZA WARUDO! actif : on peut agir sur les actions de TOUS les lieux. */
  zaWarudoActive?: boolean
  /** Clés `lieu:action` jouables pendant ZA WARUDO! (toutes positions confondues). */
  zaWarudoKeys?: Set<string> | null
  /** Clic sur une action pendant ZA WARUDO! (porte le lieu, pour focaliser puis agir). */
  onZaActionClick?: (locationId: string, action: LocationAction) => void
  /** Sombra — Piratage : lieu dont une action doit être DÉSACTIVÉE par clic direct
   *  (remplace la modale). Les actions listées dans `hackActionIds` y clignotent en
   *  fuchsia et `onHackPick` est appelé au clic. */
  hackLocationId?: string | null
  hackActionIds?: string[]
  onHackPick?: (actionId: string) => void
  /** Outil de dév (mode test) : illumine TOUTES les actions du plateau (non
   *  cliquables), pour caler visuellement les positions des boutons. */
  highlightAll?: boolean
  /** Éditeur de positions (plateau joueur) : pastilles cliquables pour sélectionner
   *  une action. Implique `highlightAll`. */
  editMode?: boolean
  /** Positions de remplacement (clé `locId:actionId` → {x,y} en %) appliquées en mode
   *  illuminé/édition (pour bouger les boutons en direct). */
  posOverride?: Record<string, { x: number; y: number }>
  /** Clé `locId:actionId` de l'action sélectionnée (clignote). */
  selectedKey?: string | null
  /** Sélection d'une action (édition). */
  onSelectAction?: (locationId: string, actionId: string, label: string, locationName: string) => void
  /** Déplacement par glisser (édition) : nouvelle position en % du plateau. */
  onMoveAction?: (locationId: string, actionId: string, x: number, y: number) => void
}

/** Positions d'action d'un vilain (mode test — éditeur de positions). */
// eslint-disable-next-line react-refresh/only-export-components
export function getVillainActionPos(
  villain: string,
): Record<string, Record<string, { x: number; y: number }>> | undefined {
  return ACTION_POS[villain]
}

/**
 * Boutons ronds quasi transparents superposés aux icônes d'action de l'image du
 * plateau. Jaune = disponible (cliquable) ; assombri = déjà utilisée ce tour ;
 * neutre sinon (lieu non courant ou action pas encore prise en charge).
 */
export function BoardActions({
  player,
  housesHere,
  availableActionIds,
  usedActionIds,
  blinkTopAtLocation = null,
  activeLocationId,
  flashKey = null,
  flashOnly = false,
  onActionClick,
  zaWarudoActive = false,
  zaWarudoKeys = null,
  onZaActionClick,
  hackLocationId = null,
  hackActionIds,
  onHackPick,
  highlightAll = false,
  editMode = false,
  posOverride,
  selectedKey = null,
  onSelectAction,
  onMoveAction,
}: Props) {
  // Éditeur de positions : action en cours de glisser (pointer capturé).
  const dragRef = useRef<{ loc: string; act: string } | null>(null)
  const layout = ACTION_POS[player.villain] ?? customActionPosFor(player.villain) ?? {}
  if (!layout) return null

  // Mode test (dév) : illumine TOUTES les actions du plateau pour caler les positions.
  // `editMode` (plateau joueur) : pastilles CLIQUABLES (sélection), positions surchargées
  // par `posOverride`, la sélection (`selectedKey`) clignote. Court-circuite la logique
  // normale (recouvrement, disponibilité, flashOnly…).
  if (highlightAll) {
    return (
      <>
        {player.locations.flatMap((loc) =>
          loc.actions.map((a) => {
            const key = `${loc.id}:${a.id}`
            const pos = posOverride?.[key] ?? layout[loc.id]?.[a.id]
            if (!pos) return null
            const selected = editMode && selectedKey === key
            return (
              <button
                key={`hl:${key}`}
                type="button"
                disabled={!editMode}
                onPointerDown={
                  editMode
                    ? (e) => {
                        e.preventDefault()
                        onSelectAction?.(loc.id, a.id, a.label, loc.name)
                        // Les pastilles sont positionnées en % de leur conteneur positionné
                        // (offsetParent) : on mesure SON rect pour convertir le curseur en %.
                        const boardEl = (e.currentTarget as HTMLElement).offsetParent as HTMLElement | null
                        if (!boardEl) return
                        const rect = boardEl.getBoundingClientRect()
                        dragRef.current = { loc: loc.id, act: a.id }
                        const onMove = (ev: PointerEvent) => {
                          if (!dragRef.current) return
                          const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100))
                          const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100))
                          onMoveAction?.(loc.id, a.id, x, y)
                        }
                        const onUp = () => {
                          dragRef.current = null
                          window.removeEventListener('pointermove', onMove)
                          window.removeEventListener('pointerup', onUp)
                        }
                        window.addEventListener('pointermove', onMove)
                        window.addEventListener('pointerup', onUp)
                      }
                    : undefined
                }
                title={`${loc.name} — ${a.label} (glisser pour positionner)`}
                className={`absolute -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 ${
                  editMode ? 'z-30 cursor-grab active:cursor-grabbing' : 'pointer-events-none'
                } ${selected ? 'border-yellow-300 bg-yellow-400/50' : 'border-lime-400 bg-lime-400/30'}`}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  width: `${BUTTON_SIZE}%`,
                  aspectRatio: '1',
                  boxShadow: selected
                    ? '0 0 16px 5px rgba(250,204,21,0.95)'
                    : '0 0 10px 3px rgba(163,230,53,0.85)',
                }}
              />
            )
          }),
        )}
      </>
    )
  }
  const currentLoc = activeLocationId ?? player.pawnLocation

  // Actions recouvertes par le débordement d'un Héros agrandi voisin (Reine de
  // Cœur — Agrandir) : on masque leur bouton (le demi-masque de BoardImage les
  // recouvre déjà visuellement), comme pour les actions du haut d'un lieu à Héros.
  const enlargeCovered = new Set(
    player.locations.flatMap((loc) =>
      (player.board[loc.id] ?? []).flatMap((c) => {
        const cov = enlargeCoveredAction(player, c)
        return cov ? [`${cov.locationId}:${cov.actionId}`] : []
      }),
    ),
  )

  return (
    <>
      {player.locations.flatMap((loc) =>
        loc.actions.map((a) => {
          const pos = layout[loc.id]?.[a.id]
          if (!pos) return null
          // Sombra — Piratage : choix de l'action à DÉSACTIVER par clic direct sur
          // le plateau (remplace la modale). Bouton fuchsia clignotant, prioritaire
          // sur l'affichage normal (rendu même si la rangée serait masquée par un Héros).
          if (onHackPick && loc.id === hackLocationId && (hackActionIds ?? []).includes(a.id) && !flashOnly) {
            return (
              <button
                key={`${loc.id}:${a.id}`}
                type="button"
                onClick={() => onHackPick(a.id)}
                title={`Pirater : désactiver « ${a.label} »`}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  width: `${BUTTON_SIZE}%`,
                  aspectRatio: '1',
                  animation: 'hackPick 0.8s ease-in-out infinite',
                }}
              />
            )
          }
          // Sombra — action piratée : recouverte par l'image Hack, désactivée. Marqueur
          // PUREMENT visuel (pointer-events-none) → affiché aussi sur le plateau du bot
          // (mode `flashOnly`), pour qu'on VOIE quelle action Sombra adverse a désactivée.
          const hacked = (player.board[loc.id] ?? []).some(
            (c) => c.isPiratage && c.hackedActionId === a.id,
          )
          if (hacked) {
            return (
              <div
                key={`${loc.id}:${a.id}`}
                title={`${a.label} — désactivé (Hack)`}
                className="hack-glitch pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${BUTTON_SIZE * 1.7}%` }}
              >
                <img src="/cards/sombra/hack.png" alt="Piraté" className="hg-base" />
                <img src="/cards/sombra/hack.png" alt="" aria-hidden="true" className="hg-layer hg-a" />
                <img src="/cards/sombra/hack.png" alt="" aria-hidden="true" className="hg-layer hg-b" />
              </div>
            )
          }
          // Flash one-shot de l'action que le bot vient de jouer.
          const flashing = flashKey === `${loc.id}:${a.id}`
          // Mode bot : on n'affiche QUE le bouton en flash (pas les pastilles neutres).
          if (flashOnly && !flashing) return null
          // ZA WARUDO! : toutes les actions jouables de TOUS les lieux sont cliquables
          // (clé `lieu:action`) ; le « déjà fait » se suit par lieu (dioRealmActionsThisTurn).
          const zaKey = `${loc.id}:${a.id}`
          const isCurrent = currentLoc === loc.id
          const available = zaWarudoActive
            ? (zaWarudoKeys?.has(zaKey) ?? false)
            : isCurrent && availableActionIds.includes(a.id)
          const used = zaWarudoActive
            ? (player.dioRealmActionsThisTurn ?? []).includes(zaKey)
            : isCurrent && usedActionIds.includes(a.id)
          // Un Héros posé recouvre la rangée du HAUT de son lieu : on masque ces
          // boutons (sauf s'ils restent jouables, ex. Persifleur → available). Sur le
          // circuit en huit (Sa Sucrerie), les Héros NE recouvrent PAS positionnellement
          // d'action : on n'applique donc pas ce masquage.
          const heroHere =
            player.villain !== 'sa-sucrerie' && (player.board[loc.id] ?? []).some((c) => c.type === 'hero')
          if (a.row === 'top' && heroHere && !available && !flashing) return null
          // Action recouverte par un Héros agrandi voisin → bouton masqué.
          if (enlargeCovered.has(`${loc.id}:${a.id}`) && !flashing) return null
          // Persifleur : les actions du HAUT du lieu clignotent (choisir l'une d'elles).
          const blink = a.row === 'top' && loc.id === blinkTopAtLocation && available
          const tone = flashing
            ? 'border-yellow-300 bg-yellow-400/40'
            : available
              ? 'border-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/30 cursor-pointer'
              : used
                ? 'border-black/70 bg-black/55'
                : 'border-white/20 bg-white/5'
          return (
            <button
              key={`${loc.id}:${a.id}`}
              type="button"
              disabled={!available}
              onClick={() => (zaWarudoActive ? onZaActionClick?.(loc.id, a) : onActionClick(a))}
              title={a.label}
              // Un bouton NON disponible ne doit pas intercepter le clic : sinon, là où
              // deux cases se superposent (Sa Sucrerie — croisement du huit : a4 ET a13
              // au même point), le bouton non jouable rendu au-dessus « avale » le clic
              // destiné au bouton jouable en dessous. `pointer-events-none` le laisse passer.
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors ${available ? 'z-10' : 'pointer-events-none'} ${tone}`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${BUTTON_SIZE}%`,
                aspectRatio: '1',
                ...(flashing
                  ? { animation: 'actionFlash 0.55s ease-out' }
                  : blink
                    ? { animation: 'persifleurBlink 0.8s ease-in-out infinite' }
                    : {}),
              }}
            />
          )
        }),
      )}
      {/* Shere Khan — jetons FEU : image posée sur l'action recouverte (qui devient
          indisponible). Indicateur visuel uniquement (non cliquable). */}
      {player.villain === 'shere-khan' &&
        player.locations.flatMap((loc) =>
          (player.fireTokens?.[loc.id] ?? []).map((actionId) => {
            const pos = layout[loc.id]?.[actionId]
            if (!pos) return null
            return (
              <img
                key={`fire:${loc.id}:${actionId}`}
                src="/fire-token.png"
                alt="Jeton Feu"
                title="Action recouverte par un jeton Feu"
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 drop-shadow"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${BUTTON_SIZE * 1.5}%` }}
              />
            )
          }),
        )}
      {/* Pyramid Head — TUILES DE JUGEMENT : un rectangle (largeur du lieu, hauteur de la
          bande Héros, coins arrondis) recouvrant la partie haute des lieux tuilés (les
          `judgmentTiles` lieux les plus à DROITE). */}
      {player.villain === 'custom-pyramid-head' &&
        (() => {
          const n = player.judgmentTiles ?? 0
          if (n <= 0) return null
          const start = player.locations.length - n
          return player.locations.slice(start).map((loc, k) => {
            const rect = COL_RECTS[start + k]
            if (!rect) return null
            const left = (rect.x0 / BOARD_W) * 100
            const width = ((rect.x1 - rect.x0) / BOARD_W) * 100
            const top = (HERO_BAND.y0 / BOARD_H) * 100
            const height = ((HERO_BAND.y1 - HERO_BAND.y0) / BOARD_H) * 100
            return (
              <img
                key={`tile:${loc.id}`}
                src="/pyramid-head/tuile-jugement.png"
                alt="Tuile de Jugement"
                title="Tuile de Jugement (recouvre les actions du haut)"
                className="pointer-events-none absolute z-[12] rounded-lg shadow-lg"
                style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, objectFit: 'fill' }}
              />
            )
          })
        })()}
      {/* Mr. Monopoly — MAISONS posées par l'adversaire sur CE plateau. Une rangée de
          petites maisons (1 à 4), ou une icône hôtel à la 5ᵉ mise, en haut de chaque lieu. */}
      {housesHere &&
        player.locations.map((loc, k) => {
          const count = housesHere[loc.id] ?? 0
          if (count <= 0) return null
          const rect = COL_RECTS[k]
          if (!rect) return null
          const left = (rect.x0 / BOARD_W) * 100
          const width = ((rect.x1 - rect.x0) / BOARD_W) * 100
          const top = (HERO_BAND.y0 / BOARD_H) * 100
          const hotel = count >= 5
          return (
            <div
              key={`house:${loc.id}`}
              className="pointer-events-none absolute z-[13] flex items-center justify-center gap-[2px]"
              style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: '14%' }}
              title={hotel ? 'Hôtel' : `${count} maison${count > 1 ? 's' : ''}`}
            >
              {hotel ? (
                <img src="/mr-monopoly/hotel.png" alt="Hôtel" className="h-full w-auto drop-shadow-lg" />
              ) : (
                Array.from({ length: count }, (_, i) => (
                  <img key={i} src="/mr-monopoly/maison.png" alt="Maison" className="h-3/4 w-auto drop-shadow-lg" />
                ))
              )}
            </div>
          )
        })}
      {/* Les actions ACCORDÉES par un Objet (Canon, Boîte à Crochets, Ingénieux
          Mécanisme) sont cliquables SUR la carte posée (voir LocationCard),
          pas ici sur l'image du plateau. */}
      <style>{`
        @keyframes persifleurBlink {
          0%, 100% { box-shadow: 0 0 0 0 rgba(250,204,21,0); border-color: rgba(250,204,21,1); background-color: rgba(250,204,21,0.1); }
          50% { box-shadow: 0 0 12px 4px rgba(250,204,21,0.9); border-color: #fff; background-color: rgba(250,204,21,0.5); }
        }
        /* Flash one-shot d'une action jouée par le bot (n'anime PAS transform, pour
           ne pas écraser le centrage -translate des boutons). */
        @keyframes actionFlash {
          0% { box-shadow: 0 0 0 0 rgba(250,204,21,0); opacity: 0; }
          35% { box-shadow: 0 0 16px 6px rgba(250,204,21,0.95); border-color: #fff; opacity: 1; }
          100% { box-shadow: 0 0 0 0 rgba(250,204,21,0); opacity: 1; }
        }
        /* Sombra — action piratable (choix de désactivation par clic direct) : pulse fuchsia. */
        @keyframes hackPick {
          0%, 100% { box-shadow: 0 0 0 0 rgba(232,121,249,0); border-color: rgba(232,121,249,1); background-color: rgba(232,121,249,0.15); }
          50% { box-shadow: 0 0 12px 4px rgba(232,121,249,0.9); border-color: #fff; background-color: rgba(232,121,249,0.55); }
        }
        /* Sa Sucrerie — cases atteignables du circuit (déplacement du pion) : pulse doré doux. */
        @keyframes kcReachPulse {
          0%, 100% { box-shadow: 0 0 6px 1px rgba(250,204,21,0.35); }
          50% { box-shadow: 0 0 12px 4px rgba(250,204,21,0.7); }
        }
      `}</style>
    </>
  )
}
