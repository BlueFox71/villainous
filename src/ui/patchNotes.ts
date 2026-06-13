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
    version: '0.65',
    date: '2026-06-13',
    title: 'Chantier multijoueur (4/6) : branchement des coups',
    changes: [
      'Tous les coups de jeu passent désormais par un point d’entrée unique (toujours en préparation, sans effet sur le jeu solo) : en solo ils s’appliquent comme avant ; en réseau, ils seront envoyés à l’hôte. Étape invisible qui prépare le branchement de la partie à deux.',
    ],
  },
  {
    version: '0.64',
    date: '2026-06-13',
    title: 'Chantier multijoueur (3/6) : arbitrage des tours',
    changes: [
      'Mise en place de l’« arbitre » de partie à deux (toujours en préparation, sans effet sur le jeu solo) : l’ordinateur hôte valide chaque coup (seul le joueur dont c’est le tour peut jouer), l’applique et renvoie l’état complet à l’autre joueur, qui se synchronise.',
    ],
  },
  {
    version: '0.63',
    date: '2026-06-13',
    title: 'Chantier multijoueur (2/6) : tuyauterie réseau',
    changes: [
      'Mise en place de la connexion réseau pour la future partie à deux (toujours en préparation, sans effet sur le jeu solo) : un petit serveur de liaison à lancer sur l’ordinateur hôte permet aux deux navigateurs de s’échanger des messages sur le même réseau.',
      'Le protocole d’échange (demandes d’action, diffusion de l’état, salon de jeu) et le transport sont posés et testés.',
    ],
  },
  {
    version: '0.62',
    date: '2026-06-13',
    title: 'Chantier multijoueur (1/6) : fondations',
    changes: [
      'Début des travaux pour jouer à deux sur le même réseau (encore en préparation, pas encore jouable). Cette version ne change rien au jeu solo contre le bot.',
      'Réorganisation interne : la notion de « siège » (humain local / humain distant / bot) et le calcul de « à qui la main ? » sont désormais centralisés, pour préparer proprement les tours en réseau.',
    ],
  },
  {
    version: '0.61',
    date: '2026-06-13',
    title: 'Mise en scène : versus, « À vous de jouer », animations',
    changes: [
      'Début de partie : écran « versus » animé (votre méchant — CONTRE — l’adversaire, illustrations en grand) qui accompagne la voix d’intro et le jet de dé pour savoir qui commence (~6 s).',
      'À chaque début de votre tour, une affiche « À vous de jouer » présente votre méchant.',
      'Nouveau thème de fond « teinté par les méchants » : les couleurs des deux vilains en présence colorent l’écran (avec une légère animation), en partie comme au choix des vilains.',
      'Les couleurs bleu/rouge (vous/adversaire) sont remplacées partout par la couleur de chaque méchant (panneaux, cartes-lieux, contours du plateau).',
      'Écran « Choix des vilains » : l’illustration du vilain sélectionné s’affiche en grand à gauche (vous) et à droite (adversaire) ; une silhouette mystère apparaît pour « Aléatoire » ; fond et bandeau du bas harmonisés.',
      'En-tête de partie épurée (transparente, sans titre). Le numéro affiché correspond désormais à une manche complète (les deux joueurs ont joué) et un chronomètre indique la durée de la partie.',
      'La carte sélectionnée garde son cadre jaune le temps de choisir sa cible ; vos actions de lieu s’illuminent au clic (comme celles du bot).',
      'Le déplacement d’une carte d’un lieu à l’autre est désormais animé (bot comme joueur).',
      'Pioche : les cartes apparaissent une par une et les cartes en vol passent derrière la main. Le showcase de défausse est plus court et n’a plus de petit décalage à l’apparition.',
      'Pendant une défausse, le bouton « Fin de tour » est remplacé par un bouton bleu « Défausser » ; le bouton « Annuler » est en rouge.',
      'Chaque écran a maintenant sa propre adresse (le lien change selon la page).',
      'Correctif bot : Hadès ne joue plus « Préparez-vous au combat ! » s’il n’a aucun Titan déplaçable.',
    ],
  },
  {
    version: '0.60',
    date: '2026-06-13',
    title: 'Nouveau vilain : Dr Facilier',
    changes: [
      'Dr Facilier (Disney, 2★) jouable : objectif « jouer le Talisman et Régner sur la Nouvelle-Orléans, détenir le Talisman, puis jouer Divination au Royaume du vaudou pour révéler Régner depuis la Pile de l’Au-delà ». Pion détouré, plateau, 30 cartes Méchant + 15 Fatalité, fiche et conseils, voix d’intro.',
      'Nouvelle mécanique : la Pile de l’Au-delà (visible sous le plateau, cliquable pour voir son contenu). Amis de l’au-delà et Régner y vont quand on les joue ; les adversaires l’alimentent via la Fatalité. Divination la mélange, en révèle 3 cartes (2 avec Mama Odie) et résout leurs effets dans l’ordre que vous choisissez.',
      'Le Talisman s’associe automatiquement à un Héros de force ≤ 3 et revient libre quand ce Héros est éliminé. Forme de grenouille s’associe à un Héros (−2 force) ; un Héros de force 0 peut être éliminé sans Allié. Poudre d’illusion vide la pile à chaque Héros éliminé.',
      'Choix interactifs : Divination (ordre de résolution), Tour de passe-passe (carte gardée), Si près du but / Charlotte (cartes envoyées dans la pile + ordre), Poupées vaudou (déplacer un Héros), Canne (agir sur un lieu voisin). Joujou peut cibler les Esprits des masques (Allié + Objet) ; Ray laisse jouer la 2ᵉ carte révélée.',
      'Conditions Désespoir / Terreur ; Lawrence suit les Héros, l’Ombre suit le pion, Tiana renchérit les cartes, Big Daddy/Eudora/Naveen actifs.',
      'Règles : Forêt de Ronces ne peut plus être posée sur un lieu où un Héros présent viole sa restriction ; Joyeux non-anniversaire est injouable sans Allié dans le royaume.',
      'Améliorations du bot : il n’utilise plus Alignement des planètes sans Titan entravé ni Joyeux non-anniversaire sans Allié, et peut défausser d’un coup les cartes injouables.',
      'Menu : nouveau fond d’écran Disney Villainous et nouvelle musique (« The Magic Mirror »). Liste des villains affichée en rangées de 4.',
    ],
  },
  {
    version: '0.59',
    date: '2026-06-13',
    title: 'Sons : voix d’intro + banque de sons',
    changes: [
      'À l’entrée d’une partie, une séquence vocale se joue : voix de votre méchant, « Contre », puis voix du méchant adverse (une variante tirée au hasard parmi quatre à chaque fois).',
      'Nouvelle page « Banque de sons » accessible depuis le menu principal : parcourir et écouter tous les sons (recherche, filtre par catégorie, précédent/suivant, lecture automatique enchaînée, volume).',
    ],
  },
  {
    version: '0.58',
    date: '2026-06-13',
    title: 'Refonte de l’interface + couleurs des méchants',
    changes: [
      'Les panneaux des deux camps (nom, jetons, objectif) sont regroupés en bas de l’écran, de part et d’autre de la main ; colonnes des plateaux agrandies, textes d’objectif et jetons plus grands.',
      'Couleur thématique de chaque méchant appliquée partout : fonds des cases et des panneaux, contours des cases / du plateau / du pion, serpent du lieu courant, bulles du journal.',
      'Main du bot affichée en éventail (dos cachés) ; piles Fatalité (pioche + défausse) regroupées à gauche des cases Héros, zoom de défausse repositionné.',
      'Les actions jouées par le bot s’illuminent une par une sur son plateau ; le passage à votre tour attend désormais la fin des showcases adverses.',
      'Showcase de défausse affiché en niveaux de gris pour mieux l’identifier.',
      'En-tête épuré : titre centré en majuscules avec effet brillance, boutons « Mode test » et « Quitter le test », sélecteur de vilains réservé au mode test.',
      'Correctif : le bot Slenderman ne joue plus Téléportation ni Brouillage en l’absence de Héros dans son royaume.',
    ],
  },
  {
    version: '0.57',
    date: '2026-06-12',
    title: 'Nouveau vilain : Hadès',
    changes: [
      'Hadès (Disney, 3★) jouable : objectif « avoir 3 Titans non entravés sur le Mont Olympe au début de votre tour ».',
      'Mécanique des Titans : joués sur Les Enfers, amenés vers l’Olympe gratuitement via « Déplacer un Objet ou un Allié » (1 lieu), ou en payant via « Préparez-vous au combat ! » (2 JT/1 lieu, 5 JT/2 lieux). Argès rend du Pouvoir, Pyros et Alignement des planètes désentravent, Stratos déplace un Héros.',
      'Entrave par la Fatalité : Zeus (à l’arrivée), Héra, Éclairs ; Hercule verrouille les Titans sur son lieu ; Pégase et De zéro en héros les repoussent.',
      'Cerbère frappe à distance, l’Hydre revient en main, Nessus rapporte du Pouvoir, Panique réduit les coûts, Potion de mortalité préserve les Titans, Talon d’Achille et le Médaillon ajustent la force.',
      'Le Char déplace ta figurine (et lui-même) vers n’importe quel lieu une fois par tour. Stratos/Mégara/Hermès (déplacer un Héros), Héra/Pégase (entraver/repousser un Titan) et le Vanquish bonus de Lythos sont des choix interactifs.',
      'Pion détouré, plateau, 30 cartes Méchant + 15 Fatalité, fiche et conseils.',
    ],
  },
  {
    version: '0.56',
    date: '2026-06-12',
    title: 'Correctif : Objets Fatalité associés à un Héros',
    changes: [
      'Provocation (Crochet) s’associe désormais réellement au Héros choisi lors d’une Fatalité — Crochet doit alors éliminer les Héros provocateurs en premier (la règle d’ordre était déjà en place, mais la carte n’était jamais posée).',
      'Même correctif générique pour tous les Objets Fatalité « associés à un Héros » qui étaient silencieusement défaussés : Poussière de Fée, Vœu, Bigette Bulbeuse, Zirgouflex.',
    ],
  },
  {
    version: '0.55',
    date: '2026-06-12',
    title: 'Ursula : effets de cartes (presque tout)',
    changes: [
      'Divination (chercher un Pacte), Opportunisme (reprendre un Objet/Événement en défausse), Polochon (remélanger la défausse Vilain).',
      'Conditions Arrogance (piocher 3 / défausser 3) et Illusion (jouer la Fatalité adverse).',
      'Héros Fatalité : Max (déplace la figurine d’Ursula), Sébastien (vole un Pacte), Eurêka (récupère un Objet), Ariel (gèle un Objet : Ursula ne peut plus le déplacer).',
      'Âmes en Perdition déclenche les Pactes des lieux voisins.',
      'Colère Titanesque : effectuez une action d’un lieu voisin (vous choisissez le lieu, puis agissez dessus). Ursula est désormais complète.',
    ],
  },
  {
    version: '0.54',
    date: '2026-06-12',
    title: 'Ursula : Pactes, Trident, Chaudron',
    changes: [
      'Pacte : un Héros portant un Pacte est éliminé dès qu’il est déplacé sur le lieu du Pacte (il emporte ses Objets associés en se déplaçant).',
      'Trident : sa pose invoque le Roi Triton (zone haute) et lui associe le Trident ; vaincre Triton libère le Trident (zone basse) pour l’amener au Repaire.',
      'Tourbillon / Flotsam / Jetsam : déplacent un Héros (Tourbillon sur n’importe quel lieu) — de quoi déclencher les Pactes.',
      'Chaudron : +2 Pouvoir par Pacte dans le royaume.',
    ],
  },
  {
    version: '0.53',
    date: '2026-06-12',
    title: 'Nouveau vilain : Ursula',
    changes: [
      'Ursula (Disney, 5★) jouable : objectif « avoir le Trident et la Couronne au Repaire d’Ursula ».',
      'Palais bloqué au départ ; le Cadenas se déplace entre le Palais et le Repaire (Métamorphose, Grimsby).',
      'Couronne (regarde 2 cartes Fatalité) et bonus de force des Objets associés câblés.',
      'Pactes, Trident (via le Roi Triton), Chaudron, Divination, etc. restent « base jouable » (effet complet à venir).',
    ],
  },
  {
    version: '0.52',
    date: '2026-06-11',
    title: 'Fatalité : Migraine Atroce + cartes non jouables grisées',
    changes: [
      'Migraine Atroce : défaussez un Objet du royaume adverse (au choix).',
      'Lors d’une Fatalité, une carte sans cible valide (ex. Migraine Atroce sans Objet) est grisée quand l’autre est jouable.',
      'Il était un Rêve n’est jouable que s’il existe une Malédiction sur un lieu portant un Héros.',
    ],
  },
  {
    version: '0.51',
    date: '2026-06-11',
    title: 'Reine de Cœur : Chute dans le terrier',
    changes: [
      'Chute dans le terrier : cherche Alice (pioche + défausse Fatalité) et la pose sur le lieu de votre choix.',
      'Si Alice est déjà dans le royaume, retirez plutôt un Allié présent sur son lieu.',
    ],
  },
  {
    version: '0.50',
    date: '2026-06-11',
    title: 'Carte du Pays Imaginaire, Trahison, Digne Adversaire',
    changes: [
      'Carte du Pays Imaginaire : cliquez dessus (à tout moment de votre tour) pour la défausser et jouer gratuitement un Objet de votre main.',
      'Trahison fait bien perdre 2 jetons Pouvoir à Jafar.',
      'Digne Adversaire / Obsession : le Héros révélé doit être joué (vous choisissez seulement le lieu) ; les autres cartes dévoilées sont défaussées.',
    ],
  },
  {
    version: '0.49',
    date: '2026-06-11',
    title: 'Jafar : Abu/Aladdin, K.O., Hypnose = Vaincre',
    changes: [
      'Abu / Aladdin : vous choisissez l’Objet à voler (du lieu, et de la main pour Aladdin) ; il est associé au Héros, inutilisable par Jafar.',
      'K.O. : vous choisissez l’Allié de force ≤ 3 à retirer du royaume.',
      'Hypnose est désormais traitée comme « éliminer un Héros » : elle déclenche les Conditions adverses (Obsession, Méchanceté, Crise d’hystérie) selon la force du Héros hypnotisé.',
      'Digne Adversaire / Obsession : le Héros dévoilé peut être joué (vous choisissez le lieu) ou défaussé ; les autres cartes dévoilées sont montrées avant d’être défaussées.',
      'Zoom au survol des cartes dans la fenêtre de défausse.',
    ],
  },
  {
    version: '0.48',
    date: '2026-06-11',
    title: 'Crochet : Pas de Quartier ! interactif + Flibustiers',
    changes: [
      'Pas de Quartier ! : vous choisissez désormais quel Allié déplacer, puis sa destination (lieu voisin non bloqué), avant de gagner +2 force.',
      'Flibustiers : ils peuvent bien être sélectionnés pour éliminer un Héros d’un lieu voisin (côte à côte) — la sélection à l’écran le proposait pas.',
    ],
  },
  {
    version: '0.47',
    date: '2026-06-11',
    title: 'Crochet : Faites-leur peur ! interactif',
    changes: [
      'Faites-leur peur ! ouvre une fenêtre montrant les 2 premières cartes Fatalité : défaussez-les ou remettez-les sur le dessus dans l’ordre de votre choix.',
      'Correction : dos de cartes du Capitaine Crochet (Vilain ↔ Fatalité) remis dans le bon sens.',
    ],
  },
  {
    version: '0.46',
    date: '2026-06-11',
    title: 'Crochet : actions accordées cliquables sur la carte',
    changes: [
      'La Boîte à Crochets (et le Canon, l’Ingénieux Mécanisme) : l’action accordée se déclenche en cliquant directement sur la carte posée (badge « ▶ action » + contour jaune), au lieu d’une pastille au centre du lieu.',
    ],
  },
  {
    version: '0.45',
    date: '2026-06-11',
    title: 'Capitaine Crochet : effets complets',
    changes: [
      'Objets qui donnent une action au lieu : Canon (Éliminer), Boîte à Crochets (Gagner 1), Ingénieux Mécanisme (Déplacer un Héros).',
      'Peter Pan se place d’office sur l’Arbre du Pendu dès qu’il est dévoilé (même verrouillé).',
      'Digne Adversaire & Obsession : piochent un Héros dans votre propre deck Fatalité et le jouent.',
      'Monsieur Starkey (déplacer un Héros), Clochette (défausser un Allié), Tic Tac (défausse de la main), Pas de Quartier ! (+2 force), Faites-leur peur !, Ruse.',
    ],
  },
  {
    version: '0.44',
    date: '2026-06-11',
    title: 'Nouveau vilain : Capitaine Crochet',
    changes: [
      'Capitaine Crochet (Disney, 3★) jouable : objectif « éliminer Peter Pan sur le Jolly Roger ».',
      'Arbre du Pendu verrouillé au départ, débloqué par la Carte du Pays Imaginaire.',
      'Enfants Perdus (2 Alliés requis), Flibustiers (Vaincre à distance), Provocation (ordre d’élimination), bonus de force (Mouche, Wendy, Jean, Michel, Sabre, Poussière de Fée).',
      'Certains effets restent « base jouable » (Canon/Boîte/Ingénieux donnant une action, Digne Adversaire/Obsession, Faites-leur peur, etc.).',
    ],
  },
  {
    version: '0.43',
    date: '2026-06-11',
    title: 'Correctif : fenêtre du Coup Royal',
    changes: [
      'La fenêtre de résultat du Coup Royal peut de nouveau se fermer après une victoire (elle restait bloquée car la partie était déjà terminée).',
    ],
  },
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
