// Onglets stratégie de l'Atelier — TROIS variants :
//   - « coding »   → onglet « Codage Cartes » : comment CHAQUE carte est codée (ce que
//     Claude Code a compris au développement) — pour vérifier / demander des corrections.
//   - « botPlay »  → onglet « Bot adverse »   : comment le BOT adverse joue chaque carte
//     (priorités, cibles, timing) — pour comprendre / demander des corrections.
//   - « journal »  → onglet « Journal »       : message écrit quand la carte est jouée.
//
// « coding » + « botPlay » sont en LECTURE SEULE (le codage vient de Claude Code) : chaque
// champ affiche l'« ancien input » (non éditable) et, en dessous, un champ « À modifier »
// (titre rouge, ÉPHÉMÈRE — non persisté) pour noter la correction souhaitée. Le bouton
// « Copier » exporte ces demandes (nom de carte + codage actuel + modif) à recoller dans
// une session Claude Code. « journal » reste ÉDITABLE et persisté dans `draft.botStrategy`.
//
// Les onglets ne sont accessibles QUE lorsque le vilain est développé (cf.
// `isVillainDeveloped` + gating dans VillainEditor). Les champs sont PRÉREMPLIS ; ceux
// non rédigés affichent « Non développé ».
import { useState } from 'react'
import type {
  CustomVillain,
  CustomCard,
  StrategySection,
  FateStrategyNote,
} from '../../data/customVillain'
import { FATE_CARD_COLOR } from '../../data/customVillain'
import { CardPreview } from './CardPreview'
import { LogBlockView, type LogBlock } from '../components/GameLog'
import { fillJournal, type JournalCtx } from '../../engine/journalTemplate'

/** Texte affiché (et copié) quand une consigne n'a pas été rédigée. */
const UNDEVELOPED = 'Non développé'

/** Clé d'indexation des notes de stratégie/journal : l'id de la carte de BASE. Pour une
 *  variante (skin), les cartes ont un id propre mais `botStrategy` reste indexé par l'id de
 *  base → on retombe sur `baseCardId`. Pour un vilain de base, `baseCardId` est absent = `id`. */
const noteKey = (c: CustomCard): string => c.baseCardId ?? c.id

/** Quelle facette de la stratégie l'onglet édite. */
export type StrategyVariant = 'coding' | 'botPlay' | 'journal'

/** Libellés + options d'affichage propres à chaque variant. */
const VARIANTS: Record<
  StrategyVariant,
  {
    title: string
    intro: React.ReactNode
    generalTitle: string
    generalPlaceholder: string
    villainLabel: string
    villainPlaceholder: string
    /** Affiche la zone de texte GÉNÉRALE en tête (objectif / ligne de conduite). */
    hasGeneral: boolean
    /** Cartes Fatalité : un SEUL champ (au lieu de description + reçu + attaque). */
    fateSingle: boolean
  }
> = {
  coding: {
    title: 'Codage Cartes',
    intro: (
      <>
        Comment chaque carte est <strong>codée</strong> : les champs sont préremplis avec ce que
        Claude Code a compris au développement ; corrige-les au besoin (survole une carte pour
        l’agrandir et relire sa règle).
      </>
    ),
    generalTitle: 'Comment atteindre son objectif',
    generalPlaceholder: 'Décris le plan de jeu du bot pour remplir sa condition de victoire…',
    villainLabel: 'Description',
    villainPlaceholder: 'Ce que fait la carte / ses conditions de jeu…',
    hasGeneral: true,
    fateSingle: false,
  },
  botPlay: {
    title: 'Bot adverse',
    intro: (
      <>
        Comment le <strong>bot adverse joue</strong> chaque carte (priorités, cibles, timing) —
        pour comprendre et corriger son comportement.
      </>
    ),
    generalTitle: 'Comment le bot joue globalement',
    generalPlaceholder: 'Décris la ligne de conduite générale du bot…',
    villainLabel: 'Comment le bot joue cette carte',
    villainPlaceholder: 'Quand / pourquoi le bot joue cette carte…',
    hasGeneral: true,
    fateSingle: false,
  },
  journal: {
    title: 'Journal',
    intro: (
      <>
        Ce qui sera écrit dans le <strong>Journal de partie</strong> quand chaque carte est jouée
        (un message par carte).
      </>
    ),
    generalTitle: '',
    generalPlaceholder: '',
    villainLabel: 'Message de journal',
    villainPlaceholder: 'Ex. « Le Flagelleur place un Tunnel de Hawkins. »',
    hasGeneral: false,
    fateSingle: true,
  },
}

