// =============================================================================
// Modèle de données des cartes.
//
// Le TEXTE français reste la source de vérité « humaine ». Les `effects` sont la
// traduction machine, exécutée par le moteur (engine/effects.ts) : on les ajoute
// progressivement, carte par carte. Les champs de présentation (image, texte,
// nom anglais) restent ici ; les champs de jeu (type/coût/force/effets) sont
// recopiés dans les CardInstance par buildDeckInstances pour que le moteur soit
// autosuffisant.
// =============================================================================

import type {
  AuDelaEffect,
  CardInstance,
  CardType,
  ConditionTrigger,
  CurseDiscardTrigger,
  Effect,
  LocationActionType,
  LocationId,
  PlacementRestriction,
  SelfStrengthMod,
  StrengthMod,
} from '../engine/types'

// CardType est un concept de jeu : il vit dans le moteur, on le ré-exporte ici
// par commodité pour le reste de data/.
export type { CardType } from '../engine/types'

/** À quel paquet appartient la carte. */
export type DeckKind = 'villain' | 'fate'

/**
 * Classement « malus » d'une carte Fatalité DURABLE (Héros/Objet) du point de vue
 * du joueur ciblé. Sert UNIQUEMENT à l'IA pour moduler son agressivité Fatalité
 * (cf. mémoire projet « villainous-fate-malus ») : poids croissant, l'absence de
 * champ = NEUTRE (typiquement le Héros-cible de l'objectif). Renseigné par cardId
 * dans `data/fateMalus.ts` et attaché aux CardDef par le registre.
 *
 *  slow / slow2 / slow3        → RALENTIT (gêne ; ++ / +++ = beaucoup)
 *  block-advance / -advance3   → EMPÊCHE D'AVANCER (fait reculer la progression)
 *  block-win                   → EMPÊCHE DE GAGNER (bloc dur tant que présent)
 */
export type FateMalus =
  | 'slow'
  | 'slow2'
  | 'slow3'
  | 'block-advance'
  | 'block-advance3'
  | 'block-win'

