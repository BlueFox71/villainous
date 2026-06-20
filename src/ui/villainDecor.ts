import type { VillainKey } from './store/gameStore'

/** Décor PERMANENT d'arrière-plan d'un vilain. Contrairement à `villainAnimations`
 *  (props qui traversent l'écran ponctuellement), ce décor est présent EN CONTINU
 *  pendant toute la partie. Il occupe la LARGEUR de la colonne du vilain (le div
 *  `game-board`) et TOUTE la hauteur de l'écran. Posé en arrière-plan (z -1),
 *  derrière toute l'UI ; visible là où l'UI laisse voir le fond / à travers les
 *  panneaux translucides.
 *
 *  Data-driven, à la manière de `villainAnimations.ts` / `villainArt.ts` : ajouter
 *  un vilain = une entrée ici + (si le `kind` est inédit) un rendu dans
 *  `components/VillainDecor.tsx`. */
export type VillainDecor =
  // `film` : vieille pellicule de cinéma — grain, scintillement de luminosité,
  // rayures verticales qui vont et viennent en tremblant, poussières qui
  // clignotent, vignette sépia et perforations qui défilent sur les bords
  // (Pat Hibulaire — le cinéma muet de Mickey & l'âge d'or des cartoons).
  | { kind: 'film' }
  // `sand` : sablier — un filet de sable tombe du haut vers le bas (concentré au
  // centre, comme le col d'un sablier) tandis qu'un niveau de sable se remplit au
  // fond puis se vide en boucle (sablier qu'on retourne) (Jafar — Aladdin).
  | { kind: 'sand' }
  // `space` : champ d'étoiles (points blancs) défilant vers la droite, avec
  // profondeur (étoiles proches plus rapides et en traînées) → on file dans l'espace
  // comme à travers le hublot d'une fusée (L'Imposteur — Among Us).
  | { kind: 'space' }
  // `fire` : un mur de flammes permanent en bas de l'écran (sprite vertical joué en
  // boucle), teinté via `tint`. Paramétrable → réutilisable (Hadès : feu bleu ;
  // Scar : feu vert…).
  | { kind: 'fire'; sprite: string; frames: number; tint?: string; heightPct?: number }
  // `goldenHair` : la chevelure magique dorée de Raiponce — des mèches lumineuses
  // pendent du haut de l'écran et se balancent doucement, avec un halo doré qui pulse
  // au rythme de l'incantation (« Fleur aux pétales d'or… ») et des particules d'or
  // qui montent en scintillant (Mère Gothel — Raiponce).
  | { kind: 'goldenHair' }
  // `video` : une vidéo en boucle (plein cadre, `object-fit: cover`) recouverte d'un
  // dégradé teinté en `mix-blend-mode: color` → on colore la vidéo en gardant sa
  // luminance. Paramétrable (`src`, `gradient`) → réutilisable (Méchante Reine : fumée
  // violette de sorcellerie).
  | { kind: 'video'; src: string; gradient?: string }
  // `goldDust` : une fine poussière d'or dérive lentement (mouvement flottant, vitesses
  // et tailles variées) ; quelques particules scintillent (éclat de reflet). Voile chaud
  // doré + vignette (le trésor hors champ) (Prince Jean — Robin des Bois, la cupidité).
  | { kind: 'goldDust' }
  // `thorns` : une forêt de ronces — des épines sombres montent du bas en oscillant
  // légèrement, sur fond de lueur verte pulsante (sa magie) et d'étincelles vertes qui
  // s'élèvent (Maléfique — La Belle au bois dormant).
  | { kind: 'thorns' }
  // `forest` : une forêt sombre — des troncs d'arbres verticaux montent au-delà du haut de
  // l'écran (on ne voit pas le feuillage), avec profondeur (arbres lointains plus clairs/flous)
  // (Slenderman). [construction étape par étape]
  | { kind: 'forest' }
  // `petals` : des pétales de roses rouges tombent du haut en voletant (oscillation latérale)
  // et en tournoyant, sur un fond cramoisi sombre (Reine de Cœur — Alice au pays des merveilles).
  | { kind: 'petals' }
  // `water` : une mer de nuit — des reflets de lune (traînées horizontales claires) ondulent
  // et scintillent sur l'eau dans le bas de l'écran, sur un fond bleu-nuit (Capitaine Crochet).
  | { kind: 'water' }

export const VILLAIN_DECOR: Partial<Record<VillainKey, VillainDecor>> = {
  patHibulaire: { kind: 'film' },
  princeJohn: { kind: 'goldDust' },
  maleficent: { kind: 'thorns' },
  slenderman: { kind: 'forest' },
  reineCoeur: { kind: 'petals' },
  crochet: { kind: 'water' },
  jafar: { kind: 'sand' },
  imposteur: { kind: 'space' },
  gothel: { kind: 'goldenHair' },
  // Méchante Reine (Blanche-Neige) : vidéo de fumée teintée en violet sorcellerie
  // (#472B46) via mix-blend-mode color.
  mechanteReine: {
    kind: 'video',
    src: '/animations/smoke.mp4',
    gradient: 'linear-gradient(to top, #2e1c2d, #472b46 55%, #5e3a5b)',
  },
  // Hadès (Hercule) : feu bleu permanent (sprite orange détouré, teinté en bleu).
  hades: {
    kind: 'fire',
    sprite: '/animations/fire_sprite.png',
    frames: 39,
    tint: 'hue-rotate(190deg) saturate(1.5)', // feu orange → bleu
    heightPct: 32,
  },
}

/** Décor permanent d'un vilain (undefined si non défini). */
export function villainDecor(key: VillainKey): VillainDecor | undefined {
  return VILLAIN_DECOR[key]
}
