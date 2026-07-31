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
  // poussière de sorcellerie violette scintille, une potion mijote dans un verre (changement
  // de couleurs, éclair, vaporisation) et des POMMES empoisonnées lévitent un peu partout
  // (Méchante Reine — Blanche-Neige).
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
  // `underwater` : vue SOUS L'EAU vers la surface. Fond NOIR, avec la SURFACE de l'eau miroitante
  // tout en haut (caustiques bleutées qui ondulent), des RAYONS de lumière qui descendent en
  // éventail depuis la surface et se balancent, et des BULLES qui remontent (Tabbou).
  | { kind: 'underwater' }
  // `image` : une simple IMAGE d'arrière-plan fixe, affichée en plein cadre (`cover`, centrée).
  // Base sobre et générique → point de départ pour construire un décor par couches par-dessus.
  | { kind: 'image'; src: string }
  // `scar` : le décor de Scar (Le Roi Lion), construit par couches sur l'image de fond `src`
  // (réutilise le rendu `image`). Couche actuelle : des GEYSERS de vapeur VERTE qui jaillissent du
  // bas en s'enroulant (réutilise le keyframe `vaporRise`). D'autres couches viendront s'ajouter.
  | { kind: 'scar'; src: string }
  // `yzma` : le laboratoire secret de Yzma (Kuzco) — pénombre de pierre violet/magenta + cyan, une lueur
  // magenta pulsante, des BULLES multicolores et des VOLUTES de vapeur colorées qui montent des potions.
  // [construction par couches : fioles en verre + explosion « Pull the lever » à venir]
  | { kind: 'yzma' }
  // `clockwork` : Ratigan (Basil, détective privé) — une pluie continue d'images (4 rouages + 4
  // diamants) qui tombent du haut en tournoyant, comme les pièces de Prince Jean (keyframe `coinFall`
  // en boucle), en quantité ×3.
  | { kind: 'clockwork' }
  // `cruella` : nuit d'hiver enneigée (le climax des 101 Dalmatiens, la poursuite dans la neige) —
  // fond bleu-nuit froid, un faible halo lunaire, une chute de neige voletante (profondeur), de
  // subtiles taches dalmatiennes noires qui dérivent en fondu (le thème fourrure tachetée) et, par
  // moments, une traînée d'EMPREINTES de pattes de chiot qui s'imprime dans la neige puis s'efface
  // (Cruella d'Enfer).
  | { kind: 'cruella' }
  // `laBonneFee` : la MAGIE ROSE de la Bonne Fée (Marraine de Shrek) qui retombe — des volutes de fumée rose
  // lumineuse qui TOMBENT doucement du haut en dérivant et en se dissipant, sur un fond violacé, surmontées
  // d'une lueur rose pulsante (la source). 100 % CSS.
  | { kind: 'laBonneFee' }
  // `cyber` : Sombra (Overwatch) — son interface de piratage. Fond violet très sombre, une PLUIE
  // de code (colonnes de glyphes binaires/symboles qui tombent, tête claire + traîne qui s'estompe)
  // en violet/cyan, une DISTORSION glitch en arrière-plan (copies décalées magenta/cyan tranchées),
  // une ligne de scan qui balaie l'écran, et par moments des SURPRISES : une vague de glitch qui
  // parcourt l'écran, et le crâne de piratage qui se tape en ASCII.
  | { kind: 'cyber' }
  // `castleAssault` : l'assaut du château de la Bête par Gaston et la foule (La Belle et la Bête).
  // Une IMAGE du château dans la forêt (`src`) ASSOMBRIE en nuit d'orage (voile bleu-nuit + vignette),
  // sous une PLUIE battante, avec des TORCHES qui crépitent au premier plan (la foule en marche) et,
  // par moments, un ÉCLAIR qui illumine la scène.
  | { kind: 'castleAssault'; src: string }
  // `tremaine` : l'entrée du manoir de Madame de Trémaine (Cendrillon) — l'image de fond `src`
  // (grand escalier, hall dallé) surmontée d'une vignette froide, de poussières qui flottent dans
  // la pénombre et d'une faible lueur de bougie qui vacille. Par moments, SURPRISE : Lucifer le chat
  // traverse le hall en y laissant des traces de pattes sales partout, puis s'enfuit.
  | { kind: 'tremaine'; src: string }
  // `mim` : la magie de Mad Madam Mim (Merlin l'Enchanteur) — pénombre VIOLETTE, lueur magenta
  // pulsante, volutes de fumée ROSE & violette qui montent et fines étincelles roses scintillantes
  // (Mim adore le rose). 100 % CSS. (Le duel de sorciers / transformations = animation temporaire.)
  | { kind: 'mim' }
  // `syndrome` : la base secrète de Syndrome (Les Indestructibles) — salle de contrôle high-tech
  // SOMBRE baignée d'énergie POINT-ZÉRO cyan/bleue : grille en perspective, particules d'énergie qui
  // montent, lueur bleue pulsante, scanlines holographiques et arcs électriques qui crépitent.
  // Par moments, SURPRISE : une manta-fusée décolle (gerbe de flammes). 100 % CSS.
  | { kind: 'syndrome' }
  // `cauldron` : la salle du Chaudron Noir (Le Seigneur des Ténèbres — Le Chaudron Magique). Crypte de
  // pierre sombre, le CHAUDRON NOIR au centre-bas avec sa gueule de bouillon VERT lumineux qui pulse,
  // VOLUTES de vapeur verte qui montent (réutilise `vaporRise`), ÂMES/feux follets verts qui s'élèvent
  // en ondulant et lueur verte pulsante. 100 % CSS. [surprise + animation à venir]
  | { kind: 'cauldron' }
  // `sunnyside` : la garderie Sunnyside (Lotso — Toy Story 3). Ciel bleu du papier peint d'Andy avec
  // NUAGES blancs floconneux qui dérivent lentement, teinte chaude ROSE FRAISE (Lotso sent la fraise),
  // douces paillettes flottantes et vignette tiède. 100 % CSS. [surprise = pluie de jouets, à venir]
  | { kind: 'sunnyside' }
  // `oogie` : la tanière-casino d'Oogie Boogie (L'Étrange Noël de Monsieur Jack). Pénombre, LUEUR de
  // LUMIÈRE NOIRE verte & violette qui pulse et poussière verte qui monte, surmontées d'une déco
  // HALLOWEEN : guirlande de fanions/fantômes en haut, citrouille à chapeau qui luit dans un coin, un
  // gros DÉ unique (faces réelles du dé en os rouge) qui flotte et bascule sur une nouvelle face toutes
  // les 10 s, et 2-3 PERCE-OREILLES qui se baladent. Surprise : une nuée de perce-oreilles se déverse.
  | { kind: 'oogie' }
  // `candy` : le monde de bonbons de Sugar Rush (Sa Sucrerie / Roi Candy — Les Mondes de Ralph). Fond
  // rose/magenta gourmand, VERMICELLES colorés (sprinkles) qui tombent en voletant, BOKEH sucré qui
  // dérive et scintille, bande de GLAÇAGE blanc en bas, et la COURSE de Sugar Rush : une PISTE (route) qui
  // défile en bas, des TRAÎNÉES de vitesse et des BONBONS-BOLIDES qui la filent.
  | { kind: 'candy' }
  // `jungle` : la jungle À CONTRE-JOUR de Shere Khan (Le Livre de la Jungle). Fond vert-jungle sombre +
  // lueur chaude au centre + vignette, RAIS de lumière chaude qui filtrent, LIANES (images) qui pendent du
  // haut et se balancent en silhouette, FEUILLES (image) en silhouette qui encadrent et dérivent, LUCIOLES
  // ambrées qui flottent et clignotent. Deux SURPRISES minutées : SHERE KHAN (silhouette noire) qui TRAVERSE
  // le bas de la colonne de gauche à droite en rôdant ; et « la Fleur Rouge » où tout S'EMBRASE (voile
  // orangé + mur de flammes + braises + lueur) le temps d'une bouffée, puis se dissipe.
  | { kind: 'jungle' }
  // `teamRocket` : le décor de la Team Rocket — l'image de fond `background_team_rocket.jpg` (plein
  // cadre) surmontée de la MONGOLFIÈRE Miaouss (le ballon « R », petite) qui traverse lentement le
  // ciel en tanguant. SURPRISE minutée : « La Team Rocket s'envole vers d'autres cieux ! » — Jessie,
  // James et Miaouss (image `team_rocket_cieux.png`) jaillissent du plateau, filent en diagonale vers
  // le haut en rétrécissant (ils s'éloignent), puis disparaissent dans un éclat d'étoile (le *DING*
  // classique de fin d'épisode).
  | { kind: 'teamRocket' }
  // `flyingDutchman` : la mer démontée de Davy Jones (Pirates des Caraïbes) — ciel d'orage
  // vert-sarcelle, une MER agitée dont la houle ondule en bas de l'écran (crêtes d'écume), une
  // TEMPÊTE de pluie battante diagonale avec voile d'orage et ÉCLAIRS verdâtres occasionnels, et
  // le HOLLANDAIS VOLANT (image `bateau_hollandais.png`) qui tangue et roule sur la houle au centre.
  | { kind: 'flyingDutchman'; ship: string }
  // `atmosfear` : le Seigneur des clés (le Gardien d'Atmosfear) — sa CASSETTE VHS. Fond NOIR
  // et un CHRONOMÈTRE au format MM:SS en haut, centré (police EvanstonTavern), précédé à sa
  // gauche d'une LUNE (#558CF4) dont la phase suit la progression d'objectif (croissant → pleine),
  // et une RANGÉE DE PETITES FLAMMES alignées au-dessus de la barre d'objectif.
  // [base — couches VHS/Gardien à venir]
  | { kind: 'atmosfear' }
  // `tamatoa` : l'antre du crabe Tamatoa (Vaiana, chanson « Shiny / Bling Bling »). Fond NOIR sur
  // lequel défilent vers la DROITE plein de TRIANGLES JAUNES FLOUTÉS et brillants (le bling-bling),
  // rotation fixe, couleur/vitesse identiques ; PAR-DESSUS, une pluie PERMANENTE de pièces d'or
  // (Prince Jean, 90 %) et de diamants blancs (10 %) qui tombent en tournoyant (`coinFall` en boucle),
  // plus un gros hameçon de Maui & Te Fiti ; et quelques BULLES qui montent par-dessus le tout.
  | { kind: 'tamatoa' }
  // `upsideDown` : le Monde à l'Envers du Flagelleur Mental (Stranger Things). Ciel d'orage nocturne
  // quasi-noir ; des NUAGES sombres et flous DÉRIVENT lentement (profondeur), de fines SPORES pâles
  // flottent EN SUSPENSION (dérive très lente + balancement + scintillement, la signature du Monde à
  // l'Envers), et des ÉCLAIRS ROUGES fractals claquent par intermittence en ILLUMINANT nuages et spores
  // en rouge le temps du flash — tout est sombre au repos, ne rougeoie qu'à la frappe (Le Flagelleur Mental).
  | { kind: 'upsideDown' }
  // `felGate` : la marée de GANGRENÉ de Gul'dan (Warcraft) — un Draenor mort baigné de magie fel. Fond
  // gris-vert sombre, lueur fel VERT NÉON pulsante au sol (les lieux corrompus) battue par une lueur
  // VIOLETTE du Vide, des VOLUTES de gangrené vertes (et quelques violettes) qui montent en s'enroulant,
  // et de fines CENDRES de gangrené vertes/violettes qui s'élèvent en scintillant. 100 % CSS
  // (Gul'dan — vilain custom publié).
  | { kind: 'felGate' }
  // `theWorld` : le pouvoir du TEMPS de Dio (JoJo's Bizarre Adventure — son Stand « The World »). Fond
  // nuit du Caire violet/indigo → doré, aura dorée pulsante, un grand MANDALA d'horloge (anneaux +
  // graduations dorées) qui tourne lentement en arrière-plan (visible dans les marges), une HORLOGE
  // dorée nette dans la bande haute (cadran, chiffres ROMAINS, 3 aiguilles qui tournent) et des CHIFFRES
  // ROMAINS qui flottent en montant et scintillent (or + accents magenta). 100 % CSS. (L'arrêt du temps
  // « ZA WARUDO! » viendra en surprise plus tard.) (Dio — vilain custom publié.)
  | { kind: 'theWorld' }
  // `monopoly` : le PLATEAU de Monopoly (Mr Monopoly). L'image `src` du plateau vu de dessus, affichée
  // en grand CARRÉ centré sur la colonne (sur un fond de table vert feutré + vignette), SURMONTÉE de
  // deux couches d'ambiance en boucle : des PIONS 2D (chapeau, voiture, chien, dé à coudre, brouette,
  // bateau) qui font le tour du plateau, et des chantiers où poussent des MAISONS vertes (1→4) qui se
  // muent en HÔTEL rouge puis se réinitialisent. SURPRISE : « la table renversée » — le plateau tremble
  // puis bascule d'un coup, et pions, maisons, hôtels, dés et billets sont projetés en arc dans toute la
  // colonne (secousse d'écran), avant que tout se remette en place (Mr Monopoly — vilain custom publié).
  | { kind: 'monopoly'; src: string }
  // `rift` : Sumbra (Dharkon — SSBU « La Lueur du Monde »). LES TÉNÈBRES BRISENT LE MONDE. Un abîme
  // noir-violet + vignette lourde, une LUEUR centrale rouge-violet qui pulse (l'œil de Dharkon), et
  // surtout des FISSURES DENSES qui apparaissent en continu : chacune se trace, luit puis s'efface et
  // renaît, dans toutes les directions. Du VIDE suinte des brèches (volutes violettes) et une poussière
  // d'esprits violette/rouge dérive. Des TIRS de Vide violets filent de gauche à droite. SURPRISE : les
  // esprits libérés (images) s'élèvent depuis le bas. 100 % CSS (vilain custom).
  | { kind: 'rift' }
  // `radiance` : Killaire (Galeem — SSBU « La Lueur du Monde »). LE MIROIR LUMINEUX du `rift` : LA
  // LUMIÈRE SUBMERGE LE MONDE. Fond blanc-doré éblouissant + vignette CLAIRE (coins dorés), une LUEUR
  // centrale blanc-or qui pulse (le cœur de Galeem), et surtout des RAYONS DENSES qui jaillissent en
  // continu : chacun se trace, éclate puis s'estompe et renaît, dans toutes les directions (cœur BLANC
  // lumineux + liseré doré, exact négatif des fissures noires de Sumbra). De la lumière dorée monte du
  // bas (volutes) et une poussière d'esprits or/blanc/bleu dérive (accents bleus = la couleur de
  // Killaire). Des TIRS de lumière filent de droite à gauche. SURPRISE : les esprits libérés (images)
  // s'élèvent depuis le bas. 100 % CSS (skin custom de Sumbra).
  | { kind: 'radiance' }

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
  // mix-blend-mode color) surmontée des bulles de potion, de la poussière de sorcellerie violette,
  // de la potion qui mijote dans son verre et des pommes empoisonnées qui lévitent.
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
  // Tabbou : vue sous l'eau vers la surface — fond noir, surface miroitante en haut, rayons de
  // lumière descendants et bulles qui remontent.
  tabbou: { kind: 'underwater' },
  // Scar (Le Roi Lion) : image `background_scar.jpg` en fond + geysers de vapeur verte (couches en
  // construction).
  scar: { kind: 'scar', src: '/animations/background_scar.jpg' },
  // Yzma (Kuzco) : son laboratoire secret de potions — bulles et vapeurs multicolores (couches en construction).
  yzma: { kind: 'yzma' },
  // La Bonne Fée (Marraine de Shrek) : sa magie ROSE qui retombe — des volutes de fumée rose lumineuse qui
  // tombent du haut en dérivant et se dissipant, sur un fond violacé, surmontées d'une lueur rose pulsante.
  laBonneFee: { kind: 'laBonneFee' },
  // Ratigan (Basil, détective privé) : pluie de rouages & diamants qui tombent en tournoyant
  // (comme les pièces de Prince Jean, ×3).
  ratigan: { kind: 'clockwork' },
  // Cruella d'Enfer (Les 101 Dalmatiens) : nuit d'hiver enneigée — neige voletante, taches
  // dalmatiennes qui dérivent, et empreintes de pattes de chiot qui s'impriment dans la neige.
  cruella: { kind: 'cruella' },
  // Sombra (Overwatch) : son interface de piratage — pluie de code violet/cyan, distorsion glitch
  // en arrière-plan, ligne de scan, vagues de glitch et crâne ASCII occasionnels.
  sombra: { kind: 'cyber' },
  // Gaston (La Belle et la Bête) : l'assaut du château — image `background_gaston.png` assombrie en
  // nuit d'orage, pluie battante, torches de la foule au premier plan et éclairs.
  gaston: { kind: 'castleAssault', src: '/animations/background_gaston.png' },
  // Madame de Trémaine (Cendrillon) : l'entrée du manoir (image `background_tremaine.jpg`) avec
  // vignette froide, poussières et lueur de bougie ; surprise = Lucifer salit le hall de traces de
  // pattes puis s'enfuit.
  madameTremaine: { kind: 'tremaine', src: '/animations/background_tremaine.jpg' },
  // Madame Mim (Merlin l'Enchanteur) : sa magie rose/violette — pénombre violette, lueur magenta
  // pulsante, fumée rose & violette qui monte, étincelles roses. (Transformations = anim temporaire.)
  madameMim: { kind: 'mim' },
  // Syndrome (Les Indestructibles) : sa base high-tech baignée d'énergie point-zéro bleue — grille,
  // particules, lueur pulsante, scanlines, arcs électriques ; surprise = manta-fusée qui décolle.
  syndrome: { kind: 'syndrome' },
  // Le Seigneur des Ténèbres (Le Chaudron Magique) : la salle du Chaudron Noir — crypte sombre, chaudron
  // au bouillon vert pulsant, vapeur verte, âmes vertes qui montent. 100 % CSS.
  seigneurTenebres: { kind: 'cauldron' },
  // Lotso (Toy Story 3) : la garderie Sunnyside — ciel bleu du papier peint d'Andy, nuages blancs qui
  // dérivent, teinte rose fraise chaude, paillettes douces. 100 % CSS.
  lotso: { kind: 'sunnyside' },
  // Oogie Boogie (L'Étrange Noël de Monsieur Jack) : sa tanière-casino — lumière noire verte/violette
  // pulsante, poussière verte, déco Halloween (guirlande, citrouille, perce-oreilles) et un gros dé aux
  // faces réelles qui flotte et change de face toutes les 10 s. Surprise : nuée de perce-oreilles.
  oogieBoogie: { kind: 'oogie' },
  // Sa Sucrerie (Roi Candy — Les Mondes de Ralph) : le monde de bonbons de Sugar Rush — fond rose
  // gourmand, vermicelles colorés qui voletent, bokeh sucré, glaçage blanc en bas, et la course de
  // Sugar Rush : piste (route) qui défile, traînées de vitesse et bonbons-bolides.
  saSucrerie: { kind: 'candy' },
  // Shere Khan (Le Livre de la Jungle) : la jungle à contre-jour — lianes & feuilles en silhouette,
  // rais de lumière chaude, lucioles, et Shere Khan qui traverse en rôdant (surprise).
  shereKhan: { kind: 'jungle' },
  // Team Rocket (Pokémon) : le ciel de jour — nuages qui dérivent, soleil, la mongolfière Miaouss qui
  // traverse ; surprise = « s'envole vers d'autres cieux ! » (le trio file vers le haut → éclat d'étoile).
  teamRocket: { kind: 'teamRocket' },
  // Davy Jones (Pirates des Caraïbes) : la mer démontée — ciel d'orage vert-sarcelle, houle agitée
  // en bas, tempête de pluie battante + éclairs verdâtres, et le Hollandais Volant qui tangue.
  davyJones: { kind: 'flyingDutchman', ship: '/animations/bateau_hollandais.png' },
  // Tamatoa (Vaiana) : l'antre « Shiny / Bling Bling » — fond noir + triangles jaunes floutés et
  // brillants qui défilent vers la droite, sous une pluie permanente de pièces d'or & diamants.
  tamatoa: { kind: 'tamatoa' },
}