export function StrategyTab({
  draft,
  variant,
}: {
  draft: CustomVillain
  variant: StrategyVariant
}) {
  const strategy = draft.botStrategy ?? {}
  const L = VARIANTS[variant]
  const villain = draft.cards.filter((c) => c.deck === 'villain' && !c.group)
  const fate = draft.cards.filter((c) => c.deck === 'fate' && !c.group)

  // Les TROIS variants sont désormais en LECTURE SEULE : chaque champ affiche l'« ancien
  // input » (non éditable) + un champ « À modifier » ÉPHÉMÈRE (état local, perdu au
  // changement d'onglet), copiable via « Copier les modifs » pour le recoller à Claude Code.
  const [mods, setMods] = useState<Record<string, string>>({})
  const setMod = (key: string, v: string) => setMods((m) => ({ ...m, [key]: v }))

  // Vue unifiée de la section active (le volet « coding » vit à plat ; « botPlay » et
  // « journal » dans leur sous-objet).
  const section: StrategySection =
    variant === 'coding'
      ? { general: strategy.howToWin, villainNotes: strategy.villainNotes, fateNotes: strategy.fateNotes }
      : variant === 'botPlay'
        ? (strategy.botPlay ?? {})
        : (strategy.journal ?? {})

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-3xl text-sm text-white/55">
          {L.intro}{' '}
          <>
            Les champs sont en <strong>lecture seule</strong> : note tes corrections dans{' '}
            <strong className="text-red-400">« À modifier »</strong> puis <strong>copie-les</strong>{' '}
            pour les recoller à Claude Code.
          </>
        </p>
        <CopyButton draft={draft} variant={variant} mods={mods} />
      </div>

      {/* --- Texte général (variants avec objectif / ligne de conduite) ------- */}
      {L.hasGeneral && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">
            {L.generalTitle}
          </h3>
          <ReviewField
            value={section.general ?? UNDEVELOPED}
            modifyValue={mods['general'] ?? ''}
            onModifyChange={(v) => setMod('general', v)}
          />
        </section>
      )}

      {/* --- Deck Vilain ------------------------------------------------------ */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">Deck Vilain</h3>
        {villain.length === 0 ? (
          <p className="text-xs text-white/40">Aucune carte Vilain : ajoute-en dans l’onglet « Cartes ».</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {villain.map((c, i) => (
              <CardRow key={c.id} card={c} color={draft.color} keywordColors={draft.keywordColors} tooltipBelow={i < 4}>
                {variant === 'journal' && (
                  <JournalPreview draft={draft} card={c} message={section.villainNotes?.[noteKey(c)] ?? ''} />
                )}
                <ReviewField
                  label={L.villainLabel}
                  value={section.villainNotes?.[noteKey(c)] ?? UNDEVELOPED}
                  modifyValue={mods[`v:${c.id}`] ?? ''}
                  onModifyChange={(v) => setMod(`v:${c.id}`, v)}
                  hideOld={variant === 'journal'}
                  prefillActions={variant === 'journal'}
                />
              </CardRow>
            ))}
          </div>
        )}
      </section>

      {/* --- Deck Fatalité ---------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">Deck Fatalité</h3>
        {fate.length === 0 ? (
          <p className="text-xs text-white/40">Aucune carte Fatalité : ajoute-en dans l’onglet « Cartes ».</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {fate.map((c) => {
              const note = section.fateNotes?.[noteKey(c)] ?? {}
              return (
                <CardRow key={c.id} card={c} color={draft.color} fate keywordColors={draft.keywordColors}>
                  {variant === 'journal' ? (
                    // « journal » : un SEUL champ (message de journal) + aperçu « final ».
                    <>
                      <JournalPreview draft={draft} card={c} message={note.description ?? ''} fate />
                      <ReviewField
                        label={L.villainLabel}
                        value={note.description ?? UNDEVELOPED}
                        modifyValue={mods[`f:${c.id}:description`] ?? ''}
                        onModifyChange={(v) => setMod(`f:${c.id}:description`, v)}
                        hideOld
                        prefillActions
                      />
                    </>
                  ) : (
                    <>
                      <ReviewField
                        label="Description"
                        value={note.description ?? UNDEVELOPED}
                        modifyValue={mods[`f:${c.id}:description`] ?? ''}
                        onModifyChange={(v) => setMod(`f:${c.id}:description`, v)}
                      />
                      <ReviewField
                        label="En tant que joueur qui reçoit cette carte"
                        value={note.asReceiver ?? UNDEVELOPED}
                        modifyValue={mods[`f:${c.id}:asReceiver`] ?? ''}
                        onModifyChange={(v) => setMod(`f:${c.id}:asReceiver`, v)}
                      />
                      {/* « En tant qu'adverse qui attaque » : conservé UNIQUEMENT sur
                          « Bot adverse » (retiré de « Codage Cartes » — sans intérêt). */}
                      {variant === 'botPlay' && (
                        <ReviewField
                          label="En tant qu’adverse qui attaque"
                          value={note.asAttacker ?? UNDEVELOPED}
                          modifyValue={mods[`f:${c.id}:asAttacker`] ?? ''}
                          onModifyChange={(v) => setMod(`f:${c.id}:asAttacker`, v)}
                        />
                      )}
                    </>
                  )}
                </CardRow>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

