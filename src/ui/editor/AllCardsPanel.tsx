// Panneau de RÉFÉRENCE affiché à droite de l'onglet « Cartes » : toutes les cartes de
// tous les vilains (natifs + publiés), groupées par vilain dans l'ordre de sortie. But
// = s'inspirer des cartes existantes en concevant les siennes. Lecture seule : un clic
// agrandit la carte, rien n'est modifié dans le vilain en cours.
import { useEffect, useMemo, useState } from 'react'
import type { CardDef } from '../../data/types'
import { VILLAIN_REGISTRY, UNRELEASED_VILLAINS } from '../store/gameStore'
import { useCustomVillainStore } from '../store/customVillainStore'
import { toCardDefs } from '../../data/customVillain'
import { byRelease } from '../villainOrder'

/** Un vilain de la référence : sa clé, son nom affiché et ses cartes (tous paquets). */
interface VillainCards {
  key: string
  name: string
  cards: CardDef[]
}

export function AllCardsPanel({ excludeId }: { excludeId?: string }) {
  const loaded = useCustomVillainStore((s) => s.loaded)
  const load = useCustomVillainStore((s) => s.load)
  const customVillains = useCustomVillainStore((s) => s.villains)
  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  // Natifs (hors non sortis) triés par ordre de sortie, puis vilains publiés (custom-…).
  // On exclut le vilain en cours d'édition (déjà éditable à gauche).
  const villains = useMemo<VillainCards[]>(() => {
    const reg = VILLAIN_REGISTRY as Record<string, { def: { name: string }; cards: CardDef[]; label?: string }>
    const natives = Object.keys(reg)
      .filter((k) => k !== excludeId && !(UNRELEASED_VILLAINS as string[]).includes(k))
      .sort(byRelease)
      .map((k) => ({
        key: k,
        name: reg[k].label ?? reg[k].def.name,
        cards: reg[k].cards,
      }))
    const customs = customVillains
      .filter((v) => v.id !== excludeId)
      .map((v) => ({ key: v.id, name: v.name, cards: toCardDefs(v) }))
    return [...natives, ...customs]
  }, [customVillains, excludeId])

  const [openKey, setOpenKey] = useState<string | null>(null) // section dépliée (une à la fois)
  const [zoom, setZoom] = useState<CardDef | null>(null)
  const [filter, setFilter] = useState('')

  const q = filter.trim().toLowerCase()
  const shown = q ? villains.filter((v) => v.name.toLowerCase().includes(q)) : villains

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-200/70">
          Toutes les cartes
        </span>
        <span className="text-[11px] text-white/35">{villains.length} vilains</span>
      </div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrer un vilain…"
        className="rounded-lg border border-white/15 bg-black/30 px-2.5 py-1.5 text-xs text-white outline-none transition focus:border-amber-300/70"
      />
      <p className="text-[11px] text-white/40">Référence seule — clique une carte pour l’agrandir.</p>

      {/* Carte agrandie : COLLANTE en bas de l'écran (fixe) → toujours visible. */}
      {zoom && (
        <div className="fixed bottom-3 right-3 z-50 flex w-[22rem] max-w-[calc(100vw-1.5rem)] flex-col items-center gap-2 rounded-lg border border-amber-300/30 bg-[#1a1620] p-3 shadow-2xl">
          <div className="flex w-full items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold text-amber-200/80">{zoom.name}</span>
            <button
              type="button"
              onClick={() => setZoom(null)}
              className="shrink-0 rounded px-1.5 text-sm text-white/50 transition hover:text-white"
              title="Fermer"
            >
              ✕
            </button>
          </div>
          {zoom.image && (
            <img src={zoom.image} alt={zoom.name} className="max-h-[75vh] w-auto max-w-full rounded-xl shadow-2xl" />
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        {shown.map((v) => {
          const open = openKey === v.key
          return (
            <div key={v.key} className="rounded-lg border border-white/10 bg-black/20">
              <button
                type="button"
                onClick={() => setOpenKey(open ? null : v.key)}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-sm font-semibold text-white/85 transition hover:text-amber-200"
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-white/40">{open ? '▾' : '▸'}</span>
                  {v.name}
                </span>
                <span className="text-[11px] font-normal text-white/35">{v.cards.length}</span>
              </button>
              {open && (
                <div className="grid grid-cols-3 gap-1.5 p-2 pt-0">
                  {v.cards.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setZoom(c)}
                      title={c.name}
                      className="block overflow-hidden rounded border border-transparent transition hover:border-amber-300/70"
                    >
                      {c.image ? (
                        <img
                          src={c.image}
                          alt={c.name}
                          loading="lazy"
                          className="aspect-[1440/2044] w-full object-cover"
                        />
                      ) : (
                        <span className="flex aspect-[1440/2044] w-full items-center justify-center bg-black/40 p-1 text-center text-[9px] text-white/50">
                          {c.name}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {shown.length === 0 && (
          <p className="px-1 py-2 text-[11px] text-white/35">Aucun vilain ne correspond.</p>
        )}
      </div>
    </div>
  )
}
