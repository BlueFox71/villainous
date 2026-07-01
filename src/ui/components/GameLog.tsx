import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import { OverlayScrollbarsComponent, type OverlayScrollbarsComponentRef } from 'overlayscrollbars-react'
import { COL_RECTS, LOC_IMG, BOARD_W, BOARD_H } from '../editor/boardLayout'
import { allCards } from '../../data/registry'

/** Index nom de carte → image (1ʳᵉ occurrence) : pour afficher les vignettes des
 *  cartes défaussées, dont le journal ne porte que les noms. */
const CARD_IMAGE_BY_NAME = new Map<string, string>()
for (const c of allCards) if (!CARD_IMAGE_BY_NAME.has(c.name)) CARD_IMAGE_BY_NAME.set(c.name, c.image)

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
        <img src="/cards/bowser/etoile.png" alt="Étoile" className="inline-block h-3.5 w-3.5 align-text-bottom" />
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
  if (/est déplacé\(e\)/.test(t)) return { icon: 'move-hero' }
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
/** Une ligne de `log` ouvre-t-elle un nouveau bloc (action top-level) ? Les autres
 *  lignes (effets de la carte, sous-choix…) se rattachent au bloc en cours. */
function isTopLevelAction(body: string): boolean {
  return (
    /^joue \*\*/.test(body) ||
    /^se déplace vers /.test(body) ||
    /^entre en jeu/i.test(body) ||
    /^lance la fatalité/i.test(body) ||
    /^active \*\*/.test(body) ||
    /^déplace /.test(body) ||
    /^défausse /.test(body) ||
    /^vainc/i.test(body) ||
    /^(?:gagne|commence avec|reçoit|récupère|regagne)\s+\d+\s*(?:jt\b|jetons?\s+pouvoir|pouvoir)/i.test(body)
  )
}

/** Bloc du journal : soit une bannière neutre isolée, soit une action (tête +
 *  lignes d'effet rattachées). */
type LogBlock =
  | { type: 'neutral'; lines: string[] }
  | { type: 'draw'; playerIndex: number; text: string }
  | {
      type: 'action'
      playerIndex: number
      head: string
      card?: string
      details: string[]
      bonus?: boolean
      effect?: 'Allié' | 'Objet'
    }

/** Échappe une chaîne pour l'insérer littéralement dans une RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Regroupe les lignes de `log` : chaque action top-level démarre un bloc ; les
 *  lignes suivantes (effets, attribuées ou non) lui sont rattachées en détail. */
