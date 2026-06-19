import { useState, type MouseEvent } from 'react'
import type { CardDef } from '../../data/types'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { villainPortrait, villainPresentation, PRESENTATION_TWEAK } from '../villainArt'
import { VILLAIN_GUIDE } from '../villainGuide'
import { Scroller } from './Scroller'
import { playPageFlip, playCardHover, playTinyButtonPress } from '../sfx'

interface Props {
  villain: VillainKey
  onClose: () => void
}

/** Libellé court du type de carte (pour le survol). */
const TYPE_LABEL: Record<string, string> = {
  ally: 'Allié',
  item: 'Objet',
  effect: 'Événement',
  condition: 'Condition',
  hero: 'Héros',
  curse: 'Malédiction',
  ingredient: 'Ingrédient',
}

/** DEBUG : formate une valeur (params d'effet) de façon compacte et lisible. */
function fmtVal(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(fmtVal).join(', ')}]`
  if (v && typeof v === 'object') {
    return `{${Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}:${fmtVal(x)}`).join(', ')}}`
  }
  return String(v)
}

/** DEBUG : formate un effet/déclencheur « TYPE(param=…, …) ». */
function fmtEffect(e: { type: string } & Record<string, unknown>): string {
  const { type, ...rest } = e
  const keys = Object.keys(rest)
  return keys.length ? `${type}(${keys.map((k) => `${k}=${fmtVal(rest[k])}`).join(', ')})` : type
}

/** DEBUG : pour chaque effet de carte, une description EN CLAIR (`does`) et la
 *  CONDITION de jouabilité (`needs`) le cas échéant. Tout effet non listé retombe
 *  sur son nom brut. (Sert l'encart Debug de la liste des vilains.) */