export interface CardDef {
  /** Slug stable (kebab-case, ASCII). Sert de clé et d'id de rendu. */
  id: string
  /** Nom français imprimé sur la carte. */
  name: string
  /** Nom anglais officiel (wiki) — utile pour recouper règles et stratégies. */
  englishName: string
  deck: DeckKind
  type: CardType
  /** Coût en pouvoir pour jouer la carte. Cartes Vilain uniquement
   *  (les cartes Fatalité n'ont pas de coût). */
  cost?: number
  /** Force au combat. Alliés et Héros uniquement. */
  strength?: number
  /** Pour un Objet : à quoi il s'associe une fois joué. `'ally'` = posé sur un
   *  Allié présent sur le lieu ; `'hero'` = posé sur un Héros (Objets Fatalité) ;
   *  absent / `'location'` = posé sur le lieu lui-même. Sans effet pour les
   *  autres types (un Allié va toujours sur le lieu). */
  attach?: 'location' | 'ally' | 'hero'
  /** Pour un Objet associé (`attach: 'ally' | 'hero'`) : bonus de force conféré
   *  à la carte hôte tant que cet Objet lui est associé (Arc et Flèches / Cimeterre
   *  / Lance : +1 ; Épée de Vérité / Vœu : +2). Donnée réutilisable : le moteur
   *  somme ce champ sur tous les Objets associés, sans connaître la carte. */
  attachStrengthBonus?: number
  /** Nombre d'exemplaires dans le paquet. */
  copies: number
  /** Texte de règle français, recopié de la carte. Source de vérité. */
  text: string
  /** URL de l'illustration, servie depuis public/ (ex. '/cards/prince-jean/...'). */
  image: string
  /** Effets immédiats résolus à la mise en jeu (optionnel, ajouté au fil de l'eau). */
  effects?: Effect[]
  /** Effets « à la pose » d'un Héros (Fatalité), résolus sur la CIBLE quand
   *  le Héros est posé sur son plateau. Optionnel — ajouté au fil de l'eau. */
  onPlace?: Effect[]
  /** Effets « à la mort » d'un Héros, résolus sur le joueur qui l'a éliminé
   *  (Toby remélangé dans la pioche Fatalité, Belle Marianne fait apparaître
   *  Robin sur son lieu). */
  onVanquish?: Effect[]
  /** Pour un Héros : lieux où il ne peut être ni posé ni déplacé (Dame Gertrude
   *  ne peut pas aller sur la Prison). */
  forbiddenLocations?: LocationId[]
  /** Pour une Malédiction : restriction imposée à son lieu. */
  placementRestriction?: PlacementRestriction
  /** Modificateur passif de force sur les AUTRES cartes du même lieu (aura). */
  strengthMod?: StrengthMod
  /** Modificateurs conditionnels de la PROPRE force de la carte (synergies). */
  selfStrengthMods?: SelfStrengthMod[]
  /** Déclencheur de défausse automatique (typiquement les Malédictions). */
  discardWhen?: CurseDiscardTrigger
  /** Pour une Condition : descripteur du trigger côté adversaire. */
  trigger?: ConditionTrigger
  /** Nombre maximum d'exemplaires de cette carte posés sur un même lieu (Page : 2). */
  maxAtLocation?: number
  /** Jafar : coût (en Pouvoir) de la capacité activée (action « Activer »). La
   *  présence de ce champ indique que la carte porte le symbole Activer. */
  activatedCost?: number
  /** La carte ne peut être posée QUE sur ce lieu (Lampe Merveilleuse → Caverne). */
  playOnlyAt?: string
  /** L'Imposteur — Tâche / Sabotage : seuil de Coéquipiers sur son lieu déclenchant
   *  sa défausse avant le déplacement de fin de tour (+1 avec le Coéquipier imposteur). */
  discardAtCrewmates?: number
  /** L'Imposteur — Sabotage : carte d'objectif (survivre 3 tours) qui attire les
   *  Coéquipiers. */
  isSabotage?: boolean
  /** Capitaine Crochet : Objet qui DONNE une action à son lieu tant qu'il y est
   *  posé (Canon → Vaincre, Boîte à Crochets → Gagner 1, Ingénieux → Déplacer un
   *  Héros). */
  grantsAction?: { type: LocationActionType; amount?: number; label: string }
  /** Ursula — Pacte : lieu lié au Pacte (le Héros porteur est éliminé s'il y est
   *  déplacé). */
  contractLocationId?: LocationId
  /** Hadès — Titan (Lythos, Hydros, Pyros, Stratos, Argès) : Allié spécial déplacé
   *  vers le Mont Olympe pour l'objectif. */
  isTitan?: boolean
  /** L'Allié peut Éliminer un Héros sur un lieu VOISIN (Flibustiers, Cerbère). */
  reachesAdjacentVanquish?: boolean
  /** Objet « véhicule » : sur son lieu, on peut 1×/tour déplacer la figurine + cet
   *  Objet vers n'importe quel lieu et y faire une action (hors Fatalité).
   *  Hadès — Char ; Bowser — Bateau (même mécanisme, voir applyChariotMove). */
  ridesWithPawn?: boolean
  /** Allié qui retourne en main au lieu d'être défaussé après un Vanquish (Hydre). */
  returnToHandOnVanquish?: boolean
  /** Dr Facilier — comportement de la carte révélée depuis la Pile de l'Au-delà
   *  (Divination). Absent = simple défausse si révélée. */
  auDela?: AuDelaEffect
  /** Dr Facilier — l'Événement va dans la Pile de l'Au-delà au lieu de la défausse
   *  quand il est joué (Amis de l'au-delà, Régner sur la Nouvelle-Orléans). */
  goesToAuDelaOnPlay?: boolean
  /** La carte compte AUSSI comme un Objet (Esprits des masques = Allié + Objet) :
   *  ciblable par les effets « Objet » (Joujou). */
  alsoItem?: boolean
  /** Héros qui doit être éliminé AVANT les autres Héros du royaume (Prof —
   *  La Méchante Reine ; même logique que Provocation). */
  mustDefeatFirst?: boolean
  /** Héros Fatalité posé OBLIGATOIREMENT sur ce lieu (même verrouillé), quel que
   *  soit le choix de l'adversaire (Blanche-Neige → Maison des Nains). */
  forcedFateLocation?: LocationId
  /** Fatalité : si cette carte fait partie des DEUX cartes dévoilées, le joueur qui
   *  pose la Fatalité PEUT jouer les deux (au lieu d'en défausser une). La 2ᵉ reste
   *  facultative (Ray — Dr Facilier ; Dormeur — La Méchante Reine). */
  fatePlayBoth?: boolean
  /** Scar — Allié « Hyène » : utilisé par ses synergies (force par Hyène, jeux
   *  gratuits, défausses comptées…). */
  isHyena?: boolean
  /** Scar — carte injouable s'il n'y a aucune Hyène dans le royaume (Festin :
   *  rien à déplacer sinon). */
  requiresHyenaInRealm?: boolean
  /** Sombra — carte de « Piratage » (Piratage, IEM) : posée sur un lieu, NON
   *  déplaçable, et comptée comme un Objet pour les conditions adverses. Le lieu qui
   *  en porte une est « piraté ». `hackDisablesAction` : à la pose, le joueur
   *  désactive une action du lieu (recouverte par l'image Hack) tant que le piratage
   *  reste (Piratage = oui ; IEM = non). */
  isPiratage?: boolean
  hackDisablesAction?: boolean
  /** Objet qui résout ses effets puis est DÉFAUSSÉ au lieu de rester sur le plateau
   *  (Sombra — Faille). */
  discardOnPlay?: boolean
  /** Pat Hibulaire — Grillon : Allié qui peut suivre chaque Héros joué dans le
   *  royaume (déplacé auto sur le lieu du Héros). */
  followsHeroes?: boolean
  /** Pat Hibulaire — Bandit : plusieurs exemplaires jouables lors d'une même action
   *  « Jouer une carte ». */
  playMultiplePerAction?: boolean
  /** IA uniquement : classement « malus » de cette carte Fatalité durable pour le
   *  joueur ciblé. Renseigné via `data/fateMalus.ts` et attaché par le registre
   *  (pas dans les `.cards.ts`). Absent = NEUTRE. */
  fateMalus?: FateMalus
}

