// =============================================================================
// Modale « Rapport de tests » de FIN DE PARTIE (outil de dév). Ouverte depuis un
// bouton en haut à droite quand la partie est finie. Montre les DEUX vilains de la
// partie — celui du joueur (côté « Joueur ») et celui du bot (côté « Bot ») — laisse
// choisir le testeur, puis remplir ; sauvegarde automatique dans le même fichier que
// la page « Rapport des tests » (assets/test-report.json).
// =============================================================================

import { useEffect, useState } from 'react'
import {
  type Side,
  type Tester,
  entryOf,
  loadSelectedTester,
  saveSelectedTester,
  useTestReport,
  SAVE_LABEL,
} from '../testReport/model'
import { SidePanel, Portrait } from '../testReport/components'

/** Un vilain de la partie à évaluer : sa clé (rapport), son nom, portrait, couleur et le
 *  côté (Joueur pour le vilain du joueur, Bot pour celui du bot). */
export interface GameVillain {
  key: string
  name: string
  portrait: string
  color: string
  side: Side
}

export function GameTestReportModal({ villains, onClose }: { villains: GameVillain[]; onClose: () => void }) {
  const [tester, setTester] = useState<Tester>(loadSelectedTester)
  useEffect(() => { saveSelectedTester(tester) }, [tester])
  const { report, patch, saveState } = useTestReport()

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-[52rem] max-w-[95vw] flex-col gap-4 rounded-2xl border border-white/15 bg-[#12101a] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête : titre + choix du testeur + état de sauvegarde + fermer */}
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-lg font-bold uppercase tracking-wide text-amber-200">📋 Rapport de tests</h2>
          <label className="flex items-center gap-2 text-sm text-white/70">
            Testeur
            <select
              value={tester}
              onChange={(e) => setTester(e.target.value as Tester)}
              className="rounded-lg border border-white/15 bg-[#0b0a12] px-3 py-1.5 text-sm font-semibold text-white/90"
            >
              <option value="jules">Jules</option>
              <option value="alexis">Alexis</option>
            </select>
          </label>
          <span
            className={`text-sm ${saveState === 'error' ? 'text-red-300' : saveState === 'saved' ? 'text-emerald-300' : 'text-white/50'}`}
          >
            {SAVE_LABEL[saveState]}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            ✕ Fermer
          </button>
        </div>

        {report === null ? (
          <div className="flex h-40 items-center justify-center text-white/50">Chargement du rapport…</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {villains.map((v) => {
              const entry = entryOf(report, v.key)[tester][v.side]
              return (
                <div
                  key={v.key + v.side}
                  className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-2xl border p-3"
                  style={{
                    borderColor: `color-mix(in srgb, ${v.color}, white 22%)`,
                    background: `linear-gradient(135deg, ${v.color} 0%, color-mix(in srgb, ${v.color}, black 55%) 100%)`,
                  }}
                >
                  <div className="flex w-24 flex-col items-center gap-1">
                    <Portrait src={v.portrait} name={v.name} size="w-24" />
                    <span className="text-center text-xs font-bold text-white drop-shadow">{v.name}</span>
                  </div>
                  <div className="rounded-xl bg-black/35 p-3">
                    <SidePanel
                      side={v.side}
                      entry={entry}
                      onPatch={(p) => patch(v.key, tester, v.side, p)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