const EFFECT_INFO: Record<string, { does: string; needs?: string }> = {
  GAIN_POWER: { does: 'Gagne des jetons Pouvoir' },
  GAIN_POWER_PER_ALLY_IN_REALM: { does: 'Gagne du Pouvoir par Allié de votre royaume' },
  GAIN_POWER_PER_HERO_IN_REALM: { does: 'Gagne du Pouvoir par Héros de votre royaume' },
  GAIN_POWER_PER_CONTRACT: { does: 'Gagne du Pouvoir par Pacte de votre royaume' },
  GAIN_POWER_PER_CARD_AT_PAWN: { does: 'Gagne du Pouvoir par carte sur le lieu de votre pion' },
  GAIN_POWER_PER_TYPE_IN_DISCARD: { does: 'Gagne du Pouvoir par carte d’un type dans la défausse' },
  LOSE_POWER: { does: 'La cible perd des jetons Pouvoir' },
  LOSE_POWER_TO_HOST: { does: 'La cible perd du Pouvoir (lié à l’hôte)' },
  RELOCATE_OWN_HERO: { does: 'Déplace un de vos Héros vers n’importe quel lieu', needs: 'un Héros est présent dans votre royaume' },
  RELOCATE_HERO_ADJACENT: { does: 'Déplace un Héros vers un lieu voisin', needs: 'un Héros est présent' },
  MOVE_HERO_TO_LOCATION: { does: 'Déplace un Héros vers un lieu précis', needs: 'un Héros est présent' },
  MOVE_HERO_FROM_HOST_ANYWHERE: { does: 'Déplace le Héros de cet hôte n’importe où', needs: 'un Héros est sur l’hôte' },
  MOVE_HERO: { does: 'Action « Déplacer un Héros »' },
  FATE_MOVE_ALL_HEROES_ADJACENT: { does: 'Déplace tous les Héros vers un lieu voisin' },
  TELEPORT_TO_HERO: { does: 'Déplace votre figurine sur le lieu d’un Héros', needs: 'un Héros est présent dans votre royaume' },
  GRANT_USE_COVERED_ACTION: { does: 'Utilise les actions recouvertes par un Héros ce tour', needs: 'un Héros recouvre une action' },
  HYPNOTIZE_HERO: { does: 'Hypnotise un Héros (il devient un Allié)', needs: 'un Héros est présent' },
  REDUCE_HERO_STRENGTH_TEMP: { does: 'Réduit la force d’un Héros ce tour', needs: 'un Héros est présent' },
  SET_HERO_SIZE: { does: 'Agrandit / Rapetisse un Héros', needs: 'un Héros est présent' },
  INSTANT_VANQUISH_HERO_LE: { does: 'Élimine instantanément un Héros (force ≤ seuil)', needs: 'un Héros de force ≤ seuil est présent' },
  INSTANT_VANQUISH_HERO_AT_PAWN: { does: 'Élimine un Héros sur le lieu de votre pion', needs: 'un Héros sur le lieu du pion' },
  VANQUISH_HERO: { does: 'Élimine un Héros (Vaincre)', needs: 'un Héros et assez de force' },
  VANQUISH: { does: 'Action « Éliminer un Héros »', needs: 'un Héros et assez de force' },
  STEAL_ITEM_TO_HERO: { does: 'Vole un Objet et l’associe à un Héros', needs: 'un Héros (et un Objet à voler)' },
  MOVE_ALLY_BUFF: { does: 'Déplace un Allié vers un lieu voisin (+force temporaire)', needs: 'un Allié déplaçable' },
  MOVE_ALLY_FREELY: { does: 'Déplace un Allié vers n’importe quel lieu', needs: 'un Allié' },
  MOVE_ITEM_ALLY: { does: 'Action « Déplacer un Objet/Allié »' },
  PULL_ALLY_FROM_EACH_ADJACENT: { does: 'Attire un Allié de chaque lieu voisin', needs: 'des Alliés sur les lieux voisins' },
  DRAIN_STAR_TO_ALLY: { does: 'Déplace une Étoile de l’Observatoire vers un Allié SUR l’Observatoire', needs: 'une Étoile sur l’Observatoire ET un Allié sur l’Observatoire' },
  DRAIN_STAR_TO_SELF_IF_AT_OBSERVATORY: { does: 'Si joué sur l’Observatoire, prend une Étoile', needs: 'être joué sur l’Observatoire (Étoile disponible)' },
  RETURN_STAR_TO_OBSERVATORY: { does: 'Reprend une Étoile sur un Allié et la remet à l’Observatoire', needs: 'un Allié porte une Étoile' },
  RECOVER_ANY_FROM_DISCARD: { does: 'Reprend une carte de la défausse', needs: 'une carte en défausse' },
  RECOVER_ITEM_OR_EVENT: { does: 'Reprend un Objet/Événement de la défausse', needs: 'un Objet/Événement en défausse' },
  RECOVER_TYPE_FROM_DISCARD: { does: 'Reprend une carte d’un type de la défausse', needs: 'une carte de ce type en défausse' },
  RECOVER_FROM_DISCARD_CHOICE: { does: 'Reprend (au choix) une carte d’un type de la défausse', needs: 'une carte de ce type en défausse' },
  DISCARD_OWN_FOR_POWER: { does: 'Défausse des cartes pour gagner du Pouvoir', needs: 'des cartes en main' },
  UNTRAP_TITANS_PAY: { does: 'Libère des Titans entravés (en payant)', needs: 'un Titan entravé' },
  MOVE_TITAN_INTERACTIVE: { does: 'Déplace un Titan non entravé', needs: 'un Titan non entravé déplaçable' },
  OPEN_TITAN_SELECT: { does: 'Entrave un Titan (choix)', needs: 'un Titan ciblable' },
  STEAL_CONTRACT_TO_HOST: { does: 'Vole un Pacte vers l’hôte' },
  REVEAL_UNTIL_PLAY_ALLY_OR_ITEM: { does: 'Dévoile jusqu’à un Allié/Objet et le joue (choix du lieu)' },
  REVEAL_UNTIL_TYPE: { does: 'Dévoile jusqu’à une carte d’un type donné' },
  REVEAL_VILLAIN_UNTIL_TYPE: { does: 'Dévoile la pioche Vilain jusqu’à un type donné' },
  REVEAL_VILLAIN_UNTIL_CONTRACT: { does: 'Dévoile la pioche Vilain jusqu’à un Pacte' },
  REVEAL_OWN_FATE_PLAY_HERO: { does: 'Dévoile sa Fatalité jusqu’à un Héros et le joue' },
  REVEAL_FATE_TOP_PLAY_IF_HERO: { does: 'Dévoile le dessus de la Fatalité, le joue si c’est un Héros' },
  SUMMON_FATE_HERO_TO_OWN_REALM: { does: 'Invoque un Héros précis depuis la Fatalité', needs: 'le Héros est dans la pioche/défausse Fatalité' },
  SEARCH_FATE_HERO_TO_TOP: { does: 'Met un Héros précis sur le dessus de la Fatalité' },
  SEARCH_AND_PLACE_HERO: { does: 'Cherche et pose un Héros' },
  UNLOCK_LOCATION: { does: 'Déverrouille un lieu' },
  TOGGLE_URSULA_LOCK: { does: 'Verrouille / déverrouille un lieu d’Ursula' },
  TRANSFORM_GUARDS: { does: 'Transforme des Cartes Gardes en arceaux', needs: 'des Cartes Gardes en jeu' },
  ROYAL_CROQUET_ATTEMPT: { does: 'Tentative de Coup Royal' },
  CAPTURE_CARDS_AT_HOST: { does: 'Capture des cartes sur l’hôte' },
  RELEASE_CAPTURED_TO_HAND: { does: 'Reprend des cartes capturées en main', needs: 'des cartes capturées' },
  GRANT_SKIP_NEXT_MOVE: { does: 'La cible saute son prochain déplacement' },
  IMPUISSANCE_RESOLVE: { does: 'Capture Peach OU élimine un Héros ≤ seuil', needs: 'Peach en jeu (capture) ou un Héros ≤ seuil' },
  CAPTURE_PEACH: { does: 'Capture Peach', needs: 'Peach en jeu' },
  MOVE_OWNER_PAWN_FORCED: { does: 'Déplace la figurine de la cible' },
  MOVE_URSULA_PAWN: { does: 'Déplace la figurine d’Ursula' },
  GIANT_ACTION: { does: 'Agit sur un lieu voisin (Colère Titanesque)' },
  EUREKA_ATTACH_ITEM: { does: 'Associe un Objet (Eurêka)' },
  ARIEL_FREEZE_ITEM: { does: 'Gèle un Objet (Ariel) : la cible ne peut plus le déplacer', needs: 'un Objet chez la cible' },
  ARM_DRAGON_FORM_REWARD: { does: 'Arme la récompense « Apparence de Dragon »' },
  LOOK_TOP_DRAW_DISCARD: { does: 'Regarde le dessus de la pioche, en garde, défausse le reste' },
  PEEK_BOTTOM_THEN_CHOOSE: { does: 'Regarde le dessous de la pioche puis choisit' },
  CHOOSE_TYPE_REVEAL_DRAW: { does: 'Choisit un type, dévoile et pioche' },
  RESHUFFLE_DISCARD_AND_DRAW: { does: 'Mélange la défausse dans la pioche et pioche' },
  RESHUFFLE_HOST_INTO_FATE_DECK: { does: 'Remet l’hôte dans la pioche Fatalité' },
  DIVINATION: { does: 'Divination : trie/joue des cartes révélées' },
  DISCARD_ALLIES_AND_RETURN_STARS_AT_HOST: { does: 'Défausse les Alliés du lieu de l’hôte et renvoie leurs Étoiles' },
  DISCARD_ALLIES_AT_HOST: { does: 'Défausse les Alliés du lieu de l’hôte' },
  DISCARD_ALLY_AT_HOST: { does: 'Défausse un Allié du lieu de l’hôte' },
  DISCARD_CARDS_AT_HOST: { does: 'Défausse des cartes sur le lieu de l’hôte' },
  DISCARD_ONE_ITEM: { does: 'Défausse un Objet du royaume de la cible', needs: 'un Objet chez la cible' },
  DISCARD_FATE_ITEM: { does: 'Défausse un Objet Fatalité' },
  FATE_ALLY_TO_AUDELA: { does: 'Envoie un Allié dans la Pile de l’Au-delà' },
  FATE_TOP_DECK_TO_AUDELA: { does: 'Envoie le dessus de la pioche dans l’Au-delà' },
  FATE_AUDELA_TO_DECK_TOP: { does: 'Remet une carte de l’Au-delà sur le dessus de la pioche' },
  FATE_ITEM_AT_HOST_TO_AUDELA: { does: 'Envoie l’Objet de l’hôte dans l’Au-delà' },
  TAKE_FROM_AUDELA_TO_HAND: { does: 'Reprend une carte de l’Au-delà en main' },
  AMES_EN_PERDITION: { does: 'Âmes en Perdition' },
  KILL_CREWMATE: { does: 'Élimine un Coéquipier (au choix)', needs: 'un Coéquipier en jeu' },
  KILL_NORMAL_CREWMATE: { does: 'Élimine un Coéquipier qui ne vous suspecte pas', needs: 'un Coéquipier « normal »' },
  REASSURE_CREWMATE: { does: 'Rend un Coéquipier suspect « normal »', needs: 'un Coéquipier suspect' },
  REASSURE_ANY: { does: 'Rend un Coéquipier suspect « normal »', needs: 'un Coéquipier suspect' },
  FALSE_ACCUSATION: { does: 'Rend des Coéquipiers suspects' },
  MOVE_CREWMATES_NEIGHBOR: { does: 'Déplace des Coéquipiers vers un lieu voisin' },
  SKIP_CREWMATE_MOVE: { does: 'Les Coéquipiers ne se déplacent pas ce tour' },
}

