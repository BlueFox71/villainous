import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import { OverlayScrollbarsComponent, type OverlayScrollbarsComponentRef } from 'overlayscrollbars-react'
import { COL_RECTS, LOC_IMG, BOARD_W, BOARD_H } from '../editor/boardLayout'
import { allCards, customCardDefs } from '../../data/registry'
import { consolidateFighterDetails } from './gameLogFighters'
import { escapeRegExp, groupLog, type LogBlock } from './gameLogBlocks'

/** Index nom de carte → image (1ʳᵉ occurrence) : pour afficher les vignettes des
 *  cartes défaussées, dont le journal ne porte que les noms. */
const CARD_IMAGE_BY_NAME = new Map<string, string>()
for (const c of allCards) if (!CARD_IMAGE_BY_NAME.has(c.name)) CARD_IMAGE_BY_NAME.set(c.name, c.image)

/** Index nom → TOUTES les images (plusieurs vilains peuvent avoir une carte du même nom,
 *  ex. « Flèche » chez Tabbou ET Syndrome). Sert à lever l'ambiguïté par vilain. */
const CARD_IMAGES_BY_NAME = new Map<string, string[]>()
for (const c of allCards) {
  const list = CARD_IMAGES_BY_NAME.get(c.name)
  if (list) list.push(c.image)
  else CARD_IMAGES_BY_NAME.set(c.name, [c.image])
}
/** Image d'une carte défaussée par son nom, désambiguïsée par le vilain qui la défausse
 *  (son dossier `/cards/<vilain>/` dans l'URL). À défaut : 1ʳᵉ image connue. */
function cardImageForName(name: string, villainKey?: string): string | undefined {
  const list = CARD_IMAGES_BY_NAME.get(name)
  if (!list || list.length === 0) return undefined
  if (list.length > 1 && villainKey) {
    const scoped = list.find((img) => img.includes(`/cards/${villainKey}/`))
    if (scoped) return scoped
  }
  return list[0]
}

/** Comme `cardImageForName`, mais consulte AUSSI les vilains personnalisés (Combattants custom
 *  absents d'`allCards`). Recalculé à la volée : la surcouche custom est peuplée au lancement. */
function anyCardImageForName(name: string, villainKey?: string): string | undefined {
  const staticImg = cardImageForName(name, villainKey)
  if (staticImg) return staticImg
  const custom = customCardDefs().filter((d) => d.name === name && d.image)
  if (custom.length === 0) return undefined
  if (custom.length > 1 && villainKey) {
    const scoped = custom.find((d) => d.image.includes(`/cards/${villainKey}/`))
    if (scoped) return scoped.image
  }
  return custom[0].image
}

interface PlayerBoard {
  /** URL de l'image du plateau du joueur. */
  image: string
  /** Noms des lieux, dans l'ordre des colonnes (gauche → droite). */
  locations: string[]
}

interface Props {
  log: string[]
  /** Noms des joueurs dans l'ordre (index 0 = gauche, 1 = droite). */
  playerNames: string[]
  /** Couleur (hex) du méchant de chaque joueur, pour teinter ses cases. */
  playerColors?: string[]
  /** Portrait (avatar) du méchant de chaque joueur, affiché sur les lignes « entre en jeu ». */
  playerAvatars?: string[]
  /** Plateau de chaque joueur (image + lieux), pour cropper le lieu d'un déplacement. */
  playerBoards?: PlayerBoard[]
  /** Genre grammatical de chaque méchant, pour les pronoms (« Il/Elle subit… »). */
  playerGenders?: ('m' | 'f')[]
  /** Article défini de chaque méchant (« la »…), ou '' (nom propre). Pour « contre la X ». */
  playerArticles?: string[]
  /** Clé de vilain de chaque joueur (pour lever l'ambiguïté d'image quand deux vilains
   *  ont une carte du même nom — ex. « Flèche » Tabbou vs Syndrome). */
  playerVillains?: string[]
}

/**
 * Style CSS pour n'afficher QUE l'illustration du lieu d'index `col` du plateau,
 * cadrée dans la case (vignette). Géométrie partagée avec le plateau (`boardLayout`).
 */
