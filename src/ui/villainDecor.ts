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
  // boucle), teinté via `tint`. Paramétrable → réutilisable (Scar : feu vert…).
  | { kind: 'fire'; sprite: string; frames: number; tint?: string; heightPct?: number }
  // `underworld` : les Enfers d'Hadès — mur de feu bleu + âmes spectrales qui montent du
  // Styx + braises bleues + lueur bleue pulsante, et par moments un COUP DE COLÈRE (le feu
  // vire au rouge/orange et grossit) (Hadès — Hercule).
  | { kind: 'underworld' }
  // `goldenHair` : la chevelure magique dorée de Raiponce — des mèches lumineuses
  // pendent du haut de l'écran et se balancent doucement, avec un halo doré qui pulse
  // au rythme de l'incantation (« Fleur aux pétales d'or… ») et des particules d'or
  // qui montent en scintillant (Mère Gothel — Raiponce).
  | { kind: 'goldenHair' }
  // `video` : une vidéo en boucle (plein cadre, `object-fit: cover`) recouverte d'un
  // dégradé teinté en `mix-blend-mode: color` → on colore la vidéo en gardant sa
  // luminance. Paramétrable (`src`, `gradient`) → réutilisable.
  | { kind: 'video'; src: string; gradient?: string }
  // `evilQueen` : la fumée violette de sorcellerie (vidéo `video`) SURMONTÉE de couches qui
  // racontent la Méchante Reine — des bulles de potion verte montent du chaudron, une fine
  // poussière de sorcellerie violette scintille, et une ou deux POMMES empoisonnées flottent
  // dans la fumée avec un halo vert toxique qui pulse (Méchante Reine — Blanche-Neige).
  | { kind: 'evilQueen'; src: string; gradient?: string; apple: string }
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
  // `grotto` : la Grotte d'Ursula — eau vert-bleu très sombre (fort vignettage), des colonnes de
  // VAPEUR ROSE/magenta montent du fond en s'enroulant (les évents de la grotte), une lueur rosée
  // pulse par en-dessous, de discrètes caustiques teintées scintillent en haut, et des bulles
  // (surtout roses) montent du fond (Ursula — La Petite Sirène).
  | { kind: 'grotto' }
  // `voodoo` : « Friends on the Other Side » — des masques vaudou (images) flottent dans le noir
  // violacé, bercés et respirant (ils émergent puis se fondent dans l'ombre), des particules de
  // magie violette/verte montent, et par moments une INVOCATION (les masques s'illuminent et une
  // vague de magie déferle) (Dr Facilier — La Princesse et la Grenouille).
  | { kind: 'voodoo' }
  // `galaxy` : la galaxie de Bowser — espace profond aux couleurs de Bowser (nébuleuse rouge/orange
  // qui dérive), champ d'étoiles scintillantes, étoiles filantes, des « méchants » qui flottent
  // (Méla-Méla, Bulle de lave, Comète) et, par moments, un BILL BOURRIN (obus Banzai Bill) qui
  // traverse l'écran (Bowser — Super Mario Galaxy).
  | { kind: 'galaxy' }
  // `graveyard` : le cimetière des éléphants de « Soyez prêtes » — une caverne volcanique sombre,
  // des ROCHERS déchiquetés tout autour (bas, côtés, plafond/stalactites), des colonnes de VAPEUR
  // VERTE qui jaillissent des évents et montent en s'enroulant, une nappe de brume verte qui dérive
  // partout, et une lueur verte malsaine qui palpite par en-dessous (Scar — Le Roi Lion).
  | { kind: 'graveyard' }