/** Une cellule : titre = nom de carte, vignette + champs, tooltip agrandi au survol. */
function CardRow({
  card,
  color,
  fate = false,
  keywordColors = [],
  tooltipBelow = false,
  children,
}: {
  card: CustomCard
  color: string
  fate?: boolean
  keywordColors?: { label: string; color: string }[]
  /** Affiche le tooltip SOUS la vignette (1re ligne, faute de place au-dessus). */
  tooltipBelow?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="group relative flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
      {/* Titre de la cellule = nom de la carte. */}
      <h4 className="truncate text-sm font-semibold text-white/85" title={card.name}>
        {card.name}
      </h4>
      <div className="flex gap-4">
        <div className="w-24 shrink-0">
          <CardPreview
            card={card}
            color={fate ? FATE_CARD_COLOR : color}
            fateColor={FATE_CARD_COLOR}
            keywordColors={keywordColors}
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">{children}</div>
      </div>
      {/* Tooltip : aperçu agrandi flottant au survol, ancré sur toute la cellule
          (aligné sur la vignette). Sous la cellule pour la 1re ligne (pas de place
          au-dessus), au-dessus pour le reste. */}
      <div
        className={`pointer-events-none absolute left-3 z-50 w-72 opacity-0 shadow-2xl transition-opacity duration-150 group-hover:opacity-100 ${
          tooltipBelow ? 'top-full mt-2' : 'bottom-full mb-2'
        }`}
      >
        <CardPreview
          card={card}
          color={fate ? FATE_CARD_COLOR : color}
          fateColor={FATE_CARD_COLOR}
          keywordColors={keywordColors}
        />
      </div>
    </div>
  )
}

/** Icône par défaut (fallback) d'un bloc de journal quand l'inférence par mots-clés ne
 *  trouve rien : Fatalité → `fate` ; carte Vilain jouée → `play-card` (ce que montre le vrai
 *  Journal quand on « joue » une carte). Garantit qu'une icône s'affiche toujours. */
function fallbackIconFor(fate: boolean): string {
  return fate ? 'fate' : 'play-card'
}

/** Valeurs d'EXEMPLE injectées dans les placeholders pour l'aperçu de l'Atelier (le vrai
 *  Journal en partie utilise les valeurs réelles). Doit couvrir les clés de `buildJournalCtx`
 *  + celles exposées par les effets (`journalVars`). `nomVilain` est renseigné dynamiquement. */