function locationCropStyle(image: string, col: number, total: number): CSSProperties {
  // Rectangle de la colonne (fractions de l'image). Au-delà de 4 lieux : réparti.
  let x0f: number
  let x1f: number
  if (col < COL_RECTS.length) {
    x0f = COL_RECTS[col].x0 / BOARD_W
    x1f = COL_RECTS[col].x1 / BOARD_W
  } else {
    const center = (22 + ((93 - 22) * col) / Math.max(1, total - 1)) / 100
    x0f = center - 0.1
    x1f = center + 0.1
  }
  const y0f = LOC_IMG.y0 / BOARD_H
  const y1f = LOC_IMG.y1 / BOARD_H
  const fw = x1f - x0f
  const fh = y1f - y0f
  // background-position % : pour qu'une région [s, s+f] remplisse la case → s/(1−f).
  return {
    backgroundImage: `url(${image})`,
    backgroundSize: `${100 / fw}% ${100 / fh}%`,
    backgroundPosition: `${(x0f / (1 - fw)) * 100}% ${(y0f / (1 - fh)) * 100}%`,
    backgroundRepeat: 'no-repeat',
  }
}

/** Rend un texte en mettant en gras les segments entre **…** (noms de cartes/lieux). */
function renderBold(text: string) {
  return text.split('**').map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>))
}

const STAR_TOKEN = '⟦star⟧'

/** Rendu enrichi : gras (**…**) + remplacement de « une/N Étoile(s) » par le nombre
 *  suivi de l'image d'Étoile (Bowser), et suppression des « (reste N) ». */
function renderRich(text: string) {
  const t = text
    .replace(/\s*\(reste \d+[^)]*\)/g, '')
    .replace(/\s*\(force [^)]*\)/g, '') // on n'indique pas les forces
    .replace(/déplacé\(e\)/g, 'déplacé')
    .replace(/\bune Étoile\b/g, `1 ${STAR_TOKEN}`)
    .replace(/(\d+)\s+Étoiles?\b/g, `$1 ${STAR_TOKEN}`)
  const parts = t.split(STAR_TOKEN)
  return parts.map((p, i) => (
    <Fragment key={i}>
      {renderBold(p)}
      {i < parts.length - 1 && (
        <img src="/cards/bowser/etoile.webp" alt="Étoile" className="inline-block h-3.5 w-3.5 align-text-bottom" />
      )}
    </Fragment>
  ))
}


interface ActionIcon {
  /** Nom de fichier dans `public/actions/` (sans extension). */
  icon: string
  /** Pour « Gagner du Pouvoir » : montant gagné, superposé en chiffre (1/2/3.png). */
  badge?: number
}

/**
 * Icône d'action (badge doré de `public/actions/`) déduite du texte du journal.
 * Première version : inférence par mots-clés (le moteur ne porte pas le type
 * d'action dans `log`). À remplacer plus tard par une donnée structurée.
 * L'ordre des tests compte : du plus spécifique au plus générique.
 */
function actionIconFor(text: string): ActionIcon | null {
  const t = text.toLowerCase()
  if (/fatalit|fatalis|dévoil/.test(t)) return { icon: 'fate' }
  if (/vainc|vaincu|élimin/.test(t)) return { icon: 'vanquish' }
  // Déplacement d'un Héros : « **X** est déplacé(e) sur **Y** ».
  if (/est déplacé\(e\)/.test(t) || /^\*\*.+?\*\* rejoint \*\*/.test(t)) return { icon: 'move-hero' }
  if (/déplace/.test(t)) {
    // « déplace **X** vers **Y** » (Allié/Objet) ne mentionne pas « héros » → move-ally.
    if (/héros/.test(t)) return { icon: 'move-hero' }
    return { icon: 'move-ally' }
  }
  if (/défausse/.test(t)) return { icon: 'discard' }
  if (/\bjoue\b|jouée|jouer|pose\b/.test(t)) return { icon: 'play-card' }
  if (/active|capacité|activ/.test(t)) return { icon: 'activate' }
  // Gagner du Pouvoir : « gagne N JT », « commence avec N jeton Pouvoir »… → chiffre
  // superposé. On exige un verbe d'acquisition pour ne pas confondre avec perte/dépense.
  const gain = t.match(/(?:gagne|commence avec|reçoit|récupère|regagne)\s+(\d+)\s*(?:jt\b|jetons?\s+pouvoir|pouvoir)/)
  if (gain) return { icon: 'power', badge: Number(gain[1]) }
  if (/pouvoir/.test(t)) return { icon: 'power' }
  return null
}

/** Journal en grosses cases empilées (ordre chronologique, haut → bas) :
 *  image de l'action à gauche, texte à droite. Chaque case est teintée par la
 *  couleur du méchant qui agit ; les lignes neutres (début/fin de tour, victoire)
 *  restent centrées, sans icône. */

