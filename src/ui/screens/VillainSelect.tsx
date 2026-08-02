import { useEffect, useMemo, useState } from 'react'
import { VILLAIN_REGISTRY, villainEntry, useGameStore, UNRELEASED_VILLAINS, type VillainKey } from '../store/gameStore'
import { useCustomVillainStore } from '../store/customVillainStore'
import { usePlayerStore } from '../store/playerStore'
import { useIsDesktopApp } from '../store/settingsStore'
import { villainPortrait, villainPresentation, PRESENTATION_TWEAK, savedArtTweak, type ArtTweakDraft } from '../villainArt'
import { villainGuideOf } from '../villainGuide'
import { byRelease, villainOrigin, VILLAIN_ORIGINS, ORIGIN_LABELS } from '../villainOrder'
import { VILLAIN_COLOR, villainsBackground, DEFAULT_TINT_A, DEFAULT_TINT_B } from '../villainColors'
import { Scroller } from '../components/Scroller'
import { OptionsButton } from '../components/OptionsButton'
import { PresentationTweakBar } from '../components/PresentationTweakBar'
import { GameLoading } from './GameLoading'
import { playHeroSelect, playPlayButtonHover, playBackClick, playHover, playHeroHover } from '../sfx'
import { playVillainPhrase, stopVillainVoice } from '../villainVoices'

interface Props {
  /** Le vilain est choisi et la partie démarre (l'écran de jeu prend le relais). */
  onStart: () => void
  /** Revenir au menu principal. */
  onBack: () => void
}

/** Un choix possible : un vilain précis (clé native OU id `custom-…` d'un vilain
 *  publié) ou « aléatoire ». */
type Choice = string | 'random'

/** Camp en cours d'attribution (solo). */
type Side = 'mine' | 'opp'

/** Clés des vilains natifs (statiques), dans l'ordre de SORTIE (comme la galerie).
 *  Les vilains publiés s'y ajoutent au runtime (après, façon nouveautés). */
const BUILTIN_KEYS = (Object.keys(VILLAIN_REGISTRY) as VillainKey[]).sort(byRelease)

/** Vilains dont on peut emprunter la présentation pour la SILHOUETTE d'« Aléatoire ».
 *  Uniquement des natifs : leurs images sont servies depuis `public/`, disponibles dès
 *  le premier rendu (les publiés se chargent au runtime). */
const SILHOUETTE_KEYS = BUILTIN_KEYS.filter((k) => villainPresentation(k))

/** De combien le « ? » d'« Aléatoire » est tiré VERS LE CENTRE de l'écran, depuis le
 *  milieu de sa colonne de bord. À ajuster ici pour les deux camps à la fois. */
const MARK_INSET = '5rem'

/** Tire la silhouette d'un camp passé sur « Aléatoire ». Hors composant : le rendu doit
 *  rester pur, le tirage n'a lieu qu'au clic. */
function drawSilhouette(): VillainKey {
  return SILHOUETTE_KEYS[Math.floor(Math.random() * SILHOUETTE_KEYS.length)]
}

/** Apparence d'un camp (toi / adversaire). */
const SIDE_STYLE: Record<Side, { label: string; badge: string; ring: string; text: string }> = {
  mine: { label: 'Toi', badge: 'bg-amber-400 text-black', ring: 'ring-amber-400', text: 'text-amber-200' },
  opp: { label: 'Adversaire', badge: 'bg-purple-400 text-black', ring: 'ring-purple-400', text: 'text-purple-200' },
}

/** Une tuile de la grille : portrait (ou 🎲) avec les pastilles des camps qui l'ont
 *  choisie. Cliquer assigne au camp actif (géré par le parent). */