/** Développe une liste de définitions en un paquet concret (un élément par
 *  exemplaire), prêt à être mélangé. */
export function buildDeck(cards: CardDef[], deck: DeckKind): CardDef[] {
  return cards
    .filter((c) => c.deck === deck)
    .flatMap((c) => Array.from({ length: c.copies }, () => c))
}

/** Développe un deck en exemplaires jouables (CardInstance) avec des id uniques.
 *  Recopie les champs de jeu pour que le moteur n'ait pas besoin de data/.
 *  `prefix` permet de garantir des instanceId uniques entre joueurs (ex. 'p0:'). */
export function buildDeckInstances(
  cards: CardDef[],
  deck: DeckKind,
  prefix = '',
): CardInstance[] {
  return cards
    .filter((c) => c.deck === deck)
    .flatMap((c) =>
      Array.from(
        { length: c.copies },
        (_, i): CardInstance => ({
          instanceId: `${prefix}${c.id}#${i + 1}`,
          cardId: c.id,
          name: c.name,
          type: c.type,
          cost: c.cost,
          strength: c.strength,
          attach: c.attach,
          attachStrengthBonus: c.attachStrengthBonus,
          effects: c.effects,
          onPlace: c.onPlace,
          onVanquish: c.onVanquish,
          forbiddenLocations: c.forbiddenLocations,
          placementRestriction: c.placementRestriction,
          strengthMod: c.strengthMod,
          selfStrengthMods: c.selfStrengthMods,
          discardWhen: c.discardWhen,
          trigger: c.trigger,
          maxAtLocation: c.maxAtLocation,
          activatedCost: c.activatedCost,
          playOnlyAt: c.playOnlyAt,
          discardAtCrewmates: c.discardAtCrewmates,
          isSabotage: c.isSabotage,
          grantsAction: c.grantsAction,
          contractLocationId: c.contractLocationId,
          isTitan: c.isTitan,
          reachesAdjacentVanquish: c.reachesAdjacentVanquish,
          ridesWithPawn: c.ridesWithPawn,
          returnToHandOnVanquish: c.returnToHandOnVanquish,
          auDela: c.auDela,
          goesToAuDelaOnPlay: c.goesToAuDelaOnPlay,
          alsoItem: c.alsoItem,
          mustDefeatFirst: c.mustDefeatFirst,
          forcedFateLocation: c.forcedFateLocation,
          fatePlayBoth: c.fatePlayBoth,
          isHyena: c.isHyena,
          requiresHyenaInRealm: c.requiresHyenaInRealm,
          isPiratage: c.isPiratage,
          hackDisablesAction: c.hackDisablesAction,
          discardOnPlay: c.discardOnPlay,
          followsHeroes: c.followsHeroes,
          playMultiplePerAction: c.playMultiplePerAction,
        }),
      ),
    )
}
