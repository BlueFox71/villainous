// =============================================================================
// Classement « malus Fatalité » par cardId — données IA UNIQUEMENT.
//
// Du point de vue du JOUEUR ciblé : quelles cartes Fatalité durables (Héros /
// Objets persistants) le gênent, et à quel point. Sert à l'IA pour moduler son
// agressivité Fatalité (cf. ai/fateMalus.ts) : si l'adversaire est déjà bien
// bloqué, le bot se concentre sur SON objectif plutôt que d'empiler des Fatalités.
//
// Source unique maintenable (par cardId) ; le registre (data/registry.ts) attache
// la valeur au CardDef correspondant (`getCardDef(id).fateMalus`). Un test
// d'intégrité vérifie que chaque cardId ici existe bien dans le registre.
//
// Catégories (poids croissant) — l'ABSENCE = NEUTRE (0), typiquement le Héros-cible
// de l'objectif (Peach, Génie, Kuzco, Mufasa, Blanche-Neige, Peter Pan…) :
//   slow / slow2 / slow3      → RALENTIT (gêne ; ++ / +++ = beaucoup)
//   block-advance / -advance3 → EMPÊCHE D'AVANCER (fait reculer la progression)
//   block-win                 → EMPÊCHE DE GAGNER (bloc dur tant que présent)
//
// CONDITIONNELS (block-win seulement dans certains cas) : zeus, hercule,
// provocation, reine-moustoria → l'IA (ai/fateMalus.ts) applique la condition.
// =============================================================================

import type { FateMalus } from './types'

