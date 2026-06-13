import { useSettingsStore, type DisplayMode } from '../store/settingsStore'

interface Props {
  onClose: () => void
  /** Ouvrir la banque de sons (uniquement depuis le menu ; absent en partie). */
  onSoundTest?: () => void
}

const DISPLAY_MODES: { mode: DisplayMode; label: string }[] = [
  { mode: 'windowed', label: 'Fenêtré' },
  { mode: 'fullscreen', label: 'Plein écran' },
  { mode: 'borderless', label: 'Plein écran fenêtré' },
]

/** Réglages du jeu : volume de la musique, sourdine et mode d'affichage. */
export function OptionsModal({ onClose, onSoundTest }: Props) {
  const volume = useSettingsStore((s) => s.musicVolume)
  const muted = useSettingsStore((s) => s.musicMuted)
  const setMusicVolume = useSettingsStore((s) => s.setMusicVolume)
  const toggleMusicMuted = useSettingsStore((s) => s.toggleMusicMuted)
  const sfxVolume = useSettingsStore((s) => s.sfxVolume)
  const setSfxVolume = useSettingsStore((s) => s.setSfxVolume)
  const pauseUnfocused = useSettingsStore((s) => s.pauseMusicUnfocused)
  const togglePauseUnfocused = useSettingsStore((s) => s.togglePauseMusicUnfocused)
  const displayMode = useSettingsStore((s) => s.displayMode)
  const setDisplayMode = useSettingsStore((s) => s.setDisplayMode)
  const pct = Math.round((muted ? 0 : volume) * 100)
  const sfxPct = Math.round(sfxVolume * 100)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-purple-200">Options</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-1 text-sm text-white/80 hover:bg-white/10"
          >
            Fermer ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-white/80">Musique</span>
            <button
              type="button"
              onClick={toggleMusicMuted}
              className="rounded-lg border border-white/20 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
            >
              {muted ? '🔇 Muet' : '🔊 Activé'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={pct}
              onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
              className="h-2 flex-1 cursor-pointer accent-amber-400"
              aria-label="Volume de la musique"
            />
            <span className="w-10 text-right font-mono text-sm text-white/70">{pct}%</span>
          </div>
          <p className="text-xs text-white/40">
            La musique « Slender: The Arrival » se joue pendant le tour de Slenderman.
          </p>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-white/80">Couper hors de l’onglet</span>
            <button
              type="button"
              onClick={togglePauseUnfocused}
              aria-pressed={pauseUnfocused}
              className={`rounded-lg border px-2 py-1 text-xs transition ${
                pauseUnfocused
                  ? 'border-amber-400 bg-amber-400/10 text-amber-200'
                  : 'border-white/20 text-white/70 hover:bg-white/10'
              }`}
            >
              {pauseUnfocused ? 'Activé' : 'Désactivé'}
            </button>
          </div>
          <p className="text-xs text-white/40">
            Met la musique en pause quand le jeu n’est pas au premier plan (autre onglet / fenêtre).
          </p>
        </div>

        {/* Bruitages (clics de boutons…). */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-white/80">Bruitages</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={sfxPct}
              onChange={(e) => setSfxVolume(Number(e.target.value) / 100)}
              className="h-2 flex-1 cursor-pointer accent-amber-400"
              aria-label="Volume des bruitages"
            />
            <span className="w-10 text-right font-mono text-sm text-white/70">{sfxPct}%</span>
          </div>
          <p className="text-xs text-white/40">Volume des sons d’interface (clics de boutons).</p>
        </div>

        {/* Mode d'affichage : fenêtré / plein écran. */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-white/80">Affichage</span>
          <div className="grid grid-cols-3 gap-2">
            {DISPLAY_MODES.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDisplayMode(mode)}
                aria-pressed={displayMode === mode}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                  displayMode === mode
                    ? 'border-amber-400 bg-amber-400/10 text-amber-200'
                    : 'border-white/20 text-white/70 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/40">
            Dans un navigateur, « Plein écran » et « Plein écran fenêtré » utilisent
            le mode plein écran (Échap pour revenir en fenêtré).
          </p>
        </div>

        {/* Banque de sons : raccourci vers l'écran d'écoute (menu uniquement). */}
        {onSoundTest && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-white/80">Sons du jeu</span>
            <button
              type="button"
              onClick={() => {
                onClose()
                onSoundTest()
              }}
              className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              🎵 Banque de sons
            </button>
            <p className="text-xs text-white/40">Écouter les musiques et bruitages du jeu.</p>
          </div>
        )}
      </div>
    </div>
  )
}
