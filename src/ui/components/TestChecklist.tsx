import { useMemo, useState } from 'react'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { VILLAIN_COLOR } from '../villainColors'
import { Scroller } from './Scroller'

// =============================================================================
// TestChecklist — suivi de test « carte par carte » (MODE TEST uniquement).
//
// Deux colonnes : « À tester » (gauche) et « Validés » (droite). Clic sur une
// carte = bascule d'une colonne à l'autre. L'ensemble des cartes validées est
// PERSISTÉ en localStorage : il survit au rechargement de la page et à la
// fermeture de l'onglet. Autonome : ne dépend pas de l'état de jeu.
// =============================================================================

const LS_KEY = 'villainous:test:validated'
const LS_COLLAPSED = 'villainous:test:checklist-collapsed'

interface CatalogCard {
  id: string
  name: string
  image: string
  deck: 'villain' | 'fate'
  type: string
  villainId: string
  villainKey: VillainKey
  villainLabel: string
}

/** Catalogue figé : toutes les cartes de tous les vilains du registre. */
const CATALOG: CatalogCard[] = (Object.entries(VILLAIN_REGISTRY) as [VillainKey, (typeof VILLAIN_REGISTRY)[VillainKey]][])
  .flatMap(([key, { def, cards, label }]) =>
    cards.map((c) => ({
      id: c.id,
      name: c.name,
      image: c.image,
      deck: c.deck,
      type: c.type,
      villainId: def.id,
      villainKey: key,
      villainLabel: label,
    })),
  )

const VILLAIN_ORDER = (Object.keys(VILLAIN_REGISTRY) as VillainKey[])

/** Libellé FR court du type de carte (affiché à côté de chaque carte). */
const TYPE_LABEL: Record<string, string> = {
  ally: 'Allié',
  item: 'Objet',
  effect: 'Événement',
  condition: 'Condition',
  hero: 'Héros',
  curse: 'Malédiction',
}

function loadValidated(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(LS_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === 'string')) : new Set()
  } catch {
    return new Set()
  }
}
function saveValidated(s: Set<string>) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...s]))
  } catch {
    /* quota / mode privé : on ignore */
  }
}
function loadCollapsed(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(LS_COLLAPSED) === '1'
}

/** Carte cliquable (chip) avec pastille de couleur du vilain + indicateur de paquet. */
function CardChip({
  card,
  onClick,
  onHover,
  done,
}: {
  card: CatalogCard
  onClick: () => void
  onHover: (c: CatalogCard | null, rect?: DOMRect) => void
  done: boolean
}) {
  const color = VILLAIN_COLOR[card.villainId] ?? '#666'
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => onHover(card, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => onHover(null)}
      title={card.name}
      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] text-white/85 hover:bg-white/10"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <span className="shrink-0 text-[8px] uppercase tracking-wide text-white/40">
        {card.deck === 'fate' ? 'F' : 'V'}
      </span>
      <span className="min-w-0 truncate">{card.name}</span>
      <span className="ml-auto shrink-0 rounded bg-white/10 px-1 text-[8px] uppercase tracking-wide text-white/45">
        {TYPE_LABEL[card.type] ?? card.type}
      </span>
      <span className="shrink-0 text-white/30">{done ? '↩' : '✓'}</span>
    </button>
  )
}

