import { useState } from 'react'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { VILLAIN_COLOR } from '../villainColors'
import { villainGuideOf } from '../villainGuide'
import { villainPortrait } from '../villainArt'
import { villainCreator } from '../villainPacks'
import { VillainColorModal } from './VillainColorModal'
import { PortraitEditorModal } from './PortraitEditorModal'

interface Props {
  /** Vilain natif à éditer (clé registre). */
  villain: VillainKey
  onClose: () => void
}

/**
 * Éditeur de vilain (outil de dév, réservé au serveur de dév) regroupant les trois
 * réglages de présentation d'un vilain NATIF : sa **difficulté**, sa **couleur** et
 * son **portrait** (encadré + titre). La couleur et le portrait réutilisent les
 * éditeurs dédiés (pipette / cadre), verrouillés sur ce vilain. La difficulté est
 * réécrite dans `villainGuide.ts` via l'endpoint dev `/__save-villain-difficulty`.
 */
export function VillainEditModal({ villain, onClose }: Props) {
  const def = VILLAIN_REGISTRY[villain].def
  const color = VILLAIN_COLOR[def.id]
  // Le portrait n'est encadrable (cadre + titre) que pour les collaborateurs : les
  // vilains officiels ont déjà leur cadre d'origine.
  const canEditPortrait = !!villainCreator(villain)

  // Sous-éditeur ouvert (couleur / portrait), ou aucun.
  const [sub, setSub] = useState<'color' | 'portrait' | null>(null)

  // Difficulté (1–5), enregistrée dans la source via le serveur de dév.
  const [difficulty, setDifficulty] = useState(villainGuideOf(villain).difficulty)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const saveDifficulty = async () => {
    setSaveMsg('Sauvegarde…')
    try {
      const res = await fetch('/__save-villain-difficulty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ villain, difficulty }),
      })
      setSaveMsg(res.ok ? '✓ Difficulté enregistrée (rechargez pour voir partout)' : `Échec : ${await res.text()}`)
    } catch {
      setSaveMsg('Erreur réseau (serveur de dév requis).')
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-2xl border border-lime-400/40 bg-[#15131f] p-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-black text-lime-200">✏️ Modifier le vilain</span>
          <span className="rounded border border-white/15 bg-black/40 px-2 py-1 text-sm text-white/80">{def.name}</span>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg border border-white/25 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            ✕ Fermer
          </button>
        </div>

        {/* Difficulté (1–5 étoiles cliquables). */}
        <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/30 p-3">
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-amber-300/70">Difficulté</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setDifficulty(n); setSaveMsg(null) }}
                  title={`Difficulté ${n}/5`}
                  className={`text-2xl leading-none transition ${
                    n <= difficulty ? 'text-amber-400' : 'text-white/20 hover:text-amber-300/50'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            <span className="font-mono text-sm text-white/70">{difficulty}/5</span>
            <button
              onClick={saveDifficulty}
              className="ml-auto rounded-lg border border-amber-400/60 px-3 py-1.5 text-sm font-semibold text-amber-200 hover:bg-amber-500/15"
            >
              💾 Enregistrer
            </button>
          </div>
          {saveMsg && <span className="text-xs text-lime-300">{saveMsg}</span>}
        </div>

        {/* Couleur du méchant. */}
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-amber-300/70">Couleur</span>
          {color && (
            <span className="inline-block h-7 w-7 rounded border border-white/30" style={{ backgroundColor: color }} title={color} />
          )}
          <span className="font-mono text-sm text-white/60">{color ?? '—'}</span>
          <button
            onClick={() => setSub('color')}
            className="ml-auto rounded-lg border border-lime-400/60 px-3 py-1.5 text-sm font-semibold text-lime-200 hover:bg-lime-500/15"
          >
            🎨 Modifier
          </button>
        </div>

        {/* Portrait (encadré + titre). */}
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-amber-300/70">Portrait</span>
          <img src={villainPortrait(villain)} alt="" className="h-10 w-10 rounded border border-white/20 object-cover" />
          <button
            onClick={() => setSub('portrait')}
            disabled={!canEditPortrait}
            title={canEditPortrait ? 'Encadrer + titrer le portrait' : 'Réservé aux vilains de collaboration (les officiels ont déjà leur cadre)'}
            className="ml-auto rounded-lg border border-lime-400/60 px-3 py-1.5 text-sm font-semibold text-lime-200 enabled:hover:bg-lime-500/15 disabled:opacity-40"
          >
            🖼 Modifier
          </button>
        </div>
      </div>
    </div>

      {/* Sous-éditeurs dédiés (verrouillés sur ce vilain) — hors backdrop pour qu'un
          clic sur leur fond ne ferme pas aussi cet éditeur. */}
      {sub === 'color' && <VillainColorModal onClose={() => setSub(null)} initialVillain={villain} lockVillain />}
      {sub === 'portrait' && <PortraitEditorModal onClose={() => setSub(null)} initialVillain={villain} lockVillain />}
    </>
  )
}