/** Une ligne « effet en clair (+ condition) » à partir d'un effet de carte. */
function describeEffect(e: { type: string } & Record<string, unknown>): string {
  const info = EFFECT_INFO[e.type]
  if (!info) return fmtEffect(e) // repli : nom brut + params
  const amount = typeof e.amount === 'number' ? ` (${e.amount})` : ''
  const cond = info.needs ? ` — jouable si ${info.needs}` : ''
  return `${info.does}${amount}${cond}`
}

/** Déclencheur d'une Condition (= sa condition de jouabilité), en clair. */
function describeTrigger(t: { type: string } & Record<string, unknown>): string {
  const v = typeof t.value === 'number' ? t.value : '?'
  const own = t.requiresOwnAlly ? ' (et vous avez un Allié)' : ''
  switch (t.type) {
    case 'opponent-power-ge':
      return `l'adversaire a ≥ ${v} jetons Pouvoir`
    case 'opponent-allies-in-realm-ge':
      return `l'adversaire a ≥ ${v} Alliés dans son royaume${own}`
    case 'opponent-items-in-realm-ge':
      return `l'adversaire a ≥ ${v} Objets dans son royaume`
    case 'opponent-discarded-ge':
      return `l'adversaire a défaussé ≥ ${v} cartes ce tour`
    case 'opponent-played-cards-ge':
      return `l'adversaire a joué ≥ ${v} cartes ce tour`
    case 'opponent-gained-power-ge':
      return `l'adversaire a gagné ≥ ${v} Pouvoir ce tour`
    case 'opponent-vanquished-hero-strength-ge':
      return `l'adversaire a vaincu un Héros de force ≥ ${v}`
    case 'opponent-drew-card':
      return `l'adversaire a pioché une carte`
    case 'opponent-moved-card':
      return `l'adversaire a déplacé une carte`
    default:
      return fmtEffect(t)
  }
}