export const VILLAIN_DECOR: Partial<Record<VillainKey, VillainDecor>> = {
  patHibulaire: { kind: 'film' },
  princeJohn: { kind: 'goldDust' },
  maleficent: { kind: 'thorns' },
  slenderman: { kind: 'forest' },
  reineCoeur: { kind: 'petals' },
  crochet: { kind: 'water' },
  ursula: { kind: 'grotto' },
  jafar: { kind: 'sand' },
  facilier: { kind: 'voodoo' },
  imposteur: { kind: 'space' },
  gothel: { kind: 'goldenHair' },
  // Méchante Reine (Blanche-Neige) : la fumée de sorcellerie (vidéo teintée violet #472B46 via
  // mix-blend-mode color) surmontée des bulles de potion verte, de la poussière de sorcellerie
  // violette et des pommes empoisonnées.
  mechanteReine: {
    kind: 'evilQueen',
    src: '/animations/smoke.mp4',
    gradient: 'linear-gradient(to top, #2e1c2d, #472b46 55%, #5e3a5b)',
    apple: '/animations/apple.png',
  },
  // Hadès (Hercule) : les Enfers — feu bleu + âmes + braises + lueur + coups de colère.
  hades: { kind: 'underworld' },
  // Bowser (Super Mario Galaxy) : sa galaxie — nébuleuse rouge/orange + étoiles + méchants flottants
  // + Bill Bourrin qui traverse.
  bowser: { kind: 'galaxy' },
  // Scar (Le Roi Lion) : « Soyez prêtes » — caverne du cimetière des éléphants, rochers tout autour
  // + geysers de vapeur verte + brume verte + lueur verte malsaine.
  scar: { kind: 'graveyard' },
}

/** Décor permanent d'un vilain (undefined si non défini). */
export function villainDecor(key: VillainKey): VillainDecor | undefined {
  return VILLAIN_DECOR[key]
}

/** Manifeste des fichiers (images / vidéos) qu'un décor charge à l'exécution. Sert à les
 *  PRÉCHARGER pendant l'écran de chargement (cf. `screens/GameLoading.tsx`) pour éviter le
 *  pic de saccade au montage du décor (décodage d'images + démarrage vidéo en bloc).
 *
 *  ⚠️ À garder en phase avec les assets réellement référencés dans `components/VillainDecor.tsx`
 *  (et quelques `url(...)` de `index.css`). Une entrée en trop ou manquante est sans danger
 *  (le préchargement est « best-effort ») : au pire on précharge un fichier inutile, ou on rate
 *  un pic. Les décors purement CSS (grain, dégradés, formes) n'ont aucun asset → liste vide. */
export function decorAssets(decor: VillainDecor): { images: string[]; videos: string[] } {
  const none = { images: [], videos: [] }
  switch (decor.kind) {
    case 'fire':
      return { images: [decor.sprite], videos: [] }
    case 'underworld':
      return {
        images: ['/animations/ame_homme.png', '/animations/ame_femme.png', '/animations/ame_homme2.png', '/animations/fire_sprite.png'],
        videos: [],
      }
    case 'video':
      return { images: [], videos: [decor.src] }
    case 'evilQueen':
      return { images: [decor.apple], videos: [decor.src] }
    case 'goldDust':
      return { images: Array.from({ length: 11 }, (_, i) => `/animations/piece-${i + 1}.png`), videos: [] }
    case 'thorns':
      return { images: ['/animations/ronces.png'], videos: [] }
    case 'forest':
      return {
        images: ['/animations/tronc1.png', '/animations/tronc2.png', '/animations/tronc3.png', '/animations/slenderman_animation.png'],
        videos: [],
      }
    case 'water':
      return { images: ['/animations/neverland.png'], videos: [] }
    case 'grotto':
      return { images: ['/animations/bulle-bleu.png', '/animations/bulle.png', '/animations/bulle-rose.png'], videos: [] }
    case 'voodoo':
      return { images: Array.from({ length: 11 }, (_, i) => `/animations/masque${i + 1}.png`), videos: [] }
    case 'galaxy':
      return {
        images: [
          // Mondes flottants (galaxy1..N), pluie d'étoiles/fragments, observatoire et trou noir.
          ...Array.from({ length: 37 }, (_, i) => `/animations/galaxy${i + 1}.png`),
          '/animations/star.png',
          ...Array.from({ length: 6 }, (_, i) => `/animations/fragment${i + 1}.png`),
          '/animations/observatory.png',
          '/animations/trou_noir.png',
        ],
        videos: [],
      }
    // Décors 100 % CSS (aucun fichier à précharger) : film, sand, space, goldenHair, petals, graveyard.
    default:
      return none
  }
}
