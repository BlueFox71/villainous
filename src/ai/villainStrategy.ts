// =============================================================================
// Couche « stratégie bot » par vilain.
//
// Le heuristicBot est volontairement GÉNÉRIQUE (mêmes poids pour tous) : il ne
// connaît qu'un objectif (`objectiveScore`) et la valeur brute des cartes. Ce
// fichier ajoute, par vilain, des CONSEILS DE JEU déclaratifs (issus des guides
// stratégiques officiels) que l'évaluation consulte en plus de l'éval générique.
//
// On reste DATA-DRIVEN : un vilain = une entrée déclarative ; `villainStrategyBonus`
// l'interprète une fois pour tous. On n'ajoute pas de branche `if (villain === …)`
// dans le moteur de recherche.
//
// Échelle : ces bonus sont des AJUSTEMENTS (départage de coups quasi équivalents),
// petits devant le terme objectif (×1000) et comparables aux termes de force
// (myAllyStr ×2, myHeroVsPower ×4). Ils orientent SANS écraser l'objectif.
// =============================================================================

import type { PlayerState } from '../engine/types'

export interface VillainStrategy {
  /**
   * Placement préféré de certaines cartes (`cardId` → `locationId`) : petit bonus
   * si la carte (non associée) se trouve effectivement sur ce lieu. Sert à orienter
   * le CHOIX DU LIEU où jouer une carte, à coût égal.
   */
  preferredPlacements?: Record<string, string>
  /**
   * Héros à éliminer en PRIORITÉ (`cardId` → poids) : malus SUPPLÉMENTAIRE tant
   * qu'ils sont sur le plateau du joueur, en plus de la pénalité générique liée à
   * leur force. Pousse le bot à les vaincre avant les autres Héros.
   */
  priorityVanquish?: Record<string, number>
  /**
   * Cartes « moteur » dont la simple PRÉSENCE EN JEU (non associée) vaut un bonus
   * au-delà de leur force brute (`cardId` → bonus) : incite le bot à les chercher
   * et à les poser (moteurs de Pouvoir, synergies défensives…).
   */
  enginePieces?: Record<string, number>
  /**
   * Conseils pour le bot qui FATALISE ce vilain (volet « contre ») : sur quels
   * Héros concentrer les Objets de protection et le Pouvoir volé. Sert à départager
   * le CHOIX DE LA CIBLE d'une carte Fatalité, à valeur d'objectif égale (le terme
   * objectif ne distingue pas le porteur). Consulté sur le plateau de l'ADVERSAIRE.
   */
  fateTargeting?: {
    /**
     * Héros à protéger en priorité avec un Objet « ne peut pas être éliminé »
     * (Déguisement) : ceux que ce vilain veut le plus vaincre (= ses `priorityVanquish`).
     */
    protectHeroes?: string[]
    /**
     * Héros sur lesquels déposer en priorité le Pouvoir volé (`lockedPower` de
     * Voler aux Riches / Petit Jean) : les plus durs à éliminer, donc à reprendre le
     * Pouvoir (grosse force, ou défaite qui se retourne contre le vilain).
     */
    powerCarriers?: string[]
    /**
     * Héros-« bloqueurs » à poser de préférence sur un lieu NON maudit (Pimprenelle
     * contre Maléfique : verrouille une case d'objectif). On juge l'ÉTAT RÉSULTANT :
     * poser le Héros sur une Forêt de Ronces la défausse → le lieu devient non maudit
     * → bonus aussi (le guide recommande Forêt de Ronces OU lieu sans Malédiction).
     */
    blockOnUncursed?: string[]
    /**
     * Objets Fatalité « +Force » à associer aux BONS Héros pour maximiser la gêne.
     * Pour chaque règle : si `preferHeroCardIds` est donné, bonus quand l'Objet est
     * dessus ; sinon si `avoidHeroCardIds` est donné, bonus quand l'Objet est sur
     * tout AUTRE Héros (les évités n'en tirent rien d'utile). `onlyIfNotHypnotized` :
     * sans effet une fois le Héros hypnotisé. Ex. : Vœu → Génie (Jafar, renchérit
     * l'Hypnose) ; Poussière de Fée → tout sauf Clochette/Enfants Perdus (Crochet).
     */
    strengthenTargets?: Array<{
      itemCardId: string
      preferHeroCardIds?: string[]
      avoidHeroCardIds?: string[]
      onlyIfNotHypnotized?: boolean
    }>
    /**
     * Pour un objectif « vaincre un Héros sur un lieu » (Crochet/Peter au Jolly Roger) :
     * récompense les Héros posés LOIN du lieu-objectif (plus coûteux à amener/vaincre),
     * sauf ceux de `nearObjective` (Tic Tac : nuit le plus là où le vilain doit venir).
     * Le Héros-cible de l'objectif est exclu (placé par le vilain, pas par le fataliseur).
     */
    spreadHeroesFromObjective?: { nearObjective?: string[] }
    /**
     * Comme `blockOnUncursed`, mais pour un objectif « un Arceau par lieu » (Reine
     * de Cœur) : récompense un Héros-bloqueur (Dodo) posé sur un lieu SANS arceau —
     * il y interdit la transformation des Cartes Gardes, verrouillant la case.
     */
    blockOnNonWicket?: string[]
    /**
     * Objets-MOTEURS de ce vilain qu'il vaut mieux lui retirer (Migraine Atroce →
     * Ingénieux Mécanisme chez Crochet ; Du gospel pur → Char chez Hadès) : malus
     * tant qu'ils sont sur son plateau → le bot préfère les cibler.
     */
    engineThreats?: string[]
    /**
     * Lieu optimal où poser certains Héros Fatalité (`cardId` → `locationId`) : bonus
     * si le Héros s'y trouve. Pour les bloqueurs dont l'effet dépend du lieu (Zeus au
     * Mont Olympe entrave les Titans qui arrivent ; Hercule aux Enfers les y bloque).
     */
    placeHeroAt?: Record<string, string>
    /**
     * Héros Fatalité dont l'aura AFFAIBLIT les Héros co-localisés (Zazu : −2 aux autres
     * Héros de son lieu) : à NE PAS poser sur le lieu d'un Héros que le vilain veut
     * vaincre (sinon on le lui facilite). Pénalité si `heroCardId` partage un lieu avec
     * un `targets`. Cf. Scar : ne pas mettre Zazu sur Mufasa/Simba.
     */
    avoidWeakenerWith?: { heroCardId: string; targets: string[] }
    /**
     * Cartes de la MAIN de ce vilain les plus précieuses à lui faire défausser, par
     * ORDRE de priorité décroissante (Animaux de la forêt contre la Méchante Reine :
     * Miroir > Ingrédients > Croque). Consulté par `enumerate` quand le bot résout un
     * choix « défausser une carte de la main adverse » (l'éval ne distingue pas les
     * cartes en main). La 1ʳᵉ présente est défaussée.
     */
    valuableHandCards?: string[]
    /**
     * Héros de la pioche Fatalité de ce vilain qui l'AIDENT (ex. Flaversham chez
     * Ratigan : −3 au coût de la Reine Robot) : le bot qui fatalise NE les joue PAS,
     * sauf s'il n'a aucune autre carte révélée à jouer. Consulté par `enumerate`
     * (résolution de `pendingFate`).
     */
    avoidPlayingHeroes?: string[]
    /**
     * Héros qui EMPÊCHE la capture sur son lieu (Pongo chez Cruella) : à poser de
     * préférence sur un lieu qui PORTE des Tuiles Chiots (pour bloquer leur capture).
     * Bonus si le Héros est sur un lieu avec ≥1 Tuile « board ».
     */
    blockCaptureOnTiles?: string[]
    /**
     * Lieu(x) à ENCOMBRER de Héros (volet « contre ») : tout Héros Fatalité posé sur un
     * de ces lieux vaut un bonus. Pour les vilains dont un lieu porte une action clé que
     * des Héros peuvent recouvrir — Syndrome : la Base de Syndrome (2ᵉ action « Éliminer
     * un Héros ») ; Lotso : la Bibliothèque + la Cour de Récréation (ses meilleurs lieux
     * de Fatalité/Activer/Pouvoir, à recouvrir avec un Héros plutôt que Buzz).
     */
    clogLocation?: string | string[]
  }
}

