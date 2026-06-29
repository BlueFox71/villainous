import { useEffect, useMemo, useRef, useState } from 'react'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { villainPortrait } from '../villainArt'
import { villainCreator } from '../villainPacks'

// Cadre doré (double liseré) servi depuis public/. Dessiné PAR-DESSUS le portrait.
const GUIDE_SRC = '/villain-guide.png'
// Taille du rendu carré (comme les portraits Disney, ex. Prince Jean 1000×1000).
const SIZE = 1000
// Couleur du titre (or Villainous).
const TITLE_COLOR = '#AF9569'

/** Mode ATELIER : encadrer le portrait d'un vilain PERSONNALISÉ (dataURL) et
 *  appliquer le rendu (pas d'écriture fichier — on renvoie le dataURL encadré). */
interface CustomMode {
  /** Portrait brut à encadrer (dataURL) ; undefined si pas encore choisi. */
  portrait: string | undefined
  /** Titre par défaut (nom du vilain). */
  name: string
  /** Reçoit le portrait encadré (dataURL) à appliquer au brouillon. */
  onApply: (dataUrl: string) => void
}

interface Props {
  onClose: () => void
  /** Vilain ciblé à l'ouverture (rabattu sur un collaborateur si besoin). */
  initialVillain?: VillainKey
  /** Verrouille sur `initialVillain` (cache le sélecteur) — édition d'un vilain précis. */
  lockVillain?: boolean
  /** Présent → mode Atelier (vilain perso) au lieu du mode dev (vilains natifs). */
  custom?: CustomMode
}

