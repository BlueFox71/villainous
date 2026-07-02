import { useEffect, useRef, useState } from 'react'
import { useCustomVillainStore } from '../store/customVillainStore'
import { useTestWinStore } from '../store/testWinStore'
import { PortraitEditorModal } from '../components/PortraitEditorModal'
import { CardBackLayout } from '../editor/CardBackLayout'
import { exportVillainAssets } from '../editor/exportAssets'
import type { BackOverlay, ExtraBack, ExtraBackColorMode } from '../../data/customVillain'
import {
  emptyCustomVillain,
  FATE_CARD_COLOR,
  VILLAIN_DECK_SIZE,
  FATE_DECK_SIZE,
  deckCounts,
  isDeckComplete,
  DEFAULT_EXTRA_BACK,
  extraBackColor,
  extraBackPaper,
  type CustomVillain,
  type VillainOrigin,
} from '../../data/customVillain'
import { villainsBackground } from '../villainColors'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { Scroller } from '../components/Scroller'
import { Field, TextField, ColorField, ImageField, SelectField } from '../editor/fields'
import { BoardTab } from '../editor/BoardTab'
import { CardsTab } from '../editor/CardsTab'
import { QuantityTab } from '../editor/QuantityTab'
import { bakeVillain } from '../editor/bake'
import { renderCardBack } from '../editor/cardRender'
import { parseExcelVillains, type ExcelVillain } from '../editor/importExcel'

interface Props {
  onBack: () => void
  /** Lance une partie de test avec ce vilain (déjà figé/baké). `opponent` = clé du vilain
   *  adverse choisi (undefined = adversaire aléatoire). */
  onPlay: (custom: CustomVillain, opponent?: VillainKey) => void
}

/** Onglets de l'éditeur. */
type Tab = 'identity' | 'board' | 'cards' | 'quantity'

// --- Onglet Identité ---------------------------------------------------------

function IdentityTab({
  draft,
  patch,
  onFramePortrait,
}: {
  draft: CustomVillain
  patch: (p: Partial<CustomVillain>) => void
  /** Ouvre l'Éditeur de portrait (cadre doré + nom) pour le portrait carré. */
  onFramePortrait: () => void
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <TextField label="Nom du vilain" value={draft.name} onChange={(name) => patch({ name })} />
        <Field label={`Difficulté — ${draft.stars} ★`}>
          <input
            type="range"
            min={1}
            max={5}
            value={draft.stars}
            onChange={(e) => patch({ stars: Number(e.target.value) })}
            className="accent-amber-400"
          />
        </Field>
        <ColorField label="Couleur thématique" value={draft.color} onChange={(color) => patch({ color })} />
        <p className="text-xs text-white/45">
          Le dos des cartes Vilain reprend la <strong>couleur thématique</strong> ; le dos des
          cartes Fatalité reste blanc (parchemin d’origine).
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <ImageField
          label="Portrait (carré)"
          value={draft.portrait}
          // Nouveau portrait choisi → c'est le nouveau « brut » (on oublie l'ancien
          // cadre conservé), pour que l'Éditeur de portrait reparte de cette image.
          onChange={(portrait) => patch({ portrait, portraitRaw: undefined })}
          aspect="square"
        />
        <button
          type="button"
          onClick={onFramePortrait}
          disabled={!draft.portrait}
          title={draft.portrait ? 'Ajuster le portrait (zoom / déplacement / cadre + nom)' : 'Choisis d’abord un portrait'}
          className="self-start rounded-lg border border-amber-300/50 px-3 py-1.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          🖼 Ajuster le portrait (zoom / déplacement / cadre)
        </button>
        <ImageField
          label="Présentation (corps entier)"
          value={draft.presentation}
          onChange={(presentation) => patch({ presentation })}
          aspect="card"
          fit="contain"
        />
      </div>
    </div>
  )
}

// --- Aperçu des dos de cartes (template officiel tinté) ---------------------