// Décors des vilains PUBLIÉS (Atelier), indexés par leur id runtime `custom-…`. Le registre natif
// `VILLAIN_DECOR` est indexé par `VillainKey` (union figée à la compilation) et ne peut donc pas
// porter un id custom ; on tient à part la table des vilains custom. C'est aussi le point d'entrée
// pour donner un décor à N'IMPORTE QUEL vilain publié, sans toucher aux natifs.
export const CUSTOM_VILLAIN_DECOR: Record<string, VillainDecor> = {
  // Le Flagelleur Mental (Stranger Things) : le Monde à l'Envers — orage nocturne, nuages sombres qui
  // dérivent et éclairs ROUGES qui illuminent les nuages en rouge à chaque frappe.
  'custom-flagelleur-mental': { kind: 'upsideDown' },
  // Gul'dan (Warcraft) : la marée de gangrené — Draenor mort, lueur fel verte + violette pulsante,
  // volutes de gangrené qui montent, cendres scintillantes et éclairs de gangrené (halo violet).
  'custom-gul-dan': { kind: 'felGate' },
  // Dio (JoJo's Bizarre Adventure) : le pouvoir du temps de The World — nuit dorée/violette, mandala
  // d'horloge tournant, horloge à chiffres romains et chiffres romains flottants (or + magenta).
  'custom-dio': { kind: 'theWorld' },
  // Mr Monopoly : le plateau de Monopoly (image `monopoly.png`) en grand carré centré, sur un fond de
  // table vert feutré, surmonté des pions qui font le tour et des maisons/hôtels qui poussent en boucle.
  'custom-mr-monopoly': { kind: 'monopoly', src: '/animations/monopoly.png' },
  // Sumbra (Dharkon — SSBU) : les Ténèbres qui brisent le monde — abîme noir-violet, œil de Dharkon
  // qui pulse et fissures denses qui apparaissent/disparaissent en continu, dans toutes les directions.
  'custom-mrl4fb45': { kind: 'rift' },
  // Killaire (Galeem — SSBU) : la Lumière qui submerge le monde — miroir lumineux du rift. Fond
  // blanc-doré, cœur de Galeem qui pulse et rayons denses (blanc/or) qui jaillissent en continu.
  'custom-killaire': { kind: 'radiance' },
  // Le Seigneur des clés (le Gardien d'Atmosfear) : sa cassette VHS — fond noir + chronomètre
  // MM:SS en haut, centré (#3E4371, police EvanstonTavern). 100 % CSS.
  'custom-seigneur-cles': { kind: 'atmosfear' },
}

