// =============================================================================
// Journal de partie — DÉCOUPAGE des lignes de log en BLOCS (pur, testable).
// Le rendu visuel des blocs vit dans GameLog.tsx (composants React).
// =============================================================================

import { JOURNAL_TAG_RE } from '../../engine/journalTemplate'
import { isFighterOutcomeLine, isFighterPromptLine } from './gameLogFighters'

/** Une ligne de `log` ouvre-t-elle un nouveau bloc (action top-level) ? Les autres
 *  lignes (effets de la carte, sous-choix…) se rattachent au bloc en cours. */
function isTopLevelAction(body: string): boolean {
  return (
    /^joue \*\*/.test(body) ||
    /^se déplace vers /.test(body) ||
    /^entre en jeu/i.test(body) ||
    /^lance la fatalité/i.test(body) ||
    // « active **X** » et ses formes avec article « active le/la/les/l' **X** »
    // (Canon Géant, Sceptre Serpent, Montre à gousset…) : chaque activation = bloc.
    /^active (?:le |la |les |l'|\*\*)/i.test(body) ||
    /^déplace /.test(body) ||
    /^défausse /.test(body) ||
    /^vainc/i.test(body) ||
    // Action « Vaincre » loguée « élimine **Héros** (alliés : …) » (Tabbou & co.) :
    // bloc à part. Le suffixe « (alliés : » l'isole des éliminations de SOUS-effet
    // de cartes (Sonde Bio, Apparence de Dragon…), qui restent rattachées à leur bloc.
    /^élimine \*\*.*\(alliés\s*:/i.test(body) ||
    /^(?:gagne|commence avec|reçoit|récupère|regagne)\s+\d+\s*(?:jt\b|jetons?\s+pouvoir|pouvoir)/i.test(body)
  )
}

/** Bloc du journal : soit une bannière neutre isolée, soit une action (tête +
 *  lignes d'effet rattachées). */
export type LogBlock =
  | { type: 'neutral'; lines: string[] }
  | { type: 'draw'; playerIndex: number; text: string }
  // Sumbra / Kilaire — un Combattant révélé (revenu / carte) : bloc à part, illustration
  // encadrée par l'anneau décagonal + le message d'esprits/alignement.
  | { type: 'combattant'; playerIndex: number; cardName: string; message: string }
  | {
      type: 'action'
      playerIndex: number
      head: string
      card?: string
      details: string[]
      bonus?: boolean
      effect?: 'Allié' | 'Objet'
      /** Icône imposée (journal data-driven, `⟦ji:…⟧`) : repli si l'inférence par mots-clés
       *  ne trouve rien sur le texte freeform du template. */
      forcedIcon?: string
      /** Déplacement AUTONOME d'un Héros (« <Héros> se déplace vers <Lieu> », ex. Raiponce) :
       *  nom du Héros → son illustration sert d'icône d'action (cf. `ActionGlyph`). */
      heroMove?: string
      /** Le Seigneur des clés — bloc « clé » : le jeton de la couleur concernée sert
       *  d'illustration (chemin d'image). */
      keyImage?: string
    }

/** Couleur de clé (Le Seigneur des clés) mentionnée dans une ligne de journal, normalisée
 *  sur les ids de `KeyColor` — le texte accorde au féminin (« une clé bleue »). */
function keyColorIn(text: string): string | null {
  const m = /\bclés? (rouges?|bleues?|bleus?|vertes?|verts?|jaunes?|violettes?|violets?|oranges?|noires?|noirs?)\b/i.exec(text)
  if (!m) return null
  const w = m[1].toLowerCase().replace(/s$/, '')
  const base: Record<string, string> = { rouge: 'rouge', bleue: 'bleu', bleu: 'bleu', verte: 'vert', vert: 'vert', jaune: 'jaune', violette: 'violet', violet: 'violet', orange: 'orange', noire: 'noire', noir: 'noire' }
  return base[w] ?? null
}

/** Jeton de clé (détouré) servant d'illustration au bloc de journal. */
function keyTokenImage(color: string): string {
  return `/cards/seigneur-cles/cle-${color}.webp`
}

/** Échappe une chaîne pour l'insérer littéralement dans une RegExp. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Regroupe les lignes de `log` : chaque action top-level démarre un bloc ; les
 *  lignes suivantes (effets, attribuées ou non) lui sont rattachées en détail.
 *  Exporté pour les tests. */
export function groupLog(log: string[], playerNames: string[]): LogBlock[] {
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
    // L'Imposteur — déplacement des Coéquipiers (« Les Coéquipiers de X se déplacent. »)
    // et le Conduit qui suit : événement AUTONOME, pas rattaché à l'action/Fatalité
    // précédente. On coupe le bloc courant → ces lignes forment un bloc neutre à part.
    if (/^les coéquipiers de .+ (?:se déplacent|ne se déplacent pas)/i.test(line)) {
      current = null
      absorbNext = false
      nextEffect = null
    }
    const idx = playerNames.findIndex((n) => n && line.startsWith(n))
    const body = idx >= 0 ? line.slice(playerNames[idx].length).trim() || line : line
    // Tabbou — prompts UI de Combattants (dévoilez… / choisissez une couleur… / Coup Fatal) :
    // bruit, masqués (le résumé est porté par les lignes de résultat qui suivent).
    if (idx >= 0 && isFighterPromptLine(body)) continue
    // Journal data-driven (`⟦ji:<icon>⟧<texte>`) : message authoré d'une carte. TOUJOURS un
    // bloc top-level à part (le texte freeform ne matche pas le regroupement par mots-clés) ;
    // on retire le marqueur et on retient l'icône imposée.
    if (idx >= 0) {
      const jm = JOURNAL_TAG_RE.exec(body)
      if (jm) {
        const jhead = jm[2]
        current = {
          type: 'action',
          playerIndex: idx,
          head: jhead,
          card: jhead.match(/\*\*(.+?)\*\*/)?.[1],
          details: [],
          forcedIcon: jm[1] || undefined,
        }
        blocks.push(current)
        absorbNext = false
        nextEffect = null
        continue
      }
    }
    // Tabbou — dévoilement/mise à mort d'un Combattant : rattaché en détail à la carte
    // jouée en cours (Primides/Collection/Flèche/Coup Fatal → tête « joue … »), sinon
    // (action « Dévoiler » de l'Émissaire) → bloc dédié à part.
    if (idx >= 0 && isFighterOutcomeLine(body)) {
      if (current && idx === current.playerIndex && /^joue /i.test(current.head)) {
        current.details.push(body)
      } else {
        current = { type: 'action', playerIndex: idx, head: body, details: [] }
        blocks.push(current)
        absorbNext = false
        nextEffect = null
      }
      continue
    }
    // « pioche N cartes » → case à part, sans image (ne se rattache à aucun bloc).
    if (idx >= 0 && /^pioche \d+ cartes?/i.test(body)) {
      blocks.push({ type: 'draw', playerIndex: idx, text: body })
      current = null
      absorbNext = false
      nextEffect = null
      continue
    }
    // Sumbra / Kilaire — révélation d'un Combattant (« révèle **X** : 🌑/☀️ ±N esprit(s) · … »).
    // Chaque Combattant = un bloc À PART (illustration encadrée par l'anneau décagonal), jamais
    // rattaché à l'action en cours. Le « … esprit(s) … » lève l'ambiguïté avec les autres « révèle ».
    if (idx >= 0) {
      const rev = body.match(/^révèle \*\*(.+?)\*\* : (.*esprits?.*?)\.?$/)
      if (rev) {
        blocks.push({ type: 'combattant', playerIndex: idx, cardName: rev[1], message: rev[2] })
        current = null
        absorbNext = false
        nextEffect = null
        continue
      }
    }
    // Déplacement d'un Héros (« **X** rejoint **Y** », non préfixé par le vilain) → bloc
    // À PART, avec l'icône move-hero (cf. actionIconFor).
    if (/est déplacé\(e\) sur /i.test(body) || /^\*\*.+?\*\* rejoint \*\*/.test(body)) {
      const pIdx: number = current?.playerIndex ?? (idx >= 0 ? idx : 0)
      current = { type: 'action', playerIndex: pIdx, head: body, details: [] }
      blocks.push(current)
      absorbNext = false
      continue
    }
    // Le Seigneur des clés — une CLÉ ramassée / reposée / volée fait son PROPRE bloc, avec
    // le jeton de clé en illustration : ces lignes (jet du dé de couleur puis ramassage)
    // se rattachaient au bloc précédent (« gagne 3 JT »), où l'action passait inaperçue.
    const keyColor = keyColorIn(line)
    if (keyColor && (/^Dé\s*:/i.test(line) || (idx >= 0 && /^(ramasse|repose|reprend) une clé/i.test(body)))) {
      const pIdx: number = idx >= 0 ? idx : playerNames.findIndex((n) => n && line.includes(n))
      const owner: number = pIdx >= 0 ? pIdx : (current?.playerIndex ?? 0)
      // Le ramassage qui SUIT le jet de dé complète le bloc au lieu d'en ouvrir un second.
      if (current?.keyImage && current.playerIndex === owner) {
        current.details.push(idx >= 0 ? body : line)
      } else {
        current = {
          type: 'action',
          playerIndex: owner,
          head: idx >= 0 ? body : line,
          details: [],
          keyImage: keyTokenImage(keyColor),
        }
        blocks.push(current)
      }
      absorbNext = false
      nextEffect = null
      continue
    }
    // Déplacement AUTONOME d'un Héros non préfixé par un vilain (« Raiponce se déplace vers
    // **X** », « **Maximus** se déplace vers **X** ») → bloc À PART, l'illustration du Héros
    // servant d'icône (résolue dans `LogBlockView`). Le sujet peut être en gras ou non.
    const heroMove = idx < 0 ? /^\*{0,2}(.+?)\*{0,2} se déplace vers \*\*.+?\*\*/.exec(body) : null
    if (heroMove) {
      const pIdx: number = current?.playerIndex ?? 0
      current = { type: 'action', playerIndex: pIdx, head: body, details: [], heroMove: heroMove[1].trim() }
      blocks.push(current)
      absorbNext = false
      nextEffect = null
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
      // Deux-points résiduel : le préfixe « <Vilain> : » a laissé un « : » en tête
      // une fois le nom de l'acteur retiré (ex. « : prochain déplacement… »).
      d = d.replace(/^:\s*/, '')
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
