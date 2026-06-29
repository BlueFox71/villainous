import { isCustomKey, customVillainOf, type VillainKey } from './store/gameStore'

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
      "Le saboteur masqué (Among Us, 2018). Sous sa combinaison de Coéquipier se cache un Imposteur : il sabote le vaisseau, élimine l'équipage un à un dans les couloirs d'Electrical, du Réacteur, d'Admin et de la Cafétaria, puis fait porter le chapeau aux innocents lors des réunions d'urgence.",
    playTips: [
      "Objectif : pose un Sabotage (O2 à Admin, Réacteur au Réacteur) et tiens-le 3 tours. Mais il saute dès 2 Coéquipiers sur son lieu : commence par en ÉLIMINER le plus possible (Tuer, Fausse accusation) — qu'ils te suspectent n'est pas grave.",
      "Tâche Électricité est GRATUITE et rapporte du Pouvoir : empiles-en. Les autres Tâches ne tiennent qu'une fois des Coéquipiers morts — avant ça, ne les pose que pour les activer dans la foulée.",
      "Ne gaspille pas tes Sabotages tôt (ils sautent aussitôt) ; au besoin récupère-les avec Tâche Téléchargement. Une fois la voie dégagée, protège ton Sabotage avec Lumière / Porte désactivées.",
      "Coéquipier imposteur est ta meilleure carte : pose-le vite — il protège tes Tâches (1 Coéquipier de plus pour les défausser) et t'ouvre « Jouer une carte ».",
    ],
    counterTips: [
      "Pas de Héros chez lui : ce sont les Coéquipiers qui le gênent. Suspecte-les (Corps découvert, Tâche visuelle, Carte, Caméra) pour recouvrir ses actions.",
      "Arrivée tardive est ta meilleure carte dès qu'un Coéquipier est éliminé : elle en remet un en jeu (plus il y a de Coéquipiers, plus il peine à sabotter).",
      "Corps découvert pendant un Sabotage repousse sa victoire d'un tour : garde-la pour ce moment. Majorité défausse ses Objets et Alliés (hors sabotages).",
    ],
  },
  bowser: {
    difficulty: 3,
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
  yzma: {
    difficulty: 2,
    story:
      "Conseillère machiavélique de l’empereur Kuzco (Kuzco, l’empereur mégalo, 2000), Yzma veut s’emparer du trône. Avec l’aide (maladroite) de son homme de main Kronk, elle multiplie les potions et les pièges pour se débarrasser de l’empereur.",
    playTips: [
      'Ton objectif : trouver Kuzco dans l’une de tes 4 pioches Fatalité et le jouer, puis l’éliminer avec Kronk (qui n’est pas défaussé à l’attaque).',
      'Tu as QUATRE pioches Fatalité (une par lieu). Manipule-les : À l’attaque !, Indiscrétion, Je l’écraserai avec un marteau, Bras droit te rapprochent de Kuzco et de Kronk.',
      'Kronk gagne 1 jeton Pouvoir à chaque déplacement ; à 3+ il devient un Héros. Le chemin qui balance / Bras droit récupèrent ces jetons.',
      'Couteau (+1) sur un Allié revient en main quand il est défaussé : un bonus de force réutilisable.',
    ],
    counterTips: [
      'Évite de jouer Kuzco dans son royaume : c’est exactement ce qu’il lui faut pour gagner !',
      'Tipo et Chaca empêchent Yzma d’éliminer d’autres Héros ; Bucky ne peut pas être éliminé par Kronk.',
      'Chicha et Mauvais levier la vident de ses jetons Pouvoir — exploite ses faiblesses économiques.',
    ],
  },
  sombra: {
    difficulty: 2,
    story:
      "Pirate informatique surdouée du collectif Los Muertos puis agent fantôme (Overwatch, 2016), Sombra traque l’information et tire les ficelles dans l’ombre. Maîtresse du piratage et de la furtivité, elle infiltre les systèmes de LumériCo et Volskaya pour faire chanter les puissants — un coup d’avance, toujours.",
    playTips: [
      "Ton objectif : pose une carte de Piratage sur CHACUN des 4 lieux (Lumérico compris) puis joue Protocole Sombra pour gagner.",
      "Lumérico est verrouillé au départ : joue Faille pour le déverrouiller (et enchaîne un Piratage gratuit).",
      "Quand tu pirates un lieu, tu désactives une de ses actions : coupe les actions les plus gênantes (ou les Fatalités) de tes adversaires.",
      "Tes Piratages ne se déplacent pas : seuls l’Œil et Réinitialisation peuvent les retirer (Zarya, elle, ne détruit qu’un vrai Objet).",
    ],
    counterTips: [
      "Retire ses Piratages : l’Œil nettoie un lieu et Réinitialisation annule un piratage à distance.",
      "Guillermo Portero se pose sur Lumérico (même bloqué) et empêche Sombra d’y poser un Piratage : un verrou sur son lieu le plus difficile.",
      "Vol de données la saigne (−1 Pouvoir par Piratage/IEM) et Shutdown gèle un lieu un tour : ralentis sa course aux 4 piratages.",
    ],
  },
  ratigan: {
    difficulty: 2,
    story:
      "Génie criminel de Londres (Basil, détective privé, 1986), le Professeur Ratigan — un rat qui se rêve en gentilrat — kidnappe l’horloger Flaversham pour bâtir une Reine Robot et usurper la couronne. Élégant et théâtral, il bascule dans une rage bestiale dès qu’on le traite de « rat » — et son ennemi juré, le détective Basil, est sur sa piste.",
    playTips: [
      'Ton objectif : joue la Reine Robot (coûteuse : 15 Pouvoir), déplace-la sur Buckingham Palace et commence ton tour avec elle sur ce lieu.',
      'Réduis le coût de la Reine Robot avec tes Objets : Engrenages (−3 chacun, défaussés) et Outils (−1 par Objet joué) rendent les 15 Pouvoir atteignables.',
      'Si Basil défausse ta Reine Robot, ta tuile bascule côté « Le Rat » : ton objectif devient alors d’éliminer Basil — appuie-toi sur tes Alliés (Félicia, Brutes) et le Piège ingénieux.',
      'Méfie-toi de la Reine Moustoria : tant qu’elle est à Buckingham Palace, tu ne peux pas gagner, quel que soit ton objectif.',
    ],
    counterTips: [
      'Basil est ta meilleure arme : pose-le sur la Reine Robot pour la défausser et forcer Ratigan à changer d’objectif (et à repartir de loin).',
      'Place la Reine Moustoria à Buckingham Palace : un verrou vivant qui interdit toute victoire à Ratigan.',
      'Sabotage défausse ses Objets bon marché (coût ≤ 3) : ralentis son économie d’Engrenages et d’Outils.',
    ],
  },
  patHibulaire: {
    difficulty: 3,
    story:
      "Brute massive et matamore, Pat Hibulaire (Pete) est le plus vieil ennemi de Mickey (depuis 1925). Bandit de grand chemin, contrebandier et gros bras, il écume Frontier Town, la station-service, l’aéroport et le ponton du Steamboat Willie. Cupide et combinard, il poursuit quatre coups fumants à la fois.",
    playTips: [
      'Ton objectif change à chaque partie : 4 de tes 5 tuiles sont tirées au hasard, une par lieu. Repère-les vite et adapte ton plan.',
      'Boucle « Jackpot » (Une Petite Partie ?) au plus tôt : plus la partie dure, plus tes grosses cartes quittent la pioche et plus Oswald risque de sortir.',
      'Les Bandits sont ton moteur : on peut en jouer plusieurs en une seule action — idéal pour « Bande Puissante » (force ≥ 10) et « Main Basse » (plus d’Alliés que de Héros partout).',
      'Cheval, Steamboat Willie et le Perroquet repositionnent et récupèrent tes cartes : sers-t’en pour aligner Objets (« Signe de Richesse ») et Alliés au bon endroit.',
    ],
    counterTips: [
      'Mickey est l’arme absolue : tant qu’il est dans son royaume, Pat ne peut remplir AUCUNE tuile. Mais il peut continuer à se préparer — ne relâche pas la Fatalité pour autant.',
      'Goofy (Dingo) et Minnie sabotent ses tuiles et ses Alliés/Objets ; Donald l’oblige à le vaincre en premier. Couvre ses lieux de gain et de pose.',
      'Oswald affaiblit Une Petite Partie ? : pose-le si « Jackpot » ou « Soif de Pouvoir » traînent encore.',
    ],
  },
  gothel: {
    difficulty: 5,
    story:
      "Vaniteuse et manipulatrice, Mère Gothel (Disney, Raiponce, 2010) a séquestré la princesse Raiponce dans une tour isolée pour profiter du pouvoir rajeunissant de sa chevelure magique. Sous des airs de mère aimante, elle étouffe la jeune fille de fausse tendresse et de remarques humiliantes pour la garder sous son emprise.",
    playTips: [
      'Ton objectif est la Confiance : accumule-la (Raiponce ramenée à la Tour, Héros éliminés, Brosse à cheveux déplacée…) jusqu’à 10, puis l’emporte au début de ton tour.',
      'Raiponce est toujours chez toi : elle glisse d’un lieu vers la droite à chaque fin de tour. Organise tes lieux pour exploiter sa position.',
      'Manipule plutôt que d’affronter : tes Événements et Conditions retournent le tour adverse à ton avantage.',
    ],
    counterTips: [
      'Les Héros de Corona (Flynn, Maximus, la garde) la ralentissent : ils l’empêchent de gagner de la Confiance librement.',
      'Surveille sa Confiance : quand elle approche de 10, prive-la des sources faciles (Raiponce, éliminations).',
      'Les Lanternes et « Moi j’ai un rêve » perturbent son emprise sur Raiponce.',
    ],
  },
  cruella: {
    difficulty: 4,
    story:
      "Héritière fortunée obsédée par la fourrure, Cruella d’Enfer (Disney, Les 101 Dalmatiens, 1961) rêve d’un manteau taillé dans la robe tachetée de chiots dalmatiens. Mondaine cruelle et impatiente, elle lance ses sbires Jasper et Horace à la capture des chiots, fonçant dans la nuit au volant de son bolide.",
    playTips: [
      'Ton objectif : amène des Tuiles Chiots dans ton royaume (réserve → lieu indiqué) puis CAPTURE-les jusqu’à 99 Chiots, l’emporte au début de ton tour.',
      'Amène des Chiots avec Lampe électrique, Horace, Ici mes petits ! et Sans cœur ; capture avec Horace, Jasper et J’ai payé pour ça.',
      'Repéré ! révèle les grosses tuiles (22) de la réserve pour les viser ; Roadster et Sergent Tibs regroupent les tuiles là où tes captureurs agissent.',
    ],
    counterTips: [
      'Pongo bloque la capture sur son lieu et Anita & Roger renvoient les tuiles en réserve : pose-les là où elle amasse ses Chiots.',
      'Évasion et « Nous sommes des labradors » lui font perdre des Chiots déjà acquis ou posés.',
      'Nanny renchérit ses activations ; multiplie les Héros pour recouvrir ses actions Activer et Jouer.',
    ],
  },
  gaston: {
    difficulty: 1,
    story:
      "Chasseur vaniteux et adulé de tout le village (Disney, La Belle et la Bête, 1991), Gaston n’a qu’une idée en tête : épouser Belle, « la plus belle, donc la seule digne de lui ». Éconduit, il retourne la foule contre la Bête et marche sur le château, prêt à tout pour obtenir ce qu’il convoite.",
    playTips: [
      'Ton objectif : RETIRER tes 8 jetons Obstacle (2 par lieu). Retire-les avec Crise de colère, Laissez-moi vous regarder, Sortez !, Digne de moi, ou en activant Monsieur D’Arque.',
      'Vaincre la Bête vide les Obstacles du Château de la Bête ; vaincre Maurice vide ceux de la Maison de Belle : fais-les venir par Gardez-moi en otage / Miroir magique, puis élimine-les.',
      'Belle bloque TOUT retrait tant qu’elle est en jeu : élimine-la en priorité (Instinct de chasseur, Belle est à moi). Loups et Foule en colère fournissent la force.',
    ],
    counterTips: [
      'Belle est ton meilleur frein contre lui : tant qu’elle est dans son royaume, il ne peut retirer aucun Obstacle.',
      'Oui c’est toi !, Me masser gentiment les pieds, C’est gentil de m’avoir sauvé la vie et Quel beau garçon ! REPLACENT des Obstacles : annule sa progression au pire moment.',
      'Le Bidule de malheur affaiblit ses Alliés ; Big Ben renforce tes Héros : rends ses éliminations (et donc l’accès à la Bête / Maurice) plus coûteuses.',
    ],
  },
  seigneurCles: {
    difficulty: 2,
    story:
      "Le Seigneur des clés est le Gardien (« the Gatekeeper ») du jeu de société Atmosfear (à l’origine Nightmare, 1991) : un spectre encapuchonné aux yeux luminescents qui, depuis sa cassette vidéo, mène la partie et harcèle les joueurs. Comme dans Atmosfear, la victoire passe par la collecte d’une clé de chacune des six couleurs avant de regagner le centre du plateau — sous peine d’être englouti par les Ténèbres. Sa cour de damnés (Anne de Chantraine, Élisabeth Báthory, le Baron Samedi, Gévaudan…) veille à reprendre les clés à quiconque s’approche du but.",
    playTips: [
      'Ton objectif : au début de ton tour, posséder au moins 1 clé de CHAQUE couleur (bleu, rouge, vert, jaune, violet, orange). 12 clés sont réparties sur tes 4 lieux.',
      'Ramasse les clés avec l’action « Obtenir une clé » (Crypte), Toute Puissance, C’est moi qui décide, Pierre Tombale et 00:00. Déplace ton pion vers les lieux qui portent les couleurs qui te manquent.',
      'Le dé de couleur est aléatoire : Pierre Tombale et J’ai affronté mon cauchemar dépendent du jet, mais 00:00 / Minuit te laissent CHOISIR la couleur visée — garde-les pour la dernière couleur manquante.',
      'Garde un œil sur la Clé Noire : tant qu’elle est sur ton plateau, tu ne peux pas gagner, même avec les six couleurs.',
    ],
    counterTips: [
      'La Fatalité lui reprend des clés : Sorcellerie repose une clé, Duel rebrasse celles du plateau, J’ai affronté mon cauchemar et Plaisir ou souffrance lui en coûtent. Vise la couleur dont il n’a qu’un exemplaire.',
      'Gévaudan vole une clé tant qu’il vit ; Baron Samedi bloque une couleur au dé : combine-les pour l’asphyxier sur sa dernière couleur.',
      'La Clé Noire (Objet Fatalité) lui interdit la victoire tant qu’elle reste posée : pose-la quand il approche des six couleurs.',
    ],
  },
  madameTremaine: {
    difficulty: 4,
    story:
      "Belle-mère cruelle de Cendrillon (Disney, 1950), Madame de Trémaine n’a qu’une obsession : marier l’une de ses filles, Anastasia ou Drizella, au Prince — quitte à enfermer Cendrillon et à briser ses rêves. Avec son chat Lucifer et sa canne, elle manœuvre dans son manoir jusqu’à la Salle de Bal.",
    playTips: [
      'Ton objectif : MARIER une fille au Prince. Joue d’abord l’Invitation du Roi pour déverrouiller la Salle de Bal.',
      'Amène une fille EN ROBE DE BAL (Anastasia/Drizella en robe — qui remplacent leur version ordinaire déjà en jeu) ET le Prince dans la Salle de Bal, puis joue les Cloches de Mariage… mais SANS aucune Pantoufle de Verre dans ton royaume.',
      'Les Pantoufles de Verre ne se retirent qu’avec la Canne (récupérable via « Il y a encore une chance »). Piège les Héros gênants, ou vaincs-les avec Petite voleuse ! et Minuit.',
      'Le Prince ne recouvre aucune action et tu peux le déplacer comme un allié : amène-le jusqu’à la Salle de Bal.',
    ],
    counterTips: [
      'La Bonne Fée et les Pantoufles de Verre sont tes meilleures armes : tant qu’une Pantoufle est dans son royaume, le mariage est impossible.',
      'Cendrillon, Cendrillon en robe de bal et la Bonne Fée recouvrent ses lieux : ralentis sa mise en place de la Salle de Bal.',
      'Jaq lui fait défausser un Objet clé (Cloches de Mariage, Canne) ; « Chante, Rossignol, Chante » déloge un de ses Alliés vers n’importe quel lieu et Bibbidi-Bobbidi-Boo libère un Héros qu’elle avait piégé : perturbe sa mise en place.',
    ],
  },
  oogieBoogie: {
    difficulty: 3,
    story:
      "Croquemitaine de Halloween Town (L’Étrange Noël de Monsieur Jack, 1993), Oogie Boogie est un sac de toile grouillant d’insectes, accro au jeu et aux dés pipés. Il enlève « Perce-Oreilles » (Sandy Claws) et veut convaincre Jack Skellington de lui laisser Noël… avant de le faire tomber dans son antre.",
    playTips: [
      'Joue tes « Imposteur Perce-Oreilles » (lance les dés : 7+ = succès). À 4 réussis, Jack revient (force 8) à l’Antre.',
      'Truque les dés : Gram donne +1 sur son lieu, les Dés pipés relancent un dé, et « Cette fois l’affaire est dans le sac » choisit le résultat (souvent ton 4ᵉ imposteur).',
      'Empile tes Alliés à l’Antre, où Jack apparaît, puis vaincs-le (élimine d’abord les Citoyens, qui le protègent).',
      'Garde « Gagner 3 » libre : dégage les Héros qui recouvrent tes actions — mais laisse Le Maire d’Halloween tranquille.',
    ],
    counterTips: [
      'Joue Sally à la Ville d’Halloween : elle bloque ses déplacements (lieu voisin seulement).',
      'Empile les Citoyens d’Halloween à l’Antre : ils doivent être éliminés en premier et servent de bouclier à Jack.',
      'Sabote-le quand il monte ses imposteurs : « Salut, Oogie ! » (−2 au dé) ou Jack en Fatalité (défausse un imposteur).',
    ],
  },
  seigneurTenebres: {
    difficulty: 4,
    story:
      "Le Seigneur des Ténèbres (Disney, Taram et le Chaudron magique, 1985) est un roi-liche décharné qui convoite le Chaudron Magique : une marmite maudite capable de relever une armée de Soldats Ressuscités immortels. Avec son sbire couard Crapaud, il pourchasse le petit valet de ferme Taram et la truie oraculaire Tirelire pour s’emparer du Chaudron et plonger le monde dans les ténèbres.",
    playTips: [
      'Ton objectif : avoir un Soldat Ressuscité sur CHACUN de tes 4 lieux.',
      'Empare-toi du Chaudron Magique (Montre-moi le Chaudron Magique, Nous avons conclu un marché, ou en vainquant Tirelire), puis RÉVEILLE-le pour passer sur sa face Pouvoir : via la carte « Notre heure est venue ! » OU l’action « Activer une capacité » donnée par les Squelettes de Soldats.',
      'Les Squelettes de Soldats (Objets) donnent à leur lieu l’action « Activer une capacité » — c’est ainsi qu’on réveille le Chaudron. Une fois réveillé, joue tes Soldats Ressuscités sur tes lieux — ils sont immortels (non défaussés quand ils participent à une élimination).',
      'Tirelire (Hen Wen) est un atout : si elle débarque dans ton royaume, vaincs-la pour t’emparer du Chaudron Magique gratuitement.',
    ],
    counterTips: [
      'Taran (force 4), Fflewddur Fflam et le Petit Peuple recouvrent ses lieux ; le Petit Peuple empêche même d’y poser des Soldats Ressuscités.',
      'Les Sorcières de Morva l’empêchent de s’emparer du Chaudron Magique tant qu’elles sont là : un verrou tant qu’il ne l’a pas encore réclamé.',
      'Garde Tirelire hors de son royaume : la lui livrer revient à lui offrir le Chaudron Magique (il la vainc pour le réclamer).',
    ],
  },
  madameMim: {
    difficulty: 1,
    story:
      "Madame Mim (Disney, Merlin l’Enchanteur, 1963) est une sorcière mesquine et vaniteuse qui adore tricher. Lorsque Merlin la défie en duel de sorcellerie, les deux mages se transforment tour à tour en animaux de plus en plus redoutables. Mim ne supporte pas de perdre — et compte bien venir à bout de toutes les métamorphoses de ce vieux barbon.",
    playTips: [
      'Ton objectif : vaincre les 7 Métamorphoses de Merlin. Une trône en permanence au Lieu du Duel ; dès que tu en vainc une, une autre apparaît.',
      'Chaque Métamorphose Mim (tes « Alliés ») donne l’action « Éliminer un Héros » à son lieu et ne peut vaincre QU’UNE Métamorphose de Merlin précise : assure-toi d’avoir la bonne (ex. Mim Crocodile vainc Merlin Tortue).',
      'Tu peux aussi vaincre une Métamorphose de Merlin en jouant « J’établis les règles ». « Pas de Tricherie » te laisse regarder/réordonner le dessus de la pioche Merlin pour préparer ta prochaine Métamorphose.',
    ],
    counterTips: [
      '« Le Savoir conduit à la Puissance » déplace la Métamorphose de Merlin loin de la Métamorphose Mim prête à la vaincre.',
      '« Merlin » renvoie une Métamorphose déjà vaincue dans la pioche (elle devra la revaincre) ; « Archimède » remplace celle en jeu par une autre.',
      '« Merlin Microbe » défausse une de ses Métamorphoses Mim ; « Arthur Oiseau » lui fait défausser toute sa main.',
    ],
  },
  syndrome: {
    difficulty: 3,
    story:
      "Buddy Pine, alias Syndrome (Les Indestructibles, Pixar, 2004), est un génie de la technologie rejeté par son idole M. Indestructible. Devenu super-vilain sans super-pouvoirs, il met au point l’Omnidroïde, un robot tueur de Super qui apprend de chaque combat. Il compte bien prouver qu’avec assez de gadgets, n’importe qui peut être « super »… donc plus personne ne le sera.",
    playTips: [
      'Ton objectif : DÉTRUIRE l’Omnidroïde v.10 et n’avoir aucun Héros dans ton royaume. Fais évoluer ton Omnidroïde v.X8 → v.X9 → v.10 en l’utilisant pour Éliminer des Héros.',
      'Pour jouer l’Omnidroïde v.X9 (puis v.10), tu dois défausser des MODIFICATIONS MAJEURES de ton royaume : pose-les tôt et garde-en assez (1 pour le v.X9, 3 pour le v.10).',
      'Quand l’Omnidroïde v.X9 vainc un Héros, tu récupères la TÉLÉCOMMANDE. Pose-la sur Métroville (avec le v.10), amène ton pion là, puis Active-la pour détruire le robot et l’emporter.',
    ],
    counterTips: [
      'Les Indestructibles VOLENT la Télécommande s’ils arrivent alors qu’elle est dans le royaume : élimine-les ou récupère-la.',
      '« Alors ça, c’est un truc de dingue ! » balaie tous tes Alliés et Objets (Modifications Majeures comprises) — sauf le Champ de Force.',
      'Le Champ de Force protège un Héros d’une élimination ; Violette défausse tes Énergies au Point Zéro ; « Pas de Capes ! » te prive de déplacement.',
    ],
  },
  lotso: {
    difficulty: 4,
    story:
      "Lots-o’-Huggin’ Bear (Toy Story 3, Pixar, 2010) est un ours en peluche à la fraise au sourire mielleux qui règne en tyran sur la garderie de Sunnyside. Abandonné jadis par sa petite fille, il a juré que plus aucun jouet ne compterait. Il « accueille » les nouveaux venus… avant de les briser, de les réduire au silence et de les enfermer.",
    playTips: [
      'Ton objectif : réunir tes 4 Héros (Hamm, Jessie, Rex, Woody) sur la Salle des Chenilles, TOUS réduits à force 0, avec Buzz l’Éclair (Gardien ou Mode Démo) sur ce lieu.',
      'Réduis les Héros avec des jetons Force −1 (Enfermés, Le Bibliothécaire, Patrouille de nuit…) ou en les ÉLIMINANT : un Héros que tu élimines n’est pas défaussé — il reste sur place à force 0.',
      'Amène les Héros sur la Salle des Chenilles (Pas l’âge minimum requis, Quelque chose se brisa, Bienvenue à Sunnyside). Buzz en Mode Démo, utilisé pour éliminer un Héros (avec un autre Allié), le réduit à 0 ET le place sur la Salle des Chenilles.',
    ],
    counterTips: [
      'Buzz l’Éclair (Gardien) protège du Vaincre les Héros de son lieu ; Mode espagnol le renvoie en Gardien sur la Cour de Récréation, loin de la Salle des Chenilles.',
      'Andy nous cherche et Jouets de Bonnie RESTAURENT la force des Héros ; Un seul moyen de sortir et Woody les font QUITTER la Salle des Chenilles ; Le Grappin renvoie un Héros réduit à 0 dans la pioche.',
      'Bayonne exige 2 Alliés pour être éliminé ; Rex est protégé tant qu’il accompagne un autre Héros ; Médaillon de Daisy / Lotso était son préféré défaussent ses Alliés (Big Baby compris).',
    ],
  },
  saSucrerie: {
    difficulty: 5,
    story:
      "King Candy (Les Mondes de Ralph, 2012) règne en tyran sur le jeu d'arcade Sugar Rush. C'est en réalité Turbo, un pilote jaloux qui a piraté le jeu et effacé les souvenirs de tous. Il s'acharne à empêcher Vanellope von Schweetz, une « Bug » au grand cœur, de prendre le départ — quitte à provoquer l'invasion des Cybugs.",
    playTips: [
      "Ton objectif : franchir la case Départ/Arrivée du circuit AVANT le jeton Pilote de Vanellope, alors qu'un Bug lui est associé.",
      "Ton pion ne change pas de lieu : il avance de 1 à 4 cases sur le circuit en huit, et tu n'accèdes qu'à 3 actions par tour (celle où tu es + devant + derrière). Choisis bien ta distance pour viser les bonnes actions.",
      "Fais d'abord venir Vanellope dans ton royaume (par Fatalité, ou en jouant le Médaillon des Héros de Ralph puis en vainquant Ralph la Casse), puis joue un Bug sur elle : la course démarre, ton pion et le jeton Pilote repartent de Départ/Arrivée.",
      "Pendant la course, ralentis le jeton Pilote (Mémoire Verrouillée, Taffyta Crème Brûlée, Il lui est défendu de courir) et accélère-toi (L'important c'est de payer) pour boucler le tour le premier.",
    ],
    counterTips: [
      "Vanellope avance le jeton Pilote chaque tour tant qu'un Bug lui est associé — et Enfin un vrai Kart ! le propulse encore plus loin.",
      "Princesse Vanellope fait reculer King Candy de 4 cases ; Félix Fixe Jr. le contraint à n'avancer que de 2 ou 3 cases.",
      "Calhoun et Ralph la Casse renchérissent ses actions ; déplace Vanellope hors de portée d'un Bug pour casser sa mise en place.",
    ],
  },
  shereKhan: {
    difficulty: 1,
    story:
      "Shere Khan, le tigre du Bengale (Le Livre de la Jungle, 1967), règne par la terreur sur la jungle. Tous fuient à son approche. Il n'a qu'une obsession : retrouver et dévorer le « petit d'homme », Mowgli — mais il ne craint qu'une chose, le Feu Rouge des hommes.",
    playTips: [
      "Ton objectif : VAINCRE Mowgli alors qu'AUCUN jeton Feu n'est présent dans ton royaume.",
      "Fais venir Mowgli : par Fatalité, par tromperie (Aie confiance), ou avec « Lancé sur ses traces » qui le cherche — et sert aussi à l'éliminer. À son arrivée, Mowgli pose un jeton Feu : tu en auras donc toujours au moins un à nettoyer.",
      "Les jetons Feu recouvrent des ACTIONS de tes lieux (comme un Héros recouvre la rangée du haut) : ils t'empêchent de les utiliser. Retire-les avec « C'est moi, Shere Khan » ou en activant les Macaques (paie 1 Pouvoir par jeton du lieu).",
      "Kaa devient redoutable avec ses Objets (Anneaux/Yeux : +2 Force chacun) ; les Yeux te laissent même agir sous un Héros. Le Roi Singe repositionne tes Macaques pour éteindre le feu là où il faut.",
    ],
    counterTips: [
      "Le Feu Rouge des Hommes pose ou déplace des jetons Feu sur ses actions : couvre ses actions de Vaincre et d'Activer pour l'empêcher de nettoyer puis de gagner.",
      "Baloo protège TOUS les autres Héros : tant qu'il est là, impossible d'éliminer Mowgli (chaque tentative pose un jeton sur Baloo, défaussé à 3). La Patrouille de la Jungle (force 6) est un mur.",
      "Garde toujours au moins un jeton Feu sur son royaume : sans Feu et avec Mowgli vincible, il gagne aussitôt.",
    ],
  },
  davyJones: {
    difficulty: 3,
    story:
      "Davy Jones, capitaine maudit du Hollandais Volant (Pirates des Caraïbes), commande l'océan et son Kraken. Il convoite les cinq Trésors légendaires — dont son propre Cœur, arraché et caché dans le Coffre du Maudit.",
    playTips: [
      "Ton objectif : RÉCUPÉRER les 5 jetons Trésor. Pose-les FACE CACHÉE sur des Héros (As-tu peur de la mort ?, Ils sont là), RÉVÈLE-les (Bill le Bottier, Hadras, La Marque Noire), puis ÉLIMINE le Héros qui porte un trésor RÉVÉLÉ pour t'en emparer.",
      "Un Héros ne porte qu'un trésor à la fois. Tant qu'un trésor est révélé sur un Héros, il te GÊNE (le Compas lui donne +2 Force ; le Coffre interdit les Alliés sur son lieu ; la Clé te fait défausser ta main à la révélation) : enchaîne révélation puis Vanquish au plus vite.",
      "Tu n'as qu'UNE action Éliminer (Le Hollandais Volant) : pose Clanker ailleurs pour gagner une seconde action Éliminer. Le Kraken (force 8) n'est PAS défaussé après avoir vaincu un Héros à trésor révélé (contrairement à tes autres Alliés) : il reste en jeu et peut donc récupérer un trésor à chaque tour.",
      "Déplace les Héros vers tes Alliés (La Poursuite) et réarrange les trésors (Les amis deviennent des ennemis) pour aligner force et bons trésors.",
    ],
    counterTips: [
      "Maudit sois-tu, Jack Sparrow retire un trésor révélé d'un Héros et le remélange : tu effaces sa progression. L'amour de Calypso ramène son Pouvoir à 2.",
      "Jack Sparrow (force 3) bloque toute action Éliminer tant que Davy partage son lieu. La Boîte à Musique empêche le Kraken de vaincre le Héros qui la porte.",
      "James Norrington grossit (+1 Force par trésor récupéré) ; l'Équipage du Black Pearl grandit avec le nombre de Héros. Sature ses lieux de Héros costauds pour ralentir ses Vanquish.",
    ],
  },
  tamatoa: {
    difficulty: 2,
    story:
      "Crabe géant et cleptomane de Lalotai (Vaiana, 2016), Tamatoa collectionne tout ce qui BRILLE sur sa carapace dorée. Il rêve de remettre la main sur l'hameçon magique de Maui — et sur le Cœur de Te Fiti — pour parader, plus beau et brillant que jamais.",
    playTips: [
      "Ton objectif : réunir le CROCHET DE MAUI et le CŒUR DE TE FITI dans ton Antre.",
      "Trouve le Cœur au plus vite : il est dans ta pioche Fatalité et il te faut presque toujours « Crustacé doté du pouvoir de création » pour l'y chercher. Défausse souvent pour piocher tes Crustacés… et compte un peu sur la chance (3 exemplaires, coût 3, pas d'action Gagner 3).",
      "Moana et Maui s'emparent de tes Objets : vaincs-les pour les libérer. Élimine Moana d'ABORD, puis Maui (force 8, qui revient via « L'heure de Maui ») — idéalement gagne le tour même où tu bats Maui. « Tu ressembles à des fruits de mer » élimine un Héros en payant sa force.",
      "Si tu pioches le Crochet avant que l'adversaire joue « L'heure de Maui », pose-le aussitôt (il te donne 2 Pouvoir à chaque Fatalité). Le Monstre Arboricole peut, après un combat, amener un Objet dans ton Antre pour conclure le tour même.",
    ],
    counterTips: [
      "Joue « L'heure de Maui » tôt : sinon Tamatoa peut gagner très vite s'il a de la chance avec le Cœur et le Crochet. Maui (force 8) déclenche aussi sa pioche Maui chaque tour.",
      "Le fataliser AVANT qu'il trouve le Cœur est à double tranchant : si tu révèles le Cœur sans le garder, tu le rapproches de son objectif.",
      "« Quelque chose qui brille » est toujours un bon choix — surtout posé là où se trouve (ou ira) un Héros important : il le protège du Vanquish et recouvre une action.",
    ],
  },
  teamRocket: {
    difficulty: 3,
    story:
      "Jessie, James et leur Miaouss parlant : le trio de bras cassés de la Team Rocket, lancés à la poursuite des Pokémon de Sacha à bord de leur montgolfière. Maladroits mais increvables, ils multiplient pièges, déguisements et machines pour s'emparer des Pokémon les plus rares. (Pokémon, série animée.)",
    playTips: [
      "Ton objectif : CAPTURER au moins 4 Pokémon, dont Pikachu, dans ta pile de Captures.",
      "Les Pokémon arrivent par la Fatalité (chaque dresseur invoque le sien) : laisse-les venir, puis réunis assez de Force d'Alliés pour les ATTRAPER (action Pokéball) au lieu de simplement les vaincre.",
      "Fais évoluer tes Alliés (Abo→Arbok, Smogo→Smogogo, Miaouss→Persian) pour frapper plus fort et plus loin.",
      "Garde tes Conditions (Oui la guerre !, Pour vous jouer un mauvais tour, Oh des pokémons !) pour réagir au tour de l'adversaire.",
    ],
    counterTips: [
      "ATTENTION, inversion : lui envoyer des Pokémon par la Fatalité l'AIDE (ce sont ses cibles de capture), surtout Pikachu. Évite de le fataliser avec des Pokémon-clés.",
      "Défausse ses Objets et ses Alliés évolués pour qu'il manque de Force au moment d'attraper un gros Pokémon.",
      "Garde un œil sur sa pile de Captures : tant qu'il n'a pas Pikachu + 3 autres, il ne peut pas gagner.",
    ],
  },
  laBonneFee: {
    difficulty: 3,
    story:
      "La Marraine la bonne fée, marraine intrigante du royaume de Fort Fort Lointain. Sous ses airs charmants, elle manigance pour marier son fils, le Prince Charmant, à la princesse Fiona — quitte à transformer, ensorceler et faire disparaître quiconque se met en travers de son conte de fées. (Shrek 2.)",
    playTips: [
      "Ton objectif : amener FIONA dans la Salle de Bal avec ses 2 potions (« Filtre d'amour » + « Heureux pour toujours ») et le PRINCE CHARMANT, puis activer « Embrasse-la tout de suite ! ».",
      "Les héros de Shrek arrivent par la Fatalité sur TON royaume — Fiona y compris, qui est ta cible : récupère-la (ou pioche-la toi-même via « Une petite chanson », « Observation », « Incarnation de la beauté ») et associe-lui les deux potions.",
      "Tu n'as pas d'action Vaincre : pour éliminer un Héros gênant (surtout SHREK, qui bloque la victoire), transforme-le (« Héros en Meuble ! » / « Héros en Colombe ! » → force 0) puis défausse-le avec « Nettoyage de fond ».",
    ],
    counterTips: [
      "La fataliser est risqué : tu peux lui offrir FIONA, dont elle a justement besoin. Évite de révéler des Fatalités quand sa Salle de Bal est prête.",
      "Garde SHREK en jeu : tant qu'il est dans son royaume, elle ne peut pas gagner.",
      "Défausse ses potions et son Prince Charmant, ou bloque la Salle de Bal, pour casser sa combinaison de mariage.",
    ],
  },
}

