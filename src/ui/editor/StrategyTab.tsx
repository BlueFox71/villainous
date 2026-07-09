// Onglets stratégie de l'Atelier — DEUX variants, même affichage (cartes + inputs) :
//   - « coding »   → onglet « Codage Cartes » : comment CHAQUE carte est codée (ce que
//     Claude Code a compris au développement) — pour vérifier / corriger le codage.
//   - « botPlay »  → onglet « Bot adverse »   : comment le BOT adverse joue chaque carte
//     (priorités, cibles, timing) — pour comprendre / corriger son comportement.
//
// Purement DOCUMENTAIRE pour l'instant (affichage + copie ; l'IA ne les consomme pas
// encore). Persisté dans `draft.botStrategy` : le volet « coding » utilise les champs à
// plat (howToWin/villainNotes/fateNotes), le volet « botPlay » son sous-objet dédié.
//
// Les onglets ne sont accessibles QUE lorsque le vilain est développé (cf.
// `isVillainDeveloped` + gating dans VillainEditor). Les champs sont PRÉREMPLIS ; ceux
// non rédigés affichent « Non développé ».
import type {
  CustomVillain,
  CustomCard,
  BotStrategy,
  StrategySection,
  FateStrategyNote,
} from '../../data/customVillain'
import { FATE_CARD_COLOR } from '../../data/customVillain'
import { CardPreview } from './CardPreview'