export const VILLAIN_STRATEGY: Record<string, VillainStrategy> = {
  // --- Prince Jean (objectif : 20 Pouvoir) — Méchant défensif ---------------
  // Cf. guide officiel : accumuler du Pouvoir, garder ses moteurs, et éliminer
  // sans délai les Héros qui l'amputent (Roi Richard, Robin des Bois).
  princeJohn: {
    preferredPlacements: {
      // La Couronne réduit le coût des cartes là où se trouve la figurine : on la
      // pose sur l'Église du Frère Tuck (Gagner 2 + deux « Jouer une carte »), le
      // meilleur lieu où s'installer pour la déclencher.
      'couronne-roi-richard': 'church',
    },
    priorityVanquish: {
      // Roi Richard bloque TOUTES les cartes Événement ; Robin des Bois ampute
      // chaque gain de Pouvoir. Ses ennemis mortels : à éliminer en premier.
      'roi-richard': 10,
      'robin-des-bois': 10,
    },
    enginePieces: {
      // Moteurs de Pouvoir défensifs : le Shérif gagne 1 Pouvoir quand un Héros le
      // rejoint, le Mandat d'Arrêt rapporte 2 Pouvoir par Héros joué sur son lieu.
      'sherif-nottingham': 4,
      'mandat-arret': 3,
      // Accélérateur de tempo : Persifleur permet de récupérer une action recouverte
      // par un Héros (typiquement une 2ᵉ « Jouer une carte »). Situationnel → sous les
      // vrais moteurs de Pouvoir.
      persifleur: 2,
    },
    fateTargeting: {
      // Déguisement (« ne peut pas être éliminé ») est le plus gênant sur les ennemis
      // mortels que le Prince Jean veut absolument vaincre : on les rend imprenables.
      protectHeroes: ['roi-richard', 'robin-des-bois'],
      // Voler aux Riches : déposer le Pouvoir sur un Héros dur à éliminer (donc dur à
      // reprendre). Dame Gertrude (F6, imprenable en Prison), Belle Marianne (la vaincre
      // invoque Robin → piège), Frère Tuck (a déjà cassé le moteur Mandat).
      powerCarriers: ['dame-gertrude', 'belle-marianne', 'frere-tuck'],
    },
  },

  // --- Maléfique (objectif : une Malédiction sur chacun des 4 lieux) ----------
  // Cf. guide officiel : trouver/garder Diablo (action bonus, contourne le Feu
  // Infernal) et le Bâton Magique (réduit le coût des cartes sur la Forêt) ;
  // dégager les Héros qui défaussent ses Malédictions ou tuent Diablo.
  maleficent: {
    preferredPlacements: {
      // Bâton Magique sur la Forêt : −1 au coût des Événements/Malédictions là où
      // Maléfique gagne 3 Pouvoir et enchaîne ses « Jouer une carte ».
      'baton-magique': 'forest',
    },
    enginePieces: {
      // Diablo = meilleure carte : une action disponible en plus chaque tour et il
      // contourne la restriction du Feu Infernal. À chercher et poser au plus tôt.
      diablo: 6,
      // Bâton Magique = 2ᵉ priorité : moteur de coût pour empiler Malédictions/Événements.
      'baton-magique': 4,
    },
    priorityVanquish: {
      // Pimprenelle interdit TOUTE Malédiction sur son lieu → bloque une case
      // d'objectif tant qu'elle est là : à dégager en priorité.
      pimprenelle: 8,
      // Prince Philippe défausse tous les Alliés de son lieu → menace Diablo (son moteur).
      'prince-philippe': 4,
    },
    fateTargeting: {
      // Pour le bot qui FATALISE Maléfique : poser Pimprenelle sur un lieu non maudit
      // (ou sur une Forêt de Ronces, qu'elle défausse) verrouille une case d'objectif.
      blockOnUncursed: ['pimprenelle'],
    },
  },

  // --- Jafar (objectif : hypnotiser le Génie + Lampe Merveilleuse au Palais) -----
  // Cf. guide officiel : trouver Scarabée d'Or + Lampe + Hypnose, déplacer la Lampe
  // vite (Iago), hypnotiser le Génie au plus tôt (avant qu'il ne grossisse), et
  // neutraliser les voleurs d'Objets (Abu/Aladdin) et le Tapis (à vaincre en premier).
  jafar: {
    enginePieces: {
      // Sceptre Serpent : récupère une Hypnose de la défausse → enabler clé du contrôle.
      'sceptre-serpent': 3,
      // Sablier Géant : −2 à la force des Héros de son lieu → Génie moins cher à hypnotiser.
      'sablier-geant': 2,
      // Iago : déplace la Lampe (et lui-même) plus vite vers le Palais.
      iago: 2,
    },
    priorityVanquish: {
      // Abu/Aladdin volent un Objet (dont la Lampe !) et le rendent inutilisable :
      // à neutraliser vite (les vaincre OU les hypnotiser lève la pénalité).
      abu: 6,
      aladdin: 6,
      // Tapis Volant : doit être éliminé avant les autres Héros (gêne le nettoyage).
      'tapis-volant': 5,
    },
    fateTargeting: {
      // Pour le bot qui FATALISE Jafar : associer le Vœu (+2 Force) au Génie pour
      // renchérir l'Hypnose. Sans effet une fois le Génie hypnotisé.
      strengthenTargets: [{ itemCardId: 'voeu', preferHeroCardIds: ['genie'], onlyIfNotHypnotized: true }],
    },
  },

  // --- Capitaine Crochet (objectif : vaincre Peter Pan sur le Jolly Roger) -------
  // Cf. guide officiel : trouver/jouer Peter + Carte du Pays Imaginaire, masser de
  // la Force au Jolly Roger, déplacer Peter là et l'éliminer. Moteurs clés : Boîte
  // à Crochets (Pouvoir), Canon (action Vaincre), Ingénieux Mécanisme (Déplacer Héros).
  crochet: {
    preferredPlacements: {
      // Canon de préférence à l'Arbre du Pendu (action Vaincre près de Peter à son arrivée).
      canon: 'arbre-pendu',
      // Flibustiers au Rocher du Crâne : couvre le Jolly Roger et la Lagune (Vanquish à distance).
      flibustiers: 'rocher-crane',
      // Monsieur Mouche au Jolly Roger : +2 Force là (masse de Force pour le Vanquish final).
      'monsieur-mouche': 'jolly-roger',
    },
    enginePieces: {
      // Boîte à Crochets : action « Gagner 1 Pouvoir » supplémentaire (moteur durable).
      'boite-crochets': 3,
      // Canon : action « Éliminer un Héros » supplémentaire (clé pour vaincre Peter).
      canon: 3,
      // Ingénieux Mécanisme : action « Déplacer un Héros » → amène Peter au Jolly Roger.
      'ingenieux-mecanisme': 3,
    },
    fateTargeting: {
      // Poussière de Fée (+2 Force) : utile sur n'importe quel Héros SAUF Clochette et
      // Enfants Perdus (qui n'en tirent pas de protection utile) — cf. guide.
      strengthenTargets: [
        { itemCardId: 'poussiere-fee', avoidHeroCardIds: ['clochette', 'enfants-perdus'] },
      ],
      // Poser les Héros loin du Jolly Roger (plus coûteux à amener/vaincre) ; Tic Tac
      // au contraire près (il fait défausser la main de Crochet là où il doit venir).
      spreadHeroesFromObjective: { nearObjective: ['tic-tac'] },
      // Migraine Atroce vise en priorité l'Ingénieux Mécanisme (l'empêche de replacer
      // les Héros pour les éliminer).
      engineThreats: ['ingenieux-mecanisme'],
    },
  },

  // --- Reine de Cœur (objectif : un Arceau sur chaque lieu + Coup Royal) ---------
  // Cf. guide officiel : transformer les Cartes Gardes en Arceaux au plus vite,
  // garder Roi de Cœur / Montre à gousset / Tweedle. Côté défense : Alice (bloque
  // les déplacements) et Dodo (verrouille la transformation d'un lieu) à dégager.
  reineCoeur: {
    enginePieces: {
      // Roi de Cœur : les Cartes Gardes coûtent 1 de moins (moteur d'arceaux).
      'roi-coeur': 3,
      // Montre à gousset : +1 Pouvoir par arceau → moteur qui grossit avec l'objectif.
      'montre-gousset': 3,
      // Tweedle : non défaussés au Vanquish → nettoyeur de Héros réutilisable.
      tweedle: 2,
    },
    priorityVanquish: {
      // Alice : empêche de déplacer Objets/Alliés (gêne le repositionnement et arme le
      // combo « stacker les Gardes ») — guide : la dégager au plus vite.
      alice: 8,
      // Dodo : interdit la transformation des Cartes Gardes de son lieu → verrouille une case.
      dodo: 7,
    },
    fateTargeting: {
      // Pour le bot qui FATALISE la Reine : poser Dodo sur un lieu SANS arceau (il y
      // bloque la transformation, donc verrouille une case d'objectif).
      blockOnNonWicket: ['dodo'],
    },
  },

  // --- Ursula (objectif : Trident + Couronne au Repaire) -------------------------
  // Cf. guide officiel : trouver/poser ses deux Objets, déplacer le Roi Triton (avec
  // le Trident) jusqu'au Repaire, et SURTOUT dégager Ariel (qui gèle le déplacement
  // d'Objet). Le ciblage Bigette→Triton/Ariel du guide n'est pas codé (effet de
  // Bigette « texte seul » à ce jour).
  ursula: {
    enginePieces: {
      // Flotsam/Jetsam : déplacent un Héros (amènent Triton+Trident au Repaire, ou
      // poussent un Héros sur un Pacte pour l'éliminer).
      flotsam: 2,
      jetsam: 2,
      // Chaudron : +2 Pouvoir par Pacte en jeu.
      chaudron: 2,
    },
    priorityVanquish: {
      // Ariel : déplace un Objet hors du Repaire et GÈLE tout déplacement d'Objet tant
      // qu'elle est en jeu → priorité absolue (sa simple présence bloque l'objectif).
      ariel: 10,
      // Grimsby : déplace le Cadenas (peut verrouiller le Repaire au mauvais moment).
      grimsby: 4,
    },
    fateTargeting: {
      // Bigette Bulbeuse (effet désormais codé : +3 au coût d'associer un Pacte au
      // Héros porteur) → la poser sur le Roi Triton ou Ariel, que la Reine doit
      // « pacter » pour les déplacer/neutraliser (cf. guide).
      strengthenTargets: [{ itemCardId: 'bigette', preferHeroCardIds: ['roi-triton', 'ariel'] }],
    },
  },

  // --- Dr Facilier (objectif : Régner + Talisman + Divination au Royaume du vaudou) -
  // Cf. guide officiel : trouver ses 3 cartes-clé (déjà portées par objectiveScore),
  // garder la Canne (victoire-surprise en un tour) et la Poudre d'illusion (vide la
  // Pile de l'Au-delà que les adversaires remplissent). Dégager Tiana (taxe) et Mama
  // Odie (bride la Divination).
  facilier: {
    preferredPlacements: {
      // Canne au Royaume du vaudou : de là, le pion peut emprunter l'action « Jouer
      // une carte » de la Parade pour poser Talisman + Divination le même tour.
      canne: 'royaume-vaudou',
    },
    enginePieces: {
      // La Canne : meilleure carte (combo de victoire en un tour).
      canne: 4,
      // Poudre d'illusion : vide la Pile de l'Au-delà à chaque Vanquish sur son lieu
      // (contre l'attaque principale des adversaires).
      'poudre-illusion': 3,
    },
    priorityVanquish: {
      // Tiana : +1 au coût de TOUTES ses cartes (taxe durable) — guide : la dégager.
      tiana: 6,
      // Mama Odie : la Divination ne révèle plus que 2 cartes → bride son action de victoire.
      'mama-odie': 5,
    },
    fateTargeting: {
      // Pour le bot qui FATALISE Facilier : la Canne est un moteur clé (combo de
      // victoire) → malus tant qu'elle est posée, pour qu'il préfère la retirer
      // (Joujou envoie un Objet dans l'Au-delà).
      engineThreats: ['canne'],
    },
  },

  // --- Hadès (objectif : 3 Titans non entravés au Mont Olympe) -------------------
  // Cf. guide officiel : trouver/jouer ses Titans puis les acheminer vite (le Char
  // est sa meilleure carte ; Panique réduit les coûts aux Enfers). Dégager Zeus et
  // Hercule (qui entravent/bloquent les Titans). Zeus/Hercule sont déjà des block-win
  // CONDITIONNELS (cf. ai/fateMalus.ts) selon leur lieu — ici on les place au mieux.
  hades: {
    preferredPlacements: {
      // Panique aux Enfers : les Titans (joués là) coûtent 1 de moins.
      panique: 'enfers',
    },
    enginePieces: {
      // Le Char : meilleure carte (déplace le pion + le Char, accélère l'acheminement).
      char: 4,
      // Panique : réduit le coût des Objets/Alliés/Titans sur son lieu.
      panique: 3,
    },
    priorityVanquish: {
      // Zeus entrave les Titans arrivant sur son lieu ; Hercule empêche les Titans de
      // quitter le sien → les deux gros bloqueurs à éliminer (avec Potion de mortalité).
      zeus: 8,
      hercule: 8,
    },
    fateTargeting: {
      // Pour le bot qui FATALISE Hadès : poser Zeus au Mont Olympe (entrave les Titans
      // qui arrivent) et Hercule aux Enfers (les y bloque dès le départ).
      placeHeroAt: { zeus: 'mont-olympe', hercule: 'enfers' },
      // Le Char est son moteur de déplacement → malus tant qu'il est posé (Du gospel
      // pur ! le défausse en priorité, cf. moteur).
      engineThreats: ['char'],
    },
  },

  // --- La Méchante Reine (objectif : empoisonner Blanche-Neige à la Maison des Nains) -
  // Cf. guide officiel : trouver les Ingrédients (déverrouillent la Maison) puis le
  // Miroir magique (invoque Blanche-Neige). Ne PAS tuer les Nains (ils renforcent
  // Blanche-Neige et gâchent du Poison) sauf Prof (à vaincre en premier).
  'mechante-reine': {
    preferredPlacements: {
      // Chasseur à la Mine (voisine de la Maison des Nains) : −1 aux Héros, s'y infiltre.
      chasseur: 'mine',
    },
    enginePieces: {
      // Miroir magique : invoque Blanche-Neige (cible de l'objectif) + pioche sur Fatalité.
      'miroir-magique': 4,
      // Trône : moteur de Poison (Activer → +1 Poison).
      trone: 2,
    },
    priorityVanquish: {
      // Prof doit être éliminé AVANT Blanche-Neige (mustDefeatFirst) → priorité ; les
      // autres Nains, eux, ne valent pas le Poison/un Croque (cf. guide) → non listés.
      prof: 8,
    },
    fateTargeting: {
      // Pour le bot qui FATALISE la Méchante Reine : Atchoum défausse un Objet de son
      // lieu → le Miroir magique est la cible n°1 (carte-clé) ; on le pénalise tant
      // qu'il est posé pour que le bot place Atchoum dessus.
      engineThreats: ['miroir-magique'],
      // Animaux de la forêt : faire défausser en priorité le Miroir, puis un Ingrédient
      // (bloque le déverrouillage), puis un Croque ! (la carte de victoire).
      valuableHandCards: [
        'miroir-magique',
        'caquet-megere',
        'hurlement-effroi',
        'noir-de-nuit',
        'poussiere-momie',
        'croque',
      ],
    },
  },

  // --- Ratigan (objectif double : Reine Robot à Buckingham, ou « Le Rat » → Basil) -
  // Cf. guide officiel : amasser de quoi jouer la Reine Robot (coûteuse) puis l'amener
  // vite à Buckingham — le Dirigeable est le meilleur transport. Garder un Allié
  // (Félicia) pour vaincre Basil ou la Reine Moustoria, les deux bloqueurs.
  ratigan: {
    preferredPlacements: {
      // Dirigeable au Repaire secret (où naît la Reine Robot) : il l'emmène à
      // Buckingham en un tour.
      dirigeable: 'repaire-secret',
    },
    enginePieces: {
      // Dirigeable : meilleur transport de la Reine Robot.
      dirigeable: 3,
      // Outils : −1 au coût des Objets (aide à financer la Reine Robot, coût 15).
      outils: 2,
      // Liste de Fidget : moteur de recherche d'Objets.
      'liste-de-fidget': 2,
    },
    priorityVanquish: {
      // Basil défausse la Reine Robot (et bascule l'objectif côté « Le Rat ») ; la
      // Reine Moustoria bloque la victoire à Buckingham → à vaincre (Félicia).
      basil: 7,
      'reine-moustoria': 7,
    },
    fateTargeting: {
      // Pour le bot qui FATALISE Ratigan : poser la Reine Moustoria à Buckingham
      // Palace (seul lieu où elle bloque la victoire — cf. malus conditionnel).
      placeHeroAt: { 'reine-moustoria': 'buckingham-palace' },
      // Flaversham AIDE Ratigan (sur le Repaire secret, la Reine Robot coûte 3 de moins)
      // → le bot ne le joue pas (sauf s'il n'a rien d'autre à jouer).
      avoidPlayingHeroes: ['flaversham'],
    },
  },

  // --- Scar (objectif : Force ≥ 15 dans la pile Succession, démarrée par Mufasa) --
  // Cf. guide officiel : amasser des Hyènes dans une « zone d'élimination » (la
  // Savane), trouver et y vaincre Mufasa (qui lance la pile), puis y faire entrer
  // d'autres gros Héros (Simba). Dégager Rafiki (verrou) et Simba (bride les Hyènes).
  scar: {
    preferredPlacements: {
      // Regrouper les Hyènes affamées sur la Savane (la « zone d'élimination ») : leur
      // force augmente par autre Hyène présente, et l'action Fatalité y est défendue.
      'hyene-affamee': 'savane',
    },
    enginePieces: {
      // Moteurs du essaim de Hyènes : Shenzi (joue une Hyène gratuite), Ed (Hyènes −1),
      // Banzaï (Pouvoir par Hyène défaussée), Troupeau de gnous (regroupe les Héros).
      shenzi: 2,
      ed: 2,
      banzai: 1,
      'troupeau-gnous': 2,
    },
    priorityVanquish: {
      // Mufasa lance la pile Succession (à vaincre dès qu'il y a assez de Hyènes) ;
      // Simba bride les Hyènes (force ≤ 2) ; Rafiki doit être vaincu avant les autres.
      mufasa: 8,
      simba: 6,
      rafiki: 5,
    },
    fateTargeting: {
      // Pour le bot qui FATALISE Scar : poser le Bâton de Rafiki (bouclier : défaussé
      // au lieu d'éliminer le Héros) sur Mufasa ou Simba — Scar gaspille alors un
      // Vanquish pour le retirer (cf. guide : « terrible sur un Héros de grande force »).
      strengthenTargets: [{ itemCardId: 'baton-rafiki', preferHeroCardIds: ['mufasa', 'simba'] }],
      // Ne PAS poser Zazu sur le lieu de Mufasa/Simba : sa −2 les affaiblirait et
      // faciliterait leur élimination par Scar (l'inverse du but du fataliseur).
      avoidWeakenerWith: { heroCardId: 'zazu', targets: ['mufasa', 'simba'] },
    },
  },

  // --- Yzma (objectif : éliminer Kuzco avec Kronk) -------------------------------
  // Cf. guide officiel : trouver Kuzco (Indiscrétion/Marteau pour scruter ses 4 pioches,
  // À l'attaque ! pour le jouer) et Kronk (Bras droit), les réunir, renforcer Kronk
  // (Couteau, Kuzco a +1 de Force) puis éliminer. Chaca/Tipo bloquent toute élimination.
  yzma: {
    enginePieces: {
      // Kronk (F6) : l'Allié-éliminateur indispensable, non défaussé au Vanquish.
      kronk: 3,
    },
    priorityVanquish: {
      // Chaca/Tipo : tant qu'ils sont là, Yzma ne peut éliminer AUCUN autre Héros (donc
      // pas Kuzco) → à dégager en priorité absolue (eux-mêmes restent éliminables).
      chaca: 8,
      tipo: 8,
    },
  },

  // --- Cruella d'Enfer (objectif : capturer 99 Chiots) ---------------------------
  // Cf. guide officiel : amener des Tuiles Chiots puis les capturer avec Jasper (×2)
  // /Horace ; garder du Pouvoir (J'adore les belles fourrures). Dégager Pongo (bloque
  // la capture sur son lieu) et Anita & Roger (renvoie les Tuiles ajoutées en réserve).
  cruella: {
    enginePieces: {
      // Jasper : capture jusqu'à 2 Tuiles par activation = moteur de capture n°1.
      jasper: 4,
      // Horace : capture 1 Tuile ou en amène une de la réserve.
      'horace-cruella': 3,
      // Lampe électrique : amène une Tuile de la réserve (alimente le plateau).
      'lampe-electrique': 2,
      // Roadster : regroupe les Tuiles vers le lieu de capture.
      roadster: 2,
    },
    priorityVanquish: {
      // Pongo : aucune capture possible sur son lieu ; Anita & Roger : renvoie en réserve
      // les Tuiles amenées sur son lieu → à dégager pour débloquer la capture.
      pongo: 6,
      'anita-et-roger': 5,
    },
    fateTargeting: {
      // Pour le bot qui FATALISE Cruella : poser Pongo sur un lieu PORTANT des Tuiles
      // Chiots (il y bloque toute capture).
      blockCaptureOnTiles: ['pongo'],
    },
  },

  // --- Mère Gothel (objectif : 10 Confiance) -------------------------------------
  // Cf. guide officiel : gagner de la Confiance (surtout la Brosse à cheveux) tout en
  // gardant Raiponce loin de Corona. La Couronne est son SEUL gagne-Pouvoir. Dégager
  // Flynn Rider (qui lui vole 2 Confiance, rendues à sa défaite) et Pascal (repousse
  // Raiponce vers Corona / bloque la Tour).
  gothel: {
    enginePieces: {
      // Brosse à cheveux : principal gagne-Confiance (+1 jouée/déplacée sur Raiponce).
      'brosse-a-cheveux': 4,
      // Couronne : seul gagne-Pouvoir + Confiance à l'élimination sur son lieu.
      'couronne-gothel': 3,
      // Stabbington (F5) : renvoient Raiponce sur la Tour (contrôle clé).
      'patchy-stabbington': 2,
      'sideburns-stabbington': 2,
    },
    priorityVanquish: {
      // Flynn Rider détient 2 de sa Confiance (rendues s'il est éliminé) → le vaincre
      // récupère la Confiance ; Pascal repousse Raiponce vers Corona.
      'flynn-rider': 6,
      pascal: 4,
    },
    fateTargeting: {
      // Pour le bot qui FATALISE Gothel : poser Pascal sur la Tour (y bloque ses actions
      // et repousse Raiponce) ; viser ses Objets-moteurs (Brosse/Couronne) avec
      // Vieillissement (malus tant qu'ils sont posés).
      placeHeroAt: { pascal: 'tour' },
      engineThreats: ['brosse-a-cheveux', 'couronne-gothel'],
    },
  },

  // --- Pat Hibulaire (objectif : remplir 4 tuiles Objectif, parmi 120 combinaisons) -
  // Cf. guide officiel : objectif TRÈS variable (pas de plan fixe). Constantes : poser
  // Alliés/Objets, faire les « Win Big » tôt, utiliser les actions bonus des Objets de
  // lieu. Mickey bloque TOUTE complétion (à dégager), Donald doit être vaincu en premier.
  // Pas de fateTargeting : les tuiles sont cachées/variables → ciblage impraticable
  // (l'éval gère déjà Mickey via le plafond d'objectif, Minnie/Goofy via leurs effets).
  patHibulaire: {
    enginePieces: {
      // Steamboat Willie : action « Déplacer un Objet/Allié » bonus (repositionnement
      // pour Rule the Realm / Strike It Rich). Vieux Tacot : action « Jouer une carte »
      // bonus (Power Play, poser Objets/Alliés). Les deux meilleurs moteurs d'actions.
      'steamboat-willie': 3,
      'vieux-tacot': 3,
    },
    priorityVanquish: {
      // Mickey empêche de remplir le moindre objectif tant qu'il est là → priorité ;
      // Donald doit être vaincu avant les autres ; Minnie défausse un Allié/Objet clé.
      mickey: 8,
      donald: 5,
      minnie: 4,
    },
  },

  // --- Madame de Trémaine (objectif : marier une fille EN ROBE au Prince) ----------
  // Cf. guide officiel : réunir Invitation + Cloches + fille en robe + Prince, se
  // défendre des Pantoufles (Canne) et des Fatalités (Plaisanteries douteuses). Dégager
  // Cendrillon en robe de bal (bloque la Salle de Bal) et Marraine la Bonne Fée (bloque
  // les déplacements d'Alliés → la fille ne peut plus rejoindre le bal).
  'madame-tremaine': {
    enginePieces: {
      // Cloches de Mariage : carte de victoire. Canne : seule à retirer les Pantoufles
      // (défense clé). Invitation : déverrouille la Salle de Bal + invoque le Prince.
      'cloches-mariage': 3,
      'canne-tremaine': 3,
      'invitation-du-roi': 2,
    },
    priorityVanquish: {
      // Cendrillon en robe de bal interdit aux Alliés d'entrer dans la Salle de Bal
      // (bloque la victoire) ; Marraine la Bonne Fée gèle les déplacements d'Alliés.
      'ball-gown-cinderella': 7,
      'fairy-godmother': 6,
      cendrillon: 4,
    },
  },

  // --- Gaston (objectif : retirer les 8 Obstacles) -------------------------------
  // Cf. guide officiel : retirer les Obstacles vite (Crise de colère, Laissez-moi vous
  // regarder, Sortez !, Digne de moi, Monsieur D'Arque) et jouer AGRESSIVEMENT. Belle
  // bloque TOUT retrait. Vaincre Maurice/la Bête RETIRE des Obstacles (cible utile).
  gaston: {
    enginePieces: {
      // Monsieur D'Arque : Activer (2 Pouvoir) pour retirer un Obstacle → seul moteur
      // de retrait PERSISTANT (pression hors-Fatalité, cf. guide).
      'monsieur-darque': 4,
    },
    priorityVanquish: {
      // Belle bloque TOUT retrait d'Obstacle → à dégager en priorité absolue. Vaincre
      // Maurice (retire les Obstacles de la Maison de Belle) et la Bête (ceux du Château)
      // fait directement PROGRESSER l'objectif.
      belle: 8,
      maurice: 6,
      'la-bete': 6,
    },
    fateTargeting: {
      // Pour le bot qui FATALISE Gaston : ne PAS jouer Maurice (le vaincre retire des
      // Obstacles = cadeau ; guide « never play Maurice if you can help it »).
      avoidPlayingHeroes: ['maurice'],
    },
  },

  // --- Le Seigneur des Ténèbres (objectif : un Mort-vivant du Chaudron sur chaque lieu) -
  // Cf. guide officiel : s'emparer du Chaudron Noir (Montre-moi le Chaudron Noir / vaincre
  // Hen Wen), le RÉVEILLER (Notre heure est arrivée), poser des Soldats Ancestraux puis les
  // échanger contre des Morts-vivants pour couvrir les 4 lieux. Les Sorcières de Morva
  // empêchent la prise ; le Petit Peuple (Fair Folk) bloque les Soldats ; Fflewddur Fflam
  // est le plus dévastateur (rassemble tous les Alliés). Hen Wen : la vaincre RÉCLAME le
  // Chaudron (cible utile pour LUI, donc le bot adverse évite de la lui donner).
  'seigneur-tenebres': {
    enginePieces: {
      // Soldats Ancestraux : posés sur les lieux puis échangés contre des Morts-vivants
      // (cœur du moteur de couverture) ; activés, ils alimentent aussi le Chaudron.
      'ancient-soldiers': 3,
    },
    priorityVanquish: {
      // Sorcières de Morva : détiennent le Chaudron → bloquent la prise tant qu'elles
      // sont là (verrou). Hen Wen : la vaincre réclame le Chaudron ET lève son blocage
      // d'Événements. Petit Peuple : empêche les Soldats sur son lieu. Fflewddur Fflam :
      // rassemble tous les Alliés sur son lieu → casse la diffusion des Morts-vivants.
      'witches-of-morva': 7,
      'hen-wen': 6,
      'fair-folk': 5,
      'fflewddur-fflam': 5,
    },
  },

  // --- Syndrome (objectif : détruire l'Omnidroïde v.10, royaume sans Héros) -------
  // Cf. guide officiel : 3 phases — « Alpha/Beta Testing » (faire venir des Héros à
  // vaincre pour faire évoluer l'Omnidroïde), « Major Modifications » (trouver les
  // Modifs Majeures + sortir la v.10), « Save the Day » (tout éliminer). La Base de
  // Syndrome offre une 2ᵉ action Éliminer (à garder dégagée). La Télécommande doit
  // être jouée vite (avant Monologue).
  syndrome: {
    enginePieces: {
      // Modifications Majeures : carburant d'évolution (3 défaussées pour la v.10) ;
      // les avoir POSÉES = prêtes à consommer (« throw down Major Modifications »).
      'modification-majeure': 2,
      // Télécommande : indispensable à l'activation finale → la jouer/garder en jeu.
      'telecommande-de-syndrome': 3,
    },
    fateTargeting: {
      // Volet « contre » : encombrer la Base de Syndrome (2ᵉ action Éliminer) pour
      // ralentir son endgame ; M. Indestructible y devient un mur (force +1/Héros
      // co-localisé). La gêne globale des Héros est portée par la jauge objectif
      // (les Héros restants font baisser son score en phase finale).
      clogLocation: 'base-syndrome',
    },
  },

  // --- Lotso (objectif : réduire ses 4 Héros à 0 et les réunir sur la Salle des Chenilles) ---
  // Cf. guide officiel : sortir TOUS les Héros (Big Baby), les corraler, puis tout réduire
  // à 0 EN UN TOUR. Le Chapeau de Woody (−1 à tous les Héros sauf Woody) facilite le combo ;
  // Flex/Stretch sort Rex de la Salle (sinon protégé avec un autre Héros). Volet « contre » :
  // ne PAS lui donner ses Héros (sa Fatalité EST son objectif), encombrer ses meilleurs lieux
  // de Fatalité (Bibliothèque + Cour de Récréation), et Andy nous cherche défait tout combo.
  lotso: {
    enginePieces: {
      // Big Baby : son moteur pour sortir les Héros de la pioche Fatalité (phase 1).
      'big-baby': 3,
      // Chapeau de Woody : −1 à tous les Héros sauf Woody → rapproche le combo de force 0.
      'chapeau-de-woody': 2,
      // Flex/Stretch : seul moyen de sortir Rex de la Salle pour le réduire.
      flex: 1,
    },
    fateTargeting: {
      // Encombrer ses deux meilleurs lieux de Fatalité (Bibliothèque : Fatalité/Activer ;
      // Cour de Récréation : Jouer/Défausser/Pouvoir) avec un Héros.
      clogLocation: ['bibliotheque', 'cour-de-recreation'],
      // Ne JAMAIS lui donner ses Héros-objectif : les jouer en Fatalité = cadeau (ils
      // viennent de SA pioche et il veut les réunir). Le bot joue un autre révélé si possible.
      avoidPlayingHeroes: ['rex', 'woody', 'bayonne', 'jessie'],
    },
  },

  // --- Sa Sucrerie (King Candy) — objectif : franchir l'arrivée avec Vanellope « glitchée » ---
  // Cf. guide officiel : trouver le Médaillon des Héros de Ralph (indispensable), vaincre
  // Ralph (→ Vanellope arrive), lui associer un Bug (la course démarre), puis foncer (Payer
  // pour courir). Volet « contre » : ne PAS lui donner Vanellope (son Héros-objectif) ; ses
  // Héros Calhoun (draine le Pouvoir) et Félix (le ralentit) le gênent (déjà en fateMalus).
  'sa-sucrerie': {
    enginePieces: {
      // Duncan & Wynnchel : action Éliminer un Héros à la pose/au déplacement → moteur pour
      // vaincre Ralph (F6) sans dépendre de la case Vaincre du circuit.
      'duncan-et-wynnchel': 2,
      // Aigre Bill (Sour Bill) : fouille la pioche (fait remonter le Médaillon + les Alliés).
      'aigre-bill': 1,
    },
    fateTargeting: {
      // Vanellope von Schweetz est son Héros-OBJECTIF (deck Fatalité) : la lui jouer la fait
      // entrer GRATUITEMENT dans son royaume (saute toute la quête Médaillon/Ralph) = cadeau.
      avoidPlayingHeroes: ['vanellope-von-schweetz'],
    },
  },

  // --- L'Imposteur (objectif : tenir un Sabotage 3 tours) ------------------------
  // Cf. stratégie : ÉLIMINER les Coéquipiers tôt (porté par la jauge objectif, qui
  // récompense le faible nombre de vivants) pour ouvrir une fenêtre de Sabotage ; ne pas
  // gaspiller les Sabotages tant que les lieux sont bondés (le lookahead l'évite déjà :
  // un Sabotage défaussé en fin de tour ne vaut rien) ; s'appuyer sur ses cartes-moteurs.
  // Pas de fateTargeting (sa Fatalité n'a AUCUN Héros) : le volet « contre » est entièrement
  // porté par la jauge objectif — Arrivée tardive (ranime un Coéquipier) et les Fatalités de
  // suspicion (Corps découvert, Tâche visuelle, Carte, Caméra) en font baisser le score.
  imposteur: {
    enginePieces: {
      // Coéquipier imposteur : exige 1 Coéquipier de plus pour défausser les Tâches de
      // son lieu ET donne l'action « Jouer une carte » → meilleur Allié, à poser tôt.
      'coequipier-imposteur': 4,
      // Tâche : Électricité — moteur de Pouvoir GRATUIT (+1/exemplaire) : à empiler.
      'tache-electricite': 2,
      // Tâche : Téléchargement — récupère un Sabotage (ou autre) de la défausse.
      'tache-telechargement': 1,
    },
  },

  // --- Tamatoa (objectif : Hameçon + Cœur de Te Fiti au Repaire) -----------------
  // Cf. guide officiel : trouver le Cœur (Crustacé doté du pouvoir de création), récupérer
  // l'Hameçon, vaincre Moana/Maui (qui s'emparent des Objets) pour les libérer, puis les
  // réunir au Repaire. Le « contre » est porté par la jauge objectif (un Objet associé à
  // Maui/Moana = progrès partiel ; le libérer/le voler change le score).
  tamatoa: {
    enginePieces: {
      // Monstre Arboricole : déplacer n'importe quelle carte après un Vanquish (combo pour
      // amener l'Hameçon/le Cœur au Repaire le tour même).
      'monstre-arboricole': 1,
      // Monstre Poisson : vainc à distance (atteint un lieu voisin).
      'monstre-poisson': 1,
    },
  },

  // --- Shere Khan (objectif : vaincre Mowgli sans jeton Feu) ----------------------
  // Cf. guide officiel : remplir le royaume de Macaques (retirent le Feu + vainquent),
  // jouer Kaa et le Roi Singe, faire venir Mowgli (« Lancé sur ses traces ») et ne le
  // vaincre que le tour où tout est prêt. Volet « contre » : couvrir les Ruines Anciennes
  // (Gagner 3) de Héros pour l'affamer en Pouvoir ; ne PAS lui donner Mowgli (son objectif).
  'shere-khan': {
    enginePieces: {
      // Kaa : gros Allié (force +2/Objet) + rejoue un Objet de la défausse → moteur de
      // Vanquish. Le Roi Singe : repositionne les Macaques. Macaques : retirent le Feu.
      kaa: 2,
      'le-roi-singe': 1,
      macaques: 1,
    },
    fateTargeting: {
      // Les Ruines Anciennes portent le Gagner 3 Pouvoir : un Héros qui le recouvre
      // l'affame (cf. guide « The Ancient Ruins should be a priority for Heroes »).
      clogLocation: 'ruines-anciennes',
      // Mowgli est son Héros-OBJECTIF (deck Fatalité) : le lui jouer lui ÉVITE de devoir le
      // chercher (« Lancé sur ses traces ») = cadeau. Les autres Héros le gênent (fateMalus).
      avoidPlayingHeroes: ['mowgli'],
    },
  },

  // --- Davy Jones (objectif : récupérer les 5 jetons Trésor) ---------------------
  // Cf. guide officiel : poser les Trésors face cachée sur des Héros, les révéler (Bill le
  // Bottier surtout), puis vaincre les Héros pour les récupérer — idéalement poser/révéler/
  // récupérer dans le même tour. Sortir Le Kraken vite (récupère facilement). Volet
  // « contre » : pas d'avoidPlayingHeroes (les Héros le RALENTISSENT, cf. guide) ; Will
  // Turner (qui défausse ses Alliés-clés) est le meilleur outil de gêne.
  'davy-jones': {
    enginePieces: {
      // Le Kraken : force 8, survit au Vanquish d'un Trésor révélé → récupère facilement.
      'le-kraken': 3,
      // Bill le Bottier : meilleur révélateur de Trésors (à la pose ET au déplacement).
      'bill-le-bottier': 2,
      // Clanker : action Éliminer supplémentaire (nécessaire pour enchaîner les récupérations).
      clanker: 1,
      // L'Équipage : pilier d'Alliés (force +1/autre lieu avec un Allié) → à étaler.
      'equipage-hollandais': 1,
    },
  },

  // --- Dio Brando (custom : retirer du jeu Jotaro + Joseph, puis balayer le royaume
  // via ZA WARUDO!) — vilain personnalisé recréé dans l'Atelier (ids natifs après
  // remap). The World = moteur endgame (double les gains une fois les Joestar retirés) ;
  // les Alliés à Stand (Vanilla Ice → Cream, Enya → Justice) nettoient les Héros
  // bloquants. Contre : ne PAS lui donner Jotaro/Joseph (ses cibles) ; encombrer Le
  // Caire (loc-2 : 2 « Jouer une carte ») que le balayage devra pourtant réaliser.
  'custom-dio': {
    enginePieces: {
      'the-world': 3,
      'vanilla-ice': 1,
      'enya-geil': 1,
    },
    fateTargeting: {
      avoidPlayingHeroes: ['jotaro-kujo', 'joseph-joestar'],
      clogLocation: 'loc-2',
    },
  },

  // --- Team Rocket (objectif : capturer 4 Pokémon dont Pikachu) ------------------
  // INVERSION : les Pokémon (et les dresseurs qui les invoquent) sont ses CIBLES de
  // capture → les lui jouer en Fatalité l'AIDE (surtout Pikachu, requis pour gagner).
  // Le bot qui fatalise Team Rocket les évite ; sa gêne réelle = Badge (capture plus
  // dure) et les cartes qui retirent ses outils/Captures. Quand le bot JOUE Team
  // Rocket, son moteur = ses gros Alliés (capteurs).
  'team-rocket': {
    enginePieces: {
      persian: 3, // force 4, portée n'importe quel lieu (capteur premium)
      arbok: 2, // force 3 + affaiblit les Héros de son lieu
      smogogo: 2, // force 3 + action distante
      miaouss: 1, // force 3, portée lieu voisin
    },
    fateTargeting: {
      avoidPlayingHeroes: [
        'pikachu', 'dracaufeu', 'stari', 'togepi', 'goupix', 'onix', // Pokémon = cibles de capture
        'sacha', 'ondine', 'pierre', // dresseurs : invoquent un Pokémon (cadeau)
      ],
    },
  },
}