/** Fusionne « dévoile sa pioche et trouve **X**. » + « joue gratuitement **X** sur
 *  **Y**. » (même carte) en « trouve et joue gratuitement **X** sur **Y**. ». */
function simplifyDetails(input: string[]): string[] {
  // « **Abo** évolue en **Arbok** sur **Arène** ! » → « **Abo** → **Arbok** ».
  const details = input.map((d) =>
    d.replace(/^\*\*(.+?)\*\* évolue en \*\*(.+?)\*\* sur \*\*.+?\*\*\s*!?\.?$/, '**$1** → **$2**'),
  )
  const out: string[] = []
  for (let k = 0; k < details.length; k++) {
    const m1 = details[k].match(/^dévoile sa pioche et trouve (\*\*.+?\*\*)\s*\.?$/)
    const m2 = details[k + 1]?.match(/^joue gratuitement (\*\*.+?\*\*) sur (\*\*.+?\*\*)\s*\.?$/)
    if (m1 && m2 && m1[1] === m2[1]) {
      out.push(`trouve et joue gratuitement ${m2[1]} sur ${m2[2]}.`)
      k++ // on saute la 2ᵉ ligne, fusionnée
      continue
    }
    out.push(details[k])
  }
  return out
}

/** Rend UN bloc de journal (bannière neutre, pioche, Combattant, ou action) exactement
 *  comme dans le Journal de partie. Extrait de `GameLog` pour être réutilisable (aperçu
 *  « final » dans l'Atelier). `onPreview` remonte l'image survolée pour l'agrandir. */
