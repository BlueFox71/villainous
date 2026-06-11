/** Une entrée de « notes de version » affichée dans le menu principal. */
export interface PatchNote {
  version: string
  date: string
  title: string
  changes: string[]
}

/** Historique des changements, du plus récent au plus ancien. */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: '0.42',
    date: '2026-06-11',
    title: 'Reine de Cœur : arceaux & Lance',
    changes: [
      'Par ordre de la Reine ! : transformez 1 ou 2 Cartes Gardes en arceaux (sélection à l’écran ; le Dodo protège les Gardes de son lieu).',
      'La Lance donne bien +1 Force, et peut être associée à un arceau (correction : c’était autorisé) — un arceau renforcé est plus dur à franchir au Coup Royal.',
      'L’IA Reine de Cœur transforme ses Cartes Gardes en priorité sur les lieux sans arceau.',
    ],
  },
  {
    version: '0.41',
    date: '2026-06-11',
    title: 'Reine de Cœur : Agrandir',
    changes: [
      'Agrandir (Fatalité) : un Héros agrandi recouvre les 2 actions de son lieu PLUS une action d’un lieu voisin (le côté le plus gênant est choisi).',
      'Agrandir sur un Héros rapetissé le ramène à sa taille normale.',
    ],
  },
  {
    version: '0.40',
    date: '2026-06-11',
    title: 'IA Jafar & Lance',
    changes: [
      'Le bot Jafar pose le Scarabée d’Or (déverrouillage) puis la Lampe Merveilleuse (Génie) dès que possible.',
      'La Lance ne peut plus être associée à un arceau (Cartes Gardes transformées).',
    ],
  },
  {
    version: '0.39',
    date: '2026-06-11',
    title: 'Joyeux non-anniversaire',
    changes: [
      'Joyeux non-anniversaire donne bien 1 Pouvoir par Allié du royaume (arceaux inclus).',
    ],
  },
  {
    version: '0.38',
    date: '2026-06-11',
    title: 'Reine de Cœur : Rapetisser',
    changes: [
      'Rapetisser : un Héros rapetissé ne recouvre qu’une des 2 actions du haut — vous choisissez laquelle utiliser.',
      'Rapetisser sur un Héros agrandi le ramène à sa taille normale ; le Loir ne peut pas rapetisser.',
    ],
  },
  {
    version: '0.37',
    date: '2026-06-11',
    title: 'Reine de Cœur : Coup Royal',
    changes: [
      'Coup Royal jouable : si un arceau est sur chaque lieu, on révèle 5 cartes ; si leurs coûts < force des arceaux, victoire !',
      'Une fenêtre montre les 5 cartes révélées et le verdict (réussi/raté).',
    ],
  },
  {
    version: '0.36',
    date: '2026-06-11',
    title: 'Reine de Cœur : arceaux',
    changes: [
      'Action Activer : transformez une Carte Garde en arceau (et inversement) ; un arceau compte comme Allié mais ne peut pas éliminer de Héros.',
      'Le Lapin Blanc (+1 coût) et Dodo (blocage sur son lieu) sont pris en compte.',
      'Bruitages encore réduits ; dos de cartes de la Reine de Cœur corrigés.',
    ],
  },
  {
    version: '0.35',
    date: '2026-06-11',
    title: 'Nouveau vilain : Reine de Cœur',
    changes: [
      'Reine de Cœur jouable : plateau, 27 cartes et illustrations.',
      'Objectif : placer un arceau dans chaque lieu et réussir un Coup Royal.',
      'Bruitages moins forts par défaut.',
      'En cours : transformation des Cartes Gardes en arceaux et victoire par Coup Royal.',
    ],
  },
  {
    version: '0.34',
    date: '2026-06-11',
    title: 'Options : volume des bruitages',
    changes: [
      'Réglage séparé du volume des bruitages (sons d’interface) dans les Options.',
    ],
  },
  {
    version: '0.33',
    date: '2026-06-11',
    title: 'Son de clic',
    changes: [
      'Un petit son est joué à chaque clic sur un bouton.',
    ],
  },
  {
    version: '0.32',
    date: '2026-06-11',
    title: 'Profil : historique des parties',
    changes: [
      'Le profil liste l’historique des parties : quel vilain contre quel vilain, et le vainqueur.',
    ],
  },
  {
    version: '0.31',
    date: '2026-06-11',
    title: 'Jafar : conseils & stratégie du bot',
    changes: [
      'Fiche de Jafar : conseils « bien le jouer » et « le contrer » réécrits.',
      'Le bot suit mieux le combo de Jafar (déverrouiller la Caverne → invoquer le Génie → rapprocher la Lampe du Palais → hypnotiser).',
    ],
  },
  {
    version: '0.30',
    date: '2026-06-11',
    title: 'Options musique + fond du menu net',
    changes: [
      'Nouvelle option : couper la musique quand le jeu n’est pas au premier plan (autre onglet/fenêtre).',
      'L’image de fond du menu principal n’est plus floutée.',
    ],
  },
  {
    version: '0.29',
    date: '2026-06-11',
    title: 'Musique du menu',
    changes: [
      'La musique « Magic Mirror » joue en boucle dans les écrans du menu (volume/sourdine dans les Options).',
    ],
  },
  {
    version: '0.28',
    date: '2026-06-11',
    title: 'Lampe (Caverne) & Sacrifice (objets associés)',
    changes: [
      'La Lampe Merveilleuse ne peut être posée que sur la Caverne aux Merveilles.',
      'Sacrifice Nécessaire peut défausser un Objet associé à un Allié ou à un Héros hypnotisé.',
    ],
  },
  {
    version: '0.27',
    date: '2026-06-11',
    title: 'Tromperie, Manipulation & Cimeterre',
    changes: [
      'Tromperie : vous choisissez désormais où poser le Héros Fatalité révélé.',
      'Manipulation : une fenêtre affiche votre défausse pour choisir la carte à reprendre.',
      'Cimeterre peut être associé à un Héros hypnotisé (il compte comme un Allié) : +1 force.',
    ],
  },
  {
    version: '0.26',
    date: '2026-06-11',
    title: 'Iago : choix de l’objet à emmener',
    changes: [
      'Si plusieurs objets sont sur le lieu d’Iago, une fenêtre demande lequel emmener (ou « Iago seul »).',
    ],
  },
  {
    version: '0.25',
    date: '2026-06-11',
    title: 'Jafar : Sablier Géant + barre d’objectif',
    changes: [
      'Sablier Géant (Activer) : les Héros de son lieu ont −2 force jusqu’à la fin de votre tour.',
      'La barre d’objectif de Jafar affiche sa vraie progression (Génie contrôlé + Lampe au Palais).',
    ],
  },
  {
    version: '0.24',
    date: '2026-06-11',
    title: 'Options : mode d’affichage',
    changes: [
      'Nouveau réglage d’affichage : Fenêtré, Plein écran, Plein écran fenêtré.',
    ],
  },
  {
    version: '0.23',
    date: '2026-06-11',
    title: 'Corrections : Disparition & Tromperie',
    changes: [
      'Correction : la Disparition de Maléfique s’affichait avec la carte de Slenderman (collision d’identifiant).',
      'Tromperie : les Malédictions de Maléfique comptent comme des Objets pour son déclencheur (≥2 Objets).',
      'Correction : le bouton « jouer une Condition » (Tromperie, Manipulation…) ne réagissait pas.',
      'Tromperie : dévoile et joue la 1ʳᵉ Fatalité de l’adversaire contre lui. Manipulation : reprend une carte de votre défausse.',
    ],
  },
  {
    version: '0.22',
    date: '2026-06-11',
    title: 'Choix du vilain adverse + aléatoire',
    changes: [
      'Nouvelle partie : choisis ton vilain ET celui de l’adversaire (bot).',
      'Option « 🎲 Aléatoire » pour chaque camp (l’adversaire aléatoire évite le miroir).',
    ],
  },
  {
    version: '0.21',
    date: '2026-06-11',
    title: 'Lancer de dé : qui commence',
    changes: [
      'Au début de chaque partie, chaque joueur lance un 1d20 (animé) : le plus haut score commence.',
      'En cas d’égalité, on relance automatiquement.',
      'Le joueur qui ne commence pas démarre avec 1 jeton Pouvoir (compensation).',
    ],
  },
  {
    version: '0.20',
    date: '2026-06-11',
    title: 'Scarabée d’Or : pioche jusqu’à 5',
    changes: [
      'Tant que le Scarabée d’Or est sur votre plateau, vous complétez votre main à 5 cartes au lieu de 4.',
      'Symétriquement, la Princesse Jasmine (Fatalité) réduit la limite de 1.',
    ],
  },
  {
    version: '0.19',
    date: '2026-06-11',
    title: 'Animation de pioche + Héros hypnotisé',
    changes: [
      'Pioche : les nouvelles cartes « volent » de la pioche vers la main au lieu d’apparaître instantanément.',
      'Un Héros hypnotisé (Jafar) s’affiche désormais dans la zone basse (côté méchant), comme un Allié.',
    ],
  },
  {
    version: '0.18',
    date: '2026-06-11',
    title: 'Jafar : Hypnose & co',
    changes: [
      'Hypnose : prenez le contrôle d’un Héros de votre royaume (coût = sa force) ; il devient un Allié et ne recouvre plus les actions — clé de la victoire.',
      'Sceptre Serpent (Activer) : payez 1 Pouvoir pour récupérer une carte Hypnose de votre défausse.',
      'Razoul : jouer un Allié sur son lieu coûte 1 Pouvoir de moins.',
      'Ah, je suis un serpent ? : la cible doit être sur votre lieu (corrigé).',
    ],
  },
  {
    version: '0.17',
    date: '2026-06-11',
    title: 'Voir sa défausse',
    changes: [
      'Cliquer sur une pile de défausse ouvre la liste de toutes les cartes qu’elle contient (plus récentes en premier).',
    ],
  },
  {
    version: '0.16',
    date: '2026-06-11',
    title: 'Jafar : Sacrifice Nécessaire',
    changes: [
      'Sacrifice Nécessaire : défaussez un Allié ou un Objet de votre royaume pour gagner 3 Pouvoir.',
    ],
  },
  {
    version: '0.15',
    date: '2026-06-11',
    title: 'Jafar : Prédiction',
    changes: [
      'Prédiction : choisissez Objet ou Allié, on révèle la pioche jusqu’à en trouver un, gardé en main ; le reste est défaussé.',
    ],
  },
  {
    version: '0.14',
    date: '2026-06-11',
    title: 'Jafar : action « Activer » + Iago',
    changes: [
      'Nouvelle action de lieu « Activer » (symbole nuage/éclair) sur le plateau de Jafar.',
      'Capacité activée d’Iago : payez 1 Pouvoir pour déplacer Iago et un Objet de son lieu vers un lieu voisin.',
      'Les lieux verrouillés ne peuvent être ni cible ni source d’un déplacement (règle officielle).',
    ],
  },
  {
    version: '0.13',
    date: '2026-06-11',
    title: 'Fiche vilain : voir les cartes',
    changes: [
      'Dans la fiche d’un vilain, un bouton « Voir toutes les cartes » affiche son deck Vilain et Fatalité.',
      'Chaque carte indique son nombre d’exemplaires (×N).',
    ],
  },
  {
    version: '0.12',
    date: '2026-06-11',
    title: 'Nouveau vilain : Jafar',
    changes: [
      'Jafar est jouable : plateau, 27 cartes (Vilain + Fatalité) et illustrations.',
      'Objectif : contrôler le Génie (Hypnose) avec la Lampe Merveilleuse au Palais du Sultan.',
      'Caverne aux Merveilles verrouillée, déverrouillée par le Scarabée d’Or ; la Lampe invoque le Génie.',
      'Bonus de force câblés (Cimeterre, Vœu, Génie+Lampe, Rajah+Jasmine).',
      'En cours : l’Hypnose (prise de contrôle) et plusieurs capacités activées arrivent prochainement.',
    ],
  },
  {
    version: '0.11',
    date: '2026-06-11',
    title: 'Main en éventail',
    changes: [
      'La main du joueur est désormais ancrée en bas de l’écran, en éventail (style jeu de cartes en ligne).',
      'Survol d’une carte : elle se relève et se redresse pour être lisible.',
    ],
  },
  {
    version: '0.10',
    date: '2026-06-11',
    title: 'Écran de profil',
    changes: [
      'Nouveau menu « Mon profil » : statistiques par vilain.',
      'Suivi du temps de jeu, des victoires/défaites et du % de victoire.',
      'Statistiques sauvegardées entre les sessions ; réinitialisation possible.',
    ],
  },
  {
    version: '0.9.1',
    date: '2026-06-11',
    title: 'Menu principal : nouvelle ambiance',
    changes: [
      'Image de fond floutée (avec voile sombre) sur le menu principal.',
    ],
  },
  {
    version: '0.9',
    date: '2026-06-11',
    title: 'Slenderman : tous les effets',
    changes: [
      'Dessin inquiétant : +1 pouvoir par Page sur votre lieu.',
      'Brouillage : utiliser une action recouverte par un Héros.',
      'Téléportation : déplacer le pion sur un lieu à Héros, puis y jouer.',
      'Apparition / Vent de panique : déplacer un Héros vers un lieu voisin.',
      'Lampe de poche : bloque la téléportation vers le Héros équipé.',
      'Lever du jour : empêche de jouer une Page au prochain tour.',
      'Mauvaise creepypasta : ramène votre réserve à 2 jetons.',
      'Sombres desseins / Sans visage : Conditions déclenchées par les actions adverses.',
    ],
  },
  {
    version: '0.8',
    date: '2026-06-11',
    title: 'Slenderman : Disparition',
    changes: [
      'Disparition : élimine sans allié un Héros présent sur le lieu de Slenderman.',
    ],
  },
  {
    version: '0.7',
    date: '2026-06-11',
    title: 'Règles & habillage',
    changes: [
      'Page : maximum 2 par lieu (règle appliquée à la pose).',
      'Volume de la musique plafonné pour un fond plus discret.',
      'Menu principal repensé : titre agrandi, boutons centrés, panneau de notes en haut à gauche.',
    ],
  },
  {
    version: '0.6',
    date: '2026-06-11',
    title: 'Audio & options',
    changes: [
      'Musique « Slender: The Arrival » pendant le tour de Slenderman.',
      'Bouton Options : réglage du volume de la musique et sourdine (mémorisés).',
      'Ajout de ce panneau de notes de version dans le menu.',
    ],
  },
  {
    version: '0.5',
    date: '2026-06-11',
    title: 'Slenderman : mécaniques',
    changes: [
      'Retourne-toi : voir la dernière carte de la pioche, la garder ou remélanger + piocher.',
      'Perdu dans les bois : mélange défausse + pioche, puis pioche 2 cartes.',
      'Tombée de la nuit : choix Événement/Objet, on garde la 1ʳᵉ des 4 cartes dévoilées.',
      "Action « Déplacer un héros » (Maison Perdue) — le bot l'utilise s'il y gagne.",
      'Enquêteur / Enfant Perdu capturent les Pages ; le bot les pose en priorité sur les Pages.',
    ],
  },
  {
    version: '0.4',
    date: '2026-06-11',
    title: 'Nouveau vilain : Slenderman',
    changes: [
      'Slenderman jouable : plateau, objectif « 8 Pages dans le royaume », 45 cartes.',
      'Jauge d’objectif dédiée (Pages X / 8).',
      'Actions du plateau cliquables comme pour les autres vilains.',
    ],
  },
  {
    version: '0.3',
    date: '2026-06-11',
    title: 'Menu & encyclopédie',
    changes: [
      'Menu principal (Nouvelle partie, Liste des villains) avec le logo du jeu.',
      'Écran de choix du vilain avant de lancer la partie.',
      'Fiches vilains : difficulté en étoiles, objectif, histoire, conseils pour jouer/contrer.',
    ],
  },
]
