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
  // SURPRISE « LA PELLICULE CASSE » : le cadre DÉCROCHE (l'image saute, la barre noire
  // d'interimage remonte l'écran de plus en plus vite), une BRÛLURE perce le photogramme et le
  // dévore jusqu'au blanc, puis on REMBOBINE — l'amorce défile, le compte à rebours du projecteur
  // balaie son cercle (3-2-1), un flash, et la pellicule repart. 100 % CSS.
  | { kind: 'film' }
  // `sand` : sablier — un filet de sable tombe du haut vers le bas (concentré au
  // centre, comme le col d'un sablier) tandis qu'un niveau de sable se remplit au
  // fond puis se vide en boucle (sablier qu'on retourne) (Jafar — Aladdin).
  // SURPRISE « LA TEMPÊTE DE SABLE » : le vent se lève et le sablier PLOIE (cisaillement +
  // poussée, il se désature), puis la tempête DÉFERLE — un voile ocre traverse la colonne,
  // trois NAPPES de sable filent en travers, de grosses BOURRASQUES la balaient, une DUNE
  // monte du bas et la visibilité tombe presque à zéro — avant que tout se dégage.
  | { kind: 'sand' }
  // `space` : champ d'étoiles (points blancs) défilant vers la droite, avec
  // profondeur (étoiles proches plus rapides et en traînées) → on file dans l'espace
  // comme à travers le hublot d'une fusée (L'Imposteur — Among Us).
  // SURPRISE « SABOTAGE — FUSION DU RÉACTEUR » : l'alerte rouge s'empare de la colonne (les
  // étoiles rougissent, une sirène pulse, des bandes de danger défilent en haut et en bas), tout
  // TREMBLE de plus en plus fort pendant que le panneau égrène son COMPTE À REBOURS, puis un
  // FLASH à zéro laisse place à « Sabotage réparé ». 100 % CSS + texte.
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
  // SURPRISE « MIROIR, MON BEAU MIROIR » : la fumée s'aspire vers le centre et se rassemble en un
  // grand MIROIR ovale (cadre doré en CSS, glace noire) ; un tourbillon de FLAMMES VERTES monte
  // dans la glace, puis le MASQUE (`mirrorMask`) se matérialise au milieu des flammes et se tient
  // en pulsant ; enfin il se dissout vers le haut et le miroir se défait en fumée. Le reste du
  // décor (bulles, poussière, pommes, potion) s'efface le temps de l'apparition.
  | { kind: 'evilQueen'; src: string; gradient?: string; apple: string; mirrorMask: string }
  // `goldDust` : une fine poussière d'or dérive lentement (mouvement flottant, vitesses
  // et tailles variées) ; quelques particules scintillent (éclat de reflet). Voile chaud
  // doré + vignette (le trésor hors champ) (Prince Jean — Robin des Bois, la cupidité).
  // SURPRISE « LE COFFRE DÉBORDE… ET SE VIDE » : un DÉLUGE de pièces et de diamants se déverse du
  // haut, le MAGOT s'empile en bas de la colonne (le tas grossit, des éclats le parcourent), puis
  // il s'AFFAISSE et se vide — l'or lui a filé entre les doigts. 100 % CSS (assets déjà là).
  | { kind: 'goldDust' }
  // `thorns` : une forêt de ronces — des épines sombres montent du bas en oscillant
  // légèrement, sur fond de lueur verte pulsante (sa magie) et d'étincelles vertes qui
  // s'élèvent (Maléfique — La Belle au bois dormant). SURPRISE périodique « Touchez le
  // fuseau… » : la boule verte s'efface, sa magie enfle au centre puis se rétracte sur la
  // pointe d'un ROUET qui se matérialise et s'emballe, avant que la piqûre n'envoie deux
  // ondes vertes sur tout l'écran.
  | { kind: 'thorns' }
  // `forest` : une forêt sombre — des troncs d'arbres verticaux montent au-delà du haut de
  // l'écran (on ne voit pas le feuillage), avec profondeur (arbres lointains plus clairs/flous)
  // (Slenderman). [construction étape par étape]
  | { kind: 'forest' }
  // `petals` : des pétales de roses rouges tombent du haut en voletant (oscillation latérale)
  // et en tournoyant, sur un fond cramoisi sombre (Reine de Cœur — Alice au pays des merveilles).
  // SURPRISE « QU'ON LUI COUPE LA TÊTE ! » : les pétales se FIGENT en plein vol, le fond vire au
  // ROUGE SANG et la vignette se referme, puis le cri BALAIE tout le champ de pétales vers le haut
  // pendant que deux ondes en forme de CŒUR se propagent ; la sentence s'abat comme un coup de
  // TAMPON, dans une secousse, avant que tout retombe. 100 % CSS + texte.
  | { kind: 'petals' }
  // `water` : une mer de nuit — des reflets de lune (traînées horizontales claires) ondulent
  // et scintillent sur l'eau dans le bas de l'écran, sur un fond bleu-nuit (Capitaine Crochet).
  // SURPRISE « LA BORDÉE » : le JOLLY ROGER, mouillé dans le lagon de l'illustration de Neverland,
  // CANONNE LE CIEL — comme quand Crochet tire sur Peter Pan en plein vol. Cinq coups échelonnés :
  // l'éclair de bouche claque sur le navire (avec son reflet sur l'eau), le boulet monte en ARC en
  // semant une traînée de fumée, puis il ÉCLATE en plein ciel (flash, bouffée, éclats). 100 % CSS.
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
  // SURPRISE « HOLDING OUT FOR A HERO » : le karaoké du bal (Shrek 2) — la salle s'ÉTEINT, puis cinq
  // POURSUITES de COULEURS différentes (magenta, violet, cyan, or, corail) s'allument et balaient la
  // scène en se croisant ; tout bat la mesure (voile rose pulsant, ONDES SONORES parties de la scène,
  // ÉGALISEUR en bas, PAILLETTES, NOTES de musique qui montent) jusqu'au DERNIER ACCORD : les cinq
  // poursuites se braquent sur le centre, un FLASH blanc claque et la magie rose se rallume. 100 % CSS.
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
  // SURPRISE « TURBO ! » : le virus se démasque — le monde en sucre se CORROMPT (la scène TRESSAUTE et
  // se DÉDOUBLE en blanc/cyan comme le bug d'écran de Slenderman, scanlines qui défilent, BANDES
  // arrachées, balayage cathodique),
  // la palette rose vire au BLANC-BLEU GLACÉ de Turbo, son nom claque deux fois en gros pixels
  // dédoublés rouge/cyan, un flash — puis tout se recolle. 100 % CSS + texte.
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
  // et une RANGÉE DE PETITES FLAMMES alignées au-dessus de la barre d'objectif. SURPRISE minutée
  // « la CLÉ NOIRE » : les 6 clés colorées jaillissent du centre et tournent en orbite (ellipse
  // aplatie) autour du chronomètre, puis s'éteignent une à une pendant que la CLÉ NOIRE grossit au
  // centre en pulsant d'une lueur violette — le chrono s'assombrit, éclipsé — avant que tout s'estompe.
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
  // et de fines CENDRES de gangrené vertes/violettes qui s'élèvent en scintillant. SURPRISE :
  // « le Portail des Ténèbres » — le CONTOUR de la colonne EST l'arche du portail : le pourtour
  // s'embrase de fel (liseré + halo + fel qui court le long de l'anneau), l'intérieur s'ouvre sur
  // L'ESPACE (nébuleuse fel/violette + étoiles) dans un flash, et des feux / brumes de gangrené nés
  // sur le contour sont ASPIRÉS en spirale vers le cœur avant que tout se referme. 100 % CSS
  // (Gul'dan — vilain custom publié).
  | { kind: 'felGate' }
  // `theWorld` : le pouvoir du TEMPS de Dio (JoJo's Bizarre Adventure — son Stand « The World »). Fond
  // nuit du Caire violet/indigo → doré, aura dorée pulsante, un grand MANDALA d'horloge (anneaux +
  // graduations dorées) qui tourne lentement en arrière-plan (visible dans les marges), une HORLOGE
  // dorée nette dans la bande haute (cadran, chiffres ROMAINS, 3 aiguilles qui tournent) et des CHIFFRES
  // ROMAINS qui flottent en montant et scintillent (or + accents magenta). SURPRISE « ZA WARUDO ! » :
  // le temps DÉFILE de plus en plus vite pendant 3 s (trotteuse qui accélère, cadran qui chauffe), puis
  // un FLASH GRIS (+ onde de choc gris acier) marque la rupture et TOUT SE FIGE ~10 s — les couches du
  // décor sont mises en PAUSE et se désaturent (elles reprendront exactement là où elles se sont
  // arrêtées), des éclats de temps restent suspendus et les NEUF secondes arrêtées défilent en chiffres
  // romains dans l'horloge éclipsée ; un flash doré rend ses couleurs au monde et le temps reprend son
  // cours. Aucun texte. 100 % CSS. (Dio — vilain custom publié.)
  | { kind: 'theWorld' }
  // `monopoly` : le PLATEAU de Monopoly (Mr Monopoly). L'image `src` du plateau vu de dessus, affichée
  // en grand CARRÉ centré sur la colonne (sur un fond de table vert feutré + vignette), SURMONTÉE de
  // deux couches d'ambiance en boucle : des PIONS 2D (chapeau, voiture, chien, dé à coudre, brouette,
  // bateau) qui font le tour du plateau, et des chantiers où poussent des MAISONS vertes (1→4) qui se
  // muent en HÔTEL rouge puis se réinitialisent. SURPRISE : « la table renversée » — le plateau tremble,
  // puis bascule et TOMBE HORS DE L'ÉCRAN pendant que pions, maisons, hôtels, dés et billets sont projetés
  // en arc dans toute la colonne (secousse d'écran) ; la table reste nue un instant, puis le plateau est
  // reposé d'un coup sec et tout se replace (Mr Monopoly — vilain custom publié).
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
  // `otherworld` : l'AUTRE MONDE de Pyramid Head (Silent Hill). Un ciel SOMBRE et BRUMEUX gris (nappes
  // de brume qui dérivent lentement + vignette lourde), d'où pendent des CHAÎNES rouillées et des CAGES
  // suspendues (images) qui se balancent très lentement, pendant que des BRAISES ROUGES montent du bas
  // en scintillant, sur une lueur rouge sourde qui bat (la rouille incandescente de l'Autre Monde).
  // SURPRISE « le Passage à l'Autre Monde » : la sirène monte, le monde BASCULE dans une secousse et
  // tout l'ARRIÈRE-PLAN vire au rouge sang (ciel, brume, cages, chaînes) : le décor PÈLE et découvre
  // du GRILLAGE ROUILLÉ, le SANG le tache et le strie de coulures, les braises deviennent une NUÉE et
  // le HALO DU SOLEIL (sceau de Metatron) s'embrase — puis le monde revient au gris. L'UI n'est pas
  // touchée : la bascule reste dans le décor.
  | { kind: 'otherworld' }
  // `federation` : la PASSERELLE DU CROISEUR FÉDÉRAL de Grand Councilwoman (Lilo & Stitch), vue de
  // l'orbite. Fond bleu profond + vignette, la TRAME HEXAGONALE de son plateau (alvéoles sourdes dont
  // quelques-unes respirent), l'ARC DE LA PLANÈTE en bas de l'écran nimbé de son liseré d'ATMOSPHÈRE,
  // des PANNEAUX HOLOGRAPHIQUES cyan dont les lignes clignotent, et un BALAYAGE de scan qui descend
  // périodiquement. SURPRISE : le RAYON DE CAPTURE — l'écran tremble, un cône de lumière bleue descend
  // du haut et la trame hexagonale S'ALLUME en une vague qui descend (le champ de confinement se
  // referme) sur STITCH, happé vers le haut au bas du cône, avant un flash et la dissipation.
  // 100 % CSS, à l'exception de la silhouette de Stitch.
  | { kind: 'federation' }
  // `haddonfield` : la nuit du 31 octobre à Haddonfield (Michael Myers — Halloween). Nuit de
  // banlieue FROIDE et déserte : silhouettes noires des pavillons au fond (une fenêtre allumée
  // s'éteint de temps en temps), DEUX LAMPADAIRES blafards de part et d'autre de la rue, une
  // brume basse qui dérive, des FEUILLES MORTES qui tombent en voletant et roulent au sol, et
  // la CITROUILLE du générique qui luit en haut, sa flamme vacillante, en dérivant lentement
  // de gauche à droite. SURPRISE « The Shape » : les lampadaires grésillent et, quand la lumière
  // revient, Michael est là — silhouette noire immobile, il ne fait RIEN pendant plusieurs
  // secondes, puis se fond de nouveau dans la nuit.
  | { kind: 'haddonfield' }
  // `ultronFactory` : l'USINE DE SOKOVIA (Ultron — Marvel). Un hangar d'acier sombre mordu par une
  // lueur ROUGE : un CONVOYEUR défile en continu au sol en portant des châssis de drones inertes,
  // des BRAS ROBOTISÉS pivotent au-dessus de la chaîne en crachant des GERBES D'ÉTINCELLES de
  // soudure, une poussière métallique flotte, et au fond, dans le noir, les PAIRES D'YEUX ROUGES
  // de l'armée s'allument rangée par rangée — d'autant plus nombreuses qu'Ultron approche de
  // L'ÈRE D'ULTRON (l'armée s'éveille avec sa progression d'objectif). 100 % CSS.
  | { kind: 'ultronFactory' }
  // `graceField` : le jardin d'enfance d'Isabella (The Promised Neverland) — et son mensonge. La
  // MAISON de Grace Field (image) posée dans sa PELOUSE (des herbes ondulent au vent, en profondeur),
  // le GRAND ARBRE sous lequel jouent les enfants, la lisière de FORÊT de feuillus qui la cache du
  // monde et, tout au fond, LE MUR de béton infranchissable et sa PORTE. Une JOURNÉE défile en boucle (le ciel passe du plein
  // jour au crépuscule doré puis à la nuit — ses « activités quotidiennes ») : la nuit, les étoiles
  // sortent, les fenêtres de la maison s'allument et les LUCIOLES gagnent la prairie. Des MATRICULES
  // à 5 chiffres s'inscrivent en fondu dans le ciel, comme tamponnés. SURPRISE « LA MOISSON » : la
  // cloche sonne (ondes concentriques depuis le clocheton), le monde se fige et se DÉSATURE, une
  // lueur ROUGE monte du sol, les FLEURS VIDA (`vida`) — celles qu'on pose sur les corps expédiés —
  // poussent dans la prairie et leurs pétales dérivent — puis la couleur revient et les lucioles se
  // rallument. 100 % CSS, hors la maison et les fleurs.
  | { kind: 'graceField'; home: string; vida: string }
  // `titan` : TITAN, la planète natale de Thanos — un monde mort, et le GANTELET qui compte ses
  // Pierres. Ciel de nébuleuse violet/magenta étoilé virant à l'ocre-rouille près du sol, silhouettes
  // de TOURS BRISÉES à l'horizon, et surtout les BLOCS de la planète éclatée qui dérivent EN
  // SUSPENSION (la gravité est morte avec elle), pendant que des cendres montent du sol.
  // Dans la bande haute, LE GANTELET DE L'INFINI sert de JAUGE : ses 6 logements (4 phalanges +
  // le dos de la main + le pouce) portent chacun une Pierre, ALLUMÉE seulement si Thanos l'a
  // réellement capturée en Compétences — sur le principe de la lune d'`atmosfear`.
  // SURPRISE « LE CLAQUEMENT » : les six gemmes montent en puissance, un FLASH blanc et une onde de
  // choc partent du Gantelet, puis TOUT LE MONDE SE DÉSAGRÈGE EN POUSSIÈRE (les couches se désaturent
  // et s'effacent tandis que les cendres s'envolent, dans un silence noir) — avant que le monde se
  // reforme. L'UI n'est pas touchée : la bascule reste dans le décor. Tout est en CSS, à l'exception
  // du GANTELET lui-même (l'illustration des cartes, cf. `TITAN_GAUNTLET`) (Thanos — Marvel).
  | { kind: 'titan' }

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
  // Surprise « Miroir, mon beau miroir » : le masque du Miroir magique (`mirrorMask`).
  mechanteReine: {
    kind: 'evilQueen',
    src: '/animations/smoke.mp4',
    gradient: 'linear-gradient(to top, #2e1c2d, #472b46 55%, #5e3a5b)',
    apple: '/animations/apple.png',
    mirrorMask: '/animations/masque_miroir.webp',
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
  // Thanos (Marvel) : Titan, sa planète morte — ciel de nébuleuse, tours brisées, blocs de la planète
  // éclatée en suspension et cendres qui montent ; le GANTELET de la bande haute compte ses Pierres
  // (gemme allumée = Pierre capturée). Surprise : LE CLAQUEMENT (tout part en poussière).
  thanos: { kind: 'titan' },
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
  // Pyramid Head (Silent Hill) : l'Autre Monde — ciel gris sombre et brumeux, chaînes et cages
  // suspendues qui se balancent, braises rouges qui montent.
  'custom-pyramid-head': { kind: 'otherworld' },
  // Grand Councilwoman (Lilo & Stitch) : la passerelle du croiseur fédéral — trame hexagonale (le motif
  // de son plateau), arc de la planète et son atmosphère, panneaux holographiques et balayage de scan.
  'custom-stitch': { kind: 'federation' },
  // Michael Myers (Halloween) : la nuit du 31 octobre à Haddonfield — pavillons en silhouette,
  // lampadaire blafard, brume basse, feuilles mortes et la citrouille du générique ; surprise =
  // « The Shape » (Michael apparaît, immobile, puis disparaît).
  'custom-michael-meyers': { kind: 'haddonfield' },
  // Ultron (Marvel) : l'usine de Sokovia — convoyeur, bras robotisés et étincelles de soudure,
  // et l'armée de drones dont les yeux rouges s'allument au fond à mesure qu'il progresse.
  'custom-ultron': { kind: 'ultronFactory' },
  // Isabella (The Promised Neverland) : le jardin d'enfance de Grace Field — la maison dans sa
  // prairie, la forêt et le mur au fond, une journée qui défile en boucle (jour → crépuscule →
  // nuit), matricules et lucioles ; surprise = « la Moisson » (la cloche, le rouge, les fleurs Vida).
  'custom-isabella': {
    kind: 'graceField',
    home: '/animations/maison_grace_field.webp',
    vida: '/animations/fleur_vida.webp',
  },
}

