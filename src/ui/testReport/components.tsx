// =============================================================================
// Rapport des tests — composants primitifs PARTAGÉS (page + modale de fin de partie).
// Fichier N'EXPORTANT QUE des composants (Fast Refresh). Le modèle/persistance vit
// dans model.ts.
// =============================================================================

import { useState } from 'react'
import { plural } from '../../engine/plural'
import { RATINGS, ratingsForSide, SIDE_LABEL, type Side, type SideEntry } from './model'

/** Compteur « parties testées » : − valeur + (borné à 0). */
export function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.max(0, n))
  return (
    <span className="inline-flex items-center overflow-hidden rounded border border-white/20 bg-white/5">
      <button type="button" onClick={() => set(value - 1)} className="px-1.5 py-0.5 text-white/70 hover:bg-white/10">
        −
      </button>
      <input
        value={value}
        inputMode="numeric"
        onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); set(Number.isNaN(n) ? 0 : n) }}
        className="w-8 bg-transparent text-center text-white/90 outline-none"
      />
      <button type="button" onClick={() => set(value + 1)} className="px-1.5 py-0.5 text-white/70 hover:bg-white/10">
        +
      </button>
    </span>
  )
}

/** Un côté (Joueur ou Bot) éditable : appréciation colorée + nombre de parties + journal + commentaire. */
export function SidePanel({ side, entry, onPatch }: { side: Side; entry: SideEntry; onPatch: (patch: Partial<SideEntry>) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-amber-200/80">{SIDE_LABEL[side]}</span>
      <div className="flex flex-wrap gap-1">
        {ratingsForSide(side).map((r) => {
          const on = r.key === entry.rating
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onPatch({ rating: r.key })}
              className="rounded-full border px-2 py-0.5 text-[11px] font-semibold transition"
              style={on
                ? { backgroundColor: r.color, borderColor: r.color, color: '#fff' }
                : { borderColor: `${r.color}66`, color: r.color, backgroundColor: `${r.color}1a` }}
            >
              {r.label}
            </button>
          )
        })}
      </div>
      <span className="flex items-center gap-2 text-[11px] text-white/60">
        Parties testées
        <Stepper value={entry.games} onChange={(games) => onPatch({ games })} />
      </span>
      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-white/60">
        <input
          type="checkbox"
          checked={entry.journalChecked}
          onChange={(e) => onPatch({ journalChecked: e.target.checked })}
          className="h-3.5 w-3.5 accent-emerald-500"
        />
        Journal vérifié
      </label>
      <input
        type="text"
        value={entry.comment}
        onChange={(e) => onPatch({ comment: e.target.value })}
        placeholder="Commentaire…"
        className="w-full rounded border border-white/15 bg-black/30 px-2 py-1 text-xs text-white/90 placeholder:text-white/30"
      />
    </div>
  )
}

/** Un côté (Joueur ou Bot) en LECTURE SEULE : seul le radio sélectionné est affiché ; les
 *  champs (parties / journal / commentaire) deviennent du texte, masqués s'ils sont vides. */
export function ReadOnlySidePanel({ title, entry }: { title: string; entry: SideEntry }) {
  const rating = RATINGS.find((r) => r.key === entry.rating) ?? RATINGS[0]
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-amber-200/80">{title}</span>
      <div className="flex flex-wrap gap-1">
        <span
          className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: rating.color, borderColor: rating.color, color: '#fff' }}
        >
          {rating.label}
        </span>
      </div>
      {entry.games > 0 && (
        <span className="text-[11px] text-white/60">
          {entry.games} {plural(entry.games, 'partie')} {plural(entry.games, 'testée')}
        </span>
      )}
      {entry.journalChecked && <span className="text-[11px] font-semibold text-emerald-300">✓ Journal vérifié</span>}
      {entry.comment.trim() !== '' && (
        <p className="whitespace-pre-wrap rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/80">
          {entry.comment}
        </p>
      )}
    </div>
  )
}

/** Bascule un chemin d'image raster vers son équivalent `.webp` (conserve un éventuel `?v=…`). */
const toWebp = (url: string): string => url.replace(/\.(png|jpe?g)(\?|$)/i, '.webp$2')

/**
 * Portrait carré du vilain, avec repli « ? » si l'image manque ou ne charge pas.
 * Certains vilains custom gardent en local (IndexedDB) un chemin périmé en `.png`/`.jpg`
 * alors que les fichiers ont migré en `.webp` : si l'image échoue, on réessaie en `.webp`
 * avant d'abandonner. `size` = classe de largeur Tailwind (ex. `w-28`).
 */
export function Portrait({ src, name, size = 'w-28' }: { src: string; name: string; size?: string }) {
  const [st, setSt] = useState({ origin: src, current: src, broken: false })
  if (st.origin !== src) setSt({ origin: src, current: src, broken: false })
  const onError = () => {
    const webp = toWebp(st.current)
    if (webp !== st.current) setSt((s) => ({ ...s, current: webp }))
    else setSt((s) => ({ ...s, broken: true }))
  }
  if (!src || st.broken) {
    return (
      <div className={`flex ${size} aspect-square items-center justify-center rounded-lg border border-white/25 bg-black/30 text-3xl text-white/40`}>
        ?
      </div>
    )
  }
  return <img src={st.current} alt={name} onError={onError} className={`${size} aspect-square rounded-lg border border-white/25 object-cover`} />
}