const EXAMPLE_JOURNAL_CTX: JournalCtx = {
  NbEspritMoi: 4,
  NbEspritAdv: 3,
  NbJT: 2,
  nbAlliés: 2,
  nomAdv: 'Adversaire',
  nomHéros: 'Onze',
  nomAllié: 'Démogorgon',
  nomObjet: 'Batte de baseball',
  nomCombattant: 'Kirby',
  nomLieu: 'le Laboratoire',
  nomCible: 'Mike Wheeler',
}

/** Aperçu « final » d'un message de journal : le rend dans le VISUEL exact d'un (ou plusieurs)
 *  bloc(s) du Journal de partie (bordure teintée à la couleur du vilain, icône d'action, gras
 *  sur les **noms**), via `LogBlockView`. Chaque LIGNE du message = UN bloc : une carte à choix
 *  peut ainsi montrer chaque conséquence (une ligne d'exemple par issue). Vide → invite. */
function JournalPreview({
  draft,
  card,
  message,
  fate = false,
}: {
  draft: CustomVillain
  card: CustomCard
  message: string
  fate?: boolean
}) {
  const [preview, setPreview] = useState<string | null>(null)
  // Une ligne non vide = un bloc (issues d'un choix, effets successifs…).
  const heads = message
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (heads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 px-2.5 py-2 text-[10px] italic text-white/35">
        Aperçu du bloc — {card.name} n’a pas encore de message.
      </div>
    )
  }
  // Placeholders remplis par des valeurs d'EXEMPLE (aperçu) : {nomVilain} = ce vilain.
  const exampleCtx: JournalCtx = { ...EXAMPLE_JOURNAL_CTX, nomVilain: draft.name }
  // Emoji d'esprit selon le CAMP du vilain (skin Lumière Killaire → ☀️, sinon 🌑) : le template
  // est authoré avec 🌑 sur la base ; on l'adapte comme le fait le moteur en partie.
  const campCamp = draft.spiritCamp ?? (draft.objective.type === 'SPIRIT_THRESHOLD' ? draft.objective.camp : 'moon')
  const campEmoji = campCamp === 'sun' ? '☀️' : '🌑'
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
        Aperçu Journal (valeurs d’exemple){heads.length > 1 ? ` · ${heads.length} issues` : ''}
      </span>
      <div className="flex flex-col gap-1.5">
        {heads.map((raw, i) => {
          const head = fillJournal(raw, exampleCtx).replace(/🌑/g, campEmoji)
          const block: LogBlock = {
            type: 'action',
            playerIndex: 0,
            head,
            card: head.match(/\*\*(.+?)\*\*/)?.[1],
            details: [],
          }
          return (
            <div key={i} className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
              <LogBlockView
                block={block}
                playerNames={[draft.name]}
                // Teinte du bloc = couleur de RECOUVREMENT (comme en partie, cf. `coverColorOf`),
                // à défaut la couleur du méchant. Vaut pour les blocs Vilain ET Fatalité.
                playerColors={[draft.coverColor || draft.color]}
                playerAvatars={draft.portrait ? [draft.portrait] : undefined}
                playerVillains={[draft.id]}
                fallbackIcon={fallbackIconFor(fate)}
                onPreview={setPreview}
              />
            </div>
          )
        })}
      </div>
      {/* Aperçu agrandi d'une éventuelle vignette survolée (centré, au-dessus de tout). */}
      {preview && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <img src={preview} alt="" className="max-h-[23vh] w-auto rounded-xl shadow-2xl ring-1 ring-white/20" />
        </div>
      )}
    </div>
  )
}

/** Champ en LECTURE SEULE (« ancien input » = codage actuel, non éditable) suivi d'un
 *  champ « À modifier » (titre rouge) où saisir la correction souhaitée. Le contenu
 *  « À modifier » est ÉPHÉMÈRE (état local du parent). */