function CardBackPreview({
  color,
  name,
  caption,
  paper,
  overlays,
}: {
  color: string
  name: string
  caption: string
  paper?: boolean
  overlays?: BackOverlay[]
}) {
  const [src, setSrc] = useState<string | null>(null)
  const overlaysKey = JSON.stringify(overlays ?? [])
  useEffect(() => {
    let alive = true
    const h = setTimeout(() => {
      void renderCardBack(color, name, { paper, overlays }).then((url) => alive && setSrc(url))
    }, 250)
    return () => {
      alive = false
      clearTimeout(h)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, name, paper, overlaysKey])
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="aspect-[1440/2044] w-48 overflow-hidden rounded-lg border border-white/20 shadow-lg">
        {src && <img src={src} alt={caption} className="h-full w-full object-cover" />}
      </div>
      <span className="text-[10px] text-white/50">{caption}</span>
    </div>
  )
}

// --- 3e dos (paquets personnalisés) -----------------------------------------

/** Éditeur du DOS des cartes de paquet PERSONNALISÉ : couleur au choix (deck Vilain /
 *  Fatalité / libre), recoloration des ornements dorés, et ses propres ornements
 *  importés. N'apparaît que si le vilain a au moins un paquet perso (`extraDecks`). */
function ExtraBackSection({
  draft,
  patch,
}: {
  draft: CustomVillain
  patch: (p: Partial<CustomVillain>) => void
}) {
  const cfg: ExtraBack = draft.backExtra ?? DEFAULT_EXTRA_BACK
  const setCfg = (p: Partial<ExtraBack>) => patch({ backExtra: { ...cfg, ...p } })
  // Couleur + traitement effectifs pour l'aperçu (mêmes règles que le bake).
  const color = extraBackColor({ ...draft, backExtra: cfg })
  const paper = extraBackPaper({ ...draft, backExtra: cfg })

  const MODE_OPTIONS: readonly { value: ExtraBackColorMode; label: string }[] = [
    { value: 'villain', label: 'Couleur du deck Vilain' },
    { value: 'fate', label: 'Couleur de la Fatalité (parchemin)' },
    { value: 'custom', label: 'Couleur libre' },
  ]

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
        Dos des cartes — paquet personnalisé
      </span>
      <div className="flex flex-wrap items-start gap-6">
        {/* Réglages de couleur / ornements. */}
        <div className="flex w-64 flex-col gap-3">
          <SelectField<ExtraBackColorMode>
            label="Couleur du dos"
            value={cfg.colorMode}
            options={MODE_OPTIONS}
            onChange={(colorMode) => setCfg({ colorMode })}
          />
          {cfg.colorMode === 'custom' && (
            <ColorField
              label="Couleur libre"
              value={cfg.color ?? draft.color}
              onChange={(c) => setCfg({ color: c })}
            />
          )}
          <label className="flex items-center gap-2 text-xs text-white/60">
            <input
              type="checkbox"
              checked={cfg.ornamentColor !== undefined}
              onChange={(e) => setCfg({ ornamentColor: e.target.checked ? '#c9a14e' : undefined })}
              className="accent-amber-400"
            />
            Recolorer les ornements (cadre + axe)
          </label>
          {cfg.ornamentColor !== undefined && (
            <ColorField
              label="Couleur des ornements"
              value={cfg.ornamentColor}
              onChange={(c) => setCfg({ ornamentColor: c })}
            />
          )}
        </div>
        {/* Éditeur interactif d'ornements importés (propres à ce dos). */}
        <div className="flex flex-col items-center gap-1">
          <CardBackLayout
            color={color}
            name={draft.name}
            overlays={cfg.overlays ?? []}
            onChange={(overlays) => setCfg({ overlays })}
            ornamentColor={cfg.ornamentColor}
            paper={paper}
          />
          <span className="text-[10px] text-white/50">Paquet perso</span>
        </div>
      </div>
      <p className="text-[11px] text-white/40">
        Ce dos s’applique aux cartes de tes paquets personnalisés (hors decks Vilain et
        Fatalité).
      </p>
    </div>
  )
}

// --- Modale de publication (« Terminer ») -----------------------------------

/** Demande le nom du créateur et l'origine (Disney / Collaboration) avant de
 *  publier le vilain. Pré-remplie si le vilain a déjà été publié (réédition). */