/** Décor permanent d'un vilain (natif OU publié) ; undefined si non défini. Un vilain publié a un id
 *  `custom-…` (résolu ici) ; un natif a sa `VillainKey`. */
export function villainDecor(key: string): VillainDecor | undefined {
  return CUSTOM_VILLAIN_DECOR[key] ?? VILLAIN_DECOR[key as VillainKey]
}

/** L'illustration du GANTELET DE L'INFINI du décor `titan`, DÉTOURÉE (fond transparent) : source dans
 *  `assets/animations/thanos/gantelet_thanos.png`, servie en WebP à alpha. Elle vient du DOS des cartes
 *  Pierre (`public/cards/thanos/back-pierre-de-l-ame.webp`, zone 125,4 400×408) — d'où les logements
 *  déjà dessinés, sur lesquels `TITAN_STONES` pose les gemmes. Ne pas recadrer sans reprendre les
 *  positions de `TITAN_STONES` : elles sont exprimées en % de CE cadrage. */
export const TITAN_GAUNTLET = '/animations/gantelet_thanos.webp'

/** LES 6 PIERRES D'INFINITÉ dans les logements du Gantelet (décor `titan`, Thanos). `id` = le `cardId`
 *  de la carte (c'est lui qui permet d'allumer la BONNE gemme), `c` sa couleur, `x`/`y` le centre du
 *  logement et `d` son diamètre, tous en % de la LARGEUR de l'illustration `TITAN_GAUNTLET` (donc
 *  indépendants de la taille à l'écran).
 *
 *  Les positions sont RELEVÉES sur l'illustration (chaque dos de carte allume le logement de SA
 *  Pierre : un diff entre les 6 dos donne les six centres au pixel), d'où cet arrangement, qui est
 *  celui du Gantelet dessiné : Âme · Réalité · Espace · Pouvoir sur les phalanges, Esprit au dos de
 *  la main (le gros logement), Temps sur le pouce. Ne pas « ranger » cette liste : elle colle au
 *  dessin. */