/** Bonus de placement gagné quand une carte est sur son lieu préféré. */
const PLACEMENT_BONUS = 3
/** Bonus de ciblage Fatalité : Déguisement sur le bon Héros, Pouvoir volé sur le bon porteur. */
const FATE_TARGET_BONUS = 4

/**
 * Contribution de la couche « stratégie bot » à l'évaluation du joueur `p`
 * (0 si le vilain n'a pas de stratégie déclarée). Consultée par `evaluate`.
 */
export function villainStrategyBonus(p: PlayerState): number {
  const strat = VILLAIN_STRATEGY[p.villain]
  if (!strat) return 0
  let bonus = 0
  for (const [locId, cards] of Object.entries(p.board)) {
    for (const c of cards) {
      if (c.attachedTo) continue // une carte associée n'est pas « posée » sur son lieu
      if (strat.preferredPlacements?.[c.cardId] === locId) bonus += PLACEMENT_BONUS
      const engine = strat.enginePieces?.[c.cardId]
      if (engine) bonus += engine
      if (c.type === 'hero' && !c.trapped) {
        // Un Héros piégé est neutralisé (capacité ignorée, ne recouvre plus) → pas la
        // peine de le prioriser au Vanquish.
        const pv = strat.priorityVanquish?.[c.cardId]
        if (pv) bonus -= pv
      }
    }
  }
  return bonus
}

