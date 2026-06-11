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
  /** Capitaine Crochet : Objet qui DONNE une action à son lieu tant qu'il y est
   *  posé (Canon → Vaincre, Boîte à Crochets → Gagner 1, Ingénieux → Déplacer un
   *  Héros). */
  grantsAction?: { type: LocationActionType; amount?: number; label: string }
  /** Ursula — Pacte : lieu lié au Pacte (le Héros porteur est éliminé s'il y est
   *  déplacé). */
  contractLocationId?: LocationId
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
          grantsAction: c.grantsAction,
          contractLocationId: c.contractLocationId,
        }),
      ),
    )
}