export const TITAN_STONES = [
  { id: 'pierre-de-l-ame', c: '#ff8c2b', x: 13.6, y: 32.8, d: 10.8 }, // Âme — orange (phalange 1)
  { id: 'pierre-de-la-realite', c: '#e23a3f', x: 28.2, y: 26, d: 11.6 }, // Réalité — rouge (phalange 2)
  { id: 'pierre-de-l-espace', c: '#4d8bff', x: 42.6, y: 24.4, d: 11.4 }, // Espace — bleu (phalange 3)
  { id: 'pierre-du-pouvoir', c: '#a855f7', x: 57.6, y: 23.2, d: 10.8 }, // Pouvoir — violet (phalange 4)
  { id: 'pierre-de-l-esprit', c: '#ffd93d', x: 42, y: 56, d: 17 }, // Esprit — jaune (dos de la main)
  { id: 'pierre-du-temps', c: '#35d97a', x: 84.2, y: 40.5, d: 9 }, // Temps — vert (pouce)
]

/** `cardId` des 6 Pierres, dans l'ordre où le Gantelet les sertit. Sert à l'outil de test, qui simule
 *  « N Pierres capturées » en sertissant les N premières (cf. `thanosStonesOverride`, App.tsx). */
export const TITAN_STONE_IDS = TITAN_STONES.map((s) => s.id)

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
    // La pomme (permanente) + le masque du Miroir magique, qui ne sert qu'à la surprise
    // « Miroir, mon beau miroir » (le miroir lui-même et ses flammes sont en CSS).
    case 'evilQueen':
      return { images: [decor.apple, decor.mirrorMask], videos: [decor.src] }
    // Les 11 pièces (permanentes) + les 4 diamants, qui ne servent qu'au déluge de la surprise
    // « le coffre déborde ».
    case 'goldDust':
      return {
        images: [
          ...Array.from({ length: 11 }, (_, i) => `/animations/piece-${i + 1}.png`),
          ...Array.from({ length: 4 }, (_, i) => `/animations/diamant-${i + 1}.png`),
        ],
        videos: [],
      }
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
      // La rangée de petites flammes réutilise le sprite de feu ; les bougies sont un gif. Les 6 clés
      // colorées sont celles de la surprise « la clé noire » (l'une d'elles sert aussi de clé noire).
      return {
        images: [
          '/animations/fire_sprite.png',
          '/animations/candles.gif',
          ...['bleu', 'vert', 'jaune', 'orange', 'rouge', 'violet'].map(
            (c) => `/cards/custom-seigneur-cles/cle-${c}.webp`,
          ),
        ],
        videos: [],
      }
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
    case 'otherworld':
      // Les 3 cages suspendues + la chaîne (répétée en plusieurs exemplaires).
      return {
        images: ['/animations/cage-1.png', '/animations/cage-2.png', '/animations/cage-3.png', '/animations/chaine.png'],
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
    // Grand Councilwoman : la silhouette de STITCH, pris dans le rayon de capture (surprise).
    case 'federation':
      return { images: ['/animations/stitch.png'], videos: [] }
    // Michael Myers : la citrouille du générique (permanente) + la silhouette de « The Shape »
    // (surprise). Le reste du décor (pavillons, lampadaire, brume, feuilles) est 100 % CSS.
    case 'haddonfield':
      return { images: ['/animations/citrouille_meyers.png', '/animations/silhouette_meyers.png'], videos: [] }
    // Isabella : la MAISON de Grace Field + la FLEUR VIDA de la surprise « la Moisson » (le reste —
    // mur, forêt, pelouse, herbes, lucioles, matricules — est 100 % CSS).
    case 'graceField':
      return { images: [decor.home, decor.vida], videos: [] }
    // Thanos : le GANTELET de la jauge (le reste — ciel, tours, blocs, cendres, gemmes — est en CSS).
    case 'titan':
      return { images: [TITAN_GAUNTLET], videos: [] }
    // Décors 100 % CSS (aucun fichier à précharger) : film, sand, space, petals,
    // clockwork, cyber, cauldron, sunnyside, upsideDown, felGate, theWorld.
    default:
      return none
  }
}