/** Décor permanent d'un vilain (natif OU publié) ; undefined si non défini. Un vilain publié a un id
 *  `custom-…` (résolu ici) ; un natif a sa `VillainKey`. */
export function villainDecor(key: string): VillainDecor | undefined {
  return CUSTOM_VILLAIN_DECOR[key] ?? VILLAIN_DECOR[key as VillainKey]
}

/** Images « carte de monde » (Brawl) affichées à l'intérieur des orbes du décor `underwater`. */
export const UNDERWATER_ORB_IMAGES = Array.from({ length: 5 }, (_, i) => `/animations/map_tabbou_${i + 1}.png`)

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
    case 'image':
    case 'scar':
    case 'castleAssault':
      return { images: [decor.src], videos: [] }
    case 'monopoly':
      // Le plateau + les 4 jetons (pions) qui font le tour + le dé (deux dés au centre).
      return {
        images: [
          decor.src,
          '/animations/monopoly-pion-chapeau.png',
          '/animations/monopoly-pion-voiture.png',
          '/animations/monopoly-pion-chien.png',
          '/animations/monopoly-pion-bateau.png',
          '/animations/monopoly-de.png',
        ],
        videos: [],
      }
    case 'tremaine':
      return {
        images: [decor.src, '/animations/background_tremaine_sale.png', '/animations/lucifer.png'],
        videos: [],
      }
    case 'mim':
      // Les transformations du duel (Mim + Merlin) + le sprite de feu de la surprise « flammes roses »
      // (cf. MIM_ANIMALS / MERLIN_ANIMALS dans components/VillainDecor.tsx).
      return {
        images: [
          '/animations/mim-crocodile.png', '/animations/mim-lion.png', '/animations/mim-fox.png',
          '/animations/mim-snake.png', '/animations/mim-elephant.png', '/animations/mim-rhinoceros.png',
          '/animations/mim-poule.png', '/animations/mim-dragon.png',
          ...Array.from({ length: 7 }, (_, i) => `/animations/merlin-${i + 1}.png`),
          '/animations/fire_sprite.png',
        ],
        videos: [],
      }
    case 'clockwork':
      return {
        images: [
          ...Array.from({ length: 11 }, (_, i) => `/animations/piece-${i + 1}.png`),
          ...Array.from({ length: 4 }, (_, i) => `/animations/diamant-${i + 1}.png`),
          '/animations/cloche-main.png',
          '/animations/rouage_plat.png',
        ],
        videos: [],
      }
    case 'yzma':
      return { images: ['/animations/potion_yzma.png', '/animations/potion_neutre.png', '/animations/cat_yzma.png'], videos: [] }
    case 'syndrome':
      // Les 6 designs d'Omnidroïdes + les 18 portraits de supers « éliminés » (groupes 1→6) affichés
      // sur l'écran holographique de la base.
      return {
        images: [
          ...Array.from({ length: 6 }, (_, i) => `/animations/omnidroide-${i + 1}.png`),
          '/animations/heroes/1/hero-05.png', '/animations/heroes/1/hero-09.png', '/animations/heroes/1/hero-20.png',
          '/animations/heroes/2/hero-06.png', '/animations/heroes/2/hero-10.png',
          '/animations/heroes/3/hero-11.png', '/animations/heroes/3/hero-12.png', '/animations/heroes/3/hero-14.png',
          '/animations/heroes/4/hero-01.png', '/animations/heroes/4/hero-04.png', '/animations/heroes/4/hero-15.png',
          '/animations/heroes/5/hero-03.png', '/animations/heroes/5/hero-07.png', '/animations/heroes/5/hero-08.png', '/animations/heroes/5/hero-16.png',
          '/animations/heroes/6/hero-02.png', '/animations/heroes/6/hero-13.png', '/animations/heroes/6/hero-17.png',
        ],
        videos: [],
      }
    case 'candy':
      // La PISTE de course (route) + les bonbons-bolides (cf. CANDY_RACERS dans CandyDecor).
      return {
        images: [
          '/animations/candy-street.jpg',
          '/animations/bonbon-1.png', '/animations/bonbon-2.png', '/animations/bonbon-5.png',
          '/animations/bonbon-9.png', '/animations/bonbon-11.png', '/animations/bonbon-13.png',
          '/animations/bonbon-11-jaune.png', '/animations/bonbon-11-vert.png',
          '/animations/bonbon-11-bleu.png', '/animations/bonbon-11-violet.png',
        ],
        videos: [],
      }
    case 'oogie':
      // Les 6 faces réelles du dé en os rouge + la déco Halloween (guirlande, citrouille, perce-oreille).
      return {
        images: [
          ...Array.from({ length: 6 }, (_, i) => `/cards/oogie-boogie/die-${i + 1}.webp`),
          '/animations/guirlande_halloween.png', '/animations/citrouille.png', '/animations/perce_oreille.png',
        ],
        videos: [],
      }
    case 'cauldron':
      // Les Soldats Ressuscités de la surprise « éruption du Chaudron » (cf. CauldronDecor).
      return { images: ['/animations/squelettes.png'], videos: [] }
    case 'cruella':
      return { images: ['/animations/patte.png'], videos: [] }
    case 'teamRocket':
      // L'image de fond + la mongolfière Miaouss (ballon permanent) + les Pokémon qui dérivent dans le
      // ciel + le trio qui s'envole (surprise blast-off) + le logo R (surprise).
      return {
        images: [
          '/animations/background_team_rocket.jpg',
          '/animations/team_rocket_ballon.png',
          '/animations/team_rocket_cieux.png',
          '/animations/R_team_rocket.png',
          '/animations/ptera.png', '/animations/papilusion.png', '/animations/insecateur.png',
          '/animations/nosferapti.png', '/animations/nosferalto.png', '/animations/dracolosse.png',
          '/animations/dardargnan.png', '/animations/aeromite.png', '/animations/fantominus.png',
          '/animations/spectrum.png', '/animations/mew.png', '/animations/dracaufeu.png', '/animations/abra.png',
          '/animations/mewtwo.png', '/animations/togetic.png', '/animations/magneton.png', '/animations/magneti.png',
          '/animations/rapasdepic.png', '/animations/porygon.png', '/animations/baudrive.png', '/animations/goelise.png',
          '/animations/floravol.png', '/animations/granivol.png', '/animations/nostenfer.png', '/animations/xatu.png',
          '/animations/noarfang.png',
        ],
        videos: [],
      }
    case 'jungle':
      return {
        images: [
          '/animations/shere_khan.png', '/animations/feuille.png',
          '/animations/liane-1.png', '/animations/liane-3.png', '/animations/liane-4.png', '/animations/liane-5.png',
        ],
        videos: [],
      }
    case 'goldenHair':
      // La fleur d'or magique + les 3 pétales de Gaston (colorés en doré) qui tombent.
      return {
        images: ['/animations/flower.png', '/animations/petale-1.png', '/animations/petale-2.png', '/animations/petale-3.png'],
        videos: [],
      }
    case 'video':
      return { images: [], videos: [decor.src] }
    case 'evilQueen':
      return { images: [decor.apple], videos: [decor.src] }
    case 'goldDust':
      return { images: Array.from({ length: 11 }, (_, i) => `/animations/piece-${i + 1}.png`), videos: [] }
    case 'tamatoa':
      // La pluie « bling-bling » permanente : les 11 pièces de Prince Jean + les 4 diamants + les
      // gros trésors (hameçon de Maui & Te Fiti) + les bulles qui montent par-dessus.
      return {
        images: [
          ...Array.from({ length: 11 }, (_, i) => `/animations/piece-${i + 1}.png`),
          ...Array.from({ length: 4 }, (_, i) => `/animations/diamant-${i + 1}.png`),
          '/animations/hamecon.png',
          '/animations/te_fiti.png',
          '/animations/bulle-bleu.png',
          '/animations/bulle.png',
        ],
        videos: [],
      }
    case 'thorns':
      return { images: ['/animations/ronces.png'], videos: [] }
    case 'forest':
      return {
        images: ['/animations/tronc1.png', '/animations/tronc2.png', '/animations/tronc3.png', '/animations/slenderman_animation.png'],
        videos: [],
      }
    case 'atmosfear':
      // La rangée de petites flammes réutilise le sprite de feu ; les bougies sont un gif.
      return { images: ['/animations/fire_sprite.png', '/animations/candles.gif'], videos: [] }
    case 'upsideDown':
      // Les arbres (sapins) + poteaux électriques de Hawkins (décor) + la silhouette du Flagelleur (surprise).
      return {
        images: [
          ...Array.from({ length: 12 }, (_, i) => `/animations/arbre-${i + 1}.png`),
          '/animations/pylones.png',
          '/animations/flagelleur_mental.png',
        ],
        videos: [],
      }
    case 'water':
      return { images: ['/animations/neverland.png'], videos: [] }
    case 'flyingDutchman':
      return { images: [decor.ship], videos: [] }
    case 'grotto':
      return { images: ['/animations/bulle-bleu.png', '/animations/bulle.png', '/animations/bulle-rose.png'], videos: [] }
    case 'underwater':
      // Orbes des mondes + l'image « Tabbou ailé » de la surprise Coup Fatal.
      return { images: [...UNDERWATER_ORB_IMAGES, '/animations/tabbou_ailes.png'], videos: [] }
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
    // La Bonne Fée : les fioles `potion_fee*` (1, 3, 4, 5 — #2 retiré) + la baguette (cf. LaBonneFeeDecor).
    case 'laBonneFee':
      return {
        images: [...[1, 3, 4, 5].map((n) => `/animations/potion_fee${n}.png`), '/animations/baguette_magique.png'],
        videos: [],
      }
    // Sumbra (`rift`) & Killaire (`radiance`) : la SURPRISE « esprits libérés » précharge les 17 têtes-esprits.
    case 'rift':
    case 'radiance':
      return { images: Array.from({ length: 17 }, (_, i) => `/animations/spirit-${i + 1}.png`), videos: [] }
    // Décors 100 % CSS (aucun fichier à précharger) : film, sand, space, petals,
    // clockwork, cyber, cauldron, sunnyside, upsideDown, felGate, theWorld.
    default:
      return none
  }
}
