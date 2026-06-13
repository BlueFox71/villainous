import { useEffect, useState } from 'react'
import { VILLAIN_REGISTRY, useGameStore, type VillainKey } from '../store/gameStore'
import { villainPortrait } from '../villainArt'
import { villainsBackground, DEFAULT_TINT_A, DEFAULT_TINT_B } from '../villainColors'
import { Scroller } from '../components/Scroller'

interface Props {
  /** La connexion est établie et la partie démarre (l'écran de jeu prend le relais). */
  onEnterGame: () => void
  /** Revenir au menu principal (coupe la connexion en cours). */
  onBack: () => void
}

const KEYS = Object.keys(VILLAIN_REGISTRY) as VillainKey[]

/** Grille de portraits pour choisir SON vilain. */
function VillainPicker({ value, onPick }: { value: VillainKey | null; onPick: (k: VillainKey) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {KEYS.map((k) => {
        const selected = value === k
        return (
          <button
            key={k}
            type="button"
            onClick={() => onPick(k)}
            aria-pressed={selected}
            title={VILLAIN_REGISTRY[k].def.name}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition ${
              selected
                ? 'border-amber-400 bg-amber-400/20 ring-2 ring-amber-400'
                : 'border-white/10 bg-black/45 hover:border-white/30 hover:bg-black/60'
            }`}
          >
            <img
              src={villainPortrait(k)}
              alt={VILLAIN_REGISTRY[k].def.name}
              className="h-14 w-14 rounded-lg border border-white/15 object-cover"
            />
            <span className="w-full truncate text-center text-[11px] text-amber-100">
              {VILLAIN_REGISTRY[k].def.name}
            </span>
          </button>
        )
      })}
    </div>
  )
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
 * Écran « Jouer en réseau » (réseau local). L'HÔTE lance `npm run relay` sur sa
 * machine, crée un salon (code à 4 lettres) et attend ; l'INVITÉ ouvre cette même
 * page depuis l'adresse de l'hôte et saisit le code. Dès la connexion établie,
 * la partie démarre. Le point de vue est relativisé côté écran de jeu.
 */
export function NetworkLobby({ onEnterGame, onBack }: Props) {
  const startHost = useGameStore((s) => s.startHost)
  const joinHost = useGameStore((s) => s.joinHost)
  const leaveNet = useGameStore((s) => s.leaveNet)
  const netStatus = useGameStore((s) => s.netStatus)
  const hostRoom = useGameStore((s) => s.hostRoom)
  const netError = useGameStore((s) => s.netError)
  const mode = useGameStore((s) => s.mode)

  const [tab, setTab] = useState<'choose' | 'host' | 'join'>('choose')
  const [villain, setVillain] = useState<VillainKey | null>(null)
  const [code, setCode] = useState('')

  // Dès que les deux joueurs sont connectés, on entre dans la partie.
  useEffect(() => {
    if (netStatus === 'connected') onEnterGame()
  }, [netStatus, onEnterGame])

  const back = () => {
    leaveNet()
    onBack()
  }

  const pageBackground = villainsBackground(DEFAULT_TINT_A, DEFAULT_TINT_B)
  const busy = mode !== 'solo' && (netStatus === 'connecting' || netStatus === 'waiting')

  return (
    <div className="villain-bg flex h-screen flex-col bg-[#0a0814] text-white" style={{ backgroundImage: pageBackground }}>
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h1 className="text-lg font-bold text-purple-200">Jouer en réseau</h1>
        <button
          type="button"
          onClick={back}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
        >
          ← Menu
        </button>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Scroller className="h-full">
          <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
            {netError && (
              <p className="rounded-lg border border-red-400/40 bg-red-500/15 px-4 py-2 text-sm text-red-100">
                {netError}
              </p>
            )}

            {tab === 'choose' && (
              <div className="flex flex-col gap-5">
                <p className="text-center text-sm text-white/70">
                  Jouez à deux sur le même réseau. L’un héberge, l’autre rejoint avec le code.
                </p>
                <div className="mx-auto flex w-72 flex-col gap-4">
                  <BigButton label="Héberger une partie" onClick={() => setTab('host')} />
                  <BigButton label="Rejoindre une partie" onClick={() => setTab('join')} />
                </div>
              </div>
            )}

            {tab === 'host' && (
              <div className="flex flex-col gap-5">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-purple-200">Ton vilain</h2>
                <VillainPicker value={villain} onPick={setVillain} />

                {!hostRoom && (
                  <div className="mx-auto w-72">
                    <BigButton label="Créer le salon" disabled={!villain} onClick={() => villain && startHost(villain)} />
                  </div>
                )}

                {hostRoom && (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-white/15 bg-black/40 p-5">
                    <span className="text-xs uppercase tracking-widest text-white/50">Code du salon</span>
                    <span className="font-mono text-5xl font-black tracking-[0.3em] text-amber-200">{hostRoom}</span>
                    <p className="text-center text-sm text-white/70">
                      L’autre joueur ouvre <span className="text-amber-200">cette même page depuis ton adresse réseau</span>,
                      choisit « Rejoindre » et saisit ce code.
                    </p>
                    <span className="text-sm text-white/50">
                      {netStatus === 'connecting' && 'Démarrage du salon…'}
                      {netStatus === 'waiting' && '⏳ En attente de l’autre joueur…'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {tab === 'join' && (
              <div className="flex flex-col gap-5">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-purple-200">Ton vilain</h2>
                <VillainPicker value={villain} onPick={setVillain} />

                <label className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-widest text-white/50">Code du salon</span>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                    placeholder="ABCD"
                    className="rounded-lg border border-white/20 bg-black/50 px-3 py-2 text-center font-mono text-2xl tracking-[0.3em] text-amber-100 outline-none focus:border-amber-400"
                  />
                </label>

                <div className="mx-auto w-72">
                  <BigButton
                    label={busy ? 'Connexion…' : 'Rejoindre'}
                    disabled={!villain || code.length < 4 || busy}
                    onClick={() => villain && joinHost(code, villain)}
                  />
                </div>
                {busy && <span className="text-center text-sm text-white/50">⏳ Connexion à l’hôte…</span>}
              </div>
            )}
          </div>
        </Scroller>
      </main>
    </div>
  )
}
