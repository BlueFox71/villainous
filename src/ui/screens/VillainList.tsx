import { useState } from 'react'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { villainPortrait } from '../villainArt'
import { VILLAIN_GUIDE } from '../villainGuide'
import { Scroller } from '../components/Scroller'
import { Stars, VillainDetailModal } from '../components/VillainDetailModal'

interface Props {
  /** Revenir au menu principal. */
  onBack: () => void
}

/**
 * Liste des vilains disponibles : pour chacun, son portrait, son nom et sa
 * difficulté. Cliquer sur un vilain ouvre sa fiche détaillée (objectif,
 * histoire, conseils pour le jouer / le contrer).
 */
/** Catégories de vilains affichées dans la liste, dans l'ordre. */
const CATEGORIES: { title: string; villains: VillainKey[] }[] = [
  { title: 'Disney', villains: ['princeJohn', 'maleficent', 'jafar', 'reineCoeur', 'crochet', 'ursula', 'hades', 'facilier'] },
  { title: 'Collaborations', villains: ['slenderman'] },
]

export function VillainList({ onBack }: Props) {
  const [selected, setSelected] = useState<VillainKey | null>(null)

  return (
    <div className="flex h-screen flex-col bg-[#0b0a12] text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h1 className="text-lg font-bold text-purple-200">Liste des villains</h1>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
        >
          ← Menu
        </button>
      </header>

      <Scroller element="main" className="min-h-0 flex-1 p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          {CATEGORIES.map((cat) => (
            <section key={cat.title}>
              <h2 className="mb-3 flex items-center gap-3 text-sm font-bold uppercase tracking-[0.2em] text-amber-300/80">
                {cat.title}
                <span className="h-px flex-1 bg-white/10" />
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {cat.villains.map((key) => {
                  const v = VILLAIN_REGISTRY[key]
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelected(key)}
                      className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/30 hover:bg-white/10"
                    >
                      <img
                        src={villainPortrait(key)}
                        alt={v.def.name}
                        className="aspect-square w-full rounded-lg border border-white/15 object-cover"
                      />
                      <h3 className="text-base font-bold text-amber-200">{v.def.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                          Difficulté
                        </span>
                        <Stars value={VILLAIN_GUIDE[key].difficulty} />
                      </div>
                      <p className="mt-auto pt-1 text-[10px] text-white/40">Cliquer pour la fiche →</p>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </Scroller>

      {selected && (
        <VillainDetailModal villain={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