function PublishModal({
  draft,
  busy,
  onCancel,
  onConfirm,
}: {
  draft: CustomVillain
  busy: boolean
  onCancel: () => void
  onConfirm: (creator: string, origin: VillainOrigin) => void
}) {
  const [creator, setCreator] = useState(draft.creator ?? '')
  const [origin, setOrigin] = useState<VillainOrigin>(draft.origin ?? 'Collaborations')
  const ORIGINS: { value: VillainOrigin; label: string; hint: string }[] = [
    { value: 'Disney', label: 'Disney / Pixar', hint: 'Univers Disney' },
    { value: 'Collaborations', label: 'Collaboration', hint: 'Hors Disney (jeux, anime…)' },
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#1a1620] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-amber-200">
            {draft.published ? 'Mettre à jour le vilain' : 'Terminer le vilain'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-2 py-1 text-sm text-white/50 transition hover:text-white"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-white/45">
          {draft.published
            ? 'Les modifications seront appliquées à la version jouable de ce vilain.'
            : '« ' + draft.name + ' » rejoindra la liste et le choix des vilains, jouable comme un vilain officiel.'}
        </p>

        <label className="flex flex-col gap-1 text-sm text-white/80">
          Nom du créateur
          <input
            type="text"
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            placeholder="Ton pseudo…"
            className="rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/50 focus:outline-none"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-white/80">Catégorie</span>
          <div className="grid grid-cols-2 gap-2">
            {ORIGINS.map((o) => {
              const active = origin === o.value
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOrigin(o.value)}
                  className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition ${
                    active
                      ? 'border-amber-300/60 bg-amber-400/20 text-amber-200'
                      : 'border-white/15 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <span className="font-semibold">{o.label}</span>
                  <span className="text-[11px] text-white/45">{o.hint}</span>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(creator, origin)}
          className="mt-1 rounded-lg border border-emerald-400/60 bg-emerald-400/20 px-4 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? '⏳ génération…' : draft.published ? 'Appliquer les modifications' : 'Publier le vilain'}
        </button>
      </div>
    </div>
  )
}

// --- Écran principal ---------------------------------------------------------

export function VillainEditor({ onBack, onPlay }: Props) {
  const { villains, loaded, load, save, remove } = useCustomVillainStore()
  const [draft, setDraft] = useState<CustomVillain | null>(null)
  const [tab, setTab] = useState<Tab>('identity')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  // Adversaire choisi pour la partie de TEST ('' = aléatoire). Liste des vilains natifs.
  const [testOpponent, setTestOpponent] = useState<VillainKey | ''>('')
  // Modale de publication (« Terminer ») : ouverte tant qu'elle collecte créateur + origine.
  const [publishOpen, setPublishOpen] = useState(false)
  // Éditeur de portrait (cadre doré + nom) pour le portrait carré du vilain perso.
  const [portraitFrameOpen, setPortraitFrameOpen] = useState(false)
  const excelRef = useRef<HTMLInputElement>(null)
  // Vilains trouvés dans une feuille Excel, en attente de choix (modale).
  const [excelChoices, setExcelChoices] = useState<ExcelVillain[] | null>(null)
  // Vilains custom ayant déjà gagné une partie de test (condition de 1re publication).
  const testWonIds = useTestWinStore((s) => s.wonIds)
  // Progression du « bake » (génération des images) pour la barre de chargement.
  const [bakeProgress, setBakeProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  const startEdit = (v: CustomVillain) => {
    setDraft(structuredClone(v))
    setTab('identity')
    setDirty(false)
  }

  const startNew = () => {
    const v = emptyCustomVillain(new Date().toISOString())
    setDraft(v)
    setTab('identity')
    setDirty(true)
  }

  const patch = (p: Partial<CustomVillain>) => {
    setDraft((d) => (d ? { ...d, ...p } : d))
    setDirty(true)
  }

  /** Fige toutes les images (faces + dos) puis persiste. Renvoie le vilain baké.
   *  Alimente la barre de chargement via `bakeProgress`. */
  const bakeAndSave = async (v: CustomVillain): Promise<CustomVillain> => {
    setBusy(true)
    setBakeProgress({ done: 0, total: v.cards.length + 3 })
    try {
      const baked = await bakeVillain(v, (done, total) => setBakeProgress({ done, total }))
      await save(baked)
      setDraft(baked)
      setDirty(false)
      return baked
    } finally {
      setBusy(false)
      setBakeProgress(null)
    }
  }

  const onSave = async () => {
    if (!draft || busy) return
    await bakeAndSave(draft)
  }

  /** Exporte le vilain en cours en .json ALLÉGÉ (sans les images, lourdes en dataURL) :
   *  uniquement les données de jeu (cartes, lieux, objectif…) — suffisant pour relire /
   *  coder ses effets. Écrit dans le dépôt (`assets/custom-exports/`) si le serveur de
   *  dév est là ; sinon, repli sur un téléchargement. */
  const onExportJson = async () => {
    if (!draft) return
    // Clone puis retire toutes les images (dataURL) pour un fichier léger et lisible.
    const light = JSON.parse(JSON.stringify(draft)) as Record<string, unknown>
    for (const k of ['portrait', 'presentation', 'portraitRaw', 'boardArt', 'boardImage', 'pawnImage', 'backVillainImage', 'backFateImage', 'backExtraImage']) {
      delete light[k]
    }
    if (Array.isArray(light.backOverlays)) {
      light.backOverlays = (light.backOverlays as Record<string, unknown>[]).map((o) => { delete o.image; return o })
    }
    if (light.backExtra && typeof light.backExtra === 'object') {
      const be = light.backExtra as Record<string, unknown>
      if (Array.isArray(be.overlays)) {
        be.overlays = (be.overlays as Record<string, unknown>[]).map((o) => { delete o.image; return o })
      }
    }
    if (Array.isArray(light.cards)) {
      light.cards = (light.cards as Record<string, unknown>[]).map((c) => { delete c.image; delete c.artImage; return c })
    }
    const json = JSON.stringify(light, null, 2)
    // 1) Tente d'écrire dans le dépôt (serveur de dév).
    try {
      const res = await fetch('/__save-villain-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id, json }),
      })
      if (res.ok) {
        const { path } = (await res.json()) as { path: string }
        alert(`Vilain exporté (sans images) dans ${path}`)
        return
      }
    } catch {
      /* pas de serveur de dév → téléchargement */
    }
    // 2) Repli : téléchargement.
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${draft.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onPlayClick = async () => {
    if (!draft || busy) return
    if (!isDeckComplete(draft)) {
      const c = deckCounts(draft)
      alert(
        `La planche doit être pleine pour tester : ${c.villain}/${VILLAIN_DECK_SIZE} cartes Vilain et ${c.fate}/${FATE_DECK_SIZE} Fatalité (onglet « Quantité »).`,
      )
      setTab('quantity')
      return
    }
    const baked = await bakeAndSave(draft)
    onPlay(baked, testOpponent || undefined)
  }

  /** Lit un fichier Excel/ODS (template Villainous) et propose ses vilains à importer. */
  const onImportExcel = async (file: File | undefined) => {
    if (!file || busy) return
    setBusy(true)
    try {
      const found = await parseExcelVillains(file, new Date().toISOString())
      if (found.length === 0) {
        alert('Aucun vilain reconnu dans ce fichier (format « Villainous Card Generator » attendu).')
        return
      }
      setExcelChoices(found)
    } catch (e) {
      alert(`Lecture du fichier impossible : ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  /** Importe le vilain choisi depuis l'Excel : id unique, sauvegarde, ouverture. */
  const chooseExcelVillain = async (ev: ExcelVillain) => {
    const taken = new Set(villains.map((v) => v.id))
    let id = ev.villain.id
    for (let n = 2; taken.has(id); n++) id = `${ev.villain.id}-${n}`
    const copy = { ...ev.villain, id }
    setExcelChoices(null)
    await save(copy)
    startEdit(copy)
  }

  // « Terminer » : publie le vilain (il rejoint la liste + le choix des vilains).
  // Exige une planche pleine, puis ouvre la modale créateur/origine.
  const onFinishClick = () => {
    if (!draft || busy) return
    if (!isDeckComplete(draft)) {
      const c = deckCounts(draft)
      alert(
        `La planche doit être pleine pour terminer : ${c.villain}/${VILLAIN_DECK_SIZE} cartes Vilain et ${c.fate}/${FATE_DECK_SIZE} Fatalité (onglet « Quantité »).`,
      )
      setTab('quantity')
      return
    }
    // Première publication : exiger une victoire en partie de test (bouton « Tester »).
    if (!draft.published && !testWonIds.includes(draft.id)) {
      alert('Pour terminer ce vilain, gagne d’abord une partie avec lui via le bouton « ▶ Tester ».')
      return
    }
    setPublishOpen(true)
  }

  /** Confirme la publication : fige les images, marque `published` + créateur/origine,
   *  sauvegarde (le store l'enregistre alors au runtime → jouable comme un natif). */
  const doPublish = async (creator: string, origin: VillainOrigin) => {
    if (!draft || busy) return
    setPublishOpen(false)
    const name = draft.name
    const wasPublished = draft.published
    const baked = await bakeAndSave({ ...draft, published: true, creator: creator.trim() || undefined, origin })
    // Écrit aussi ses fichiers dans assets/ (decks/<Nom>/, portraits, presentations,
    // pions) comme un vilain natif. Best-effort : sans serveur de dév, on n'affiche rien.
    const exp = await exportVillainAssets(baked)
    const filesMsg = exp.ok ? `\n\n${exp.written} fichier(s) rangés dans assets/.` : ''
    // EMBARQUE le vilain (JSON complet avec images) dans `src/data/published/` : chargé au
    // démarrage, il devient disponible pour TOUS les joueurs (après commit + redéploiement).
    // Best-effort : ne marche qu'avec le serveur de dév (apply: 'serve').
    let sharedMsg = ''
    try {
      const res = await fetch('/__publish-villain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: baked.id, json: JSON.stringify(baked) }),
      })
      if (res.ok) sharedMsg = '\n\nEmbarqué dans l’app (src/data/published/) — committe + redéploie pour le rendre disponible à tous.'
    } catch {
      /* pas de serveur de dév : le vilain reste local (IndexedDB) */
    }
    alert(
      (wasPublished
        ? `Les modifications de « ${name} » ont été appliquées à sa version jouable.`
        : `« ${name} » a rejoint la liste et le choix des vilains !`) + filesMsg + sharedMsg,
    )
  }

  const bg = villainsBackground(draft?.color ?? '#3a2d6b', draft?.color ?? '#3a2d6b')
  const complete = draft ? isDeckComplete(draft) : false
  // Test réussi (victoire) avec ce vilain ? Requis pour une PREMIÈRE publication
  // (les rééditions d'un vilain déjà publié n'y sont plus soumises).
  const testWon = !!draft && testWonIds.includes(draft.id)
  const canPublish = complete && (!!draft?.published || testWon)

  return (
    <div className="flex h-screen flex-col text-white" style={{ background: bg }}>
      {/* Barre supérieure */}
      <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/30 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (draft ? setDraft(null) : onBack())}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
          >
            ← {draft ? 'Liste' : 'Menu'}
          </button>
          <h1 className="text-lg font-bold text-amber-200">
            {draft ? `Éditeur — ${draft.name}` : 'Atelier des vilains'}
          </h1>
        </div>
        {draft && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {busy ? (
              <span className="text-xs text-amber-300/70">⏳ génération…</span>
            ) : (
              dirty && <span className="text-xs text-amber-300/70">● non enregistré</span>
            )}
            {!complete && (
              <span className="text-xs text-amber-300/70" title="Remplis la planche dans l’onglet Quantité">
                ⚠ planche incomplète
              </span>
            )}
            {complete && !draft.published && !testWon && (
              <span className="text-xs text-amber-300/70" title="Gagne une partie avec ce vilain via « ▶ Tester » pour pouvoir le terminer">
                🏆 gagne un test pour terminer
              </span>
            )}
            <button
              type="button"
              onClick={onFinishClick}
              disabled={busy || !canPublish}
              title={
                !complete
                  ? 'Planche incomplète (onglet Quantité)'
                  : draft.published
                    ? 'Appliquer les modifications à la version jouable'
                    : testWon
                      ? 'Terminer : rejoindre la liste et le choix des vilains'
                      : 'Gagne d’abord une partie avec lui via « ▶ Tester »'
              }
              className="rounded-lg border border-amber-300/60 bg-amber-400/20 px-4 py-1.5 text-sm font-bold text-amber-100 transition hover:bg-amber-400/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {draft.published ? '✓ Terminé' : '✓ Terminer'}
            </button>
            <button
              type="button"
              onClick={onExportJson}
              disabled={busy}
              title="Exporter ce vilain en fichier .json (sauvegarde / partage)"
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200 disabled:opacity-50"
            >
              ⬇ .json
            </button>
            {/* Choix de l'ADVERSAIRE pour la partie de test (sinon aléatoire). */}
            <label className="flex items-center gap-1 rounded-lg border border-emerald-400/60 bg-emerald-400/10 px-2 py-1.5 text-xs font-semibold text-emerald-100">
              🆚
              <select
                value={testOpponent}
                onChange={(ev) => setTestOpponent(ev.target.value as VillainKey | '')}
                title="Adversaire de la partie de test"
                className="max-w-[10rem] bg-transparent text-sm font-semibold text-emerald-100 outline-none [&>option]:bg-slate-900 [&>option]:text-white"
              >
                <option value="">Adversaire : aléatoire</option>
                {(Object.keys(VILLAIN_REGISTRY) as VillainKey[])
                  .map((k) => ({ k, name: VILLAIN_REGISTRY[k].def.name }))
                  .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                  .map(({ k, name }) => (
                    <option key={k} value={k}>{name}</option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              onClick={onPlayClick}
              disabled={busy || !complete}
              title={complete ? 'Tester contre le bot' : 'Planche incomplète (onglet Quantité)'}
              className="rounded-lg border border-emerald-400/60 bg-emerald-400/20 px-4 py-1.5 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ▶ Tester
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={busy}
              className="rounded-lg border border-amber-400/60 bg-amber-400/20 px-4 py-1.5 text-sm font-bold text-amber-100 transition hover:bg-amber-400/30 disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        )}
      </header>

      {/* Corps */}
      {!draft ? (
        // --- Vue LISTE ---------------------------------------------------------
        <Scroller className="flex-1 p-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={startNew}
                className="rounded-xl border border-amber-400/60 bg-amber-400/20 px-5 py-2.5 font-bold text-amber-100 transition hover:bg-amber-400/30"
              >
                + Nouveau vilain
              </button>
              <input
                ref={excelRef}
                type="file"
                accept=".xlsx,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet"
                className="hidden"
                onChange={(e) => {
                  void onImportExcel(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => excelRef.current?.click()}
                disabled={busy}
                className="rounded-xl border border-emerald-400/50 bg-emerald-400/15 px-5 py-2.5 font-semibold text-emerald-100 transition hover:bg-emerald-400/25 disabled:opacity-50"
              >
                Importer (feuille Excel)
              </button>
            </div>

            {villains.length === 0 ? (
              <p className="text-white/50">
                Aucun vilain personnalisé pour l’instant. Crée-en un avec « Nouveau vilain ».
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {villains.map((v) => (
                  <div
                    key={v.id}
                    className="group flex flex-col overflow-hidden rounded-xl border border-white/15 bg-black/30"
                  >
                    <button
                      type="button"
                      onClick={() => startEdit(v)}
                      className="relative aspect-square w-full overflow-hidden"
                      style={{ backgroundColor: v.color }}
                    >
                      {v.portrait ? (
                        <img src={v.portrait} alt={v.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-4xl text-white/30">
                          🎭
                        </div>
                      )}
                    </button>
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <span className="truncate font-semibold">{v.name}</span>
                      <span className="text-xs text-white/40">
                        {'★'.repeat(v.stars)} · {v.cards.length} cartes · {v.locations.length} lieux
                      </span>
                      {v.published && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/80">
                          ✓ Publié
                        </span>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(v)}
                          className="flex-1 rounded-lg border border-white/15 bg-white/5 py-1 text-xs font-semibold text-white/70 transition hover:text-amber-200"
                        >
                          Éditer
                        </button>
                        {v.published ? (
                          // Vilain publié : non supprimable (toujours disponible pour le modifier).
                          <span
                            title="Vilain publié — non supprimable. Tu peux toujours le modifier via « Éditer »."
                            className="cursor-not-allowed rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/30"
                          >
                            🔒
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Supprimer « ${v.name} » ?`)) void remove(v.id)
                            }}
                            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/50 transition hover:border-red-400/60 hover:text-red-300"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Scroller>
      ) : (
        // --- Vue ÉDITION -------------------------------------------------------
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Onglets */}
          <nav className="flex gap-1 border-b border-white/10 bg-black/20 px-6">
            {([
              ['identity', 'Identité'],
              ['board', 'Plateau'],
              ['cards', `Cartes (${draft.cards.length})`],
              ['quantity', complete ? 'Quantité ✓' : 'Quantité'],
            ] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  tab === key
                    ? 'border-amber-400 text-amber-200'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <Scroller className="flex-1 p-6">
            <div className="mx-auto max-w-5xl">
              {tab === 'identity' && (
                <div className="flex flex-col gap-8">
                  <IdentityTab draft={draft} patch={patch} onFramePortrait={() => setPortraitFrameOpen(true)} />
                  <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
                      Dos des cartes — ornements
                    </span>
                    <div className="flex flex-wrap items-start gap-6">
                      {/* Dos Vilain : éditeur interactif (importer / déplacer / redimensionner). */}
                      <div className="flex flex-col items-center gap-1">
                        <CardBackLayout
                          color={draft.color}
                          name={draft.name}
                          overlays={draft.backOverlays ?? []}
                          onChange={(backOverlays) => patch({ backOverlays })}
                        />
                        <span className="text-[10px] text-white/50">Vilain</span>
                      </div>
                      {/* Dos Fatalité : aperçu (mêmes ornements, parchemin). */}
                      <CardBackPreview
                        color={FATE_CARD_COLOR}
                        name={draft.name}
                        caption="Fatalité"
                        paper
                        overlays={draft.backOverlays}
                      />
                    </div>
                  </div>
                  {/* 3e dos : uniquement si le vilain a au moins un paquet perso. */}
                  {(draft.extraDecks?.length ?? 0) > 0 && (
                    <ExtraBackSection draft={draft} patch={patch} />
                  )}
                </div>
              )}
              {tab === 'board' && <BoardTab draft={draft} patch={patch} />}
              {tab === 'cards' && <CardsTab draft={draft} patch={patch} />}
              {tab === 'quantity' && <QuantityTab draft={draft} patch={patch} />}
            </div>
          </Scroller>
        </div>
      )}

      {/* Modale : choix du vilain à importer depuis la feuille Excel. */}
      {excelChoices && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setExcelChoices(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-lg flex-col gap-3 overflow-hidden rounded-2xl border border-white/15 bg-[#1a1620] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-amber-200">Importer un vilain</h2>
              <button
                type="button"
                onClick={() => setExcelChoices(null)}
                className="rounded-lg px-2 py-1 text-sm text-white/50 transition hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-white/45">
              Choisis le vilain à importer. Ses cartes (nom, type, coût, force, texte, quantité) sont
              reprises. Tu ajouteras ensuite les <strong>images</strong> et ajusteras le plateau /
              l’objectif dans l’Atelier.
            </p>
            <div className="flex flex-col gap-2 overflow-y-auto">
              {excelChoices.map((ev) => (
                <button
                  key={ev.villain.id}
                  type="button"
                  onClick={() => void chooseExcelVillain(ev)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-left transition hover:border-amber-300/70 hover:bg-amber-400/10"
                >
                  <span className="font-semibold">{ev.name}</span>
                  <span className="shrink-0 text-xs text-white/45">{ev.cardCount} carte(s)</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modale : publication (« Terminer ») — créateur + catégorie. */}
      {publishOpen && draft && (
        <PublishModal
          draft={draft}
          busy={busy}
          onCancel={() => setPublishOpen(false)}
          onConfirm={(creator, origin) => void doPublish(creator, origin)}
        />
      )}

      {/* Barre de chargement pendant la génération des images (bake). */}
      {bakeProgress && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
          <div className="flex w-80 max-w-full flex-col gap-3 rounded-2xl border border-white/15 bg-[#1a1620] p-6 shadow-2xl">
            <span className="text-sm font-bold text-amber-200">⏳ Génération du vilain…</span>
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-amber-400 transition-[width] duration-150"
                style={{ width: `${Math.round((bakeProgress.done / bakeProgress.total) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-white/50">
              {bakeProgress.done} / {bakeProgress.total} images
            </span>
          </div>
        </div>
      )}

      {/* Éditeur de portrait (cadre doré + nom). On l'encadre TOUJOURS à partir du
          portrait BRUT (portraitRaw, sinon le portrait actuel) pour ne pas empiler les
          cadres ; on conserve ce brut pour les ré-éditions. */}
      {portraitFrameOpen && draft && (
        <PortraitEditorModal
          onClose={() => setPortraitFrameOpen(false)}
          custom={{
            portrait: draft.portraitRaw ?? draft.portrait,
            name: draft.name,
            crop: draft.portraitCrop,
            onApply: (portrait, portraitCrop) =>
              patch({ portrait, portraitRaw: draft.portraitRaw ?? draft.portrait, portraitCrop }),
          }}
        />
      )}
    </div>
  )
}