/** Texte affiché (et copié) quand une consigne n'a pas été rédigée. */
const UNDEVELOPED = 'Non développé'

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
  patch,
  variant,
}: {
  draft: CustomVillain
  patch: (p: Partial<CustomVillain>) => void
  variant: StrategyVariant
}) {
  const strategy = draft.botStrategy ?? {}
  const L = VARIANTS[variant]
  const villain = draft.cards.filter((c) => c.deck === 'villain' && !c.group)
  const fate = draft.cards.filter((c) => c.deck === 'fate' && !c.group)

  // Vue unifiée de la section active (le volet « coding » vit à plat ; « botPlay » et
  // « journal » dans leur sous-objet) + écriture au bon endroit.
  const section: StrategySection =
    variant === 'coding'
      ? { general: strategy.howToWin, villainNotes: strategy.villainNotes, fateNotes: strategy.fateNotes }
      : variant === 'botPlay'
        ? (strategy.botPlay ?? {})
        : (strategy.journal ?? {})

  const setSection = (next: StrategySection) => {
    const patched: BotStrategy =
      variant === 'coding'
        ? {
            ...strategy,
            howToWin: next.general,
            villainNotes: next.villainNotes,
            fateNotes: next.fateNotes,
          }
        : variant === 'botPlay'
          ? { ...strategy, botPlay: next }
          : { ...strategy, journal: next }
    patch({ botStrategy: patched })
  }

  const setGeneral = (general: string) => setSection({ ...section, general })
  const setVillainNote = (id: string, value: string) =>
    setSection({ ...section, villainNotes: { ...(section.villainNotes ?? {}), [id]: value } })
  const setFateNote = (id: string, p: Partial<FateStrategyNote>) =>
    setSection({
      ...section,
      fateNotes: {
        ...(section.fateNotes ?? {}),
        [id]: { ...(section.fateNotes?.[id] ?? {}), ...p },
      },
    })

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-3xl text-sm text-white/55">
          {L.intro} Documentaire pour l’instant — tu peux <strong>copier</strong> le tout.
        </p>
        <CopyButton draft={draft} variant={variant} />
      </div>

      {/* --- Texte général (variants avec objectif / ligne de conduite) ------- */}
      {L.hasGeneral && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">
            {L.generalTitle}
          </h3>
          <textarea
            value={section.general ?? UNDEVELOPED}
            onChange={(e) => setGeneral(e.target.value)}
            rows={4}
            placeholder={L.generalPlaceholder}
            className="w-full resize-y rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white/90 outline-none transition focus:border-amber-300/60"
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
                <Field
                  label={L.villainLabel}
                  value={section.villainNotes?.[c.id] ?? UNDEVELOPED}
                  onChange={(v) => setVillainNote(c.id, v)}
                  placeholder={L.villainPlaceholder}
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
              const note = section.fateNotes?.[c.id] ?? {}
              return (
                <CardRow key={c.id} card={c} color={draft.color} fate keywordColors={draft.keywordColors}>
                  <Field
                    label={L.fateSingle ? L.villainLabel : 'Description'}
                    value={note.description ?? UNDEVELOPED}
                    onChange={(v) => setFateNote(c.id, { description: v })}
                    placeholder={L.fateSingle ? L.villainPlaceholder : 'Ce que fait la carte…'}
                  />
                  {!L.fateSingle && (
                    <>
                      <Field
                        label="En tant que joueur qui reçoit cette carte"
                        value={note.asReceiver ?? UNDEVELOPED}
                        onChange={(v) => setFateNote(c.id, { asReceiver: v })}
                        placeholder="Comment réagir quand on subit cette Fatalité…"
                      />
                      <Field
                        label="En tant qu’adverse qui attaque"
                        value={note.asAttacker ?? UNDEVELOPED}
                        onChange={(v) => setFateNote(c.id, { asAttacker: v })}
                        placeholder="Quand / sur qui infliger cette Fatalité…"
                      />
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

/** Un champ libellé + textarea multiligne (au-delà de 255 caractères). */
function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-0 w-full flex-1 resize-y rounded-lg border border-white/10 bg-black/25 p-2 text-sm text-white/90 outline-none transition focus:border-amber-300/60"
      />
    </label>
  )
}

/** Bouton « Copier » : assemble un texte lisible de la section active et le met dans
 *  le presse-papiers. */
function CopyButton({ draft, variant }: { draft: CustomVillain; variant: StrategyVariant }) {
  const copy = () => {
    void navigator.clipboard.writeText(buildStrategyText(draft, variant))
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300/70 hover:bg-amber-400/20"
    >
      📋 Copier
    </button>
  )
}

/** Sérialise la section active en texte brut lisible (pour le presse-papiers). */
function buildStrategyText(draft: CustomVillain, variant: StrategyVariant): string {
  const strategy = draft.botStrategy ?? {}
  const L = VARIANTS[variant]
  const section: StrategySection =
    variant === 'coding'
      ? { general: strategy.howToWin, villainNotes: strategy.villainNotes, fateNotes: strategy.fateNotes }
      : variant === 'botPlay'
        ? (strategy.botPlay ?? {})
        : (strategy.journal ?? {})

  const lines: string[] = [`# ${L.title} — ${draft.name}`, '']
  if (L.hasGeneral) lines.push(`## ${L.generalTitle}`, section.general?.trim() || UNDEVELOPED, '')

  const villain = draft.cards.filter((c) => c.deck === 'villain' && !c.group)
  if (villain.length > 0) {
    lines.push('## Deck Vilain')
    for (const c of villain) {
      const note = section.villainNotes?.[c.id]?.trim()
      lines.push(`- ${c.name} : ${note || UNDEVELOPED}`)
    }
    lines.push('')
  }

  const fate = draft.cards.filter((c) => c.deck === 'fate' && !c.group)
  if (fate.length > 0) {
    lines.push('## Deck Fatalité')
    for (const c of fate) {
      const note = section.fateNotes?.[c.id] ?? {}
      if (L.fateSingle) {
        lines.push(`- ${c.name} : ${note.description?.trim() || UNDEVELOPED}`)
      } else {
        lines.push(`### ${c.name}`)
        lines.push(`- Description : ${note.description?.trim() || UNDEVELOPED}`)
        lines.push(`- En tant que joueur qui reçoit : ${note.asReceiver?.trim() || UNDEVELOPED}`)
        lines.push(`- En tant qu'adverse qui attaque : ${note.asAttacker?.trim() || UNDEVELOPED}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}
