import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { villainsBackground, DEFAULT_TINT_A, DEFAULT_TINT_B } from '../villainColors'

interface Props {
  /** Les deux joueurs sont connectés : on passe au choix des vilains (en direct). */
  onEnterVillainSelect: () => void
  /** Revenir au menu (coupe la connexion en cours). */
  onBack: () => void
}

/** Bouton d'action principal (style « HearthStone »). */
function BigButton({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="hs-wrapper classique">
      <span className="hs-button classique">
        <span className="hs-border classique">
          <span className="hs-text classique">{label}</span>
        </span>
      </span>
    </button>
  )
}

/**
 * Étape de connexion du mode réseau (réseau local). L'HÔTE a déjà ouvert un salon
 * (code à 4 lettres) et attend ; l'INVITÉ saisit le code. Dès que les deux sont
 * connectés, on enchaîne sur le choix des vilains (en direct). Le serveur de
 * liaison (« npm run relay ») tourne sur la machine de l'hôte.
 */
export function NetworkLobby({ onEnterVillainSelect, onBack }: Props) {
  const mode = useGameStore((s) => s.mode)
  const netStatus = useGameStore((s) => s.netStatus)
  const hostRoom = useGameStore((s) => s.hostRoom)
  const netError = useGameStore((s) => s.netError)
  const joinHost = useGameStore((s) => s.joinHost)
  const leaveNet = useGameStore((s) => s.leaveNet)
  const [code, setCode] = useState('')

  // Les deux joueurs sont connectés → choix des vilains.
  useEffect(() => {
    if (netStatus === 'lobby') onEnterVillainSelect()
  }, [netStatus, onEnterVillainSelect])

  const back = () => {
    leaveNet()
    onBack()
  }

  const pageBackground = villainsBackground(DEFAULT_TINT_A, DEFAULT_TINT_B)
  const isHost = mode === 'host'
  const joining = mode === 'client'

  return (
    <div className="villain-bg flex h-screen flex-col bg-[#0a0814] text-white" style={{ backgroundImage: pageBackground }}>
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h1 className="text-lg font-bold text-purple-200">{isHost ? 'Héberger une partie' : 'Rejoindre une partie'}</h1>
        <button
          type="button"
          onClick={back}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
        >
          ← Menu
        </button>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center px-6">
        <div className="flex w-full max-w-md flex-col gap-6">
          {netError && (
            <p className="rounded-lg border border-red-400/40 bg-red-500/15 px-4 py-2 text-center text-sm text-red-100">
              {netError}
            </p>
          )}

          {isHost ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-white/15 bg-black/40 p-6">
              <span className="text-xs uppercase tracking-widest text-white/50">Code du salon</span>
              <span className="font-mono text-6xl font-black tracking-[0.3em] text-amber-200">{hostRoom ?? '····'}</span>
              <p className="text-center text-sm text-white/70">
                L’autre joueur ouvre <span className="text-amber-200">cette même page depuis ton adresse réseau</span>,
                choisit « Rejoindre une partie » et saisit ce code.
              </p>
              <span className="text-sm text-white/50">
                {netStatus === 'connecting' && 'Ouverture du salon…'}
                {netStatus === 'waiting' && '⏳ En attente de l’autre joueur…'}
                {netStatus === 'error' && 'Le serveur de liaison est-il lancé ? (npm run relay)'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-4 rounded-xl border border-white/15 bg-black/40 p-6">
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-widest text-white/50">Code du salon</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="ABCD"
                  disabled={joining}
                  className="rounded-lg border border-white/20 bg-black/50 px-3 py-2 text-center font-mono text-3xl tracking-[0.3em] text-amber-100 outline-none focus:border-amber-400 disabled:opacity-50"
                />
              </label>
              <div className="mx-auto w-64">
                <BigButton
                  label={joining ? 'Connexion…' : 'Rejoindre'}
                  disabled={code.length < 4 || joining}
                  onClick={() => joinHost(code)}
                />
              </div>
              {joining && (
                <span className="text-center text-sm text-white/50">
                  {netStatus === 'error' ? 'Hôte injoignable. Vérifie le code et l’adresse.' : '⏳ Connexion à l’hôte…'}
                </span>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
