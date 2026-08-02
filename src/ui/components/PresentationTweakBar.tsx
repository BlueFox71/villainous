import { useState, type ReactNode } from 'react'
import { villainEntry } from '../store/gameStore'
import { buildArtTweakEntry, savedArtTweak, type ArtTweakDraft } from '../villainArt'

/**
 * Barre de réglage (DÉV) de l'illustration de présentation d'un vilain, telle qu'elle
 * se dresse à côté de son camp sur l'écran de choix des vilains. On y choisit un vilain
 * et on ajuste sa taille et sa position ; l'aperçu est immédiat (le parent applique le
 * brouillon à l'illustration de gauche), et « Enregistrer » réécrit `PRESENTATION_TWEAK`
 * dans `src/ui/villainArt.ts` via l'endpoint de dév `/__save-presentation-tweak`.
 *
 * Ce qu'on règle ici ne vaut que pour CET écran (champs `select…`) : la fiche du vilain et
 * l'écran « versus » gardent leur propre cadrage, à retoucher à la main dans `villainArt.ts`.
 *
 * Réservée au serveur de dév : le parent la masque hors de celui-ci (`!isDesktopApp`),
 * et l'endpoint n'existe pas dans le build de production.
 */

/** Un curseur + sa valeur chiffrée (les trois réglages ont la même présentation). */
function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  suffix = '',
  onChange,
}: {
  label: string
  hint: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (v: number) => void
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2" title={hint}>
      <span className="w-20 shrink-0 text-right text-[11px] font-bold uppercase tracking-wide text-emerald-200/80">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 accent-emerald-400"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 shrink-0 rounded border border-white/15 bg-black/40 px-1.5 py-0.5 text-right text-xs tabular-nums text-white"
      />
      <span className="w-3 shrink-0 text-xs text-white/40">{suffix}</span>
    </label>
  )
}

export function PresentationTweakBar({
  keys,
  villain,
  draft,
  onVillainChange,
  onDraftChange,
  leftSlot,
}: {
  /** Vilains proposés au réglage (mêmes clés que la grille, sans « Aléatoire »). */
  keys: string[]
  /** Vilain en cours de réglage (aperçu à gauche). */
  villain: string
  draft: ArtTweakDraft
  onVillainChange: (key: string) => void
  onDraftChange: (draft: ArtTweakDraft) => void
  /**
   * Outils de dév SUPPLÉMENTAIRES, posés tout à gauche de la barre. « Configuration » sert
   * de tiroir commun aux outils de l'écran (ex. aperçu de l'écran de chargement) : ils y
   * sont rangés plutôt que d'encombrer le choix des vilains.
   */
  leftSlot?: ReactNode
}) {
  const [msg, setMsg] = useState<string | null>(null)

  const options = keys
    .map((k) => ({ key: k, name: villainEntry(k)?.def.name ?? k }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  const saved = savedArtTweak(villain)
  const dirty =
    draft.scale !== saved.scale ||
    draft.dx !== saved.dx ||
    draft.dy !== saved.dy ||
    draft.mirror !== saved.mirror

  const set = (patch: Partial<ArtTweakDraft>) => { setMsg(null); onDraftChange({ ...draft, ...patch }) }

  const save = async () => {
    setMsg('Enregistrement…')
    try {
      const res = await fetch('/__save-presentation-tweak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ villain, entry: buildArtTweakEntry(villain, draft) }),
      })
      setMsg(res.ok ? '✓ Enregistré dans villainArt.ts' : `Échec : ${await res.text()}`)
    } catch {
      setMsg('Erreur réseau (serveur de dév requis).')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-emerald-400/30 bg-emerald-950/40 px-3 py-2">
      {leftSlot}
      <label className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-200/80">Vilain</span>
        <select
          value={villain}
          onChange={(e) => { setMsg(null); onVillainChange(e.target.value) }}
          className="max-w-56 rounded border border-white/15 bg-black/50 px-2 py-1 text-sm text-white"
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>{o.name}</option>
          ))}
        </select>
      </label>

      {/* Les trois réglages. L'aperçu se fait sur l'illustration de GAUCHE. */}
      <div className="flex min-w-[36rem] flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        <Slider
          label="Taille" hint="Échelle de l'illustration (1 = taille naturelle)"
          value={draft.scale} min={0.2} max={2} step={0.01}
          onChange={(v) => set({ scale: v })}
        />
        <Slider
          label="Horizontal" hint="Décalage vers le centre de l'écran (négatif = vers le bord)"
          value={draft.dx} min={-60} max={60} step={1} suffix="%"
          onChange={(v) => set({ dx: v })}
        />
        <Slider
          label="Vertical" hint="Décalage vertical (négatif = vers le haut)"
          value={draft.dy} min={-60} max={60} step={1} suffix="%"
          onChange={(v) => set({ dy: v })}
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Inverse le sens de l'illustration : par défaut le vilain de gauche s'affiche
            tel quel et celui de droite est retourné, pour qu'ils se fassent face. */}
        <button
          type="button"
          onClick={() => set({ mirror: !draft.mirror })}
          title="Retourner l'illustration (le personnage regarde de l'autre côté)"
          aria-pressed={draft.mirror}
          className={`rounded-lg border px-2.5 py-1 text-xs transition ${
            draft.mirror
              ? 'border-emerald-300/70 bg-emerald-500/35 font-bold text-white'
              : 'border-white/20 text-white/80 hover:bg-white/10'
          }`}
        >
          ⇄ Miroir
        </button>
        <button
          type="button"
          onClick={() => { setMsg(null); onDraftChange(saved) }}
          disabled={!dirty}
          className="rounded-lg border border-white/20 px-2.5 py-1 text-xs text-white/80 enabled:hover:bg-white/10 disabled:opacity-40"
        >
          Réinitialiser
        </button>
        <button
          type="button"
          onClick={() => { void save() }}
          className="rounded-lg border border-emerald-400/50 bg-emerald-500/25 px-3 py-1 text-xs font-bold text-emerald-100 hover:bg-emerald-500/40"
        >
          Enregistrer
        </button>
        {msg && <span className="text-xs text-emerald-200/90">{msg}</span>}
      </div>
    </div>
  )
}