/** Fiches RÉDIGÉES pour certains vilains publiés (collaborations fixes), indexées par
 *  leur id custom. Priorité sur la synthèse automatique de `villainGuideOf`. */
const CUSTOM_GUIDES: Record<string, VillainGuide> = {
  'custom-dio': {
    difficulty: 3,
    story:
      "Dio Brando (JoJo's Bizarre Adventure) est l'ambition faite homme. Recueilli enfant par le riche George Joestar, il trahit sa famille adoptive et coiffe le Masque de Pierre pour devenir un vampire immortel. Un siècle plus tard, ressuscité et doté du Stand « The World », capable d'ARRÊTER LE TEMPS d'un cri — « ZA WARUDO ! » —, il affronte Jotaro Kujo et les Joestar lancés à sa poursuite (Stardust Crusaders). « Inutile, inutile, inutile… MUDA MUDA MUDA ! »",
    playTips: [
      "Ton objectif : RETIRER DU JEU Jotaro ET Joseph (en les vainquant), PUIS réaliser les 14 actions hors-Fatalité de ton royaume en un SEUL tour grâce à ZA WARUDO!.",
      "The World est en jeu dès le début et suit ton pion. Mais il ne DOUBLE tes gains de Pouvoir qu'une fois Jotaro et Joseph retirés du jeu : tant qu'ils sont là, concentre-toi sur leur élimination.",
      "Les Joestar arrivent par la Fatalité et sont joués d'office. Jotaro invoque Star Platinum (+8) qui INTERDIT ZA WARUDO! : impossible de gagner avant de l'avoir vaincu et retiré du jeu. Réunis assez de Force (Alliés, Stands) pour passer ces gros Héros.",
      "Avant de déclencher ZA WARUDO!, accumule un GROS tas de Pouvoir : pendant le temps arrêté, tu te déplaces librement de lieu en lieu, mais chaque action coûte un Pouvoir croissant (1, 2, 3… plafonné à 10).",
      "Fais tourner ta main : Vampirisme défausse un Allié pour piocher 4 cartes ; Indigne de moi gagne du Pouvoir par Joestar retiré ; MUDA! MUDA! MUDA! se joue en réaction quand un adversaire te cible avec une Fatalité.",
    ],
    counterTips: [
      "Joue Jotaro Kujo au plus vite : son Stand Star Platinum le rend coriace ET BLOQUE totalement ZA WARUDO! tant qu'il est en jeu. Sans avoir vaincu et retiré Jotaro, Dio ne peut pas gagner.",
      "Garde Jotaro OU Joseph en vie le plus longtemps possible : tant que l'un des deux n'est pas retiré du jeu, l'objectif de Dio est hors d'atteinte (et The World ne double pas encore son Pouvoir).",
      "Empile les Stands pour l'étouffer : Polnareff (Silver Chariot) doit être vaincu avant les autres, Kakyoin (Hierophant Green) renchérit ses cartes, Abdul (Magician Red) lui fait piocher moins, Iggy (The Fool) affaiblit ses Alliés.",
      "Les Stands gonflent la Force des Joestar : Dio devra réunir beaucoup de puissance pour les vaincre. Maintiens la pression pour l'empêcher d'amasser le Pouvoir nécessaire à la rafale finale de ZA WARUDO!.",
    ],
  },
}

/** Guide d'un vilain par sa clé (natif ou PUBLIÉ). Une fiche rédigée (native ou collab
 *  via CUSTOM_GUIDES) prime. Sinon, pour un vilain publié, on synthétise sa difficulté
 *  (étoiles) et son récit depuis la description d'objectif ; les conseils restent vides
 *  (la fiche les masque alors). */
export function villainGuideOf(key: string): VillainGuide {
  if (isCustomKey(key)) {
    const c = customVillainOf(key)
    // La difficulté affichée suit TOUJOURS les étoiles choisies dans l'Atelier (on n'en
    // fige jamais une dans CUSTOM_GUIDES, qui ne fournit que l'histoire et les conseils).
    const written = CUSTOM_GUIDES[key]
    if (written) return { ...written, difficulty: c?.stars ?? written.difficulty }
    return {
      difficulty: c?.stars ?? 3,
      story: c?.objectiveDescription || 'Vilain personnalisé créé dans l’Atelier des vilains.',
      playTips: [],
      counterTips: [],
    }
  }
  return VILLAIN_GUIDE[key as VillainKey]
}