export function LogBlockView({
  block,
  playerNames,
  playerColors,
  playerAvatars,
  playerBoards,
  playerGenders,
  playerArticles,
  playerVillains,
  fallbackIcon,
  onPreview,
}: {
  block: LogBlock
  playerNames: string[]
  playerColors?: string[]
  playerAvatars?: string[]
  playerBoards?: PlayerBoard[]
  playerGenders?: ('m' | 'f')[]
  playerArticles?: string[]
  playerVillains?: string[]
  /** Icône (nom de fichier `public/actions/`) à afficher si l'inférence par mots-clés ne
   *  déduit rien (aperçu Atelier : la prose custom ne matche pas toujours). Optionnel. */
  fallbackIcon?: string
  onPreview: (src: string | null) => void
}) {
  if (block.type === 'neutral') {
    return (
      <div className="flex flex-col gap-0.5 px-2 py-1">
        {block.lines.map((l, j) => (
          <p key={j} className="self-center text-center text-[10px] italic text-white/45">
            {renderRich(l)}
          </p>
        ))}
      </div>
    )
  }
  // Pioche → case à part, sans image (juste le texte, teinté par le vilain).
  if (block.type === 'draw') {
    const drawColor = playerColors?.[block.playerIndex]
    return (
      <div
        className="border-b border-l-4 border-b-white/10 px-2.5 py-2 text-[11px] leading-snug text-white/90"
        style={drawColor ? { borderLeftColor: drawColor, backgroundColor: `${drawColor}1f` } : undefined}
      >
        {renderRich(block.text)}
      </div>
    )
  }
  // Combattant révélé → bloc dédié : illustration encadrée par l'anneau décagonal
  // (Power.png) + message d'esprits/alignement. Teinté par la couleur du vilain.
  if (block.type === 'combattant') {
    const combColor = playerColors?.[block.playerIndex]
    const combImg = anyCardImageForName(block.cardName, playerVillains?.[block.playerIndex])
    return (
      <div
        className="flex items-center gap-2.5 border-b border-l-4 border-b-white/10 px-2.5 py-2 text-[11px] leading-snug text-white/90"
        style={combColor ? { borderLeftColor: combColor, backgroundColor: `${combColor}1f` } : undefined}
      >
        {/* Vignette : illustration du Combattant (rognée en rond) « primée » par l'anneau. */}
        <div className="relative h-11 w-11 shrink-0">
          {combImg ? (
            <img
              src={combImg}
              alt={block.cardName}
              title={block.cardName}
              onMouseEnter={() => onPreview(combImg)}
              onMouseLeave={() => onPreview(null)}
              className="absolute left-1/2 top-1/2 h-[74%] w-[74%] -translate-x-1/2 -translate-y-1/2 cursor-zoom-in rounded-full object-cover"
              style={{ objectPosition: 'center 22%' }}
              draggable={false}
            />
          ) : (
            <div className="absolute left-1/2 top-1/2 h-[74%] w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10" />
          )}
          <img
            src="/actions/combattant-ring.png"
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="font-semibold">{renderRich(`**${block.cardName}**`)}</div>
          <div className="mt-0.5 text-[10px] text-white/70">{renderRich(block.message)}</div>
        </div>
      </div>
    )
  }
  const { playerIndex: idx, details } = block
  let head = block.head
  let blockDetails = details
  let tag = false
  const color = playerColors?.[idx]
  // Fatalité → tête simplifiée « contre <Cible>. » (en tag, bold+italique) et
  // pronom (Il/Elle) à la place du nom dans les détails. Deux formulations du
  // moteur : « … contre <Cible> … » et « … d'office … chez <Cible>. ».
  let fateTarget: string | null = null
  const mContre = head.match(/^lance la fatalité contre (.+)$/i)
  const mChez = head.match(/^lance la fatalité .*\bchez (.+?)\s*\.?\s*$/i)
  if (mContre) {
    const rest = mContre[1]
    const cut = rest.search(/\s+\(| :/)
    fateTarget = (cut >= 0 ? rest.slice(0, cut) : rest).replace(/\.\s*$/, '').trim()
  } else if (mChez) {
    fateTarget = mChez[1].trim()
  }
  if (fateTarget) {
    const tIdx = playerNames.indexOf(fateTarget)
    head = `contre ${playerArticles?.[tIdx] ?? ''}${fateTarget}.`
    tag = true
    const pronoun = playerGenders?.[tIdx] === 'f' ? 'Elle' : 'Il'
    const re = new RegExp(`^${escapeRegExp(fateTarget)}\\b`)
    blockDetails = details.map((d) => d.replace(re, pronoun))
  }
  // Pastilles (couleur du méchant) : flottantes en haut à droite (coût, action
  // bonus) + une centrée verticalement (bonus de départ / total Pouvoir).
  const floatPills: string[] = []
  let centerPill: string | null = null
  // Entrée en jeu (setup) → avatar du vilain + pastille « +N JT » de départ.
  const enterGame = /^entre en jeu/i.test(head)
  const avatar = enterGame ? playerAvatars?.[idx] : undefined
  if (enterGame) {
    const b = head.match(/\((\d+)\s*JT de départ\)/i)?.[1]
    head = 'entre en jeu'
    if (b) centerPill = `+${b} JT`
  }
  // « déplace sa figurine et le <Carte> vers … » (ex. Bateau) → glyphe = haut de
  // la carte associée, et tête reformulée en simple « se déplace vers <Lieu> ».
  const boatName = block.head.match(/déplace sa figurine et le (.+?) vers /)?.[1]
  // Déplacement autonome d'un Héros (ex. Raiponce) : son illustration sert d'icône.
  const heroMoveImg = block.heroMove ? anyCardImageForName(block.heroMove, playerVillains?.[idx]) : undefined
  const cardCircle = block.keyImage ?? (boatName ? CARD_IMAGE_BY_NAME.get(boatName) : heroMoveImg)
  if (boatName) head = head.replace(/^déplace sa figurine et le .+? vers (\*\*.+?\*\*).*$/, 'se déplace vers $1')
  // Déplacement du pion → vignette du lieu de destination (au lieu de move-hero).
  const moveDest = !enterGame ? head.match(/^se déplace vers \*\*(.+?)\*\*/)?.[1] : undefined
  const board = playerBoards?.[idx]
  const moveCol = moveDest && board ? board.locations.indexOf(moveDest) : -1
  const locCrop = moveCol >= 0 && board ? locationCropStyle(board.image, moveCol, board.locations.length) : null
  // Icône déduite de la tête D'ORIGINE (la tête Fatalité simplifiée ne
  // contient plus « Fatalité »).
  const icon =
    enterGame || locCrop || cardCircle
      ? null
      : (actionIconFor(block.head) ??
        (block.forcedIcon ? { icon: block.forcedIcon } : fallbackIcon ? { icon: fallbackIcon } : null))
  // Action « Défausser » : « ×N » + vignettes des cartes (noms → images).
  const discardMatch = icon?.icon === 'discard' ? head.match(/^défausse (\d+) cartes?(?: \((.+)\))?\.?$/i) : null
  const discardCards = discardMatch?.[2]
    ? discardMatch[2].split(', ').map((nm) => ({ name: nm, image: cardImageForName(nm, playerVillains?.[idx]) }))
    : null
  // Gain de Pouvoir : on isole « (total : N) » → pastille centrée.
  const totalMatch = head.match(/^(.*?)\s*\(total\s*:\s*(\d+)\)\s*\.?$/)
  if (totalMatch) {
    head = totalMatch[1].replace(/\s*\.\s*$/, '')
    centerPill = `total ${totalMatch[2]}`
  }
  // Jouer une carte : « (coût N) » → pastille « coût N JT » flottante.
  const costMatch = head.match(/\(coût (\d+)\)/)
  if (costMatch) {
    head = head.replace(/\s*\(coût \d+\)/, '')
    floatPills.push(`coût ${costMatch[1]} JT`)
  }
  // Action de lieu accordée par un Objet (ex. Réacteur galactique) : marqueur
  // « (action bonus) » posé par le moteur → pastille « Action bonus ».
  const grantedBonus = /\(action bonus\)/.test(head)
  if (grantedBonus) head = head.replace(/\s*\(action bonus\)/, '')
  // Action bonus (accordée par une carte / un déplacement, ou action de lieu accordée).
  if (block.bonus || grantedBonus) floatPills.push('Action bonus')
  // Effet sur un Allié/Objet (déclenché par une carte) → pastille « effet Allié/Objet ».
  if (block.effect) floatPills.push(`effet ${block.effect}`)
  const pillStyle: CSSProperties | undefined = color
    ? { backgroundColor: `${color}40`, borderColor: `color-mix(in srgb, ${color}, white 40%)` }
    : undefined
  blockDetails = consolidateFighterDetails(simplifyDetails(blockDetails))
  return (
    <div
      className="flex items-center gap-2.5 border-b border-l-4 border-b-white/10 px-2.5 py-2 text-[11px] leading-snug text-white/90"
      style={color ? { borderLeftColor: color, backgroundColor: `${color}1f` } : undefined}
    >
      <ActionGlyph icon={icon} avatar={avatar} locCrop={locCrop} cardCircle={cardCircle} cardCircleZoom={block.heroMove ? '160%' : undefined} cardCirclePos={block.heroMove ? '62% top' : undefined} color={color} />
      <div className={`min-w-0 flex-1 ${floatPills.length ? '' : 'flex flex-col justify-center'}`}>
        {/* Pastilles flottantes en haut à droite (coût, action bonus) → le texte s'enroule dessous. */}
        {floatPills.map((p, j) => (
          <span
            key={j}
            className="float-right ml-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold text-white/90"
            style={pillStyle}
          >
            {p}
          </span>
        ))}
        {/* Pour la défausse, on n'affiche pas de texte de tête (juste les vignettes). */}
        {!discardCards && <div className={tag ? 'font-bold italic' : undefined}>{renderRich(head)}</div>}
        {discardCards && (
          <div className="flex gap-1">
            {discardCards.map((c, j) =>
              c.image ? (
                <img
                  key={j}
                  src={c.image}
                  alt={c.name}
                  title={c.name}
                  onMouseEnter={() => onPreview(c.image!)}
                  onMouseLeave={() => onPreview(null)}
                  className="h-auto w-[calc((100%-0.75rem)/4)] shrink-0 cursor-zoom-in rounded ring-1 ring-white/20 grayscale-[0.45] brightness-95"
                  draggable={false}
                />
              ) : (
                <span
                  key={j}
                  className="w-[calc((100%-0.75rem)/4)] shrink-0 truncate rounded bg-white/10 px-1.5 py-0.5 text-[10px]"
                  title={c.name}
                >
                  {c.name}
                </span>
              ),
            )}
          </div>
        )}
        {blockDetails.length > 0 && (
          <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-white/65">
            {blockDetails.map((d, j) => (
              <div key={j}>{renderRich(d)}</div>
            ))}
          </div>
        )}
      </div>
      {/* Pastille centrée à droite (teinte du méchant) : bonus de départ ou total Pouvoir. */}
      {centerPill && (
        <span
          className="ml-2 shrink-0 self-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold text-white/90"
          style={pillStyle}
        >
          {centerPill}
        </span>
      )}
    </div>
  )
}

export function GameLog({
  log,
  playerNames,
  playerColors,
  playerAvatars,
  playerBoards,
  playerGenders,
  playerArticles,
  playerVillains,
}: Props) {
  const osRef = useRef<OverlayScrollbarsComponentRef>(null)
  // Aperçu agrandi (image de carte) au survol d'une vignette — rendu en `fixed`
  // pour échapper à l'overflow du journal (sinon rogné par le scroll).
  const [preview, setPreview] = useState<string | null>(null)
  // Auto-défilement vers le bas (message le plus récent) — sur le viewport OS.
  useEffect(() => {
    const viewport = osRef.current?.osInstance()?.elements().viewport
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [log.length])

  const blocks = groupLog(log, playerNames)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <h2 className="shrink-0 px-3 py-2 text-xs font-semibold text-white/60">Journal</h2>
      <OverlayScrollbarsComponent
        ref={osRef}
        className="min-h-0 flex-1"
        defer
        options={{ scrollbars: { theme: 'os-theme-villain', autoHide: 'leave', autoHideDelay: 300 } }}
      >
        <div className="flex flex-col">
          {blocks.map((block, i) => (
            <LogBlockView
              key={i}
              block={block}
              playerNames={playerNames}
              playerColors={playerColors}
              playerAvatars={playerAvatars}
              playerBoards={playerBoards}
              playerGenders={playerGenders}
              playerArticles={playerArticles}
              playerVillains={playerVillains}
              onPreview={setPreview}
            />
          ))}
        </div>
      </OverlayScrollbarsComponent>
      {/* Aperçu agrandi de la carte survolée (centré, au-dessus de tout). */}
      {preview && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <img src={preview} alt="" className="max-h-[23vh] w-auto rounded-xl shadow-2xl ring-1 ring-white/20" />
        </div>
      )}
    </div>
  )
}