/**
 * Contribution « ciblage Fatalité » pour le bot qui FATALISE le joueur `opp`
 * (0 si ce vilain n'a pas de conseils de ciblage). Récompense, à valeur d'objectif
 * égale, le fait d'avoir placé une carte Fatalité sur la BONNE cible :
 *  - Déguisement associé à un Héros prioritaire (à rendre imprenable) OU à un Héros
 *    porteur de Pouvoir volé (on protège ainsi le Pouvoir d'être repris) ;
 *  - Pouvoir volé (`lockedPower`) déposé sur un porteur dur à éliminer.
 * Consultée par `evaluate` (côté adversaire), modulée par la menace comme les autres
 * termes de Fatalité.
 */
export function villainFateTargetingBonus(opp: PlayerState): number {
  const ft = VILLAIN_STRATEGY[opp.villain]?.fateTargeting
  if (!ft) return 0
  const all = Object.values(opp.board).flat()
  const hostOf = (c: { attachedTo?: string }) =>
    c.attachedTo ? all.find((h) => h.instanceId === c.attachedTo) : undefined
  let bonus = 0
  for (const [locId, cards] of Object.entries(opp.board)) {
    const hasCurse = cards.some((c) => c.type === 'curse')
    const hasWicket = cards.some((c) => c.isWicket)
    for (const c of cards) {
      // Pouvoir volé déposé sur un porteur dur à reprendre (Prince Jean).
      if (c.type === 'hero' && (c.lockedPower ?? 0) > 0 && ft.powerCarriers?.includes(c.cardId)) {
        bonus += FATE_TARGET_BONUS
      }
      // Héros-bloqueur posé sur un lieu non maudit (Pimprenelle contre Maléfique) :
      // verrouille une case d'objectif (état résultant ; cf. blockOnUncursed).
      if (c.type === 'hero' && !hasCurse && ft.blockOnUncursed?.includes(c.cardId)) {
        bonus += FATE_TARGET_BONUS
      }
      // Héros-bloqueur posé sur un lieu SANS arceau (Dodo contre la Reine de Cœur).
      if (c.type === 'hero' && !hasWicket && ft.blockOnNonWicket?.includes(c.cardId)) {
        bonus += FATE_TARGET_BONUS
      }
      // Héros-bloqueur posé sur son lieu optimal (Zeus→Mont Olympe, Hercule→Enfers).
      if (c.type === 'hero' && ft.placeHeroAt?.[c.cardId] === locId) {
        bonus += FATE_TARGET_BONUS
      }
      // Lieu(x) à encombrer : tout Héros posé sur un lieu-cible (Base de Syndrome ;
      // Bibliothèque/Cour de Récréation de Lotso) y recouvre une action clé → bonus.
      if (
        c.type === 'hero' &&
        (Array.isArray(ft.clogLocation) ? ft.clogLocation.includes(locId) : ft.clogLocation === locId)
      ) {
        bonus += FATE_TARGET_BONUS
      }
      // Héros qui bloque la capture, posé sur un lieu PORTANT des Tuiles (Pongo/Cruella).
      if (c.type === 'hero' && ft.blockCaptureOnTiles?.includes(c.cardId) &&
          (opp.puppyTiles ?? []).some((t) => t.location === locId && t.state === 'board')) {
        bonus += FATE_TARGET_BONUS
      }
      // Anti-placement d'un Héros « affaiblisseur » (Zazu) sur une cible que le vilain
      // veut vaincre (Mufasa/Simba) : sa −2 aiderait le vilain → pénalité.
      const aw = ft.avoidWeakenerWith
      if (aw && c.type === 'hero' && c.cardId === aw.heroCardId &&
          cards.some((h) => h.type === 'hero' && aw.targets.includes(h.cardId))) {
        bonus -= FATE_TARGET_BONUS
      }
      // Déguisement associé à un Héros prioritaire ou porteur de Pouvoir volé (Prince Jean).
      if (c.cardId === 'deguisement' && c.attachedTo) {
        const host = hostOf(c)
        if (host && (ft.protectHeroes?.includes(host.cardId) || (host.lockedPower ?? 0) > 0)) {
          bonus += FATE_TARGET_BONUS
        }
      }
      // Objets « +Force » associés au bon Héros (Vœu → Génie ; Poussière de Fée → tout
      // sauf Clochette/Enfants Perdus). `onlyIfNotHypnotized` : sans effet si hypnotisé.
      if (c.attachedTo) {
        for (const st of ft.strengthenTargets ?? []) {
          if (c.cardId !== st.itemCardId) continue
          const host = hostOf(c)
          if (!host) continue
          if (st.onlyIfNotHypnotized && host.hypnotized) continue
          const good = st.preferHeroCardIds
            ? st.preferHeroCardIds.includes(host.cardId)
            : st.avoidHeroCardIds
              ? !st.avoidHeroCardIds.includes(host.cardId)
              : true
          if (good) bonus += FATE_TARGET_BONUS
        }
      }
    }
  }
  // Héros posés loin du lieu-objectif (Crochet) : plus coûteux à amener/vaincre.
  const obj = opp.objective
  if (ft.spreadHeroesFromObjective && obj.type === 'DEFEAT_HERO_AT_LOCATION') {
    const order = opp.locations.map((l) => l.id)
    const objIdx = order.indexOf(obj.locationId)
    const span = Math.max(1, order.length - 1)
    if (objIdx >= 0) {
      for (const [locId, cards] of Object.entries(opp.board)) {
        const li = order.indexOf(locId)
        if (li < 0) continue
        const dist = Math.abs(li - objIdx) / span // 0 (sur l'objectif) … 1 (le plus loin)
        for (const c of cards) {
          if (c.type !== 'hero' || c.cardId === obj.heroCardId) continue
          const near = ft.spreadHeroesFromObjective.nearObjective?.includes(c.cardId)
          bonus += FATE_TARGET_BONUS * (near ? 1 - dist : dist)
        }
      }
    }
  }
  // Objets-moteurs adverses encore en place (Ingénieux Mécanisme) : malus → le bot
  // préfère les retirer (Migraine Atroce) quand il défausse un Objet du vilain.
  if (ft.engineThreats) {
    for (const c of all) {
      if (c.type === 'item' && !c.attachedTo && ft.engineThreats.includes(c.cardId)) {
        bonus -= FATE_TARGET_BONUS
      }
    }
  }
  return bonus
}
