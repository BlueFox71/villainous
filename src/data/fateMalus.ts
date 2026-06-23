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

  // --- Maléfique (une Malédiction par lieu) ---
  pimprenelle: 'block-advance',
  paquerette: 'slow',
  'epee-verite': 'slow',
  'gardes-chateau': 'slow',
  'roi-stephane': 'slow',
  'roi-hubert': 'slow',
  aurore: 'slow',
  'prince-philippe': 'slow',

  // --- Jafar (contrôler le Génie + Lampe au Palais) ---
  abu: 'block-advance',
  aladdin: 'block-advance',
  'tapis-volant': 'block-advance',
  jasmine: 'slow',
  sultan: 'slow',
  rajah: 'slow',
  voeu: 'slow',

  // --- Ursula (Trident + Couronne au Repaire) ---
  ariel: 'block-win',
  grimsby: 'block-advance',
  'roi-triton': 'slow',
  'prince-eric': 'slow',
  max: 'slow',
  sebastien: 'slow',
  eureka: 'slow',
  polochon: 'slow',
  bigette: 'slow',
  zirgouflex: 'slow',

  // --- Capitaine Crochet (vaincre Peter Pan au Jolly Roger) ---
  'tic-tac': 'block-advance3',
  provocation: 'block-win', // conditionnel : seulement sur un Héros ≠ Peter Pan
  wendy: 'slow',
  michel: 'slow',
  jean: 'slow',
  clochette: 'slow',
  'enfants-perdus': 'slow',
  'poussiere-fee': 'slow',

  // --- Prince Jean (20 Pouvoir) ---
  'robin-des-bois': 'slow3',
  'roi-richard': 'slow3',
  'petit-jean': 'slow3',
  'voler-riches': 'slow3',
  'frere-tuck': 'slow',
  'belle-marianne': 'slow',
  'dame-gertrude': 'slow',
  'adam-halle': 'slow',
  bobby: 'slow',
  toby: 'slow',
  deguisement: 'slow',

  // --- Reine de Cœur (un arceau par lieu + Coup Royal) ---
  dodo: 'block-advance',
  chafouin: 'block-advance',
  alice: 'block-advance',
  'lapin-blanc': 'slow',
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
  joujou: 'block-advance',
  'big-daddy': 'block-advance',
  'mama-odie': 'block-advance',
  tiana: 'slow2',
  charlotte: 'slow',
  eudora: 'slow',
  louis: 'slow',
  naveen: 'slow',
  ray: 'slow',

  // --- Scar (Force ≥ 15 dans la pile Succession) ---
  simba: 'block-advance',
  'baton-rafiki': 'slow2',
  rafiki: 'slow',
  nala: 'slow',
  sarabi: 'slow',
  pumbaa: 'slow',
  timon: 'slow',
  zazu: 'slow',
  'hakuna-matata': 'slow3',

  // --- Méchante Reine (éliminer Blanche-Neige via Poison) ---
  prof: 'block-win',
  joyeux: 'slow3',
  timide: 'slow2',
  simplet: 'slow',
  'puits-souhaits': 'slow',
  grincheux: 'slow',
  atchoum: 'slow',
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
  zarya: 'block-advance', // détruit un Objet (donc un Piratage) de son lieu
  'lynx-seventeen': 'slow2', // Piratages/IEM coûtent +1
  'soldat-76': 'slow',
  'katya-volskaya': 'slow',

  // --- Pat Hibulaire (remplir ses 4 tuiles Objectif) ---
  mickey: 'block-win', // interdit toute complétion tant qu'il est présent
  minnie: 'slow3',
  donald: 'block-advance', // à éliminer avant les autres Héros
  dingo: 'slow3', // déplace / échange les tuiles Objectif
  oswald: 'slow', // −1 Pouvoir sur Une Petite Partie ?
  horace: 'slow',
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
  cendrillon: 'block-advance', // gros Héros (F4) qui recouvre la rangée du haut
  'ball-gown-cinderella': 'block-advance', // idem, encore plus forte (F5)
  'fairy-godmother': 'slow', // recouvre + thème Pantoufle
  bruno: 'slow',
  jaq: 'slow',
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
  'fflewddur-fflam': 'slow',
  'witches-of-morva': 'block-advance', // détiennent le Chaudron : gros frein
  doli: 'slow',
  'fair-folk': 'slow',
  gurgi: 'slow',
  dyrnwyn: 'slow', // épée associée à un Héros : +2 force

  // --- Sa Sucrerie (King Candy) — Vanellope von Schweetz est le Héros-CIBLE de
  // l'objectif (NEUTRE/à éviter : la lui donner LANCE/alimente sa course → le bot évite
  // de la fataliser sauf pour accélérer le jeton Pilote contre lui). Ralph est un gros
  // Héros (mais le vaincre via le Médaillon lui donne Vanellope → ciblage prudent). ---
  'ralph-la-casse': 'block-advance', // gros Héros F6 ; renchérit Déplacer un Objet/Allié
  'sergent-calhoun': 'slow2', // l'action Jouer une carte coûte 1 Pouvoir de plus
  'felix-fixe-jr': 'slow2', // bride le déplacement à 2–3 cases (au lieu de 1–4)
}

/** cardId dont le « block-win » n'est valable que sous condition (gérée par l'IA). */
export const CONDITIONAL_MALUS = new Set(['zeus', 'hercule', 'provocation', 'reine-moustoria'])
