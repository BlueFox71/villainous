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

  // --- Slenderman (les 8 Pages dans le royaume) ---
  enqueteur: 'block-advance3',
  'enfant-perdu': 'block-advance',
  'lampe-de-poche': 'slow',
  'lever-du-jour': 'slow',
  'vent-de-panique': 'slow',
  'mauvaise-creepypasta': 'slow',
}

/** cardId dont le « block-win » n'est valable que sous condition (gérée par l'IA). */
export const CONDITIONAL_MALUS = new Set(['zeus', 'hercule', 'provocation', 'reine-moustoria'])
