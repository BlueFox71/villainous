import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'

// Volume forcé de la cinématique quand la musique est coupée (0 %) : on évite
// une intro muette en repassant à ce niveau (un peu moins fort que le maximum).
const INTRO_VOLUME = 0.55

/**
 * Cinématique d'introduction « Les Méchants Disney se déchaînent », jouée une
 * fois au lancement de l'application, AVANT le menu principal. La vidéo couvre
 * tout l'écran ; à la fin (ou si le joueur passe via Échap / clic), on enchaîne
 * un fondu au noir puis on rend la main (`onDone`) → le menu apparaît.
 *
 * L'autoplay avec son est autorisé dans l'app de bureau (cf. `autoplayPolicy`
 * dans electron/main.cjs). En navigateur de dev, l'autoplay sonore peut être
 * bloqué : on retombe alors sur une lecture muette pour que l'intro se déroule
 * quand même.
 */
export function IntroCinematic({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Fondu au noir final : passe à vrai à la fin de la vidéo ou au skip.
  const [fading, setFading] = useState(false)
  // Garde-fou : ne terminer qu'une seule fois (fin + skip pourraient coïncider).
  const doneRef = useRef(false)

  // Durée du fondu au noir (ms), synchro avec la transition CSS ci-dessous.
  const FADE_MS = 800

  // Lance le fondu au noir puis rend la main au menu, en restaurant le mode
  // d'affichage choisi par le joueur (l'intro a forcé le plein écran).
  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    setFading(true)
    window.setTimeout(() => {
      const bridge = typeof window !== 'undefined' ? window.villainous : undefined
      // Restaure le mode d'affichage persisté (l'intro a forcé le plein écran).
      // On lit le mode faisant autorité côté Electron pour éviter tout aléa de
      // synchronisation avec le store.
      if (bridge) {
        void bridge.getDisplayMode().then((mode) => bridge.setDisplayMode(mode))
      }
      onDone()
    }, FADE_MS)
  }

  // Démarrage de la lecture : la cinématique est jouée en PLEIN ÉCRAN (app de
  // bureau), avec repli muet si l'autoplay sonore est bloqué. Le volume suit le
  // réglage Musique du joueur (lu à l'arrivée sur la page) ; mais si la musique
  // est coupée (0 %), on force INTRO_VOLUME pour que l'intro ne soit pas muette.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.villainous) {
      void window.villainous.setFullscreen(true)
    }
    const el = videoRef.current
    if (!el) return
    const { musicVolume, musicMuted } = useSettingsStore.getState()
    el.volume = musicMuted || musicVolume === 0 ? INTRO_VOLUME : musicVolume
    el.play().catch(() => {
      el.muted = true
      el.play().catch(() => {})
    })
  }, [])

  // Échap pour passer la cinématique.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        src="/intro.mp4"
        autoPlay
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
        className="h-full w-full object-cover"
      />

      {/* Indice « Passer » : clic ou Échap. Masqué pendant le fondu final. */}
      {!fading && (
        <button
          type="button"
          onClick={finish}
          className="absolute bottom-7 right-9 rounded-full border border-white/25 bg-black/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/70 backdrop-blur-sm transition hover:border-white/50 hover:text-white"
        >
          Passer (Échap)
        </button>
      )}

      {/* Voile noir : fondu au noir à la fin / au skip. */}
      <div
        className="pointer-events-none absolute inset-0 bg-black transition-opacity"
        style={{ opacity: fading ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
      />
    </div>
  )
}