export const FATE_MALUS: Record<string, FateMalus> = {
  // --- Bowser (Observatoire à 0 étoile + capturer Peach) ---
  mario: 'block-win',
  harmonie: 'block-advance',
  luigi: 'slow',

  // --- Maléfique (une Malédiction par lieu) — pas de Héros-cible ; ce qui la gêne =
  // ce qui DÉFAUSSE ses Malédictions ou tue Diablo. Gardes = NEUTRE (« assez inutiles » :
  // ne retirent rien ; le terme « lieux recouverts » couvre déjà leur présence). ---
  pimprenelle: 'block-advance', // interdit toute Malédiction sur son lieu (bloc structurel)
  'roi-stephane': 'slow2', // déplace Maléfique sur un Feu Infernal → défausse une Malédiction
  'prince-philippe': 'slow2', // défausse tous les Alliés de son lieu → tue Diablo
  'epee-verite': 'slow2', // +2 au coût pour maudire son lieu (taxe durable) + protège un Héros
  paquerette: 'slow', // peut défausser Sommeil sans Rêves (conditionnel)
  'roi-hubert': 'slow',
  aurore: 'slow',

  // --- Jafar (contrôler le Génie + Lampe au Palais) — pas de bloc dur (le Génie vient
  // de SA pioche ; même Abu/Aladdin peuvent être hypnotisés). Les voleurs d'Objets et le
  // ralentisseur de pioche sont les pires. ---
  abu: 'block-advance', // vole un Objet (dont la Lampe) et le rend inutilisable ; gêne même après mise en place
  aladdin: 'block-advance', // vole un Objet de la MAIN ou du lieu (peut rafler la Lampe avant qu'elle ne serve)
  'tapis-volant': 'block-advance', // à éliminer avant les autres Héros : protège les voleurs
  jasmine: 'slow2', // −1 pioche/tour : freine durablement sa recherche du Scarabée et de la Lampe
  sultan: 'slow',
  rajah: 'slow',
  voeu: 'slow', // +2 Force sur un Héros ; sur le Génie, renchérit l'Hypnose (cf. fateTargeting)

  // --- Ursula (Trident + Couronne au Repaire) ---
  ariel: 'block-win', // CONDITIONNEL : block-win seulement si un Objet-clé est exposé (sinon slow)
  grimsby: 'block-advance', // déplace le Cadenas (peut verrouiller le Repaire)
  'roi-triton': 'slow',
  'prince-eric': 'slow',
  max: 'slow',
  sebastien: 'slow', // CONDITIONNEL : ne gêne que si un Pacte est associé à un Héros (sinon 0)
  eureka: 'slow',
  polochon: 'slow',
  bigette: 'slow', // associer un Pacte à ce Héros coûte +3 — effet TEXTE SEUL à ce jour
  zirgouflex: 'slow', // Ursula perd 1 Pouvoir en arrivant sur ce Héros — effet TEXTE SEUL à ce jour

  // --- Capitaine Crochet (vaincre Peter Pan au Jolly Roger) ---
  'tic-tac': 'block-advance3',
  provocation: 'block-win', // conditionnel : seulement sur un Héros ≠ Peter Pan
  wendy: 'slow',
  michel: 'slow',
  jean: 'slow',
  clochette: 'slow',
  'enfants-perdus': 'slow',
  'poussiere-fee': 'slow',

  // --- Prince Jean (20 Pouvoir) — pas de bloc dur : l'objectif « accumuler du
  // Pouvoir » ne se bloque pas, il se RALENTIT (fataliser proactivement). Hiérarchie :
  // slow3 (ennemis mortels + drains de Pouvoir) > slow2 (les 3 Voleuses du guide) > slow.
  'robin-des-bois': 'slow3', // −1 Pouvoir sur chaque carte/action de son royaume
  'roi-richard': 'slow3', // interdit toute carte Événement
  'petit-jean': 'slow3', // prend d'emblée 4 Pouvoir (seule carte réactive du deck)
  'voler-riches': 'slow3', // retire jusqu'à 4 Pouvoir, posés sur un Héros
  'frere-tuck': 'slow2', // défausse les Mandats de son lieu → casse le moteur de Pouvoir
  'dame-gertrude': 'slow2', // F6 + imprenable en Prison : reste, gros porteur de Pouvoir volé
  'belle-marianne': 'slow2', // voleuse de choix ; la vaincre invoque Robin des Bois (piège)
  'adam-halle': 'slow',
  bobby: 'slow',
  toby: 'slow',
  deguisement: 'slow',

  // --- Reine de Cœur (un arceau par lieu + Coup Royal) ---
  dodo: 'block-advance', // interdit la transformation des Cartes Gardes de son lieu → verrouille une case
  alice: 'block-advance', // empêche de déplacer Objets/Alliés (gêne + arme le combo de blocage)
  // Le Chafouin retransforme 1-2 arceaux en Cartes Gardes à sa pose (recul direct
  // d'objectif) — effet désormais CODÉ (REVERT_WICKETS).
  chafouin: 'block-advance',
  'lapin-blanc': 'slow', // transformer un Arceau coûte +1
  chenille: 'slow',
  'chapelier-fou': 'slow',
  'lievre-mars': 'slow',
  loir: 'slow',

  // --- Hadès (3 Titans non entravés au Mont Olympe) ---
  zeus: 'block-win', // conditionnel : seulement au Mont Olympe
  hercule: 'block-win', // conditionnel : seulement hors du Mont Olympe
  hera: 'slow2',
  pegase: 'slow',
  hermes: 'slow',
  megara: 'slow',
  phil: 'slow',
  medaillon: 'slow',

  // --- Dr Facilier (Talisman + Régner dans l'Au-delà) ---
  // Effets ONE-SHOT à la pose (slow2) vs gêne ONGOING (block-advance) :
  joujou: 'slow2', // onPlace : envoie un Objet (la Canne !) dans l'Au-delà ; ensuite simple corps F2
  'big-daddy': 'slow2', // onPlace : sort Régner de l'Au-delà (recul déjà reflété par objectiveScore)
  'mama-odie': 'block-advance', // ONGOING : la Divination ne révèle que 2 → bride durablement la victoire
  tiana: 'slow2', // +1 au coût de toutes ses cartes (taxe ongoing)
  charlotte: 'slow',
  eudora: 'slow',
  louis: 'slow',
  naveen: 'slow',
  ray: 'slow',

  // --- Scar (Force ≥ 15 dans la pile Succession) ---
  simba: 'block-advance', // bride les Hyènes (force ≤ 2) → casse la force d'élimination
  'baton-rafiki': 'slow2', // bouclier : défausse au lieu d'éliminer le Héros porteur
  rafiki: 'block-advance', // mustDefeatFirst : Scar doit le vaincre AVANT tout autre Héros (verrou)
  nala: 'slow',
  sarabi: 'slow',
  pumbaa: 'slow',
  timon: 'slow',
  zazu: 'slow',
  'hakuna-matata': 'slow3',

  // --- Méchante Reine (éliminer Blanche-Neige via Poison) ---
  prof: 'block-win', // mustDefeatFirst : à vaincre avant Blanche-Neige
  joyeux: 'slow3', // onPlace : défausse du Poison par Héros présent (gros revers)
  timide: 'slow2', // « Préparer du Poison » coûte 1 Pouvoir (taxe ongoing)
  simplet: 'slow2', // aura +1 à TOUS les autres Héros (renforce Blanche-Neige et les Nains)
  atchoum: 'slow2', // onPlace : défausse un Objet (le Miroir magique !) de son lieu
  'puits-souhaits': 'slow',
  grincheux: 'slow',
  dormeur: 'slow',
  pioche: 'slow',

  // --- L'Imposteur (garder un Sabotage 3 tours) ---
  'corps-decouvert': 'block-advance',
  'video-surveillance': 'slow',
  carte: 'slow',
  majorite: 'slow',
  'reparation-rapide': 'slow',
  'tache-visuelle': 'slow',
  'arrivee-tardive': 'slow',

  // --- Yzma (Kronk élimine Kuzco) ---
  chaca: 'block-win',
  tipo: 'block-win',
  'en-fuite': 'slow3',
  bucky: 'slow',
  chicha: 'slow',
  paysan: 'slow',
  pacha: 'slow',

  // --- Ratigan (Reine Robot à Buckingham ; ou « le Rat ») ---
  'reine-moustoria': 'block-win', // conditionnel : seulement à Buckingham Palace
  basil: 'block-advance',
  'gardes-de-la-reine': 'slow',
  'dr-dawson': 'slow',
  'mrs-judson': 'slow',
  olivia: 'slow',
  'toby-ratigan': 'slow',

  // --- Sombra (un Piratage sur chaque lieu + Protocole Sombra) ---
  'l-oeil': 'block-win', // retire un Piratage de son lieu ET empêche d'y pirater
  'guillermo-portero': 'block-win', // sur Lumérico : empêche d'y pirater
  zarya: 'slow', // détruit un VRAI Objet (pas un Piratage/IEM) → simple corps F5 vs Sombra
  'lynx-seventeen': 'slow2', // Piratages/IEM coûtent +1
  'soldat-76': 'slow',
  'katya-volskaya': 'slow',

  // --- Pat Hibulaire (remplir ses 4 tuiles Objectif) ---
  mickey: 'block-win', // interdit toute complétion tant qu'il est présent
  minnie: 'slow3', // défausse l'Allié/Objet le plus fort (gros revers)
  donald: 'block-advance', // mustDefeatFirst : à éliminer avant les autres Héros (verrou)
  dingo: 'slow3', // déplace / échange les tuiles Objectif (sabotage direct)
  oswald: 'slow', // −1 Pouvoir sur Une Petite Partie ?
  horace: 'slow2', // déplace un Allié/Objet n'importe où → désorganise les tuiles d'objectif
  pluto: 'slow',
  clarabelle: 'slow',

  // --- Slenderman (les 8 Pages dans le royaume) ---
  enqueteur: 'block-advance3',
  'enfant-perdu': 'block-advance',
  'lampe-de-poche': 'slow',
  'lever-du-jour': 'slow',
  'vent-de-panique': 'slow',
  'mauvaise-creepypasta': 'slow',

  // --- Mère Gothel (accumuler 10 Confiance) — pas de bloc dur : la Confiance peut
  // toujours se gagner. Les Héros qui la FONT PERDRE sont les plus gênants. ---
  'flynn-rider': 'block-advance', // lui fait perdre jusqu'à 2 Confiance à l'arrivée
  'la-reine-et-le-roi': 'block-advance', // −1 Confiance sur le lieu de Raiponce
  pascal: 'slow2', // repousse Raiponce vers Corona (loin de la Tour)
  'la-main-froide': 'slow', // défausse une carte de sa main
  'le-satyre': 'slow',
  maximus: 'slow',
  ulf: 'slow', // empêche ses Alliés de quitter leur lieu
  'poele-a-frire': 'slow', // protège un Héros (+1 force)

  // --- Cruella d'Enfer (capturer 99 Chiots) — pas de bloc dur : les Chiots peuvent
  // toujours être ré-amenés. Les Héros qui bloquent la capture / renvoient les
  // tuiles sont les plus gênants. ---
  pongo: 'block-advance', // aucune capture possible sur son lieu
  'anita-et-roger': 'block-advance', // renvoie en réserve les tuiles amenées sur son lieu
  perdita: 'slow2', // libère une tuile capturée (recul direct de la progression)
  nanny: 'slow2', // renchérit les activations (son moteur amener/capturer)
  'sergent-tibs': 'slow',
  colonel: 'slow',
  capitaine: 'slow',

  // --- Gaston (retirer ses 8 Obstacles) — Belle bloque DUR tout retrait. La Bête et
  // Maurice sont NEUTRES (absents) : les vaincre RETIRE des Obstacles → ne pas les
  // fataliser (règle d'évitement dans ai/fateMalus.ts). ---
  belle: 'block-win', // tant qu'elle est là, aucun Obstacle ne peut être retiré
  'big-ben': 'slow', // +1 aux autres Héros du lieu (protège les bloqueurs)
  lumiere: 'slow',
  'mrs-samovar-et-zip': 'slow',
  'invention-de-maurice': 'slow', // −1 à la force des Alliés du lieu (vanquish plus durs)

  // --- Le Seigneur des clés (posséder 1 clé de chaque couleur) — pas de Héros-cible
  // (NEUTRE) : l'objectif ne réclame aucun Héros précis. La Clé Noire bloque DUR la
  // victoire ; Baron Samedi et Gévaudan retirent/bloquent une couleur tant qu'ils
  // sont là ; les autres gênent la main / les actions / les réactions. ---
  'cle-noire': 'block-win', // tant qu'elle est posée, le Seigneur ne peut pas gagner
  'baron-samedi': 'block-advance', // bloque une couleur de clé au dé tant qu'il est là
  gevaudan: 'block-advance', // vole une clé tant qu'il est en jeu (couleur en moins)
  'anne-de-chantraine': 'slow', // défausse les Événements de sa main
  'elisabeth-bathory': 'slow', // l'empêche de jouer ses Conditions en réaction
  hellin: 'slow', // recouvre une action supplémentaire de son lieu
  khufu: 'slow', // défausse l'Appel (perte de pioche défensive)

  // --- Madame de Trémaine (marier une fille au Prince) — la Pantoufle de Verre
  // bloque DUR le mariage tant qu'elle est là ; Cendrillon (ordinaire / en robe)
  // recouvre fortement ; les autres gênent. Le PRINCE est NEUTRE (absent) : il AIDE
  // Madame de Trémaine, donc le bot évite de le lui donner (heuristique). ---
  'pantoufle-chambre': 'block-win', // tant qu'une Pantoufle est là, le mariage est impossible
  'pantoufle-chateau': 'block-win',
  cendrillon: 'block-advance', // +2 au coût des Événements + recouvre la rangée du haut
  'ball-gown-cinderella': 'block-advance', // aucun Allié ne peut entrer dans la Salle de Bal
  'fairy-godmother': 'block-advance', // GÈLE les déplacements d'Alliés → la fille ne rejoint plus le bal (+ invoque Cendrillon en robe)
  jaq: 'slow2', // défausse un Objet-clé (Cloches/Canne) à son arrivée
  bruno: 'slow',
  gus: 'slow',

  // --- Oogie Boogie (faire revenir Jack via 4 Imposteurs puis le vaincre) ---
  // Jack Skellington = Héros-cible (NEUTRE, absent). Perce-Oreilles = Prisonnier de
  // mise en place (NEUTRE). Jack joué EN Fatalité retire un Imposteur : c'est une
  // bonne carte pour l'adversaire, mais ce n'est PAS un Héros durable → hors table.
  sally: 'slow2', // restreint les déplacements d'Oogie aux lieux voisins (gêne forte)
  zero: 'slow2', // +2 à la force de Jack : rend le Vanquish final plus dur
  'docteur-finkelstein': 'slow', // revient sur la pioche Fatalité s'il est éliminé
  'maire-halloween': 'slow', // éliminé → fait apparaître un autre Héros
  'citoyens-halloween': 'slow', // à éliminer avant les autres Héros du lieu

  // --- Le Seigneur des Ténèbres (un Mort-vivant du Chaudron sur chaque lieu) — les
  // Héros recouvrent ses lieux (l'empêchant d'y poser un Mort-vivant) ; les Sorcières
  // de Morva détiennent le Chaudron (gênent davantage). HEN WEN est NEUTRE/à éviter :
  // la lui donner lui offre le Chaudron Noir (le bot l'évite — heuristique). Dyrnwyn
  // (Objet) renforce un Héros, rendant son Vanquish plus coûteux. ---
  taran: 'block-advance', // Héros-cible costaud (F4), recouvre la rangée du haut
  'princess-eilonwy': 'slow',
  'fflewddur-fflam': 'slow2', // rassemble TOUS les Alliés sur son lieu → désorganise la diffusion des Morts-vivants
  'witches-of-morva': 'block-win', // CONDITIONNEL : bloquent DUR la prise du Chaudron tant qu'il n'est pas réclamé (sinon simple corps)
  doli: 'slow',
  'fair-folk': 'block-advance', // empêche de poser des Soldats Ancestraux sur son lieu → ce lieu ne peut pas accueillir de Mort-vivant
  gurgi: 'slow',
  dyrnwyn: 'slow', // épée associée à un Héros : +2 force

  // --- Sa Sucrerie (King Candy) — Vanellope von Schweetz est le Héros-CIBLE de
  // l'objectif (NEUTRE/à éviter : la lui donner LANCE/alimente sa course → le bot évite
  // de la fataliser sauf pour accélérer le jeton Pilote contre lui). Ralph est un gros
  // Héros (mais le vaincre via le Médaillon lui donne Vanellope → ciblage prudent). ---
  'ralph-la-casse': 'block-advance', // gros Héros F6 ; renchérit Déplacer un Objet/Allié
  'sergent-calhoun': 'slow2', // l'action Jouer une carte coûte 1 Pouvoir de plus
  'felix-fixe-jr': 'slow2', // bride le déplacement à 2–3 cases (au lieu de 1–4)

  // --- Shere Khan (vaincre Mowgli sans jeton Feu). Mowgli est le Héros-CIBLE de
  // l'objectif → NEUTRE (non listé) : il est NÉCESSAIRE à sa victoire (le bot évite
  // plutôt de le lui donner). Baloo bloque TOUTE élimination de Héros (bloc dur). ---
  baloo: 'block-win', // protège tous les autres Héros : impossible de vaincre Mowgli tant qu'il est là
  'la-patrouille-de-la-jungle': 'block-advance', // Héros force 6 : mur difficile à abattre
  bagheera: 'slow', // disperse Héros et Alliés (casse la force réunie)
  vautours: 'slow', // déplace un Héros (désorganise)
  'meute-de-loups': 'slow', // défausse un Objet ou des Macaques (gêne le nettoyage du Feu)

  // --- Davy Jones — les Héros sont en grande partie ses CIBLES (porteurs de Trésor à
  // vaincre) → NEUTRE pour la plupart ; le bot évite même de lui donner des Héros utiles.
  // On ne classe que ceux qui le GÊNENT activement. ---
  'jack-sparrow': 'block-advance', // bloque toute action Éliminer tant que Davy partage son lieu
  'will-turner': 'slow2', // défausse un Allié-clé (Bill le Bottier !) à la pose → meilleur outil de gêne (guide)
  // james-norrington / equipage-black-pearl / elizabeth-swann : grossissent mais restent
  // des CIBLES — NEUTRE (non listés). black-pearl-objet : +3 Force au Héros porté (gêne le
  // Vanquish) mais reste sur une cible → on le laisse NEUTRE en v1.

  // --- Team Rocket (capturer 4 Pokémon dont Pikachu) — INVERSION : les Pokémon et les
  // dresseurs sont ses CIBLES (les lui donner l'AIDE → NEUTRE + évités, cf.
  // villainStrategy.avoidPlayingHeroes). Seule gêne durable : le Badge, qui renforce un
  // Pokémon de +2 et rend donc sa capture plus coûteuse en Force d'Alliés. ---
  badge: 'slow', // +2 Force sur un Pokémon → capture plus dure

  // NB : Dio Brando (custom-dio) porte ses malus Fatalité PAR CARTE (champ `fateMalus`
  // dans data/villains/customDio.ts), car ses cartes ne sont pas dans le registre statique
  // (enregistrées dynamiquement à la publication) → pas d'entrées globales ici.

  // --- La Bonne Fée (marier Fiona au Prince Charmant au bal). FIONA = CIBLE → NEUTRE
  // (non listée : la lui donner l'AIDE → le bot l'évite, cf. villainStrategy). Les autres
  // héros de Shrek la gênent ; SHREK bloque DUR la victoire tant qu'il est présent. ---
  shrek: 'block-win', // tant que Shrek est dans le royaume, la victoire est impossible
  parents: 'slow2', // Harold & Lillian : aucun Objet jouable/déplaçable sur leur lieu
  ane: 'slow', // l'Âne : +1 au coût d'activation sur son lieu
  chat: 'slow', // Chat Potté : −2 Pouvoir à l'arrivée + recouvre une action du haut
  creatures: 'slow', // Créatures enchantées : −1 Pouvoir à l'arrivée + recouvre une action
  humain: 'slow', // Humainement beau : protège un Héros de « Meuble » (gêne mineure : Colombe reste)
}

/** cardId dont le « block-win » n'est valable que sous condition (gérée par l'IA). */
export const CONDITIONAL_MALUS = new Set([
  'zeus',
  'hercule',
  'provocation',
  'reine-moustoria',
  'ariel',
  'sebastien',
  'witches-of-morva',
])
