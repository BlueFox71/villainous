// Palette d'accents par camp. Auparavant bleu (joueur) / rouge (adversaire) ;
// désormais DÉRIVÉE DE LA COULEUR DU MÉCHANT de chaque camp. Les valeurs sont des
// classes Tailwind à valeur arbitraire qui lisent des variables CSS (`--pa-*` pour
// le joueur, `--po-*` pour l'adversaire) posées sur le root du jeu via `accentVars`.
// (On ne peut pas mettre un hex dynamique dans une classe Tailwind — purge — d'où
// le passage par des variables CSS.)

import type { CSSProperties } from 'react'

export interface Accent {
  /** Panneau joueur quand c'est son tour / au repos. */
  panelActive: string
  panelIdle: string
  /** Remplissage de la jauge de pouvoir. */
  gauge: string
  /** Couleur (CSS) de l'anneau de progression de l'objectif / repli serpent. */
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

/** Camp joueur : lit les variables `--pa-*`. */
export const BLUE: Accent = {
  panelActive: 'border-[color:var(--pa-line)] bg-[var(--pa-bg-active)] ring-2 ring-[color:var(--pa-ring)]',
  panelIdle: 'border-[color:var(--pa-line-soft)] bg-[var(--pa-bg-idle)]',
  gauge: 'bg-[var(--pa-gauge)]',
  ringColor: 'var(--pa-text)',
  title: 'text-[color:var(--pa-text)]',
  accentText: 'text-[color:var(--pa-text)]',
  cardMovable:
    'border-[color:var(--pa-line)] bg-[var(--pa-bg-idle)] hover:border-[color:var(--pa-text)] hover:bg-[var(--pa-bg-active)] cursor-pointer',
  cardIdle: 'border-[color:var(--pa-line-soft)] bg-[var(--pa-bg-idle)]',
  chip: 'bg-[var(--pa-bg-active)] text-[color:var(--pa-text)]',
  gainBtn: 'bg-[var(--pa-gauge)] hover:brightness-110 text-white',
}

/** Camp adversaire : lit les variables `--po-*`. */
export const RED: Accent = {
  panelActive: 'border-[color:var(--po-line)] bg-[var(--po-bg-active)] ring-2 ring-[color:var(--po-ring)]',
  panelIdle: 'border-[color:var(--po-line-soft)] bg-[var(--po-bg-idle)]',
  gauge: 'bg-[var(--po-gauge)]',
  ringColor: 'var(--po-text)',
  title: 'text-[color:var(--po-text)]',
  accentText: 'text-[color:var(--po-text)]',
  cardMovable:
    'border-[color:var(--po-line)] bg-[var(--po-bg-idle)] hover:border-[color:var(--po-text)] hover:bg-[var(--po-bg-active)] cursor-pointer',
  cardIdle: 'border-[color:var(--po-line-soft)] bg-[var(--po-bg-idle)]',
  chip: 'bg-[var(--po-bg-active)] text-[color:var(--po-text)]',
  gainBtn: 'bg-[var(--po-gauge)] hover:brightness-110 text-white',
}

/** Décline une couleur de méchant en variations (texte/bordure/jauge/fonds). */
function shades(prefix: string, color: string): Record<string, string> {
  return {
    [`${prefix}-line`]: `color-mix(in srgb, ${color}, white 38%)`,
    [`${prefix}-line-soft`]: `color-mix(in srgb, ${color}, white 16%)`,
    [`${prefix}-ring`]: `color-mix(in srgb, ${color}, white 30%)`,
    [`${prefix}-text`]: `color-mix(in srgb, ${color}, white 62%)`,
    [`${prefix}-gauge`]: `color-mix(in srgb, ${color}, white 22%)`,
    [`${prefix}-bg-active`]: `color-mix(in srgb, ${color} 42%, transparent)`,
    [`${prefix}-bg-idle`]: `color-mix(in srgb, ${color} 22%, transparent)`,
  }
}

/** Variables CSS d'accent des deux camps, à poser sur un conteneur englobant
 *  (root du jeu). `BLUE` lit `--pa-*` (joueur), `RED` lit `--po-*` (adversaire). */
export function accentVars(playerColor: string, opponentColor: string): CSSProperties {
  return { ...shades('--pa', playerColor), ...shades('--po', opponentColor) } as CSSProperties
}