function Tile({
  choice,
  mineIs,
  oppIs,
  mineLabel,
  oppLabel,
  oppHovering = false,
  disabled,
  onPick,
  onHoverEnter,
}: {
  choice: Choice
  mineIs: boolean
  oppIs: boolean
  /** Libellé du camp « toi » (nom du joueur). */
  mineLabel: string
  /** Libellé du camp adversaire (nom de l'autre joueur en réseau). */
  oppLabel: string
  /** Réseau : l'adversaire SURVOLE cette tuile (curseur en direct, pas encore choisi). */
  oppHovering?: boolean
  /** Réservée par l'autre camp en réseau : non sélectionnable (pas de miroir). */
  disabled: boolean
  onPick: () => void
  /** Survol local de la tuile (pour diffuser mon curseur en réseau). */
  onHoverEnter?: () => void
}) {
  const isRandom = choice === 'random'
  const v = isRandom ? null : villainEntry(choice)
  // Anneau de la tuile : amber si à toi, violet si à l'adversaire (toi prioritaire).
  const ring = mineIs ? SIDE_STYLE.mine.ring : oppIs ? SIDE_STYLE.opp.ring : ''
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (!disabled) { playHeroSelect(); onPick() } }}
      onMouseEnter={() => { if (!disabled) { playHeroHover(); onHoverEnter?.() } }}
      disabled={disabled}
      aria-pressed={mineIs || oppIs}
      title={disabled ? 'Déjà choisi par l’autre camp' : isRandom ? 'Un vilain au hasard' : v?.def.objectiveDescription}
      className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition ${
        disabled
          ? 'cursor-not-allowed border-white/5 bg-black/40 opacity-40'
          : ring
            ? `border-transparent bg-black/45 ring-2 ${ring}`
            : 'border-white/10 bg-black/45 hover:border-white/30 hover:bg-black/60'
      }`}
    >
      {isRandom ? (
        <span className="flex aspect-square w-full items-center justify-center bg-white/5 text-4xl">🎲</span>
      ) : (
        <img src={villainPortrait(choice)} alt={v?.def.name} className="aspect-square w-full object-cover" />
      )}
      {/* Vignettes petites (grille dense) : nom borné à 2 lignes pour que toutes les
          tuiles d'une rangée gardent la même hauteur, quel que soit le nom. */}
      <span className="line-clamp-2 px-1 py-1 text-center text-[11px] font-bold leading-tight text-amber-100">
        {isRandom ? 'Aléatoire' : v?.def.name}
      </span>
      {/* Pastilles des camps ayant choisi cette tuile (random peut être les deux). */}
      <div className="pointer-events-none absolute left-1 top-1 flex flex-col gap-1">
        {mineIs && (
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${SIDE_STYLE.mine.badge}`}>
            {mineLabel}
          </span>
        )}
        {oppIs && (
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${SIDE_STYLE.opp.badge}`}>
            {oppLabel}
          </span>
        )}
      </div>
      {/* Curseur de l'adversaire (survol en direct, réseau) : liseré pointillé + œil. */}
      {oppHovering && (
        <>
          <span className="pointer-events-none absolute inset-0 animate-pulse rounded-xl border-2 border-dashed border-purple-300/90" />
          <span className="pointer-events-none absolute right-1 top-1 rounded bg-purple-400/90 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-black">
            👀 Adv
          </span>
        </>
      )}
    </button>
  )
}

/** Carte récapitulant le choix d'un camp (au-dessus de la grille). En solo elle est
 *  cliquable pour rendre ce camp « actif » (les clics sur la grille l'alimentent). */
function SlotCard({
  side,
  value,
  active,
  clickable,
  hint,
  label,
  onActivate,
}: {
  side: Side
  value: Choice | null
  active: boolean
  clickable: boolean
  /** Texte sous le slot (ex. « en direct » en réseau). */
  hint?: string
  /** Libellé du camp (remplace le libellé par défaut, ex. nom du joueur en solo). */
  label?: string
  onActivate: () => void
}) {
  const style = SIDE_STYLE[side]
  const sideLabel = label ?? style.label
  const isRandom = value === 'random'
  const v = value && value !== 'random' ? villainEntry(value) : null
  // Devise du vilain choisi (si renseignée), posée SOUS la carte.
  const devise = value && value !== 'random' ? villainGuideOf(value).devise : undefined
  return (
    <div className="flex w-full flex-col gap-2">
    <button
      type="button"
      disabled={!clickable}
      onClick={(e) => { e.stopPropagation(); if (clickable) { playHeroSelect(); onActivate() } }}
      onMouseEnter={() => { if (clickable) playHover() }}
      className={`relative flex min-h-[11rem] w-full items-center gap-5 overflow-hidden rounded-2xl border p-5 text-left transition ${
        active ? `border-transparent bg-[#181227] ring-2 ${style.ring}` : 'border-white/10 bg-[#0d0a17]'
      } ${clickable ? 'hover:bg-[#1e1733]' : 'cursor-default'}`}
    >
      <span className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/5">
        {isRandom ? (
          <span className="text-4xl">🎲</span>
        ) : v ? (
          <img src={villainPortrait(value as string)} alt={v.def.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl text-white/30">?</span>
        )}
      </span>
      <div className="relative flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
          {sideLabel}
          {active && <span className={`inline-block h-2 w-2 rounded-full ${side === 'mine' ? 'bg-amber-400' : 'bg-purple-400'}`} />}
        </span>
        <span className={`truncate text-2xl font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] ${value ? style.text : 'text-white/30'}`}>
          {isRandom ? 'Aléatoire' : v ? v.def.name : 'À choisir'}
        </span>
        {hint && <span className="truncate text-sm leading-tight text-white/50">{hint}</span>}
      </div>
    </button>
      {/* Emplacement de la devise TOUJOURS réservé (hauteur fixe = 2 lignes), même sans
          vilain choisi : sinon l'apparition de la citation faisait remonter la case du
          camp, et une devise d'une ligne d'un côté contre deux de l'autre les
          désalignait. `line-clamp-2` garantit qu'elle ne dépassera jamais ce gabarit. */}
      <p className="line-clamp-2 h-10 px-2 text-center text-sm font-semibold italic leading-snug text-amber-100/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
        {devise ? `« ${devise} »` : ' '}
      </p>
    </div>
  )
}

/** Illustration du vilain choisi, dressée sur le BORD de son camp : à gauche pour le joueur,
 *  à droite pour l'adversaire (miroir, pour qu'ils se fassent face).
 *
 *  Positionnée en ABSOLU, donc hors du flux : sans ça, une illustration de cette taille
 *  dicterait la hauteur du pied de page et la grille se ferait rogner sa dernière rangée.
 *  Affichée ENTIÈRE (`object-contain`, posée sur le bas de l'écran) : l'illustration est
 *  mise à l'échelle pour tenir dans son gabarit au lieu d'être rognée, et sa hauteur est
 *  plafonnée à la fenêtre pour qu'elle ne déborde jamais sur les petits écrans.
 *  Masquée sous `lg` (pas la place).
 *
 *  « Aléatoire » n'a pas d'illustration : on dresse à la place la SILHOUETTE NOIRE d'un
 *  vilain tiré au sort (l'inconnu se devine sans se révéler) plutôt que de laisser le
 *  bord vide. Elle est figée tant que le camp reste sur « Aléatoire ».
 *
 *  Le réglage par vilain vient des champs `select…` de `PRESENTATION_TWEAK`, PROPRES à cet
 *  écran (certaines illustrations sont cadrées bien plus serré que les autres et débordent
 *  sans échelle dédiée) : ni la fiche ni l'écran « versus » ne les partagent, chacun ayant
 *  ses propres champs. Origine du transform en bas : rétrécir garde le personnage posé sur
 *  le sol.
 *
 *  `draft` (dév) : réglage en cours dans le panneau « Configuration », qui prend la
 *  place de la valeur enregistrée le temps de l'aperçu. */
function SlotArt({
  choice,
  side,
  draft,
  silhouette,
}: {
  choice: Choice | null
  side: 'left' | 'right'
  draft?: ArtTweakDraft
  /** Vilain dont on emprunte la forme quand le camp est sur « Aléatoire ». Tiré au sort
   *  par le parent au moment du clic (le rendu doit rester pur). */
  silhouette?: VillainKey
}) {
  const isRandom = choice === 'random'
  const shown = isRandom ? (silhouette ?? null) : choice
  const src = shown ? villainPresentation(shown) : undefined
  if (!src) return null
  const left = side === 'left'
  const tweak = PRESENTATION_TWEAK[shown as string]
  // UNIQUEMENT les champs `select…`, propres à cet écran : le cadrage de la fiche
  // (`scale`/`dxPct`/`dyPct`) part d'un tout autre point de départ et ferait flotter ou
  // déborder l'illustration, ici bien plus grande et posée sur le bas de l'écran
  // (`object-bottom`). C'est aussi ce qui rend le panneau « Configuration » fidèle :
  // ce qu'il montre en aperçu est exactement ce qu'il enregistre.
  const scale = draft?.scale ?? tweak?.selectScale ?? 1
  // `selectDxPct` = décalage VERS LE CENTRE (joueur à gauche → vers la droite,
  // adversaire à droite → vers la gauche).
  const dx = (draft?.dx ?? tweak?.selectDxPct ?? 0) * (left ? 1 : -1)
  const dy = draft?.dy ?? tweak?.selectDyPct ?? 0
  // Par défaut le vilain de gauche s'affiche tel quel et celui de droite est retourné
  // (ils se font face) ; `selectMirror` inverse ce réglage pour une illustration dont
  // le personnage regarde déjà de l'autre côté.
  const mirrored = !left !== (draft?.mirror ?? tweak?.selectMirror ?? false)
  // Colonne de 32rem collée au bord du camp : commune au cadre de l'illustration et au
  // « ? », pour qu'ils occupent la même bande.
  const edge = `pointer-events-none absolute bottom-0 hidden w-[32rem] ${left ? 'left-0' : 'right-0'}`
  return (
    <>
      {/* Le cadre porte la POSITION et le réglage (décalage + échelle) ; le miroir reste sur
          l'image seule, sinon le « ? » s'afficherait à l'envers du côté adverse. */}
      <div
        aria-hidden
        className={`${edge} h-[min(52rem,calc(100vh-5rem))] lg:block`}
        style={{
          transformOrigin: 'bottom',
          transform: `translate(${dx}%, ${dy}%) scale(${scale})`,
        }}
      >
        {/* Calque de MÉTAMORPHOSE : la `key` change à chaque nouvelle silhouette, donc React
            le remonte et l'animation rejoue. Il porte l'animation à la place de l'image, dont
            il ne faut écraser ni le `transform` (miroir) ni le `filter` (noircissement). */}
        <div key={isRandom ? shown : undefined} className={`h-full w-full ${isRandom ? 'silhouette-morph' : ''}`}>
          <img
            src={src}
            alt=""
            className="h-full w-full object-contain object-bottom drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)]"
            style={{
              transform: `scaleX(${mirrored ? -1 : 1})`,
              // Silhouette : `brightness(0)` noircit tout le dessin (l'alpha du PNG est conservé,
              // donc c'est bien la FORME du vilain qui reste). Le halo clair la détache du fond,
              // sinon une masse noire sur un fond noir ne se voit pas.
              ...(isRandom
                ? { filter: 'brightness(0) drop-shadow(0 0 18px rgba(255,255,255,0.3))', opacity: 0.9 }
                : null),
            }}
          />
        </div>
      </div>
      {/* « ? » HORS du cadre de l'illustration, posé directement sur la colonne du bord :
          le cadre porte le réglage PROPRE À CHAQUE VILAIN (décalage, échelle) et la
          métamorphose, qui faisaient sauter le « ? » à chaque nouvelle silhouette. Ici il
          garde exactement la même place, quelle que soit la forme dessous.
          Tiré VERS LE CENTRE de l'écran (à droite côté joueur, à gauche côté adversaire) :
          centré sur sa colonne, il tombait trop au bord, alors que les silhouettes sont
          elles-mêmes ramenées vers le centre par leur `selectDxPct`.
          `lg:flex` seul (jamais `flex` nu) : il doit l'emporter sur le `hidden` d'`edge`,
          que deux utilitaires d'affichage de même portée ne trancheraient pas. */}
      {isRandom && (
        <span
          aria-hidden
          className={`${edge} h-[32rem] items-center justify-center lg:flex`}
          style={{ transform: `translateX(${left ? MARK_INSET : `-${MARK_INSET}`})` }}
        >
          <span className="text-[11rem] font-black leading-none text-white/85 drop-shadow-[0_0_25px_rgba(0,0,0,0.9)]">
            ?
          </span>
        </span>
      )}
    </>
  )
}

/**
 * Choix des vilains avant la partie.
 *  - SOLO : le joueur choisit SON vilain ET celui du bot (chacun pouvant être
 *    « aléatoire »). « Lancer la partie » réinitialise le moteur avec ce duo.
 *  - RÉSEAU : chacun ne choisit que SON vilain, en DIRECT (l'autre voit le choix
 *    en temps réel) ; un vilain pris par l'autre est grisé (pas de doublon).
 *    L'hôte lance la partie une fois les deux vilains choisis.
 */
export function VillainSelect({ onStart, onBack }: Props) {
  const reset = useGameStore((s) => s.reset)
  const startBotMatch = useGameStore((s) => s.startBotMatch)
  const mode = useGameStore((s) => s.mode)
  const lobby = useGameStore((s) => s.lobby)
  const localPlayerIndex = useGameStore((s) => s.localPlayerIndex)
  const selectVillain = useGameStore((s) => s.selectVillain)
  const setHoverVillain = useGameStore((s) => s.setHoverVillain)
  const peerHover = useGameStore((s) => s.peerHover)
  const launchGame = useGameStore((s) => s.launchGame)
  const leaveNet = useGameStore((s) => s.leaveNet)
  const quitNet = useGameStore((s) => s.quitNet)
  const netStatus = useGameStore((s) => s.netStatus)
  const netError = useGameStore((s) => s.netError)
  const netLeftNotice = useGameStore((s) => s.netLeftNotice)
  const network = mode !== 'solo'

  // Vilains PUBLIÉS (« Terminés » dans l'Atelier) : ils rejoignent la grille en SOLO
  // ET en RÉSEAU. Ils sont EMBARQUÉS dans le build (src/data/published + images sous
  // public/cards/) et chargés au démarrage chez tout le monde : à version d'exe identique,
  // les deux joueurs les possèdent, donc ils sont sélectionnables en 1v1 en ligne.
  const customLoaded = useCustomVillainStore((s) => s.loaded)
  const loadCustom = useCustomVillainStore((s) => s.load)
  const customVillains = useCustomVillainStore((s) => s.villains)
  useEffect(() => { if (!customLoaded) void loadCustom() }, [customLoaded, loadCustom])
  const publishedKeys = useMemo(
    () => customVillains.filter((v) => v.published).map((v) => v.id),
    [customVillains],
  )
  // Vilains non encore publiés : sélectionnables en dév, masqués aux joueurs (exe /
  // « mode application »), cf. UNRELEASED_VILLAINS.
  const hideUnreleased = useIsDesktopApp()
  // Toutes les clés sélectionnables (natives + publiées), en SOLO comme en RÉSEAU :
  // les publiés sont embarqués dans le build, donc présents chez les deux joueurs.
  const allKeys = useMemo<string[]>(() => {
    const builtin = hideUnreleased
      ? BUILTIN_KEYS.filter((k) => !UNRELEASED_VILLAINS.includes(k))
      : [...BUILTIN_KEYS]
    return [...builtin, ...publishedKeys]
  }, [publishedKeys, hideUnreleased])

  // Libellé du camp « toi » : nom du joueur (profil), en solo comme en réseau.
  const playerName = usePlayerStore((s) => s.name)
  const mineLabel = playerName.trim() || SIDE_STYLE.mine.label
  // Libellé de l'adversaire : en réseau, son nom vient du lobby (siège opposé) ;
  // en solo c'est le bot, on garde « Adversaire ».
  const oppName = network ? (lobby?.find((s) => s.seat === 1 - localPlayerIndex)?.name ?? '').trim() : ''
  const oppLabel = oppName || SIDE_STYLE.opp.label

  // DEV UNIQUEMENT : mode ORDI vs ORDI (les deux camps en IA) pour observer/analyser.
  // Gardé par `!isDesktopApp` → absent de l'exe ET de la simulation « mode application ».
  const devBuild = !useIsDesktopApp()
  const [aiVsAi, setAiVsAi] = useState(false)
  // DEV UNIQUEMENT : aperçu de l'ÉCRAN DE CHARGEMENT seul (pions qui sautent en boucle),
  // pour observer/régler l'animation sans avoir à lancer une partie.
  const [loaderPreview, setLoaderPreview] = useState(false)

  // DEV UNIQUEMENT : panneau « Configuration » — taille et position de l'illustration de
  // présentation, réglées en direct puis écrites dans `PRESENTATION_TWEAK`. Le vilain en
  // cours de réglage remplace l'illustration de GAUCHE (aperçu), sans toucher au choix.
  const [configOpen, setConfigOpen] = useState(false)
  const [tweakVillain, setTweakVillain] = useState<string | null>(null)
  const [tweakDraft, setTweakDraft] = useState<ArtTweakDraft>({ scale: 1, dx: 0, dy: 0, mirror: false })
  /** Ouvre le panneau sur un vilain (le sien s'il en a un, sinon le premier de la grille). */
  const editTweak = (key: string) => { setTweakVillain(key); setTweakDraft(savedArtTweak(key)) }

  // SOLO : choix local des deux camps + camp actif (alimenté par les clics grille).
  const [mineSolo, setMineSolo] = useState<Choice | null>(null)
  const [oppSolo, setOppSolo] = useState<Choice | null>(null)
  // Camp actif : `null` = aucun (clic grille sans effet ; choisis un camp via sa carte).
  const [activeSide, setActiveSide] = useState<Side | null>('mine')
  // Vilain qui prête sa forme à la SILHOUETTE d'un camp sur « Aléatoire » (cf. assignSide).
  const [silhouettes, setSilhouettes] = useState<Partial<Record<Side, VillainKey>>>({})

  // RÉSEAU : choix dérivés du lobby (synchronisés en direct).
  const seatVillain = (i: number) => (lobby?.find((s) => s.seat === i)?.villainKey ?? null) as Choice | null
  const mine = network ? seatVillain(localPlayerIndex) : mineSolo
  const opp = network ? seatVillain(1 - localPlayerIndex) : oppSolo

  // « Aléatoire » : la silhouette ne se fige pas, elle CHANGE de vilain toutes les cinq
  // secondes (chaque forme se déplie à la place de la précédente, cf. `.silhouette-morph`)
  // — le camp cherche encore son maître. Un seul minuteur pour les deux camps concernés.
  useEffect(() => {
    const cycling: Side[] = []
    if (mine === 'random') cycling.push('mine')
    if (opp === 'random') cycling.push('opp')
    if (cycling.length === 0) return
    const id = setInterval(() => {
      setSilhouettes((s) => {
        const next = { ...s }
        for (const side of cycling) next[side] = drawSilhouette()
        return next
      })
    }, 5000)
    return () => clearInterval(id)
  }, [mine, opp])

  // En réseau, dès que l'hôte lance, on entre dans la partie.
  useEffect(() => {
    if (network && netStatus === 'playing') onStart()
  }, [network, netStatus, onStart])

  // Si l'autre joueur quitte pendant le choix des vilains : retour au menu.
  useEffect(() => {
    if (network && netLeftNotice) { leaveNet(); onBack() }
  }, [network, netLeftNotice, leaveNet, onBack])

  // Racine du GROUPE de variantes liées (skins) d'un vilain custom : `variantOf` (la base)
  // ou l'id lui-même. `null` pour un vilain natif (jamais lié). Deux clés de MÊME racine sont
  // deux skins du MÊME vilain (ex. Sumbra ⟷ Kilaire) : la partie ne peut en contenir qu'un.
  const rootOf = (key: string): string | null => {
    const cv = customVillains.find((v) => v.id === key)
    return cv ? (cv.variantOf ?? cv.id) : null
  }
  /** `c` et `other` sont-ils deux skins DIFFÉRENTS du même vilain (même groupe lié) ? */
  const linkedButDifferent = (c: Choice, other: Choice | null): boolean => {
    if (c === 'random' || !other || other === 'random' || c === other) return false
    const rc = rootOf(c)
    return rc !== null && rc === rootOf(other)
  }

  /** Tire un vilain au hasard, en excluant une clé ET ses skins liés (pas de doublon de vilain). */
  const randomKey = (exclude?: string): string => {
    const excludeRoot = exclude ? rootOf(exclude) : null
    const pool = allKeys.filter(
      (k) => k !== exclude && !(excludeRoot !== null && rootOf(k) === excludeRoot),
    )
    return pool[Math.floor(Math.random() * pool.length)] ?? allKeys[0]
  }

  // Le vilain réservé par un camp (jamais « random ») : interdit à l'autre.
  const takenBy = (c: Choice | null): string | null => (c && c !== 'random' ? c : null)

  // Joue la réplique d'un vilain choisi : natif → fichier de phrase ; publié → sa
  // « Devise en audio ». `playVillainPhrase` résout lui-même le cas custom (no-op si aucune).
  // UN CANAL PAR CAMP : changer le vilain d'un camp coupe SA réplique précédente, mais
  // les deux camps peuvent parler en même temps (on choisit l'un puis l'autre).
  const playPhrase = (key: string, side: Side) => playVillainPhrase(key, side)

  // Affecte un vilain à un camp (avec anti-miroir : on le retire à l'autre s'il l'avait).
  const assignSide = (c: Choice, side: Side) => {
    // « Aléatoire » : on tire ICI (dans le gestionnaire de clic, pas au rendu) le vilain
    // dont l'illustration prêtera sa SILHOUETTE au bord de ce camp.
    if (c === 'random') {
      const key = drawSilhouette()
      setSilhouettes((s) => ({ ...s, [side]: key }))
    }
    if (side === 'mine') {
      setMineSolo(c)
      if (c !== 'random' && oppSolo === c) setOppSolo(null)
    } else {
      setOppSolo(c)
      if (c !== 'random' && mineSolo === c) setMineSolo(null)
    }
  }

  // SOLO : 1er clic = TON vilain, 2e clic = le BOT (auto-bascule sur le camp encore
  // vide). Quand les DEUX deviennent choisis, plus aucun camp n'est actif (`null`) :
  // pour changer un vilain, on clique d'abord sa carte « Toi » / « Adversaire ».
  const pickSolo = (c: Choice) => {
    if (!activeSide) return // aucun camp actif : choisis-en un via sa carte d'abord
    if (c !== 'random') playPhrase(c, activeSide) // phrase du vilain choisi (Scar, Maléfique…)
    // Le camp actif avait-il DÉJÀ un vilain ? Si oui, on est en train de le MODIFIER :
    // on garde ce camp actif (pas de désélection) pour pouvoir le changer en série.
    const editingChosen = !!(activeSide === 'mine' ? mineSolo : oppSolo)
    // Valeur de l'AUTRE camp après ce clic (l'anti-miroir peut le vider s'il avait `c`).
    const otherVal = activeSide === 'mine' ? oppSolo : mineSolo
    const otherStillChosen = !!otherVal && !(c !== 'random' && otherVal === c)
    assignSide(c, activeSide)
    // Modification d'un camp déjà choisi → on reste sur ce camp. Sinon (premier choix
    // de ce camp) : bascule sur l'autre s'il est vide, sinon plus aucun camp actif.
    if (editingChosen) return
    setActiveSide(otherStillChosen ? null : activeSide === 'mine' ? 'opp' : 'mine')
  }

  // RÉSEAU : on ne choisit que SON vilain. « Aléatoire » est résolu sur-le-champ en
  // un vilain disponible (on exclut celui pris par l'adversaire) puis confirmé.
  const pickMineNet = (c: Choice) => {
    const key = c === 'random' ? randomKey(takenBy(opp) ?? undefined) : c
    playPhrase(key, 'mine') // phrase du vilain choisi (Scar, Maléfique…)
    selectVillain(key as VillainKey)
  }
  const pickTile = network ? pickMineNet : pickSolo

  // Une tuile est-elle NON sélectionnable ? Deux causes :
  //  - RÉSEAU : le vilain (ou son skin lié) est déjà pris par l'adversaire (pas de miroir).
  //  - SKINS LIÉS (solo & réseau) : un vilain et son skin lié (Sumbra ⟷ Kilaire) ne peuvent pas
  //    coexister dans une partie. En solo, on grise le skin lié pris par le camp qu'on N'édite PAS
  //    (choisir le skin sur le camp actif reste possible — il remplace son jumeau).
  const disabledFor = (c: Choice): boolean => {
    if (network) return (c !== mine && c === opp) || linkedButDifferent(c, opp)
    if (activeSide === 'mine') return linkedButDifferent(c, opp)
    if (activeSide === 'opp') return linkedButDifferent(c, mine)
    // Aucun camp actif (clic sans effet) : on grise quand même le skin lié d'un vilain choisi.
    return linkedButDifferent(c, mine) || linkedButDifferent(c, opp)
  }

  // Tuiles de la grille, GROUPÉES PAR UNIVERS (mêmes sections que la galerie, via
  // `villainOrigin` partagé). Une section vide n'est pas rendue (ex. Marvel en mode exe,
  // où Thanos est encore inédit).
  const sections = useMemo(() => {
    const byOrigin = VILLAIN_ORIGINS.map((origin) => ({
      origin: origin as string,
      label: ORIGIN_LABELS[origin],
      keys: allKeys.filter((k) => villainOrigin(k) === origin),
    })).filter((s) => s.keys.length > 0)
    // « Aléatoire » n'a PAS de section à lui : une rangée entière pour une seule tuile. Il
    // ferme donc la DERNIÈRE section, en queue de sa grille.
    const last = byOrigin.length - 1
    if (last >= 0) byOrigin[last] = { ...byOrigin[last], keys: [...byOrigin[last].keys, 'random'] }
    return byOrigin
  }, [allKeys])

  // Disney + Marvel se partagent une rangée (cf. rendu) ; le reste s'empile en dessous.
  const disneySection = sections.find((s) => s.origin === 'Disney')
  const marvelSection = sections.find((s) => s.origin === 'Marvel')
  const otherSections = sections.filter((s) => s !== disneySection && s !== marvelSection)

  /** Une section d'univers : en-tête (libellé + filet) puis sa grille de vignettes. */
  const renderSection = (s: (typeof sections)[number], className?: string) => (
    <section key={s.origin} className={className}>
      {/* En-tête de section : même idiome que la galerie (libellé + filet). */}
      <h2 className="mb-1.5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300/80">
        {s.label}
        <span className="h-px flex-1 bg-white/10" />
      </h2>
      {/* Remplissage AUTO à piste FIXE (7rem) et non `minmax(7rem,1fr)` : avec `1fr` le
          reliquat était réparti sur les colonnes, si bien qu'une section étroite (Marvel,
          sur 20 %) avait des vignettes plus larges que les autres. Piste fixe = vignettes
          RIGOUREUSEMENT identiques d'une section à l'autre, au prix d'un peu d'espace
          libre au bout des rangées. */}
      <div className="grid grid-cols-[repeat(auto-fill,7rem)] gap-2">
        {s.keys.map((c) => (
          <Tile
            key={c}
            choice={c}
            mineIs={mine === c}
            oppIs={opp === c}
            mineLabel={mineLabel}
            oppLabel={oppLabel}
            oppHovering={network && peerHover === c}
            // Verrouillé si pris par l'adversaire, ou si c'est le skin lié d'un vilain déjà
            // choisi (Sumbra ⟷ Kilaire = même vilain, un seul par partie).
            disabled={disabledFor(c)}
            onPick={() => pickTile(c)}
            onHoverEnter={network ? () => setHoverVillain(c === 'random' ? null : (c as VillainKey)) : undefined}
          />
        ))}
      </div>
    </section>
  )

  const launchSolo = () => {
    if (!mineSolo || !oppSolo) return
    const playerKey = mineSolo === 'random' ? randomKey(takenBy(oppSolo) ?? undefined) : mineSolo
    const botKey = oppSolo === 'random' ? randomKey(playerKey) : oppSolo
    // Les vilains CUSTOM sont désormais chargés COMPLETS dès le démarrage (JSON « chemins » :
    // plus besoin d'hydratation avant de bâtir la partie).
    // DEV : ORDI vs ORDI → les deux sièges sont des bots (partie auto-jouée à observer).
    if (devBuild && aiVsAi) startBotMatch([playerKey, botKey])
    else reset([playerKey, botKey])
    onStart()
  }

  // Quitter le choix : en réseau on PRÉVIENT l'autre (LEAVE) pour qu'il revienne
  // aussi à l'accueil (le relais ne notifie pas les départs de lui-même).
  // On coupe la réplique en cours : sans ça le vilain finit sa phrase par-dessus le menu.
  const back = () => { stopVillainVoice(); if (network) quitNet(); onBack() }
  const bothChosen = !!takenBy(mine) && !!takenBy(opp)

  // Fond « teinté par les vilains » : réagit aux choix (toi → gauche, adversaire → droite).
  const pageBackground = villainsBackground(
    (takenBy(mine) && VILLAIN_COLOR[takenBy(mine)!]) || DEFAULT_TINT_A,
    (takenBy(opp) && VILLAIN_COLOR[takenBy(opp)!]) || DEFAULT_TINT_B,
  )

  return (
    <div
      className="villain-bg relative flex h-screen flex-col overflow-hidden bg-[#0a0814] text-white"
      style={{ backgroundImage: pageBackground }}
    >
      <header className="flex flex-col gap-2 border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-purple-200">
            {network ? 'Choix des vilains (en réseau)' : 'Choix des vilains'}
          </h1>
          <div className="flex items-center gap-2">
            {/* DEV : réglage des illustrations de présentation. Absent de l'exe ET de la
                simulation « mode application » (l'endpoint d'écriture n'existe qu'en dév). */}
            {devBuild && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  playHover()
                  if (!configOpen && !tweakVillain) editTweak(takenBy(mine) ?? allKeys[0])
                  setConfigOpen((o) => !o)
                }}
                onMouseEnter={playHover}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                  configOpen
                    ? 'border-emerald-300/70 bg-emerald-500/35 text-white'
                    : 'border-emerald-400/50 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/35'
                }`}
              >
                ⚙ Configuration
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); playBackClick(); back() }}
              onMouseEnter={playHover}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              ← Menu
            </button>
          </div>
        </div>
        {devBuild && configOpen && tweakVillain && (
          <PresentationTweakBar
            keys={allKeys}
            villain={tweakVillain}
            draft={tweakDraft}
            onVillainChange={editTweak}
            onDraftChange={setTweakDraft}
            leftSlot={
              /* Aperçu de l'écran de chargement seul : met en scène les vilains DÉJÀ
                 choisis (pions + teintes) s'il y en a. */
              <button
                type="button"
                onClick={() => setLoaderPreview(true)}
                onMouseEnter={playHover}
                title="Voir l’écran de chargement seul (en boucle)"
                className="rounded-lg border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-100 transition hover:bg-amber-500/35"
              >
                ⏳ Écran de chargement
              </button>
            }
          />
        )}
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Scroller className="relative z-10 h-full">
          {/* Pleine largeur, bord à bord : les gouttières n'existaient que pour dégager les
              illustrations latérales, désormais supprimées (la présentation du vilain choisi
              vit derrière sa case, dans le pied de page). */}
          <div className="mx-auto flex w-full flex-col gap-5 px-6 pb-6 pt-4">
            {/* Grille partagée de tous les vilains (façon sélection de perso), découpée en
                SECTIONS par univers. En réseau, on diffuse mon survol et on affiche le
                curseur de l'adversaire. */}
            <div
              className="flex flex-col gap-3"
              onMouseLeave={() => { if (network) setHoverVillain(null) }}
            >
              {/* Disney et Marvel PARTAGENT une rangée (80 % / 20 %) : Marvel ne compte que
                  2 vilains, une section pleine largeur pour lui gâchait une rangée entière.
                  Si l'un des deux manque, l'autre reprend toute la largeur. */}
              {(disneySection || marvelSection) && (
                <div className="flex gap-4">
                  {disneySection && renderSection(disneySection, marvelSection ? 'min-w-0 basis-4/5' : 'min-w-0 flex-1')}
                  {marvelSection && renderSection(marvelSection, disneySection ? 'min-w-0 basis-1/5' : 'min-w-0 flex-1')}
                </div>
              )}
              {/* Les autres univers (Collaborations) gardent la pleine largeur. */}
              {otherSections.map((s) => renderSection(s))}
            </div>
          </div>
        </Scroller>
      </main>

      {/* Barre du bas, en colonne : le bouton de lancement CENTRÉ au-dessus, les deux camps
          côte à côte en dessous — les trois informations décisives au même endroit.
          INVISIBLE : aucun habillage (ni fond, ni bordure, ni ombre, ni flou), seuls les
          camps et le bouton se détachent, posés directement sur le décor. */}
      <footer className="relative z-0 flex flex-col items-center gap-3 px-4 pb-12 pt-2">
        {/* Bouton de lancement (et ses messages) AU-DESSUS des deux camps, centré. */}
        <div className="flex flex-col items-center gap-2">
        {/* RÉSEAU : toute erreur (dont un échec de lancement) est affichée ici — sans ça,
            un clic « Lancer » qui échoue donnait l'impression que « rien ne se passe ». */}
        {network && netError && (
          <p className="mb-1 max-w-md rounded-lg border border-red-400/40 bg-red-500/15 px-4 py-2 text-center text-sm text-red-100">
            {netError}
          </p>
        )}
        {/* SOLO : 1er clic = ton vilain, 2e clic = le bot, puis « Lancer la partie ». */}
        {!network && (
          <>
            <span className={`text-xs text-white/40 ${!mineSolo || !oppSolo ? '' : 'invisible'}`}>
              {!mineSolo ? 'Clic 1 : choisis ton vilain.' : 'Clic 2 : choisis le vilain du bot.'}
            </span>
            {/* DEV : bascule ORDI vs ORDI (absente du build/exe). Bouton vert dont
                l'état actif/inactif (plein vs. estompé) reflète l'activation. */}
            {devBuild && (
              <button
                type="button"
                onClick={() => setAiVsAi((v) => !v)}
                onMouseEnter={playPlayButtonHover}
                aria-pressed={aiVsAi}
                title={aiVsAi ? 'Mode ORDI vs ORDI activé — clic pour désactiver' : 'Activer le mode ORDI vs ORDI (les deux camps en IA)'}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                  aiVsAi
                    ? 'border-emerald-300 bg-emerald-500 text-emerald-950 shadow-[0_0_12px_rgba(16,185,129,0.5)] hover:bg-emerald-400'
                    : 'border-emerald-500/40 bg-emerald-900/30 text-emerald-300/60 opacity-70 hover:opacity-100 hover:bg-emerald-800/40'
                }`}
              >
                🤖 Entre Ordis
              </button>
            )}
            <div className="w-72">
              {/* Variante « vert » quand le mode ORDI vs ORDI (dev) est actif — le libellé reste « Lancer la partie ». */}
              {(() => { const v = devBuild && aiVsAi ? 'vert' : 'classique'; return (
              <button type="button" disabled={!mineSolo || !oppSolo} onClick={(e) => { e.stopPropagation(); playHeroSelect(); launchSolo() }} onMouseEnter={playPlayButtonHover} className={`hs-wrapper ${v}`}>
                <span className={`hs-button ${v}`}>
                  <span className={`hs-border ${v}`}>
                    <span className={`hs-text ${v}`}>Lancer la partie</span>
                  </span>
                </span>
              </button>
              ) })()}
            </div>
          </>
        )}

        {/* RÉSEAU — HÔTE : lance la partie quand les deux vilains sont choisis. */}
        {network && mode === 'host' && (
          <>
            <span className={`text-xs text-white/40 ${!bothChosen ? '' : 'invisible'}`}>
              {!takenBy(mine) ? 'Choisis ton vilain.' : 'En attente du choix de l’adversaire…'}
            </span>
            <div className="w-72">
              <button type="button" disabled={!bothChosen} onClick={(e) => { e.stopPropagation(); playHeroSelect(); launchGame() }} onMouseEnter={playPlayButtonHover} className="hs-wrapper classique">
                <span className="hs-button classique">
                  <span className="hs-border classique">
                    <span className="hs-text classique">Lancer la partie</span>
                  </span>
                </span>
              </button>
            </div>
          </>
        )}

        {/* RÉSEAU — INVITÉ : attend que l'hôte lance. */}
        {network && mode === 'client' && (
          <span className="text-sm text-white/60">
            {!takenBy(mine) ? 'Choisis ton vilain.' : '⏳ En attente que l’hôte lance la partie…'}
          </span>
        )}
        </div>

        {/* Les deux camps, côte à côte SOUS le bouton, chacun flanqué de l'illustration de
            son vilain (à l'extérieur). `min-w-0` sans `shrink-0` : à cette taille les deux
            cases frôlent la largeur de l'écran, elles doivent pouvoir se comprimer plutôt
            que déborder. */}
        {/* `relative z-10` : les illustrations sont en absolu et les recouvriraient sinon. */}
        <div className="relative z-10 flex w-full items-end justify-center gap-4">
          <div className="w-[32rem] min-w-0">
            <SlotCard
              side="mine"
              value={mine}
              active={!network && activeSide === 'mine'}
              clickable={!network}
              hint={network ? undefined : 'Clique la grille'}
              label={mineLabel}
              onActivate={() => setActiveSide('mine')}
            />
          </div>
          <div className="w-[32rem] min-w-0">
            <SlotCard
              side="opp"
              value={opp}
              active={!network && activeSide === 'opp'}
              clickable={!network}
              hint={network ? 'en direct' : undefined}
              label={oppLabel}
              onActivate={() => setActiveSide('opp')}
            />
          </div>
        </div>

        {/* DEV : panneau « Configuration » ouvert → le vilain en cours de réglage occupe
            LES DEUX bords, avec le brouillon appliqué (aperçu en direct). Les deux côtés
            à la fois : le décalage horizontal joue en miroir, on voit donc du même coup ce
            que donne le réglage côté joueur ET côté adversaire. */}
        {configOpen && tweakVillain ? (
          <>
            <SlotArt choice={tweakVillain} side="left" draft={tweakDraft} />
            <SlotArt choice={tweakVillain} side="right" draft={tweakDraft} />
          </>
        ) : (
          <>
            <SlotArt choice={mine} side="left" silhouette={silhouettes.mine} />
            <SlotArt choice={opp} side="right" silhouette={silhouettes.opp} />
          </>
        )}
      </footer>

      <OptionsButton />

      {/* DEV : l'écran de chargement seul, par-dessus tout, en boucle jusqu'à fermeture. */}
      {loaderPreview && (
        <div className="fixed inset-0 z-[200]">
          <GameLoading
            preview
            previewKeys={[mine, opp].filter((c): c is VillainKey => !!c && c !== 'random')}
            onReady={() => {}}
            onBack={() => setLoaderPreview(false)}
          />
        </div>
      )}
    </div>
  )
}
