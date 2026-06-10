// Palette d'accents par camp : bleu pour le joueur (utilisateur), rouge pour le
// bot. On stocke des chaînes de classes Tailwind COMPLÈTES (pas de
// concaténation dynamique, sinon Tailwind les purge).

export interface Accent {
  /** Panneau joueur quand c'est son tour / au repos. */
  panelActive: string
  panelIdle: string
  /** Remplissage de la jauge de pouvoir. */
  gauge: string
  /** Couleur (hex) de l'anneau de progression de l'objectif. */
  ringColor: string
  /** Couleur du nom du vilain. */
  title: string
  /** Couleur de texte d'accent (libellés discrets). */
  accentText: string
  /** Cartes-lieux : déplaçable / au repos. (Le lieu courant est signalé par le
   *  serpent lumineux, plus par un encadré.) */
  cardMovable: string
  cardIdle: string
  /** Petite pastille (cartes posées). */
  chip: string
  /** Bouton « Gagner pouvoir ». */
  gainBtn: string
}

export const BLUE: Accent = {
  panelActive: 'border-sky-400 bg-sky-900/30 ring-2 ring-sky-400/40',
  panelIdle: 'border-sky-900/60 bg-sky-950/20',
  gauge: 'bg-sky-500',
  ringColor: '#38bdf8',
  title: 'text-sky-100',
  accentText: 'text-sky-300',
  cardMovable: 'border-sky-800 bg-sky-950/20 hover:border-sky-500 hover:bg-sky-900/30 cursor-pointer',
  cardIdle: 'border-sky-950/60 bg-sky-950/10',
  chip: 'bg-sky-900/50 text-sky-200',
  gainBtn: 'bg-sky-600 hover:bg-sky-500 text-white',
}

export const RED: Accent = {
  panelActive: 'border-red-400 bg-red-900/30 ring-2 ring-red-400/40',
  panelIdle: 'border-red-900/60 bg-red-950/20',
  gauge: 'bg-red-500',
  ringColor: '#f87171',
  title: 'text-red-100',
  accentText: 'text-red-300',
  cardMovable: 'border-red-800 bg-red-950/20',
  cardIdle: 'border-red-950/60 bg-red-950/10',
  chip: 'bg-red-900/50 text-red-200',
  gainBtn: 'bg-red-600 hover:bg-red-500 text-white',
}