/** DEBUG (localhost) : résumé des DONNÉES machine d'une carte — quels effets elle
 *  déclenche et à quelles conditions elle est jouable. Générique (tous vilains). */
function cardDebugInfo(card: CardDef): string[] {
  const lines: string[] = []
  const effs = (card.effects ?? []) as Array<{ type: string } & Record<string, unknown>>
  // Une ligne « • effet en clair (+ condition de jouabilité) » par effet.
  for (const e of effs) lines.push(`• ${describeEffect(e)}`)
  if (card.trigger) lines.push(`Condition (réaction) : ${describeTrigger(card.trigger as { type: string } & Record<string, unknown>)}`)
  if (card.attach) lines.push(`association : ${card.attach}`)
  if (card.grantsAction) lines.push(`accorde l'action : ${card.grantsAction.type}`)
  if (card.activatedCost != null) lines.push(`Activer : ${card.activatedCost} JT`)
  if (card.strengthMod) lines.push(`aura de force : ${fmtVal(card.strengthMod)}`)
  if (card.selfStrengthMods?.length) lines.push(`force conditionnelle : ${card.selfStrengthMods.map(fmtVal).join(' ; ')}`)
  if (card.attachStrengthBonus) lines.push(`+${card.attachStrengthBonus} force à l'hôte`)
  if (card.reachesAdjacentVanquish) lines.push('peut vaincre un Héros sur un lieu voisin')
  if (card.ridesWithPawn) lines.push('véhicule : déplace figurine + objet (1×/tour)')
  if (card.forbiddenLocations?.length) lines.push(`lieux interdits : ${card.forbiddenLocations.join(', ')}`)
  if (card.playOnlyAt) lines.push(`jouable uniquement à : ${card.playOnlyAt}`)
  if (card.maxAtLocation != null) lines.push(`max ${card.maxAtLocation} par lieu`)
  if (card.isSabotage) lines.push('Sabotage')
  if (card.isTitan) lines.push('Titan')
  if (card.placementRestriction) lines.push(`restriction de pose : ${fmtVal(card.placementRestriction)}`)
  return lines
}