/** Visuel de gauche d'un bloc d'action : vignette de lieu, avatar, ou icône d'action
 *  (disque colorisé à la teinte du vilain + chiffre superposé pour le Pouvoir). */
function ActionGlyph({
  icon,
  avatar,
  locCrop,
  cardCircle,
  cardCircleZoom,
  cardCirclePos,
  color,
}: {
  icon: ActionIcon | null
  avatar?: string
  locCrop: CSSProperties | null
  cardCircle?: string
  /** Zoom du rognage rond (`background-size`) : défaut 140 % ; plus fort pour un Héros
   *  (déplacement autonome) afin de cadrer davantage sur son illustration. */
  cardCircleZoom?: string
  /** Position du fond (`background-position`) : défaut `center top`. */
  cardCirclePos?: string
  color?: string
}) {
  if (cardCircle) {
    // Carte associée (ex. Bateau qui suit la figurine) : haut de la carte rogné en rond.
    return (
      <div
        className="h-9 w-9 shrink-0 rounded-full ring-1 ring-white/20"
        style={{ backgroundImage: `url(${cardCircle})`, backgroundPosition: cardCirclePos ?? 'center top', backgroundSize: cardCircleZoom ?? '140%' }}
      />
    )
  }
  if (locCrop) {
    // Déplacement : vignette de l'illustration du lieu de destination.
    return <div className="h-9 w-9 shrink-0 overflow-hidden rounded" style={locCrop} />
  }
  if (avatar) {
    // Entrée en jeu : avatar du vilain dans un cercle au fond de sa couleur.
    return (
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full" style={color ? { backgroundColor: color } : undefined}>
        <img src={avatar} alt="" className="h-full w-full object-cover" draggable={false} />
      </div>
    )
  }
  if (!icon) return <div className="h-9 w-9 shrink-0" />
  return (
    <div className="relative h-9 w-9 shrink-0">
      {/* Disque de fond colorisé à la teinte du méchant (masque alpha du PNG
          « Fill these with any color you want #4 »). */}
      {color && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: color,
            maskImage: 'url(/actions/disc.png)',
            WebkitMaskImage: 'url(/actions/disc.png)',
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
          }}
        />
      )}
      <img src={`/actions/${icon.icon}.png`} alt="" className="relative h-9 w-9 opacity-90" draggable={false} />
      {/* « Gagner du Pouvoir » : chiffre (1/2/3) superposé sur l'octogone. */}
      {icon.badge && icon.badge >= 1 && icon.badge <= 3 && (
        <img
          src={`/actions/${icon.badge}.png`}
          alt={`${icon.badge}`}
          className={`absolute left-1/2 top-1/2 h-4 w-4 -translate-y-1/2 object-contain opacity-90 ${
            icon.badge === 1 ? '-translate-x-[58%]' : '-translate-x-1/2'
          }`}
          draggable={false}
        />
      )}
      {/* Montants ≥ 4 (Destin : +4 JT) : pas d'image dédiée → chiffre en texte doré. */}
      {icon.badge && icon.badge > 3 && (
        <span
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[13px] font-black leading-none text-amber-100"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
        >
          {icon.badge}
        </span>
      )}
    </div>
  )
}