/** Charge une image (Promise). Même origine (public/) → pas de souillure canvas. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Dessine `img` en COVER (remplit, recadre) dans un carré `size`. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number) {
  const scale = Math.max(size / img.width, size / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh)
}

/** Écrit le titre centré en haut, rétréci pour tenir dans ~84 % de la largeur. */
function drawTitle(ctx: CanvasRenderingContext2D, title: string, size: number) {
  const text = title.trim()
  if (!text) return
  const maxWidth = size * 0.84
  ctx.save()
  ctx.fillStyle = TITLE_COLOR
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Léger interlettrage façon affiche (supporté par Chromium / l'app de bureau).
  try {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.round(size * 0.006)}px`
  } catch {
    /* navigateur sans letterSpacing : on ignore */
  }
  let fontPx = Math.round(size * 0.085)
  const fontFor = (px: number) => `${px}px Georgia, "Times New Roman", serif`
  ctx.font = fontFor(fontPx)
  while (fontPx > 18 && ctx.measureText(text).width > maxWidth) {
    fontPx -= 2
    ctx.font = fontFor(fontPx)
  }
  // Ombre douce pour décoller le titre du fond clair/sombre.
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = Math.round(size * 0.012)
  ctx.fillText(text, size / 2, size * 0.11)
  ctx.restore()
}

/**
 * Éditeur de PORTRAIT (outils mode test). Compose, pour un vilain COLLABORATEUR
 * (fan-made), son portrait brut + le cadre doré + un titre (majuscules, or), puis
 * permet de remplacer le fichier portrait actuel par le rendu (canvas → fichier).
 * Seuls les portraits des collaborateurs sont éditables (les officiels ont déjà
 * leur cadre/titre).
 */
export function PortraitEditorModal({ onClose, initialVillain, lockVillain, custom }: Props) {
  const isCustom = !!custom
  // Liste des vilains éditables : ceux qui ont un créateur (collaboration). Vide en
  // mode Atelier (on encadre le portrait du vilain perso en cours).
  const editable = useMemo(
    () => (isCustom ? [] : (Object.keys(VILLAIN_REGISTRY) as VillainKey[]).filter((k) => villainCreator(k))),
    [isCustom],
  )
  const [villain, setVillain] = useState<VillainKey>(
    initialVillain && editable.includes(initialVillain) ? initialVillain : (editable[0] ?? ('princeJohn' as VillainKey)),
  )
  const [title, setTitle] = useState(
    (isCustom ? custom!.name : VILLAIN_REGISTRY[villain].def.name).toUpperCase(),
  )
  // Mode Atelier : on montre le rendu encadré d'emblée (le bouton « Appliquer » suit).
  const [framed, setFramed] = useState(isCustom)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const portraitSrc = isCustom ? (custom!.portrait ?? '') : villainPortrait(villain)
  // Mode dev : on encadre à partir du portrait BRUT conservé sous `public/portraits-raw/`
  // (créé à la 1re sauvegarde). S'il n'existe pas encore, le fichier servi EST le brut.
  // Mode Atelier : la source fournie est déjà le brut (géré côté éditeur de vilain).
  const rawUrl = isCustom ? null : `/portraits-raw${portraitSrc}`

  // Changement de vilain : on réinitialise titre (= nom en majuscules) et vue (brute).
  const changeVillain = (k: VillainKey) => {
    setVillain(k)
    setTitle(VILLAIN_REGISTRY[k].def.name.toUpperCase())
    setFramed(false)
    setSaveMsg(null)
  }

  // (Re)dessine le canvas : portrait seul, ou portrait + cadre + titre.
  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ;(async () => {
      // Base à encadrer : le brut (copie portraits-raw) si elle existe, sinon le fichier servi.
      let portrait = rawUrl ? await loadImage(rawUrl).catch(() => null) : null
      if (!portrait) portrait = await loadImage(portraitSrc).catch(() => null)
      if (cancelled || !portrait) return
      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, SIZE, SIZE)
      drawCover(ctx, portrait, SIZE)
      if (framed) {
        const guide = await loadImage(GUIDE_SRC).catch(() => null)
        if (cancelled) return
        if (guide) ctx.drawImage(guide, 0, 0, SIZE, SIZE)
        drawTitle(ctx, title, SIZE)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [portraitSrc, rawUrl, framed, title])

  // Remplace le fichier portrait par le rendu courant (canvas → endpoint dev), ou en
  // mode Atelier, applique le rendu encadré (dataURL) au brouillon du vilain perso.
  const replacePortrait = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (isCustom) {
      custom!.onApply(canvas.toDataURL('image/png'))
      onClose()
      return
    }
    setSaveMsg('Sauvegarde…')
    // Mime selon l'extension du fichier cible (jpg → jpeg, sinon png).
    const isJpg = /\.jpe?g($|\?)/i.test(portraitSrc)
    const dataUrl = canvas.toDataURL(isJpg ? 'image/jpeg' : 'image/png', 0.95)
    try {
      const res = await fetch('/__save-portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: portraitSrc, dataUrl }),
      })
      setSaveMsg(res.ok ? '✓ Portrait remplacé (rechargez pour voir partout)' : `Échec : ${await res.text()}`)
    } catch {
      setSaveMsg('Erreur réseau (serveur de dév requis).')
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-2xl border border-lime-400/40 bg-[#15131f] p-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-black text-lime-200">🖼 Éditeur de portrait</span>
          {isCustom ? (
            <span className="rounded border border-white/15 bg-black/40 px-2 py-1 text-sm text-white/80">
              {custom!.name}
            </span>
          ) : lockVillain ? (
            <span className="rounded border border-white/15 bg-black/40 px-2 py-1 text-sm text-white/80">
              {VILLAIN_REGISTRY[villain].def.name}
            </span>
          ) : (
            <select
              value={villain}
              onChange={(e) => changeVillain(e.target.value as VillainKey)}
              className="rounded border border-white/25 bg-black/40 px-2 py-1 text-sm text-white"
            >
              {editable.map((k) => (
                <option key={k} value={k}>
                  {VILLAIN_REGISTRY[k].def.name} — {villainCreator(k)}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={onClose}
            className="ml-auto rounded-lg border border-white/25 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            ✕ Fermer
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Portrait courant (référence). */}
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-white/50">Portrait actuel</span>
            <img
              src={portraitSrc}
              alt=""
              className="aspect-square w-full rounded-lg border border-white/15 object-cover"
            />
          </div>
          {/* Aperçu (canvas) — brut ou encadré + titré. */}
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-white/50">
              Aperçu {framed ? '(encadré + titre)' : '(brut)'}
            </span>
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              className="aspect-square w-full rounded-lg border border-lime-400/30 bg-black"
            />
          </div>
        </div>

        {/* Titre éditable. */}
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-white/50">Titre (majuscules, or)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded border border-white/20 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-lime-400/50"
            placeholder="NOM DU VILAIN"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => { setFramed(true); setSaveMsg(null) }}
            className="rounded-lg border border-lime-400/60 px-3 py-2 text-sm font-semibold text-lime-200 hover:bg-lime-500/15"
          >
            🖼 Mettre encadré + titre
          </button>
          <button
            onClick={replacePortrait}
            disabled={!framed || (isCustom && !custom!.portrait)}
            title={
              !framed
                ? 'Cliquez d’abord « Mettre encadré + titre »'
                : isCustom
                  ? 'Applique le portrait encadré au vilain'
                  : 'Écrit le rendu dans le fichier portrait'
            }
            className="rounded-lg border border-amber-400/60 px-3 py-2 text-sm font-semibold text-amber-200 enabled:hover:bg-amber-500/15 disabled:opacity-40"
          >
            {isCustom ? '💾 Appliquer au portrait' : '💾 Remplacer le portrait actuel'}
          </button>
          {saveMsg && <span className="text-xs text-lime-300">{saveMsg}</span>}
        </div>
      </div>
    </div>
  )
}