/** Une carte du paquet, avec une pastille « ×N exemplaires » et un aperçu agrandi
 *  au survol (grand visuel centré à l'écran, non rogné par le défilement). En mode
 *  `debug`, un encart sous la carte détaille ses effets/conditions (données). */
function CardThumb({ card, debug = false }: { card: CardDef; debug?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <figure
        className="relative m-0 cursor-zoom-in transition-transform duration-150 ease-out hover:scale-[1.04]"
        onMouseEnter={() => { playCardHover(); setHover(true) }}
        onMouseLeave={() => setHover(false)}
      >
        <img
          src={card.image}
          alt={card.name}
          title={`${card.name} — ${TYPE_LABEL[card.type] ?? card.type}`}
          className="w-full rounded-lg border border-white/15"
        />
        <span className="absolute right-1 top-1 rounded-full border border-white/30 bg-black/80 px-1.5 text-[11px] font-bold text-white">
          ×{card.copies}
        </span>
      </figure>
      {hover && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-start p-6 pl-[6vw]">
          <div className="flex max-w-[60vw] flex-col items-start gap-2">
            <img
              src={card.image}
              alt={card.name}
              className="max-h-[40vh] w-auto max-w-full rounded-2xl border border-white/25 shadow-2xl"
            />
            {/* DEBUG (localhost) : texte de règles + effets/conditions, SOUS l'aperçu.
                Le texte couvre AUSSI les cartes dont l'effet est codé dans le moteur
                (pas de données déclaratives). */}
            {debug && (() => {
              const machine = cardDebugInfo(card)
              return (
                <div className="max-w-md rounded-lg border border-amber-400/40 bg-black/90 p-2 text-[11px] leading-tight text-amber-100 shadow-2xl">
                  <div className="mb-0.5 font-bold text-amber-200">
                    {card.name} <span className="font-normal text-amber-100/50">· coût {card.cost ?? 0}{card.strength != null ? ` · force ${card.strength}` : ''}</span>
                  </div>
                  {card.text && <div className="mb-1 italic text-amber-100/75">« {card.text} »</div>}
                  {machine.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                  {machine.length === 0 && (
                    <div className="text-amber-100/50">
                      ⚙️ Pas de données déclaratives — effet (le cas échéant) géré dans le moteur (voir texte).
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

/** Grille d'un paquet (Vilain ou Fatalité) : une vignette par carte unique. */
function DeckGallery({ title, cards, count, debug = false }: { title: string; cards: CardDef[]; count: number; debug?: boolean }) {
  if (cards.length === 0) return null
  return (
    <section>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-purple-300">
        {title} <span className="font-normal text-white/40">({count} cartes)</span>
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {cards.map((c) => (
          <CardThumb key={c.id} card={c} debug={debug} />
        ))}
      </div>
    </section>
  )
}

/** Note de difficulté en étoiles (pleines / vides) sur `max`. */
export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span
      className="text-lg leading-none tracking-wide"
      aria-label={`Difficulté ${value} sur ${max}`}
      title={`Difficulté ${value}/${max}`}
    >
      <span className="text-amber-400">{'★'.repeat(value)}</span>
      <span className="text-white/20">{'★'.repeat(Math.max(0, max - value))}</span>
    </span>
  )
}

/** Section de conseils (titre + liste à puces). */
function TipList({ title, tips, color }: { title: string; tips: string[]; color: string }) {
  return (
    <section>
      <h3 className={`text-sm font-bold uppercase tracking-wide ${color}`}>{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {tips.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm leading-snug text-white/80">
            <span className={`shrink-0 ${color}`}>•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Fiche détaillée d'un vilain : portrait, difficulté, objectif, histoire et
 * conseils pour le jouer / le contrer. Affichée en surimpression (modale).
 */
export function VillainDetailModal({ villain, onClose }: Props) {
  const v = VILLAIN_REGISTRY[villain]
  const guide = VILLAIN_GUIDE[villain]
  const presentation = villainPresentation(villain)
  // Même réglage de taille/position que le choix des vilains et l'écran versus
  // (ex. l'Imposteur, scale 0.55) — sinon l'illustration est trop grande ici.
  const tweak = PRESENTATION_TWEAK[villain]
  const presentationTransform =
    `translateX(7rem) translateY(-50%) scale(${tweak?.scale ?? 1}) translate(${tweak?.dxPct ?? 0}%, ${tweak?.dyPct ?? 0}%)`
  const [showCards, setShowCards] = useState(false)
  // Bouton Debug réservé au développement local (URL contenant « localhost »).
  const isLocalhost = typeof window !== 'undefined' && window.location.href.includes('localhost')
  const [debug, setDebug] = useState(false)

  // Cartes du vilain, séparées par paquet et triées par nombre d'exemplaires.
  const byCopies = (a: CardDef, b: CardDef) => b.copies - a.copies || a.name.localeCompare(b.name)
  const villainCards = v.cards.filter((c) => c.deck === 'villain').sort(byCopies)
  const fateCards = v.cards.filter((c) => c.deck === 'fate').sort(byCopies)
  const sumCopies = (cards: CardDef[]) => cards.reduce((n, c) => n + c.copies, 0)

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center bg-black/75 p-4 transition-all duration-300 ${
        // En vue « cartes », on pousse le modal vers la DROITE (avec une marge à
        // droite) pour dégager la place de l'illustration de présentation à gauche.
        showCards ? 'justify-end lg:pr-[4vw]' : 'justify-center'
      }`}
      onClick={onClose}
    >
      <div
        className={`relative flex max-h-full w-full items-center transition-[max-width] duration-300 ${
          showCards ? 'max-w-6xl' : 'max-w-2xl'
        }`}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {/* Présentation « corps entier » du vilain : ancrée à gauche du modal,
            son bord droit glissé DERRIÈRE le panneau (masqué par son fond opaque). */}
        {presentation && (
          <img
            src={presentation}
            alt=""
            aria-hidden
            style={{ transform: presentationTransform, transformOrigin: 'center' }}
            className="villain-fade-bottom pointer-events-none absolute right-full top-1/2 z-0 hidden h-[88vh] max-w-none object-contain object-bottom drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)] lg:block"
          />
        )}
        <Scroller
        className="relative z-10 max-h-[calc(100vh-2rem)] w-full rounded-2xl border border-white/15 bg-[#120c22] p-5"
        options={{ scrollbars: { theme: 'os-theme-villain-lg', autoHide: 'never' } }}
      >
        <div className="flex flex-col gap-5">
          {/* En-tête : portrait + nom + difficulté */}
          <div className="flex items-start gap-4">
            <img
              src={villainPortrait(villain)}
              alt={v.def.name}
              className="h-32 w-32 shrink-0 rounded-lg border border-white/15 object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl font-black text-amber-200">{v.def.name}</h2>
                <div className="flex shrink-0 items-center gap-2">
                  {showCards && isLocalhost && (
                    <button
                      type="button"
                      onClick={() => setDebug((d) => !d)}
                      title="Afficher les effets/conditions (données machine) sous chaque carte"
                      className={`rounded-lg border px-3 py-1 text-sm ${
                        debug
                          ? 'border-amber-400 bg-amber-400/20 text-amber-100'
                          : 'border-white/20 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      🐛 Debug
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { if (showCards) playPageFlip(); else playTinyButtonPress(); onClose() }}
                    className="rounded-lg border border-white/20 px-3 py-1 text-sm text-white/80 hover:bg-white/10"
                  >
                    Fermer ✕
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Difficulté
                </span>
                <Stars value={guide.difficulty} />
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                Objectif
              </p>
              <p className="mt-1 text-sm leading-snug text-white/80">
                {v.def.objectiveDescription}
              </p>
              <button
                type="button"
                onClick={() => { playPageFlip(); setShowCards((s) => !s) }}
                className="mt-3 self-start rounded-lg border border-amber-400/50 px-3 py-1.5 text-sm font-semibold text-amber-200 hover:bg-amber-400/10"
              >
                {showCards ? '← Retour à la fiche' : '🃏 Voir toutes les cartes'}
              </button>
            </div>
          </div>

          {showCards ? (
            /* Galerie des cartes (Vilain + Fatalité) avec nombre d'exemplaires. */
            <div className="flex flex-col gap-5">
              <DeckGallery title="Deck Vilain" cards={villainCards} count={sumCopies(villainCards)} debug={debug} />
              <DeckGallery title="Deck Fatalité" cards={fateCards} count={sumCopies(fateCards)} debug={debug} />
            </div>
          ) : (
            <>
          {/* Histoire */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-purple-300">Histoire</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/80">{guide.story}</p>
          </section>

          {/* Conseils */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TipList title="Bien le jouer" tips={guide.playTips} color="text-emerald-300" />
            <TipList title="Le contrer" tips={guide.counterTips} color="text-red-300" />
          </div>
            </>
          )}
        </div>
        </Scroller>
      </div>
    </div>
  )
}
