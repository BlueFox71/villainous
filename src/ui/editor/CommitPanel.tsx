import { useEffect, useState } from 'react'

/**
 * Atelier — panneau « prochain commit » (DEV uniquement). Liste les fichiers modifiés
 * du dépôt (`git status` via le plugin Vite `git-staging`) avec, pour chacun, un
 * interrupteur indiquant s'il sera **enregistré au prochain commit** (= stagé côté git).
 * Décoché → exclu du commit, affiché grisé/désactivé. N'apparaît qu'avec le serveur de
 * dév (les endpoints `/__git-*` n'existent qu'en `serve`).
 */

interface Change {
  path: string
  staged: boolean
  status: string
}

/** Découpe un chemin en dossier + nom de fichier pour l'affichage. */
function splitPath(p: string): { dir: string; name: string } {
  const i = p.lastIndexOf('/')
  return i < 0 ? { dir: '', name: p } : { dir: p.slice(0, i + 1), name: p.slice(i + 1) }
}

export function CommitPanel() {
  const [changes, setChanges] = useState<Change[] | null>(null)
  const [available, setAvailable] = useState(true)
  const [open, setOpen] = useState(true)
  const [busyPath, setBusyPath] = useState<string | null>(null)
  // < 0 = pas encore initialisé (on attend le « stage-all » d'ouverture). Ensuite,
  // incrémenter relance le simple listing (bouton ↻ et après chaque bascule).
  const [reloadKey, setReloadKey] = useState(-1)
  const refresh = () => setReloadKey((k) => Math.max(0, k) + 1)

  // À l'ouverture : COCHE TOUT par défaut (stage tous les fichiers de vilains), puis
  // autorise le listing. Le setState vit dans un callback de promesse (règles hooks OK).
  useEffect(() => {
    let cancelled = false
    fetch('/__git-stage-all', { method: 'POST' })
      .then((r) => { if (!cancelled) { if (r.ok) setReloadKey(0); else setAvailable(false) } })
      .catch(() => { if (!cancelled) setAvailable(false) })
    return () => { cancelled = true }
  }, [])

  // Liste les changements de vilains (état stagé = coché). Respecte les décochages
  // manuels (ce chemin ne re-stage rien). Le setState vit dans le callback de promesse.
  useEffect(() => {
    if (reloadKey < 0) return
    let cancelled = false
    fetch('/__git-changes')
      .then((r) => (r.ok ? (r.json() as Promise<{ changes: Change[] }>) : Promise.reject(new Error('indisponible'))))
      .then((data) => {
        if (!cancelled) { setChanges(data.changes); setAvailable(true) }
      })
      .catch(() => { if (!cancelled) setAvailable(false) })
    return () => { cancelled = true }
  }, [reloadKey])

  const toggle = async (file: string, staged: boolean) => {
    setBusyPath(file)
    // Optimiste : reflète tout de suite l'état, puis on resynchronise via refresh().
    setChanges((cs) => cs?.map((c) => (c.path === file ? { ...c, staged } : c)) ?? cs)
    try {
      const res = await fetch('/__git-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, staged }),
      })
      if (!res.ok) throw new Error(await res.text())
    } catch {
      /* échec : le refresh ci-dessous rétablit l'état réel */
    } finally {
      setBusyPath(null)
      refresh()
    }
  }

  // Pas de serveur de dév (build web / exe) : rien.
  if (!available) return null

  const stagedCount = changes?.filter((c) => c.staged).length ?? 0
  const total = changes?.length ?? 0

  return (
    <div className="fixed bottom-3 right-3 z-[90] w-80 max-w-[92vw] overflow-hidden rounded-xl border border-white/15 bg-[#140d24]/95 text-white shadow-2xl backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 border-b border-white/10 bg-black/30 px-3 py-2 text-left"
      >
        <span className="text-sm font-bold text-amber-200">
          Prochain commit{' '}
          <span className="text-xs font-normal text-white/60">
            ({stagedCount}/{total} inclus)
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); void refresh() }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); void refresh() } }}
            className="rounded px-1.5 py-0.5 text-xs text-white/60 hover:bg-white/10 hover:text-white"
            title="Rafraîchir"
          >
            ↻
          </span>
          <span className="text-white/50">{open ? '▾' : '▸'}</span>
        </span>
      </button>

      {open && (
        <div className="max-h-[45vh] overflow-y-auto p-2">
          {total === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-white/50">Aucune modification en attente.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {changes!.map((c) => {
                const { dir, name } = splitPath(c.path)
                const disabled = !c.staged
                return (
                  <li
                    key={c.path}
                    className={`flex items-center gap-2 rounded px-1.5 py-1 text-xs transition ${
                      disabled ? 'opacity-45' : 'hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={c.staged}
                      disabled={busyPath === c.path}
                      onChange={(e) => void toggle(c.path, e.target.checked)}
                      className="h-3.5 w-3.5 shrink-0 accent-amber-500"
                      title={c.staged ? 'Inclus au prochain commit' : 'Exclu du prochain commit'}
                    />
                    <span
                      className={`w-6 shrink-0 text-center font-mono text-[10px] ${
                        disabled ? 'text-white/40' : 'text-amber-300/80'
                      }`}
                      title={`git status : « ${c.status} »`}
                    >
                      {c.status.trim() || '·'}
                    </span>
                    <span className="min-w-0 truncate" title={c.path}>
                      {dir && <span className="text-white/40">{dir}</span>}
                      <span className={disabled ? 'text-white/60' : 'font-semibold text-white/90'}>{name}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