export function TestChecklist() {
  const [validated, setValidated] = useState<Set<string>>(loadValidated)
  const [query, setQuery] = useState('')
  // Filtre par méchant (null = tous).
  const [villainFilter, setVillainFilter] = useState<VillainKey | null>(null)
  const [hovered, setHovered] = useState<{ card: CatalogCard; rect: DOMRect } | null>(null)
  const [collapsed, setCollapsed] = useState(loadCollapsed)

  const handleHover = (c: CatalogCard | null, rect?: DOMRect) =>
    setHovered(c && rect ? { card: c, rect } : null)

  const toggle = (id: string) =>
    setValidated((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveValidated(next)
      return next
    })

  const setCollapsedPersist = (v: boolean) => {
    setCollapsed(v)
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_COLLAPSED, v ? '1' : '0')
  }

  const q = query.trim().toLowerCase()
  const { toTest, done } = useMemo(() => {
    // Match sur le nom de la carte OU le nom du vilain : saisir « maléfique »
    // sort toutes les cartes de Maléfique.
    const match = (c: CatalogCard) =>
      (villainFilter === null || c.villainKey === villainFilter) &&
      (q === '' || c.name.toLowerCase().includes(q) || c.villainLabel.toLowerCase().includes(q))
    return {
      toTest: CATALOG.filter((c) => !validated.has(c.id) && match(c)),
      done: CATALOG.filter((c) => validated.has(c.id) && match(c)),
    }
  }, [validated, q, villainFilter])

  /** Rend une liste groupée par vilain. */
  const renderColumn = (cards: CatalogCard[], areDone: boolean) => (
    <Scroller className="max-h-72 pr-1">
      {VILLAIN_ORDER.map((vk) => {
        const group = cards.filter((c) => c.villainKey === vk)
        if (group.length === 0) return null
        return (
          <div key={vk} className="mb-1">
            <div className="sticky top-0 bg-[#15131f] px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/40">
              {VILLAIN_REGISTRY[vk].label}
            </div>
            {group.map((c) => (
              <CardChip key={c.id} card={c} done={areDone} onHover={handleHover} onClick={() => toggle(c.id)} />
            ))}
          </div>
        )
      })}
      {cards.length === 0 && <div className="px-1 py-2 text-[11px] italic text-white/30">—</div>}
    </Scroller>
  )

  const totalDone = validated.size

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-[#15131f] p-2 text-white">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xs font-semibold text-emerald-200">🧪 Suivi de test</span>
        <span className="text-[10px] text-white/40">
          {totalDone}/{CATALOG.length} validées
        </span>
        <button
          onClick={() => setCollapsedPersist(!collapsed)}
          className="ml-auto rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-white/70 hover:bg-white/10"
        >
          {collapsed ? 'Déplier' : 'Replier'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="mb-1.5 flex items-center gap-1.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer (carte ou vilain)…"
              className="min-w-0 flex-1 rounded bg-black/30 px-2 py-1 text-[11px] text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-emerald-400/50"
            />
            {totalDone > 0 && (
              <button
                onClick={() => {
                  setValidated(new Set())
                  saveValidated(new Set())
                }}
                title="Tout remettre « à tester »"
                className="shrink-0 rounded border border-white/15 px-1.5 py-1 text-[10px] text-white/60 hover:bg-white/10"
              >
                Réinit.
              </button>
            )}
          </div>

          {/* Filtre par méchant : « Tous » + un bouton par vilain (couleur du camp). */}
          <div className="mb-1.5 flex flex-wrap gap-1">
            <button
              onClick={() => setVillainFilter(null)}
              className={`rounded border px-1.5 py-0.5 text-[10px] ${
                villainFilter === null
                  ? 'border-emerald-400 bg-emerald-500/20 text-white'
                  : 'border-white/15 text-white/60 hover:bg-white/10'
              }`}
            >
              Tous
            </button>
            {VILLAIN_ORDER.map((vk) => {
              const { def, label } = VILLAIN_REGISTRY[vk]
              const color = VILLAIN_COLOR[def.id] ?? '#666'
              const active = villainFilter === vk
              return (
                <button
                  key={vk}
                  onClick={() => setVillainFilter(active ? null : vk)}
                  className={`rounded border px-1.5 py-0.5 text-[10px] ${active ? 'text-white' : 'text-white/60 hover:bg-white/10'}`}
                  style={{ borderColor: color, backgroundColor: active ? color : 'transparent' }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-0.5 text-[10px] font-semibold text-amber-300">À tester ({toTest.length})</div>
              {renderColumn(toTest, false)}
            </div>
            <div>
              <div className="mb-0.5 text-[10px] font-semibold text-emerald-300">Validés ({done.length})</div>
              {renderColumn(done, true)}
            </div>
          </div>
        </>
      )}

      {/* Aperçu de la carte survolée : tooltip ancré juste à droite de la ligne,
          centré verticalement dessus et borné dans la fenêtre. */}
      {hovered && (
        <div
          className="pointer-events-none fixed z-[70]"
          style={{
            left: Math.min(hovered.rect.right + 10, window.innerWidth - 230),
            top: Math.min(
              Math.max(8, hovered.rect.top + hovered.rect.height / 2 - 208),
              window.innerHeight - 424,
            ),
          }}
        >
          <img
            src={hovered.card.image}
            alt={hovered.card.name}
            className="h-[26rem] w-auto rounded-lg border border-white/20 shadow-2xl"
          />
        </div>
      )}
    </div>
  )
}