function groupLog(log: string[], playerNames: string[]): LogBlock[] {
  const blocks: LogBlock[] = []
  let current: Extract<LogBlock, { type: 'action' }> | null = null
  // Une carte vient d'accorder une action « bonus » : la PROCHAINE action top-level
  // du même joueur est absorbée dans le bloc courant (au lieu d'ouvrir un nouveau).
  let absorbNext = false
  // Une carte a déclenché un effet sur un Allié/Objet : le PROCHAIN bloc (ex. déplacement
  // de l'Allié) est tagué « effet Allié »/« effet Objet ».
  let nextEffect: 'Allié' | 'Objet' | null = null
  for (const line of log) {
    // Lignes masquées : fin de tour, jet de dé, prompt « choisir l'Allié à faire évoluer ».
    if (/^fin du tour|jet de dé|choisissez l'Allié à faire évoluer/i.test(line)) continue
    const idx = playerNames.findIndex((n) => n && line.startsWith(n))
    const body = idx >= 0 ? line.slice(playerNames[idx].length).trim() || line : line
    // « pioche N cartes » → case à part, sans image (ne se rattache à aucun bloc).
    if (idx >= 0 && /^pioche \d+ cartes?/i.test(body)) {
      blocks.push({ type: 'draw', playerIndex: idx, text: body })
      current = null
      absorbNext = false
      nextEffect = null
      continue
    }
    // Déplacement d'un Héros (« **X** est déplacé(e) sur **Y** », non préfixé par le
    // vilain) → bloc À PART, avec l'icône move-hero (cf. actionIconFor).
    if (/est déplacé\(e\) sur /i.test(body)) {
      const pIdx: number = current?.playerIndex ?? (idx >= 0 ? idx : 0)
      current = { type: 'action', playerIndex: pIdx, head: body, details: [] }
      blocks.push(current)
      absorbNext = false
      continue
    }
    // Prompt « déplacez un Allié/Objet … » : masquée ; elle tague le PROCHAIN bloc
    // (le déplacement effectif) « effet Allié »/« effet Objet ».
    if (idx >= 0 && current) {
      if (/déplace[zr] un allié/i.test(body)) {
        nextEffect = 'Allié'
        continue
      }
      if (/déplace[zr] un objet/i.test(body)) {
        nextEffect = 'Objet'
        continue
      }
    }
    // Annonce « peut effectuer une action sur … » : masquée, mais elle arme
    // l'absorption de la prochaine action (l'action bonus) dans le bloc courant.
    if (idx >= 0 && current && /^peut effectuer une action sur/i.test(body)) {
      absorbNext = true
      current.bonus = true
      continue
    }
    const starter = idx >= 0 && isTopLevelAction(body)
    // Action bonus accordée → on la garde dans le même bloc que la carte jouée.
    if (starter && absorbNext && current && idx === current.playerIndex) {
      current.details.push(body)
      absorbNext = false
      continue
    }
    if (starter) {
      // Nom de la carte jouée (1er segment en gras de la tête) → retiré des détails.
      const card = body.match(/\*\*(.+?)\*\*/)?.[1]
      current = { type: 'action', playerIndex: idx, head: body, card, details: [] }
      // Effet Allié/Objet armé par une prompt précédente → tag du bloc.
      if (nextEffect) {
        current.effect = nextEffect
        nextEffect = null
      }
      blocks.push(current)
      // Tête contenant « une action disponible (hors Fatalité) » (ex. Bateau) → action bonus.
      if (/une action disponible \(hors fatalité\)/i.test(body)) {
        absorbNext = true
        current.bonus = true
      } else {
        absorbNext = false
      }
    } else if (current) {
      // Effet rattaché : on retire le préfixe de l'acteur, puis « <Carte> : » répété
      // (le nom de la carte figure déjà dans la tête du bloc).
      let d = idx === current.playerIndex ? body : line
      if (current.card) {
        const c = escapeRegExp(current.card)
        // Préfixe « <Carte> : » répété au début…
        d = d.replace(new RegExp(`^\\*{0,2}${c}\\*{0,2}\\s*:\\s*`), '')
        // …et attribution parenthétique « (<Carte>) » n'importe où dans la ligne.
        d = d.replace(new RegExp(`\\s*\\(${c}\\)`, 'g'), '')
      }
      current.details.push(d)
    } else {
      // Aucune action ouverte (début de partie, bannières) → ligne neutre isolée.
      const last = blocks[blocks.length - 1]
      if (last?.type === 'neutral') last.lines.push(line)
      else blocks.push({ type: 'neutral', lines: [line] })
    }
  }
  return blocks
}

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

export function GameLog({
  log,
  playerNames,
  playerColors,
  playerAvatars,
  playerBoards,
  playerGenders,
  playerArticles,
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
          {blocks.map((block, i) => {
            if (block.type === 'neutral') {
              return (
                <div key={i} className="flex flex-col gap-0.5 px-2 py-1">
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
                  key={i}
                  className="border-b border-l-4 border-b-white/10 px-2.5 py-2 text-[11px] leading-snug text-white/90"
                  style={drawColor ? { borderLeftColor: drawColor, backgroundColor: `${drawColor}1f` } : undefined}
                >
                  {renderRich(block.text)}
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
            const cardCircle = boatName ? CARD_IMAGE_BY_NAME.get(boatName) : undefined
            if (boatName) head = head.replace(/^déplace sa figurine et le .+? vers (\*\*.+?\*\*).*$/, 'se déplace vers $1')
            // Déplacement du pion → vignette du lieu de destination (au lieu de move-hero).
            const moveDest = !enterGame ? head.match(/^se déplace vers \*\*(.+?)\*\*/)?.[1] : undefined
            const board = playerBoards?.[idx]
            const moveCol = moveDest && board ? board.locations.indexOf(moveDest) : -1
            const locCrop = moveCol >= 0 && board ? locationCropStyle(board.image, moveCol, board.locations.length) : null
            // Icône déduite de la tête D'ORIGINE (la tête Fatalité simplifiée ne
            // contient plus « Fatalité »).
            const icon = enterGame || locCrop || cardCircle ? null : actionIconFor(block.head)
            // Action « Défausser » : « ×N » + vignettes des cartes (noms → images).
            const discardMatch = icon?.icon === 'discard' ? head.match(/^défausse (\d+) cartes?(?: \((.+)\))?\.?$/i) : null
            const discardCards = discardMatch?.[2]
              ? discardMatch[2].split(', ').map((nm) => ({ name: nm, image: CARD_IMAGE_BY_NAME.get(nm) }))
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
            blockDetails = simplifyDetails(blockDetails)
            return (
              <div
                key={i}
                className="flex items-center gap-2.5 border-b border-l-4 border-b-white/10 px-2.5 py-2 text-[11px] leading-snug text-white/90"
                style={color ? { borderLeftColor: color, backgroundColor: `${color}1f` } : undefined}
              >
                <ActionGlyph icon={icon} avatar={avatar} locCrop={locCrop} cardCircle={cardCircle} color={color} />
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
                            onMouseEnter={() => setPreview(c.image!)}
                            onMouseLeave={() => setPreview(null)}
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
          })}
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
  color,
}: {
  icon: ActionIcon | null
  avatar?: string
  locCrop: CSSProperties | null
  cardCircle?: string
  color?: string
}) {
  if (cardCircle) {
    // Carte associée (ex. Bateau qui suit la figurine) : haut de la carte rogné en rond.
    return (
      <div
        className="h-9 w-9 shrink-0 rounded-full ring-1 ring-white/20"
        style={{ backgroundImage: `url(${cardCircle})`, backgroundPosition: 'center top', backgroundSize: '140%' }}
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
    </div>
  )
}
