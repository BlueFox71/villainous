import { useEffect, useRef, useState } from 'react'
import { PATCH_NOTES, PATCH_TAG_META } from '../ui/patchNotes'
import type { NewsItem, UpdateEvent } from '../ui/store/settingsStore'

/**
 * LAUNCHER de l'application de bureau (fenêtre d'accueil, façon Marvel Rivals).
 * Affiché AVANT le jeu par Electron (cf. electron/main.cjs) : fond = vidéo d'intro
 * (muette, assombrie), actualités (EN LIGNE via news.json, repli sur les notes de
 * version embarquées), mise à jour automatique OBLIGATOIRE (barre de progression),
 * puis « Jouer ».
 *
 * Fenêtre SANS CADRE : la barre du haut est une zone de déplacement (`app-region:
 * drag`) et porte ses propres boutons Réduire / Fermer.
 */

/** État de la mise à jour, piloté par les événements du process principal. */
type Status =
  | 'checking' // recherche en cours
  | 'downloading' // téléchargement d'une MAJ (percent)
  | 'ready' // MAJ téléchargée, prête à installer (redémarrage)
  | 'uptodate' // aucune MAJ / déjà à jour → on peut jouer
  | 'error' // échec (réseau…) → on peut jouer quand même
  | 'unsupported' // pas d'auto-update (dév / build sans jeton) → on peut jouer

