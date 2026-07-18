import { useEffect, useMemo, useState } from 'react'
import { PATCH_NOTES, PATCH_TAG_META, type PatchNote } from '../ui/patchNotes'
import type { UpdateEvent } from '../ui/store/settingsStore'

/**
 * LAUNCHER de l'application de bureau (fenêtre d'accueil, façon Marvel Rivals).
 * Affiché AVANT le jeu par Electron (cf. electron/main.cjs) : il montre les
 * actualités (= notes de version embarquées, `PATCH_NOTES`), l'état de la mise à
 * jour automatique (barre de progression), puis laisse « Jouer ».
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

/** Une carte « actualité » = une note de version. */
function NewsCard({ note }: { note: PatchNote }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/30">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="rounded-md border border-purple-300/30 bg-purple-500/20 px-1.5 py-0.5 text-xs font-semibold text-purple-100">
          v{note.version}
        </span>
        <span className="text-xs text-white/45">{note.date}</span>
      </div>
      <h3 className="text-[15px] font-semibold text-white">{note.title}</h3>
      {note.tags && note.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {note.tags.map((t) => {
            const meta = PATCH_TAG_META[t]
            return (
              <span
                key={t}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${meta.className}`}
              >
                <span>{meta.emoji}</span>
                {meta.label}
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

  const notes = useMemo(() => PATCH_NOTES.slice(0, 8), [])

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

    // Filet de sécurité : si la vérification traîne (réseau lent), on débloque
    // « Jouer » au bout de 12 s (la MAJ, si elle arrive, s'appliquera plus tard).
    const safety = setTimeout(() => {
      setStatus((s) => (s === 'checking' ? 'uptodate' : s))
    }, 12000)

    return () => {
      unsub()
      clearTimeout(safety)
    }
  }, [bridge])

  const busy = status === 'checking' || status === 'downloading'

  /** Texte d'état affiché à côté de la barre de progression. */
  const statusLabel = (() => {
    switch (status) {
      case 'checking':
        return 'Recherche de mise à jour…'
      case 'downloading':
        return `Téléchargement de la mise à jour… ${percent}%`
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
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0b0a12] text-white">
      {/* Fond partagé avec le menu du jeu. */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/menu_bg_disney.jpg)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 0%, rgba(37,20,71,0.55) 0%, rgba(19,12,36,0.72) 45%, rgba(11,10,18,0.9) 100%)',
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
            {notes.map((n) => (
              <NewsCard key={n.version} note={n} />
            ))}
          </div>
        </div>
      </div>

      {/* Barre du bas : état de la MAJ + bouton Jouer. */}
      <div className="relative z-10 flex shrink-0 items-center gap-6 border-t border-white/10 bg-black/40 px-8 py-4 backdrop-blur">
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
