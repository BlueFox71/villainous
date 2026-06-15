import type { VillainKey } from './store/gameStore'

/**
 * Contenu « encyclopédie » d'un vilain (hors moteur) : difficulté, histoire et
 * conseils. L'objectif, lui, vient de la définition du vilain
 * (`def.objectiveDescription`).
 */
export interface VillainGuide {
  /** Difficulté de prise en main, sur 5 (note officielle du jeu). */
  difficulty: number
  /** Petit récit / contexte du personnage. */
  story: string
  /** Conseils pour bien le jouer. */
  playTips: string[]
  /** Conseils pour le contrer (via la Fatalité). */
  counterTips: string[]
}

export const VILLAIN_GUIDE: Record<VillainKey, VillainGuide> = {
  princeJohn: {
    difficulty: 2,
    story:
      "Frère cadet, lâche et cupide du roi Richard, Prince Jean usurpe le trône d'Angleterre pendant que son aîné guerroie en croisade. Ce lion pleurnichard suce son pouce en réclamant sa mère, tout en pressurant d'impôts les habitants de Nottingham avec l'aide du Shérif et de Triste Sire. (Disney, Robin des Bois, 1973.)",
    playTips: [
      "Ton seul objectif, c'est le pouvoir : enchaîne les actions « Gagner » et accumule jusqu'à 20.",
      "La rangée du haut de La Prison est vide : aucun héros ne peut la recouvrir, c'est ton coffre-fort à pouvoir.",
      "Pose tes Alliés (Gardes rhinocéros, Shérif, Niquedouille) pour Éliminer vite les héros qui bloquent tes lieux.",
      "Garde des cartes en main : après une attaque, tu dois pouvoir reprendre tes actions clés sans attendre.",
    ],
    counterTips: [
      "Envoie-lui la Fatalité : Robin des Bois et Petit Jean recouvrent ses lieux de gain et lui volent du pouvoir.",
      "Cible en priorité ses grosses actions (+2 / +3) pour casser sa montée vers les 20 points.",
      "Belle Marianne et le Roi Richard sont costauds : oblige-le à dépenser pouvoir et actions pour les Éliminer.",
    ],
  },
  maleficent: {
    difficulty: 1,
    story:
      "« Maîtresse de tous les Maux », sombre fée de La Belle au bois dormant (1959). Vexée de ne pas être conviée au baptême d'Aurore, elle maudit l'enfant : avant le crépuscule de ses seize ans, la princesse se piquera le doigt sur le fuseau d'un rouet et en mourra. Capable de se muer en dragon, elle règne sur la Montagne Interdite avec son corbeau Diablo.",
    playTips: [
      "Étale tes Malédictions : il t'en faut une sur CHACUN des 4 lieux au début de ton tour.",
      "Diablo te donne du tempo (déplacements, actions gratuites) : sers-t'en pour reposer une Malédiction retirée.",
      "Anticipe : les héros défaussent tes Malédictions. Garde-en en main pour rétablir aussitôt un lieu « nettoyé ».",
      "Transforme-toi en dragon ou sors tes gros Alliés pour Éliminer les héros avant qu'ils ne dégarnissent tes lieux.",
    ],
    counterTips: [
      "Les bonnes fées (Flora, Pâquerette, Pimprenelle) et l'Épée de Vérité défaussent ses Malédictions : vide-lui un lieu.",
      "Vise toujours à laisser au moins un lieu sans Malédiction : son objectif est alors hors d'atteinte.",
      "Le Prince Philippe et le Roi Stéphane sont de lourds héros : pose-les pour la forcer à gérer la menace au lieu de maudire.",
    ],
  },
  slenderman: {
    difficulty: 1,
    story:
      "Né des forums et des « creepypastas » d'Internet (2009), le Slender Man est une longue silhouette sans visage, en costume sombre, qui hante les forêts et traque les enfants. On le croise au détour d'arbres morts ; ceux qui collectent ses huit pages éparpillées sentent sa présence se rapprocher, inexorable, jusqu'à disparaître à leur tour.",
    playTips: [
      "Ton objectif, ce sont les Pages : il t'en faut 8 posées dans ton royaume (au plus 2 par lieu) au début de ton tour.",
      "Étale-toi : comme tu ne peux mettre que 2 Pages par lieu, occupe les 4 lieux et protège-les.",
      "Tes Événements te donnent du tempo (téléportation, manipulation de pioche) : sers-t'en pour enchaîner les poses de Pages.",
      "Observation t'évite le déplacement obligatoire : reste sur un lieu fort pour y empiler tes actions.",
    ],
    counterTips: [
      "Ses héros (Enfant Perdu, Enquêteur) récupèrent les Pages : pose-les là où il en a accumulé pour le faire reculer.",
      "La Lampe de poche neutralise sa téléportation vers un héros : colle-la sur un héros bien placé.",
      "Garde-le sous pression : chaque Page retirée le renvoie loin de ses 8.",
    ],
  },
  jafar: {
    difficulty: 4,
    story:
      "Grand vizir d'Agrabah et sorcier ambitieux d'Aladdin (1992), Jafar complote pour détrôner le Sultan. Avec son perroquet Iago et son sceptre serpent hypnotique, il convoite la Lampe Merveilleuse cachée dans la Caverne aux Merveilles pour asservir le Génie et ses trois vœux.",
    playTips: [
      "Cherche tes 3 cartes clés : le Scarabée d'Or, la Lampe Merveilleuse et une Hypnose. Défausse le reste et accumule du Pouvoir à l'Oasis.",
      "Joue le Scarabée pour déverrouiller la Caverne, puis la Lampe (elle fait apparaître le Génie) et amène-la jusqu'au Palais du Sultan.",
      "Hypnotise le Génie dès que tu as assez de Pouvoir : objectif atteint quand il est hypnotisé et la Lampe au Palais.",
      "Sers-toi de tes Fatalités et de Tromperie pour ralentir l'adversaire pendant que tu montes ton combo.",
    ],
    counterTips: [
      "Agis tôt : une fois son combo en place, Jafar est presque imbattable. Le Vœu et le Tapis ne protègent le Génie que TANT qu'il n'est pas encore hypnotisé.",
      "Princesse Jasmine le gêne surtout pendant qu'il cherche ses Objets (il pioche 1 carte de moins par tour).",
      "Seuls Abu et Aladdin (qui volent la Lampe) le ralentissent vraiment une fois l'objectif atteint — mais un bon Jafar les hypnotise. Ne le laisse jamais fataliser tranquillement.",
    ],
  },
  reineCoeur: {
    difficulty: 3,
    story:
      "Tyran capricieux du Pays des Merveilles (Alice, 1951), la Reine de Cœur tranche les têtes au moindre caprice et joue au croquet avec ses cartes-soldats. Sous ses ordres, le Lapin Blanc, le Roi et les Gardes (Cœur, Pique, Trèfle, Carreau) s'activent pour préparer sa grande partie.",
    playTips: [
      "Pose tes Cartes Gardes, puis transforme-les en arceaux (action Activer) — il t'en faut un sur chacun des 4 lieux.",
      "Quand un arceau est présent partout, joue Coup Royal pour tenter de gagner la partie.",
      "Rapetisse et élimine les Héros gênants (Qu'on leur coupe la tête !) avant qu'ils ne défassent tes arceaux.",
    ],
    counterTips: [
      "Le Chafouin retransforme ses arceaux en Gardes : retarde sa partie de croquet.",
      "Alice bloque ses déplacements d'Objets/Alliés ; le Lapin Blanc et Dodo gênent la transformation en arceaux.",
      "Garde des Héros sur ses lieux pour l'empêcher d'aligner un arceau partout.",
    ],
  },
  crochet: {
    difficulty: 3,
    story:
      "Pirate rancunier du Pays Imaginaire (Peter Pan, 1953), le Capitaine Crochet n'a qu'une obsession : se venger de Peter Pan, qui a jeté sa main au crocodile Tic Tac. Depuis le Jolly Roger, avec Monsieur Mouche et son équipage, il traque l'enfant volant dans tout Neverland.",
    playTips: [
      "Ton but : amener Peter Pan jusqu'au Jolly Roger et l'y éliminer (l'éliminer ailleurs ne compte pas).",
      "Fais venir les Héros dans ton royaume (Digne Adversaire) puis déplace-les vers le Jolly Roger pour les vaincre.",
      "Débloque l'Arbre du Pendu avec la Carte du Pays Imaginaire pour ouvrir l'action « Déplacer un Héros ».",
      "Évite de déplacer ton pion sur le lieu de Tic Tac : tu défausserais toute ta main.",
    ],
    counterTips: [
      "Garde Peter Pan loin du Jolly Roger ; la Poussière de Fée et Wendy le rendent très difficile à vaincre.",
      "Provocation force Crochet à éliminer certains Héros d'abord : verrouille ses priorités.",
      "Migraine Atroce lui retire ses Objets (Canon, Sabre) et casse son installation.",
    ],
  },
  ursula: {
    difficulty: 5,
    story:
      "Sorcière des mers de La Petite Sirène (1989), Ursula attire les âmes désespérées et leur fait signer des pactes qu'elle est sûre de gagner. Avec ses anguilles Flotsam et Jetsam, elle convoite le trident et la couronne du Roi Triton pour régner sur l'océan.",
    playTips: [
      "Objectif : amène le Trident ET la Couronne à ton Repaire, au début d'un tour.",
      "Récupère le Trident en vainquant le Roi Triton — un Pacte associé à lui le fait éliminer quand il est déplacé sur le bon lieu.",
      "La Métamorphose déplace le Cadenas entre le Palais et le Repaire : débloque le Palais quand tu en as besoin.",
      "Le Chaudron et les actions « Gagner » financent tes Pactes et tes Objets coûteux.",
    ],
    counterTips: [
      "Ariel bloque le déplacement d'un Objet ; garde le Trident ou la Couronne loin du Repaire.",
      "Grimsby déplace le Cadenas et peut reverrouiller le Repaire au mauvais moment pour elle.",
      "Bigette Bulbeuse renchérit ses Pactes ; Zirgouflex la saigne en Pouvoir quand elle se déplace.",
    ],
  },
  hades: {
    difficulty: 3,
    story:
      "Seigneur des Enfers d'Hercule (1997), Hadès rêve de renverser Zeus et de régner sur l'Olympe. Avec ses sbires Peine et Panique, il libère les Titans emprisonnés et les lance à l'assaut du Mont Olympe — tout en s'agaçant que ce « machin », fils de Zeus, se dresse sur sa route.",
    playTips: [
      "Objectif : avoir 3 Titans non entravés sur le Mont Olympe au début de ton tour.",
      "Joue tes Titans sur Les Enfers, puis amène-les vers l'Olympe : « Déplacer un Objet ou un Allié » est GRATUIT (1 lieu voisin), et « Préparez-vous au combat ! » paie 2 ou 5 JT pour 1 ou 2 lieux afin d'accélérer.",
      "Panique réduit le coût de tes Titans ; Argès te rend du Pouvoir à chaque déplacement ; Pyros et Alignement des planètes désentravent.",
      "Garde de quoi répliquer aux Héros : Talon d'Achille et Cerbère (qui frappe à distance) nettoient la route.",
    ],
    counterTips: [
      "Entrave ses Titans : Éclairs (tout un lieu), Héra et surtout Zeus, qui fige tout Titan arrivant sur son lieu.",
      "Hercule empêche les Titans de quitter son lieu : pose-le sur leur chemin (Thèbes, Jardins).",
      "Pégase et De zéro en héros repoussent un Titan vers Les Enfers : fais-lui perdre ses déplacements payés.",
    ],
  },
  facilier: {
    difficulty: 2,
    story:
      "Bonimenteur du Vieux Carré de La Nouvelle-Orléans (La Princesse et la Grenouille, 2009), le Dr Facilier marchande avec ses « amis de l'au-delà ». Derrière son sourire et sa magie vaudou se cache une dette à payer : il rêve de régner sur la ville grâce au Talisman et à son Ombre maléfique.",
    playTips: [
      "Objectif : joue le Talisman et « Régner sur la Nouvelle-Orléans », détiens le Talisman, puis joue Divination au Royaume du vaudou pour révéler Régner depuis ta Pile de l'Au-delà.",
      "Tour de passe-passe creuse ta pioche vers tes cartes clés : joue-le dès que possible.",
      "La Canne te laisse jouer une action d'un lieu voisin : place-la au Royaume du vaudou pour enchaîner Talisman + Divination le même tour.",
      "Tes adversaires remplissent ta Pile de l'Au-delà : vide-la avec Poudre d'illusion et Désespoir, et n'hésite pas à relancer Divination (tu en as 3).",
    ],
    counterTips: [
      "Remplis sa Pile de l'Au-delà (Si près du but, Charlotte, L'étoile du soir) pour noyer Régner et compliquer ses Divinations.",
      "Le Talisman s'associe aux Héros faibles (force ≤ 3) : garde-en sur ses lieux pour lui voler le Talisman.",
      "Tiana renchérit toutes ses cartes ; Mama Odie réduit ses Divinations à 2 cartes révélées.",
    ],
  },
  imposteur: {
    difficulty: 3,
    story:
      "Le saboteur masqué d'Among Us (InnerSloth, 2018). Sous sa combinaison de Coéquipier se cache un Imposteur : il sabote le vaisseau, élimine l'équipage un à un dans les couloirs d'Electrical, du Réacteur, d'Admin et de la Cafétaria, puis fait porter le chapeau aux innocents lors des réunions d'urgence.",
    playTips: [
      "Objectif : pose un Sabotage (O2 à Admin, Réacteur au Réacteur) et tiens-le 3 tours.",
      "Surveille tes 8 Coéquipiers : un Coéquipier « suspect » recouvre l'action sous lui — élimine (Tuer) ou rassure (Assurance) ceux qui te gênent.",
      "Les Tâches se défaussent quand trop de Coéquipiers s'y rassemblent : le Coéquipier imposteur en exige un de plus et t'ouvre l'action « Jouer une carte ».",
      "Joue avec leurs déplacements de fin de tour (Porte / Lumière désactivées, Conduit) pour protéger ton Sabotage le temps qu'il faut.",
    ],
    counterTips: [
      "Sa Fatalité ne contient pas de Héros : ce sont des Coéquipiers et des indices (Carte, Vidéo de surveillance) qui le rendent suspect et recouvrent ses actions.",
      "Corps découvert et Tâche visuelle braquent les soupçons sur lui et font monter le compte à rebours : casse sa fenêtre de 3 tours.",
      "Majorité défausse ses Objets et Alliés (hors sabotages) ; Réunion d'urgence regroupe les Coéquipiers pour saturer son lieu de Sabotage.",
    ],
  },
  bowser: {
    difficulty: 4,
    story:
      "Le Roi des Koopas (Super Mario Galaxy) a arraché l'Observatoire de la Comète à Harmonie et capturé la Princesse Peach au sommet de sa forteresse spatiale. En drainant les Étoiles qui alimentent le cosmos, il compte plonger la galaxie dans les ténèbres — pour peu que les frères Mario ne viennent pas tout gâcher.",
    playTips: [
      "Ton objectif : vider l'Observatoire de ses 4 Étoiles ET capturer Peach (uniquement via Impuissance) — le tout en début de ton tour.",
      "Draine les Étoiles avec « épuisement d'énergie » : chaque Étoile retirée se pose sur un Allié et te rapproche du but (mais elle saute si l'Allié élimine un Héros).",
      "À 0 Étoile, l'Observatoire se bloque : protège ce verrou en éliminant Mario, qui en remet une et t'interdit la victoire tant qu'il est là.",
      "Bowser Jr. va chercher Peach et la met en jeu ; garde une Impuissance sous la main pour la capturer dans la foulée.",
    ],
    counterTips: [
      "Mario est ta meilleure arme : tant qu'il est sur le plateau, Bowser ne peut pas gagner, et il remet une Étoile à l'Observatoire.",
      "Harmonie force l'Observatoire à garder une Étoile : un cadenas vivant contre l'épuisement.",
      "Luigi défausse les Alliés d'un lieu et renvoie leurs Étoiles à l'Observatoire — idéal pour annuler un gros drainage.",
    ],
  },
  mechanteReine: {
    difficulty: 3,
    story:
      "Reine orgueilleuse et jalouse (Blanche-Neige et les Sept Nains, 1937), elle interroge sans cesse son Miroir magique. Quand celui-ci désigne Blanche-Neige comme « la plus belle », la Reine se métamorphose en vieille sorcière et concocte une pomme empoisonnée pour en finir avec sa rivale.",
    playTips: [
      'Ton objectif : faire venir Blanche-Neige à la Maison des Nains (via le Miroir magique), puis l’éliminer avec « Croque ! ».',
      'Joue les 4 Ingrédients différents (Caquet, Hurlement, Noir de nuit, Poussière de momie) : ils vont dans ta zone Ingrédients et, à 4, déverrouillent la Maison des Nains.',
      'Accumule des jetons Poison : l’action « Préparer du poison » convertit autant de jetons Pouvoir que tu veux en jetons Poison (1 pour 1) ; le Trône et Jalousie en donnent aussi. « Croque ! » en défausse autant que la force du Héros visé pour l’éliminer.',
      'Le Chasseur affaiblit les Héros présents sur son lieu (−1) ; le Miroir magique te fait piocher quand tu es ciblée par la Fatalité.',
    ],
    counterTips: [
      'Les 7 Nains gonflent : Simplet booste tous les autres Héros (+1) et Prof doit être éliminé en premier.',
      'Joyeux fait défausser à la Reine autant de Poison que de Héros présents — sabote sa réserve.',
      'Premier baiser d’amour défausse un Poison et remet un Héros sur le dessus de la Fatalité : casse son tempo juste avant le « Croque ! » final.',
    ],
  },
  scar: {
    difficulty: 4,
    story:
      "Lion ambitieux et manipulateur (Le Roi Lion, 1994), Scar convoite le trône de son frère Mufasa. Allié aux hyènes du Cimetière d’éléphants, il complote pour éliminer le roi et son héritier Simba, et régner sur la Terre des Lions.",
    playTips: [
      'Ton objectif : trouver et éliminer Mufasa (il rejoint alors la pile Succession), puis éliminer d’autres Héros pour atteindre une Force combinée d’au moins 15 dans cette pile. Tu ne peux gagner qu’au début de ton tour.',
      'Une fois Mufasa dans la pile Succession, TOUS les Héros que tu élimines y sont placés et leur Force s’additionne — chasse les gros Héros (Simba 5, Mufasa 6).',
      'Appuie-toi sur tes Hyènes (Hyène affamée, Banzaï, Ed, Shenzi) : elles se renforcent en groupe et se jouent à prix réduit ou gratuitement ; Festin et Suivez-moi ! les redéploient.',
      'Rafiki doit être éliminé avant les autres Héros — règle vite ce verrou.',
    ],
    counterTips: [
      'Tant que Mufasa n’est pas dans sa pile Succession, Scar ne progresse pas — protège Mufasa (Bâton de Rafiki, Vision) et garde des Héros forts en jeu.',
      'Simba plafonne la force des Hyènes à 2 ; Zazu affaiblit les Héros sur son lieu mais renforce ceux d’ailleurs.',
      'Timon et Pumbaa se renforcent mutuellement (+2 chacun s’ils sont dans le royaume) : un duo difficile à croquer pour Scar.',
    ],
  },
}