/** Convertit le gras Markdown `**…**` d'une note en fragments JSX. */
function renderRich(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

/** Une carte « actualité ». Tolérante : `version`/`tags` facultatifs, tags inconnus
 *  (actus en ligne libres) rendus en pastille neutre. */
function NewsCard({ note }: { note: NewsItem }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/30">
      <div className="mb-1.5 flex items-baseline gap-2">
        {note.version && (
          <span className="rounded-md border border-purple-300/30 bg-purple-500/20 px-1.5 py-0.5 text-xs font-semibold text-purple-100">
            v{note.version}
          </span>
        )}
        <span className="text-xs text-white/45">{note.date}</span>
      </div>
      <h3 className="text-[15px] font-semibold text-white">{note.title}</h3>
      {note.tags && note.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {note.tags.map((t) => {
            const meta = PATCH_TAG_META[t as keyof typeof PATCH_TAG_META]
            return (
              <span
                key={t}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                  meta ? meta.className : 'border-white/20 bg-white/10 text-white/70'
                }`}
              >
                {meta && <span>{meta.emoji}</span>}
                {meta ? meta.label : t}
              </span>
            )
          })}
        </div>
      )}
      <ul className="mt-2.5 space-y-1.5">
        {note.changes.map((c, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-snug text-white/70">
            <span className="mt-[3px] text-purple-300/70">◆</span>
            <span>{renderRich(c)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Launcher() {
  const bridge = typeof window !== 'undefined' ? window.villainous : undefined
  // État initial : 'checking' si l'auto-update est disponible (Electron), sinon
  // 'unsupported' (aperçu navigateur) → on évite un setState synchrone dans l'effet.
  const [status, setStatus] = useState<Status>(() =>
    bridge?.onUpdateEvent && bridge.launcherStart ? 'checking' : 'unsupported',
  )
  const [percent, setPercent] = useState(0)
  const [version, setVersion] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  // Actualités : repli embarqué (notes de version) tant que l'en-ligne n'a pas répondu.
  const [news, setNews] = useState<NewsItem[]>(() => PATCH_NOTES.slice(0, 8))
  const videoRef = useRef<HTMLVideoElement>(null)

  // Coupe le son de la vidéo de fond de façon FIABLE : l'attribut `muted` de React
  // n'est pas toujours appliqué au DOM, et la fenêtre autorise l'autoplay sonore →
  // on force `muted` (l'intro sert de décor, sans musique).
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = true
  }, [])

  // --- Vérification de la mise à jour (Electron) -----------------------------
  useEffect(() => {
    // Hors Electron (aperçu navigateur) : rien à mettre à jour (statut initial
    // déjà 'unsupported'), on peut jouer directement.
    if (!bridge?.onUpdateEvent || !bridge.launcherStart) return

    // On s'abonne AVANT de lancer la vérification (aucun événement perdu).
    const unsub = bridge.onUpdateEvent((e: UpdateEvent) => {
      switch (e.type) {
        case 'checking':
          setStatus('checking')
          break
        case 'available':
          setStatus('downloading')
          setPercent(0)
          if (e.payload?.version) setVersion(e.payload.version)
          break
        case 'progress':
          setStatus('downloading')
          setPercent(e.payload?.percent ?? 0)
          break
        case 'not-available':
          setStatus('uptodate')
          break
        case 'downloaded':
          setStatus('ready')
          if (e.payload?.version) setVersion(e.payload.version)
          break
        case 'error':
          setStatus('error')
          setErrorMsg(e.payload?.message ?? '')
          break
        case 'unsupported':
          setStatus('unsupported')
          break
      }
    })

    void bridge.launcherStart().then((info) => {
      setVersion((v) => v || info.version)
      if (!info.supported) setStatus('unsupported')
    })

    // Filet de sécurité : si la recherche traîne (réseau lent) SANS qu'aucune MAJ
    // n'ait été détectée, on débloque « Jouer » au bout de 12 s. Une MAJ réelle
    // fait quitter 'checking' bien avant → elle reste donc obligatoire.
    const safety = setTimeout(() => {
      setStatus((s) => (s === 'checking' ? 'uptodate' : s))
    }, 12000)

    return () => {
      unsub()
      clearTimeout(safety)
    }
  }, [bridge])

  // --- Actualités en ligne (news.json) ---------------------------------------
  useEffect(() => {
    if (!bridge?.launcherNews) return
    let alive = true
    void bridge.launcherNews().then((online) => {
      if (alive && online && online.length) setNews(online.slice(0, 12))
    })
    return () => {
      alive = false
    }
  }, [bridge])

  const busy = status === 'checking' || status === 'downloading'

  /** Texte d'état affiché à côté de la barre de progression. */
  const statusLabel = (() => {
    switch (status) {
      case 'checking':
        return 'Recherche de mise à jour…'
      case 'downloading':
        return `Mise à jour obligatoire — téléchargement… ${percent}%`
      case 'ready':
        return 'Mise à jour prête — redémarrage requis'
      case 'uptodate':
        return 'Jeu à jour'
      case 'error':
        return 'Mise à jour indisponible — vous pouvez jouer'
      case 'unsupported':
        return 'Prêt'
    }
  })()

  function play() {
    if (bridge?.launcherPlay) void bridge.launcherPlay()
    else window.location.href = '/' // aperçu navigateur
  }
  function install() {
    if (bridge?.launcherInstall) void bridge.launcherInstall()
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#07060c] text-white">
      {/* Fond : vidéo d'intro, MUETTE et en boucle. */}
      <video
        ref={videoRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        src="/intro.mp4"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
      />
      {/* Assombrissement : voile noir + dégradé (pour lire le premier plan). */}
      <div className="pointer-events-none absolute inset-0 bg-black/60" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 0%, rgba(20,10,40,0.5) 0%, rgba(11,8,22,0.78) 45%, rgba(5,4,10,0.94) 100%)',
        }}
        aria-hidden
      />

      {/* Barre de titre (déplacement de la fenêtre sans cadre) + boutons. */}
      <div
        className="relative z-10 flex h-9 shrink-0 items-center justify-between px-3"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 text-xs tracking-widest text-white/50">
          <img src="/jeton_pouvoir.png" alt="" className="h-4 w-4" />
          VILLAINOUS
        </div>
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => bridge?.launcherMinimize?.()}
            className="grid h-6 w-8 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"
            title="Réduire"
          >
            ─
          </button>
          <button
            onClick={() => bridge?.launcherClose?.()}
            className="grid h-6 w-8 place-items-center rounded text-white/60 hover:bg-red-500/70 hover:text-white"
            title="Quitter"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Corps : titre à gauche, actualités à droite. */}
      <div className="relative z-10 flex min-h-0 flex-1 gap-6 px-8 pb-4">
        <div className="flex flex-1 flex-col justify-center">
          <h1
            className="text-6xl leading-none text-white drop-shadow-[0_4px_18px_rgba(140,80,255,0.5)]"
            style={{ fontFamily: 'Fondamento, serif' }}
          >
            Villainous
          </h1>
          <p className="mt-3 max-w-sm text-sm text-white/60">
            Prenez le rôle d'un célèbre méchant Disney et accomplissez votre sombre dessein
            avant l'arrivée des héros.
          </p>
          {version && <p className="mt-6 text-xs tracking-wider text-white/35">Version {version}</p>}
        </div>

        <div className="flex w-[380px] flex-col">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-wide text-white/80">
            <span>📰</span> Actualités
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
            {news.map((n, i) => (
              <NewsCard key={n.version ?? `${n.date}-${i}`} note={n} />
            ))}
          </div>
        </div>
      </div>

      {/* Barre du bas : état de la MAJ + bouton Jouer. */}
      <div className="relative z-10 flex shrink-0 items-center gap-6 border-t border-white/10 bg-black/50 px-8 py-4 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2 text-sm text-white/75">
            {busy && (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-purple-300/40 border-t-purple-200" />
            )}
            <span className="truncate" title={errorMsg || undefined}>
              {statusLabel}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-400 to-fuchsia-400 transition-all duration-300"
              style={{
                width:
                  status === 'downloading'
                    ? `${percent}%`
                    : status === 'checking'
                      ? '35%'
                      : '100%',
                opacity: status === 'checking' ? 0.4 : 1,
              }}
            />
          </div>
        </div>

        {status === 'ready' ? (
          <button
            onClick={install}
            className="shrink-0 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-8 py-3 text-lg font-bold text-white shadow-lg shadow-emerald-900/40 transition hover:brightness-110 active:scale-[0.98]"
          >
            Redémarrer et installer ⟳
          </button>
        ) : (
          <button
            onClick={play}
            disabled={busy}
            className="shrink-0 rounded-xl bg-gradient-to-b from-purple-400 to-fuchsia-600 px-10 py-3 text-lg font-bold text-white shadow-lg shadow-fuchsia-900/40 transition enabled:hover:brightness-110 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Jouer ▶
          </button>
        )}
      </div>
    </div>
  )
}
