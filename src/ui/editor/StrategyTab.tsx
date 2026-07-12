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

  // « journal » reste éditable ; « coding »/« botPlay » sont en lecture seule + champs
  // « À modifier » ÉPHÉMÈRES (état local, perdus au changement d'onglet / rechargement).
  const editable = variant === 'journal'
  const [mods, setMods] = useState<Record<string, string>>({})
  const setMod = (key: string, v: string) => setMods((m) => ({ ...m, [key]: v }))

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
          {L.intro}{' '}
          {editable ? (
            <>Documentaire pour l’instant — tu peux <strong>copier</strong> le tout.</>
          ) : (
            <>
              Les champs sont en <strong>lecture seule</strong> : note tes corrections dans{' '}
              <strong className="text-red-400">« À modifier »</strong> puis <strong>copie-les</strong>{' '}
              pour les recoller à Claude Code.
            </>
          )}
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
                {editable ? (
                  <Field
                    label={L.villainLabel}
                    value={section.villainNotes?.[c.id] ?? UNDEVELOPED}
                    onChange={(v) => setVillainNote(c.id, v)}
                    placeholder={L.villainPlaceholder}
                  />
                ) : (
                  <ReviewField
                    label={L.villainLabel}
                    value={section.villainNotes?.[c.id] ?? UNDEVELOPED}
                    modifyValue={mods[`v:${c.id}`] ?? ''}
                    onModifyChange={(v) => setMod(`v:${c.id}`, v)}
                  />
                )}
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
                  {editable ? (
                    // « journal » : un seul champ éditable (message de journal).
                    <Field
                      label={L.villainLabel}
                      value={note.description ?? UNDEVELOPED}
                      onChange={(v) => setFateNote(c.id, { description: v })}
                      placeholder={L.villainPlaceholder}
                    />
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

/** Champ en LECTURE SEULE (« ancien input » = codage actuel, non éditable) suivi d'un
 *  champ « À modifier » (titre rouge) où saisir la correction souhaitée. Le contenu
 *  « À modifier » est ÉPHÉMÈRE (état local du parent). */
function ReviewField({
  label,
  value,
  modifyValue,
  onModifyChange,
}: {
  /** Libellé sémantique du champ (Description, etc.). Absent = titre porté par la section. */
  label?: string
  value: string
  modifyValue: string
  onModifyChange: (v: string) => void
}) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      {label && <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">{label}</span>}
      {/* Ancien input : codage actuel, non éditable. */}
      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/35">Ancien input</span>
      <div className="min-h-[2.25rem] whitespace-pre-wrap rounded-lg border border-white/10 bg-black/15 p-2 text-sm text-white/70">
        {value.trim() ? value : UNDEVELOPED}
      </div>
      {/* À modifier : titre rouge + saisie libre (éphémère, alimente le bouton Copier). */}
      <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">À modifier</span>
      <textarea
        value={modifyValue}
        onChange={(e) => onModifyChange(e.target.value)}
        placeholder="Décris la correction à apporter…"
        className="min-h-0 w-full resize-y rounded-lg border border-red-500/30 bg-black/25 p-2 text-sm text-white/90 outline-none transition focus:border-red-400/70"
      />
    </div>
  )
}

/** Bouton « Copier » : « journal » copie toute la section ; « coding »/« botPlay »
 *  copient les DEMANDES de modification (« À modifier » + contexte). */
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
    const text = variant === 'journal' ? buildStrategyText(draft, variant) : buildModifyText(draft, variant, mods)
    void navigator.clipboard.writeText(text)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300/70 hover:bg-amber-400/20"
    >
      {variant === 'journal' ? '📋 Copier' : '📋 Copier les modifs'}
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

/** Sérialise les DEMANDES de modification (« coding »/« botPlay ») : pour chaque champ
 *  ayant un « À modifier » non vide, exporte le nom de carte + le codage actuel (ancien)
 *  + la modif demandée. Prêt à recoller dans une session Claude Code. */
function buildModifyText(draft: CustomVillain, variant: StrategyVariant, mods: Record<string, string>): string {
  const strategy = draft.botStrategy ?? {}
  const L = VARIANTS[variant]
  const section: StrategySection =
    variant === 'coding'
      ? { general: strategy.howToWin, villainNotes: strategy.villainNotes, fateNotes: strategy.fateNotes }
      : (strategy.botPlay ?? {})

  const lines: string[] = [`# À modifier — ${L.title} — ${draft.name}`, '']
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
    vLines.push(`- Codage actuel : ${section.villainNotes?.[c.id]?.trim() || UNDEVELOPED}`)
    vLines.push(`- À modifier : ${m}`)
  }
  if (vLines.length > 0) lines.push('## Deck Vilain', ...vLines, '')

  // Deck Fatalité (plusieurs sous-champs ; « adverse qui attaque » seulement en botPlay).
  const fateFields: { key: keyof FateStrategyNote; label: string }[] =
    variant === 'botPlay'
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
    const note = section.fateNotes?.[c.id] ?? {}
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