function ReviewField({
  label,
  value,
  modifyValue,
  onModifyChange,
  hideOld = false,
  prefillActions = false,
}: {
  /** Libellé sémantique du champ (Description, etc.). Absent = titre porté par la section. */
  label?: string
  value: string
  modifyValue: string
  onModifyChange: (v: string) => void
  /** Masque le bloc « Ancien input » (journal : l'aperçu final le rend déjà redondant). */
  hideOld?: boolean
  /** Ajoute les boutons « 📋 Journal » (préremplit « À modifier » avec le message actuel)
   *  et « 🧹 Vider » sous le champ (journal : pour partir du message existant). */
  prefillActions?: boolean
}) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      {label && <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">{label}</span>}
      {/* Ancien input : codage actuel, non éditable. */}
      {!hideOld && (
        <>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/35">Ancien input</span>
          <div className="min-h-[2.25rem] whitespace-pre-wrap rounded-lg border border-white/10 bg-black/15 p-2 text-sm text-white/70">
            {value.trim() ? value : UNDEVELOPED}
          </div>
        </>
      )}
      {/* À modifier : titre rouge + saisie libre (éphémère, alimente le bouton Copier). */}
      <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">À modifier</span>
      <textarea
        value={modifyValue}
        onChange={(e) => onModifyChange(e.target.value)}
        placeholder="Décris la correction à apporter…"
        className="min-h-0 w-full resize-y rounded-lg border border-red-500/30 bg-black/25 p-2 text-sm text-white/90 outline-none transition focus:border-red-400/70"
      />
      {prefillActions && (
        <div className="flex gap-1.5">
          {/* Recopie le message de journal actuel dans « À modifier » (base à retoucher). */}
          <button
            type="button"
            onClick={() => onModifyChange(value.trim() ? value : '')}
            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/10"
          >
            📋 Journal
          </button>
          {/* Vide le champ « À modifier ». */}
          <button
            type="button"
            onClick={() => onModifyChange('')}
            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/60 transition hover:border-white/30 hover:bg-white/10"
          >
            🧹 Vider
          </button>
        </div>
      )}
    </div>
  )
}

/** Bouton « Copier les modifs » : pour chaque variant, copie les DEMANDES de modification
 *  (« À modifier » + contexte), prêtes à recoller dans une session Claude Code. */
function CopyButton({
  draft,
  variant,
  mods,
}: {
  draft: CustomVillain
  variant: StrategyVariant
  mods: Record<string, string>
}) {
  const copy = () => {
    void navigator.clipboard.writeText(buildModifyText(draft, variant, mods))
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300/70 hover:bg-amber-400/20"
    >
      📋 Copier les modifs
    </button>
  )
}

/** Rappel des règles du système « Journal data-driven » + catalogue de placeholders, embarqué
 *  dans le copier/coller du volet Journal pour rendre la demande auto-suffisante côté Claude
 *  Code (source de vérité : CLAUDE.md § « Journal de partie »). */
const JOURNAL_DEV_GUIDE = [
  '## Contexte — Système « Journal data-driven » (cf. CLAUDE.md § Journal)',
  'Le message de Journal d’une carte vit dans `botStrategy.journal` (injecté sur `CardInstance.journal`',
  'par `toCardDefs`) et REMPLACE en partie le log codé en dur. Émission : `applyJournalTemplate`',
  '(engine/actions.ts) sur PLAY_CARD / PLAY_CONDITION / RESOLVE_FATE / Choc des Titans / émission',
  'différée (`pendingJournal`, effets interactifs). Rendu `GameLog` : bloc teinté couleur de',
  'recouvrement ; `fillJournal` remplace `{clé}` (clé inconnue laissée telle quelle).',
  '',
  'Écriture : forme PRÉDICAT (pas de nom de vilain), JAMAIS « (Force x) » sur un Héros, écrire 🌑',
  '(adapté au camp automatiquement), multi-lignes = issues d’un choix.',
  '',
  'Placeholders disponibles :',
  '- génériques (aucun câblage) : {NbEspritMoi} {NbEspritAdv} {NbJT} {nomVilain} {nomAdv}',
  '- via l’action : {nomLieu} (action.to) · {nomHéros} (action.targetHeroId)',
  '- via l’hôte (Objet associé) : {nomHéros}/{nomAllié} selon le type de l’hôte',
  '- via `journalVars` (effet) : {nomHéros} {nomObjet} {nomAllié} {nomCombattant} {nomCible} {nbAlliés}',
  '- différés (choix interactif) : {nomCarte} · {nomHéros}+{nomLieu} · {nomAllié}/{nomObjet}',
  '',
  'Nouveau placeholder = exposer `journalVars: { ...state.journalVars, ["clé"]: valeur }` dans le',
  'handler d’effet (ou le handler de RÉSOLUTION du pending si l’effet est interactif). Reste',
  'GÉNÉRIQUE (jamais par `cardId`).',
].join('\n')

/** Sérialise les DEMANDES de modification (les trois variants) : pour chaque champ
 *  ayant un « À modifier » non vide, exporte le nom de carte + le codage actuel (ancien)
 *  + la modif demandée. Prêt à recoller dans une session Claude Code. */
function buildModifyText(draft: CustomVillain, variant: StrategyVariant, mods: Record<string, string>): string {
  const strategy = draft.botStrategy ?? {}
  const L = VARIANTS[variant]
  const section: StrategySection =
    variant === 'coding'
      ? { general: strategy.howToWin, villainNotes: strategy.villainNotes, fateNotes: strategy.fateNotes }
      : variant === 'botPlay'
        ? (strategy.botPlay ?? {})
        : (strategy.journal ?? {})

  const lines: string[] = [`# À modifier — ${L.title} — ${draft.name}`, '']
  // Journal : on embarque un rappel des RÈGLES + le catalogue de placeholders, pour que le
  // copier/coller soit auto-suffisant dans une session Claude Code (cf. CLAUDE.md § Journal).
  if (variant === 'journal') lines.push(JOURNAL_DEV_GUIDE, '')
  let any = false

  // Texte général.
  const gMod = mods['general']?.trim()
  if (L.hasGeneral && gMod) {
    any = true
    lines.push(`## ${L.generalTitle}`)
    lines.push(`- Actuel : ${section.general?.trim() || UNDEVELOPED}`)
    lines.push(`- À modifier : ${gMod}`, '')
  }

  // Deck Vilain (une note par carte).
  const villain = draft.cards.filter((c) => c.deck === 'villain' && !c.group)
  const vLines: string[] = []
  for (const c of villain) {
    const m = mods[`v:${c.id}`]?.trim()
    if (!m) continue
    any = true
    vLines.push(`### ${c.name}`)
    vLines.push(`- Codage actuel : ${section.villainNotes?.[noteKey(c)]?.trim() || UNDEVELOPED}`)
    vLines.push(`- À modifier : ${m}`)
  }
  if (vLines.length > 0) lines.push('## Deck Vilain', ...vLines, '')

  // Deck Fatalité : « journal » n'a qu'un champ (message) ; « botPlay » a les trois ;
  // « coding » a description + reçu.
  const fateFields: { key: keyof FateStrategyNote; label: string }[] = L.fateSingle
    ? [{ key: 'description', label: L.villainLabel }]
    : variant === 'botPlay'
      ? [
          { key: 'description', label: 'Description' },
          { key: 'asReceiver', label: 'En tant que joueur qui reçoit' },
          { key: 'asAttacker', label: "En tant qu'adverse qui attaque" },
        ]
      : [
          { key: 'description', label: 'Description' },
          { key: 'asReceiver', label: 'En tant que joueur qui reçoit' },
        ]
  const fate = draft.cards.filter((c) => c.deck === 'fate' && !c.group)
  const fLines: string[] = []
  for (const c of fate) {
    const note = section.fateNotes?.[noteKey(c)] ?? {}
    const parts: string[] = []
    for (const f of fateFields) {
      const m = mods[`f:${c.id}:${f.key}`]?.trim()
      if (!m) continue
      parts.push(`- ${f.label}`)
      parts.push(`  · actuel : ${note[f.key]?.trim() || UNDEVELOPED}`)
      parts.push(`  · à modifier : ${m}`)
    }
    if (parts.length > 0) {
      any = true
      fLines.push(`### ${c.name}`, ...parts)
    }
  }
  if (fLines.length > 0) lines.push('## Deck Fatalité', ...fLines, '')

  if (!any) lines.push('_Aucune modification demandée._')
  return lines.join('\n')
}
