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
  isVillainDeveloped,
  DEFAULT_EXTRA_BACK,
  extraBackColor,
  extraBackPaper,
  mergeGameData,
  syncVariantFromBase,
  variantSyncState,
  type CustomVillain,
  type VillainOrigin,
} from '../../data/customVillain'
import { villainsBackground } from '../villainColors'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { Scroller } from '../components/Scroller'
import { SplitPortrait } from '../components/SplitPortrait'
import { Field, TextField, ColorField, ImageField, AudioField, SelectField } from '../editor/fields'
import { BoardTab } from '../editor/BoardTab'
import { CardsTab } from '../editor/CardsTab'
import { AllCardsPanel } from '../editor/AllCardsPanel'
import { QuantityTab } from '../editor/QuantityTab'
import { StrategyTab } from '../editor/StrategyTab'
import { CommitPanel } from '../editor/CommitPanel'
import { useIsDesktopApp } from '../store/settingsStore'
import { bakeVillain } from '../editor/bake'
import { renderCardBack } from '../editor/cardRender'
import { parseExcelVillains, type ExcelVillain } from '../editor/importExcel'

interface Props {
  onBack: () => void
  /** Lance une partie de test avec ce vilain (déjà figé/baké). `opponent` = clé du vilain
   *  adverse choisi (undefined = adversaire aléatoire). */
  onPlay: (custom: CustomVillain, opponent?: VillainKey) => void
  /** Retour depuis une partie de TEST (« Retourner à l'atelier ») : id du vilain à rouvrir
   *  directement en édition (une seule fois, au montage). */
  openVillainId?: string
}

/** Onglets de l'éditeur. */
type Tab = 'identity' | 'board' | 'cards' | 'quantity' | 'strategy' | 'botplay' | 'journal'

/** Onglets « stratégie » verrouillés tant que le vilain n'est pas développé. */
const STRATEGY_TABS: Tab[] = ['strategy', 'botplay', 'journal']

/** Petit tooltip stylé au survol (bulle sombre sous l'élément), plus lisible que le
 *  `title` natif. Enveloppe un déclencheur (bouton…) et s'affiche même s'il est
 *  désactivé (le survol est capté par le conteneur, pas par le bouton). */
function Tooltip({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max max-w-[16rem] -translate-x-1/2 whitespace-normal rounded-lg border border-white/15 bg-[#1a1620] px-3 py-2 text-center text-xs font-medium text-white/85 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}

/** Progression de l'enregistrement : `{done, total}` d'images figées + `phase` (étape
 *  courante : « Génération des cartes/dos/plateau », « Sauvegarde… », « ✓ Terminé »). */
interface SaveProgress {
  done: number
  total: number
  phase: string
  /** Titre de l'overlay pendant l'opération (défaut « ⏳ Enregistrement… »). */
  title?: string
}

/** Overlay affiché pendant « Enregistrer » / « Publier » : barre de progression à ÉTAPES
 *  nommées (Génération → Sauvegarde → Terminé), puis fermeture automatique. */
function SaveProgressOverlay({ done, total, phase, title }: SaveProgress) {
  const isDone = phase.startsWith('✓')
  const isSaving = phase.startsWith('Sauvegarde')
  const pct = total > 0 ? Math.round((done / total) * 100) : isDone ? 100 : 0
  const stepClass = (active: boolean, passed: boolean) =>
    active ? 'font-semibold text-amber-200' : passed ? 'text-emerald-300/80' : 'text-white/35'
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-80 max-w-full flex-col gap-3 rounded-2xl border border-white/15 bg-[#1a1620] p-6 shadow-2xl">
        <span className={`text-sm font-bold ${isDone ? 'text-emerald-300' : 'text-amber-200'}`}>
          {isDone ? '✓ Enregistré' : (title ?? '⏳ Enregistrement…')}
        </span>
        {!isDone && <span className="text-xs text-white/70">Étape : {phase}</span>}
        <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-[width] duration-200 ${isDone ? 'bg-emerald-400' : 'bg-amber-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] text-white/45">
          {isDone ? 'Brouillon sauvegardé.' : isSaving ? 'Sauvegarde du brouillon…' : `${done} / ${total} images`}
        </span>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className={stepClass(!isDone && !isSaving, isSaving || isDone)}>Génération</span>
          <span className="text-white/25">→</span>
          <span className={stepClass(isSaving, isDone)}>Sauvegarde</span>
          <span className="text-white/25">→</span>
          <span className={stepClass(isDone, false)}>✓ Terminé</span>
        </div>
      </div>
    </div>
  )
}

// --- Onglet Identité ---------------------------------------------------------

function IdentityTab({
  draft,
  patch,
  variant = false,
  onFramePortrait,
}: {
  draft: CustomVillain
  patch: (p: Partial<CustomVillain>) => void
  /** Mode VARIANTE liée : la difficulté (partagée avec la base) est masquée ; seuls les
   *  champs de présentation surchargeables restent éditables. */
  variant?: boolean
  /** Ouvre l'Éditeur de portrait (cadre doré + nom) pour le portrait carré. */
  onFramePortrait: () => void
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <TextField label="Nom du vilain" value={draft.name} onChange={(name) => patch({ name })} />
        <TextField
          label="Devise du vilain"
          value={draft.devise ?? ''}
          onChange={(devise) => patch({ devise })}
          textarea
        />
        <AudioField
          label="Devise en audio"
          value={draft.audio}
          onChange={(audio) => patch({ audio })}
        />
        {!variant && (
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
        )}
        <ColorField label="Couleur thématique" value={draft.color} onChange={(color) => patch({ color })} />
        <p className="text-xs text-white/45">
          {variant
            ? 'Variante liée : couleur, nom, devise, portrait, présentation, audio, dos (ornements), plateau (lieux) et une sélection de cartes lui sont propres. Le reste (règles, deck) vient de la base.'
            : 'Le dos des cartes Vilain reprend la couleur thématique ; le dos des cartes Fatalité reste blanc (parchemin d’origine).'}
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
  // Le créateur est Jules ou Alexis ; la catégorie est toujours « Collaboration ».
  const CREATORS = ['Jules', 'Alexis'] as const
  const [creator, setCreator] = useState(draft.creator ?? '')
  const [origin, setOrigin] = useState<VillainOrigin>(draft.origin ?? 'Collaborations')
  const ORIGINS: { value: VillainOrigin; label: string; hint: string }[] = [
    { value: 'Disney', label: 'Disney / Pixar', hint: 'Univers Disney' },
    { value: 'Marvel', label: 'Marvel', hint: 'Univers Marvel' },
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
            {draft.published ? 'Mettre à jour le vilain' : 'Publier le vilain'}
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

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-white/80">Créateur</span>
          <div className="grid grid-cols-2 gap-2">
            {CREATORS.map((c) => {
              const active = creator === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCreator(c)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? 'border-amber-300/60 bg-amber-400/20 text-amber-200'
                      : 'border-white/15 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-white/80">Catégorie</span>
          <div className="grid grid-cols-3 gap-2">
            {ORIGINS.map((o) => {
              const active = origin === o.value
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOrigin(o.value)}
                  title={o.hint}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? 'border-amber-300/60 bg-amber-400/20 text-amber-200'
                      : 'border-white/15 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={busy || !creator}
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

export function VillainEditor({ onBack, onPlay, openVillainId }: Props) {
  const { villains, loaded, load, save, remove, unpublish, createLinkedVariant } = useCustomVillainStore()
  const [draft, setDraft] = useState<CustomVillain | null>(null)
  const [tab, setTab] = useState<Tab>('identity')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  // Adversaire choisi pour la partie de TEST ('' = aléatoire). Liste des vilains natifs.
  const [testOpponent, setTestOpponent] = useState<VillainKey | ''>('')
  // Modale de publication (« Terminer ») : ouverte tant qu'elle collecte créateur + origine.
  const [publishOpen, setPublishOpen] = useState(false)
  // Modale de DÉPUBLICATION : vilain visé (null = fermée) + indicateur d'opération en cours.
  const [unpublishTarget, setUnpublishTarget] = useState<CustomVillain | null>(null)
  const [unpublishBusy, setUnpublishBusy] = useState(false)
  // Modale de SUPPRESSION DE VARIANTE (depuis l'onglet Identité) : variante visée + busy.
  const [deleteVariantTarget, setDeleteVariantTarget] = useState<CustomVillain | null>(null)
  const [deleteVariantBusy, setDeleteVariantBusy] = useState(false)
  // Éditeur de portrait (cadre doré + nom) pour le portrait carré du vilain perso.
  const [portraitFrameOpen, setPortraitFrameOpen] = useState(false)
  const excelRef = useRef<HTMLInputElement>(null)
  // Vilains trouvés dans une feuille Excel, en attente de choix (modale).
  const [excelChoices, setExcelChoices] = useState<ExcelVillain[] | null>(null)
  // Vilains custom ayant déjà gagné une partie de test (condition de 1re publication).
  const testWonIds = useTestWinStore((s) => s.wonIds)
  // Progression du « bake » (génération des images) pour la barre de chargement.
  const [bakeProgress, setBakeProgress] = useState<SaveProgress | null>(null)
  // Retour visuel bref après « Copier les consignes » de développement.
  const [promptCopied, setPromptCopied] = useState(false)
  // Web uniquement (cf. dev-only-ui-gating) : boutons de développement via Claude Code.
  const isDesktopApp = useIsDesktopApp()

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  const startEdit = (v: CustomVillain) => {
    // Plus d'hydratation : le vilain listé est déjà complet (JSON « chemins »).
    setDraft(structuredClone(v))
    setTab('identity')
    setDirty(false)
  }

  // Retour depuis une partie de test : rouvrir directement le vilain testé, UNE SEULE fois
  // (une fois les vilains chargés). Le ref évite une réouverture si la liste change ensuite.
  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (autoOpenedRef.current || !loaded || !openVillainId) return
    const v = villains.find((x) => x.id === openVillainId)
    if (v) {
      autoOpenedRef.current = true
      // Ouverture ponctuelle au retour de test : le setState ici est intentionnel (pas une
      // synchro en boucle — verrouillé par autoOpenedRef).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startEdit(v)
    }
  }, [loaded, openVillainId, villains])

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
  const bakeAndSave = async (v: CustomVillain, opts?: { title?: string }): Promise<CustomVillain> => {
    const title = opts?.title
    setBusy(true)
    setBakeProgress({ done: 0, total: v.cards.length + 3, phase: 'Préparation…', title })
    try {
      const baked = await bakeVillain(v, (done, total, phase) => setBakeProgress({ done, total, phase, title }))
      // Étape « Sauvegarde » (barre pleine) pendant la persistance IndexedDB + disque.
      setBakeProgress((p) => ({ done: p?.total ?? 1, total: p?.total ?? 1, phase: 'Sauvegarde…', title }))
      await save(baked)
      setDraft(baked)
      setDirty(false)
      // État final « ✓ Terminé » affiché brièvement, puis fermeture automatique.
      setBakeProgress((p) => ({ done: p?.total ?? 1, total: p?.total ?? 1, phase: '✓ Terminé', title }))
      await new Promise((r) => setTimeout(r, 900))
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

  // --- Variantes liées (« skins ») -------------------------------------------
  // Base d'une variante en cours d'édition (dans la liste chargée) + état de synchro.
  const variantBase = draft?.variantOf ? villains.find((x) => x.id === draft.variantOf) : undefined
  const isVariant = !!draft?.variantOf
  const syncState = draft ? variantSyncState(draft, variantBase) : 'independent'
  // Variante liée d'un vilain de BASE en cours d'édition (une base = au plus une variante).
  const linkedVariant = draft && !draft.variantOf ? villains.find((x) => x.variantOf === draft.id) : undefined

  /** Bascule l'édition vers un autre vilain (base ↔ variante). Prévient la perte de
   *  modifications non enregistrées. */
  const trySwitchTo = (v: CustomVillain) => {
    if (busy) return
    if (dirty && !confirm('Des modifications ne sont pas enregistrées. Changer de vilain les abandonnera. Continuer ?')) return
    startEdit(v)
  }

  /** Supprime une variante liée (dépublie d'abord si besoin) puis ferme la modale. */
  const doDeleteVariant = async (v: CustomVillain) => {
    if (deleteVariantBusy) return
    setDeleteVariantBusy(true)
    try {
      if (v.published) await unpublish(v.id)
      await remove(v.id)
      setDeleteVariantTarget(null)
    } finally {
      setDeleteVariantBusy(false)
    }
  }

  /** Supprime un vilain de BASE et, le cas échéant, sa variante liée (en cascade), pour
   *  ne pas laisser une variante orpheline. Dépublie ce qui est publié avant de retirer. */
  const removeWithVariant = async (base: CustomVillain) => {
    const variant = villains.find((x) => x.variantOf === base.id)
    if (variant) {
      if (variant.published) await unpublish(variant.id)
      await remove(variant.id)
    }
    await remove(base.id)
  }

  /** Crée une variante liée d'un vilain (skin) : demande un nom, la crée/persiste puis
   *  l'ouvre directement en édition. */
  const onCreateVariant = async (base: CustomVillain) => {
    if (busy) return
    const name = prompt(`Nom de la variante liée de « ${base.name} » :`, `${base.name} (variante)`)?.trim()
    if (!name) return
    const id = await createLinkedVariant(base.id, name)
    const created = useCustomVillainStore.getState().villains.find((x) => x.id === id)
    if (created) startEdit(created)
  }

  /** Resynchronise la variante en cours depuis sa base : recompose les données (mécaniques
   *  + présentation des cartes liées) puis re-bake les images à la couleur de la variante. */
  const onResync = async () => {
    if (!draft || !variantBase || busy) return
    const synced = syncVariantFromBase(variantBase, draft)
    await bakeAndSave(synced)
  }

  /** Construit le JSON ALLÉGÉ (sans les images, lourdes en dataURL) du vilain : uniquement
   *  les données de jeu (cartes, lieux, objectif…) — suffisant pour relire / coder ses effets. */
  const buildLightJson = (v: CustomVillain): string => {
    // Clone puis retire toutes les images (dataURL) pour un fichier léger et lisible.
    const light = JSON.parse(JSON.stringify(v)) as Record<string, unknown>
    for (const k of ['portrait', 'presentation', 'portraitRaw', 'boardArt', 'boardImage', 'pawnImage', 'backVillainImage', 'backFateImage', 'backExtraImage', 'audio']) {
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
    return JSON.stringify(light, null, 2)
  }

  /** Écrit le JSON allégé dans le dépôt via le serveur de dév (`assets/custom-exports/<id>.json`).
   *  Renvoie le chemin écrit, ou `null` si le serveur de dév est absent. */
  const writeVillainJson = async (id: string, json: string): Promise<string | null> => {
    try {
      const res = await fetch('/__save-villain-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, json }),
      })
      if (res.ok) return ((await res.json()) as { path: string }).path
    } catch {
      /* pas de serveur de dév */
    }
    return null
  }

  /** Exporte le vilain en cours en .json ALLÉGÉ. Écrit dans le dépôt si le serveur de
   *  dév est là ; sinon, repli sur un téléchargement. */
  const onExportJson = async () => {
    if (!draft) return
    const json = buildLightJson(draft)
    // 1) Tente d'écrire dans le dépôt (serveur de dév).
    const path = await writeVillainJson(draft.id, json)
    if (path) {
      alert(`Vilain exporté (sans images) dans ${path}`)
      return
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

  /** Chemin du .json allégé dans le dépôt (mêmes règles de « slugification » que
   *  l'endpoint DEV `/__save-villain-json`). */
  const jsonPathOf = (id: string): string =>
    `assets/custom-exports/${id.replace(/[^a-z0-9_-]+/gi, '-')}.json`

  /** Construit le prompt de développement (consignes détaillées) à coller dans une
   *  nouvelle session Claude Code pour coder les effets de ce vilain de l'Atelier.
   *  RÈGLE CENTRALE : le vilain RESTE un CustomVillain (l'Atelier est la source
   *  unique). On n'en fait JAMAIS un vilain natif — on n'ajoute au moteur que des
   *  capacités GÉNÉRIQUES, déclarées ensuite en DONNÉE sur le JSON du vilain. */
  const buildDevPrompt = (v: CustomVillain): string => {
    const jsonPath = jsonPathOf(v.id)
    return `Développe ENTIÈREMENT le vilain de l'Atelier « ${v.name} » (id \`${v.id}\`). Fais-le MAINTENANT, carte par carte, de façon autonome et rigoureuse.

⚠️ CE VILAIN RESTE UN VILAIN DE L'ATELIER (custom, data-driven). L'Atelier est la SOURCE UNIQUE. Ne le porte JAMAIS en vilain natif : ne crée AUCUN fichier \`src/data/villains/*.ts\`, ne le câble PAS dans \`data/registry.ts\`, \`ui/store/gameStore.ts\` (VILLAINS / VillainKey / UNRELEASED_VILLAINS), \`ui/villainArt.ts\`, \`ui/villainColors.ts\`, \`ui/screens/VillainList.tsx\`.

📄 FICHIER À ÉDITER (données de jeu, SANS images — petit et lisible)
\`${jsonPath}\`
C'est l'export allégé du vilain : cartes (id, nom, type, coût, force, texte, quantité, \`effects\`), lieux (actions), objectif. TU ÉDITES CE FICHIER : ajoute les \`effects\` sur chaque carte, renseigne l'\`objective\`, pose les \`fateMalus\`. NE modifie pas les images (elles ne sont pas ici, elles restent dans l'Atelier).
➡️ IMPORTANT : l'app ne lit PAS ce fichier directement. Quand tu as fini, dis à l'utilisateur de cliquer « ⟳ Synchroniser » dans l'Atelier pour réinjecter tes données de jeu dans le brouillon (les images sont conservées).

🎴 EFFETS DES CARTES (règle centrale)
Traduis le texte FR de CHAQUE carte en \`effects\` DONNÉES — jamais de comportement branché par cardId/villainId dans le moteur.
1. Réutilise un \`Effect\` existant (cf. \`engine/types.ts\` union Effect + \`engine/effects.ts\`).
2. Sinon crée un \`Effect\` PARAMÉTRABLE GÉNÉRIQUE (1 variant dans \`engine/types.ts\` + 1 case dans \`engine/effects.ts\`), jamais spécifique à ce vilain. Si l'effet est SIMPLE (paramètres numériques) ajoute-le aussi au catalogue \`src/ui/editor/effectCatalog.ts\`.
3. Pose l'effet en DONNÉE sur la carte (\`effects: [...]\`) dans le fichier ci-dessus.
Force PASSIVE : champs data (attachStrengthBonus, selfStrengthMods, strengthMod), jamais un effect.

🏁 OBJECTIF INÉDIT (si le texte l'exige)
Ajoute un variant à \`ObjectiveDef\` (\`engine/types.ts\`) + sa condition de victoire (\`engine/rules.ts\`), branchés par TYPE d'objectif. Renseigne \`objective\` dans le JSON.

🖱️ INTERACTIVITÉ (non négociable)
Toute carte impliquant un CHOIX du joueur (quel Héros/Allié/Objet, quel lieu, action « vous pouvez… ») doit être interactive : état \`pendingXXX\` + modale ou clic plateau (réutilise pendingFateChoice, pendingHeroRelocate, pendingReveal…). Jamais d'auto-pick humain. Une carte sans cible valide est injouable (grisée + garde-fou moteur). Couvre le flux interactif par des tests.

⚔️ CLASSEMENT FATALITÉ (malus IA — OBLIGATOIRE)
Écris le \`fateMalus\` PAR CARTE (champ sur la carte du JSON — PAS dans \`data/fateMalus.ts\`) : 'slow'/'slow2'/'slow3' (RALENTIT) < 'block-advance'/'block-advance3' (EMPÊCHE D'AVANCER) < 'block-win' (EMPÊCHE DE GAGNER) ; NEUTRE = pas de \`fateMalus\` (typiquement le Héros-cible). PRÉSENTE le tableau récapitulatif (carte → effet → catégorie + règle d'évitement/ciblage) pour validation, et reporte dans la mémoire projet « villainous-fate-malus ».

🎯 JAUGE D'OBJECTIF (IA — OBLIGATOIRE)
Implémente/branche \`objectiveScore\` (\`ai/heuristicBot.ts\`) par TYPE d'objectif (ou par id custom \`${v.id}\` si vraiment spécifique, cf. custom-mr-monopoly / custom-gul-dan), reflétant la VRAIE proximité de victoire. PRÉSENTE les paliers/poids (0→1) pour validation.

🧠 STRATÉGIE BOT (onglets « Codage Cartes » + « Bot adverse » de l'Atelier — OBLIGATOIRE)
Renseigne l'objet \`botStrategy\` dans le JSON ci-dessus (préremplit les deux onglets, VERROUILLÉS tant que le vilain n'est pas développé). Décris ce que TU as compris, en langage joueur, pour que l'utilisateur corrige vite.
Volet « Codage Cartes » (comment CHAQUE carte est codée) :
- \`botStrategy.howToWin\` : le plan de jeu du bot pour remplir l'objectif.
- \`botStrategy.villainNotes\` : dictionnaire { cardId → description } pour CHAQUE carte Vilain — ce que fait la carte ET ses conditions de jouabilité (quand/pourquoi elle est jouable ou grisée).
- \`botStrategy.fateNotes\` : dictionnaire { cardId → { description, asReceiver, asAttacker } } pour CHAQUE carte Fatalité : \`description\` = effet + conditions ; \`asReceiver\` = conseil quand le bot SUBIT cette Fatalité ; \`asAttacker\` = quand/sur qui l'INFLIGER.
Volet « Bot adverse » (comment le BOT joue) :
- \`botStrategy.botPlay\` : objet { general, villainNotes { cardId → texte }, fateNotes { cardId → { description, asReceiver, asAttacker } } } décrivant le COMPORTEMENT du bot — priorités, cibles et timing pour chaque carte.
Volet « Journal » (message écrit dans le Journal de partie) :
- \`botStrategy.journal\` : objet { villainNotes { cardId → texte }, fateNotes { cardId → { description } } } — UN message par carte, tel qu'il apparaîtra dans le Journal quand la carte est jouée (pas de \`general\`, pas de \`asReceiver\`/\`asAttacker\`).
Toute carte/champ que tu n'as pas développé : mets exactement \`"Non développé"\`.

✅ FINI
Lance \`npm run test\` et \`npm run lint\`. Puis rappelle à l'utilisateur de cliquer « ⟳ Synchroniser » dans l'Atelier, de tester via « ▶ Tester », et de publier via « ✓ Publier » quand c'est prêt. En cas de doute sur une règle Villainous, demande.`
  }

  /** Écrit le JSON allégé (pour qu'il soit à jour) puis copie les consignes de
   *  développement dans le presse-papier — à coller dans une nouvelle session. */
  const onCopyDevPrompt = async () => {
    if (!draft) return
    // Réécrit le .json pour qu'il soit à jour et présent à l'emplacement cité.
    await writeVillainJson(draft.id, buildLightJson(draft))
    const prompt = buildDevPrompt(draft)
    try {
      await navigator.clipboard.writeText(prompt)
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 1500)
    } catch {
      // Presse-papier indisponible : repli sur un onglet texte à copier à la main.
      const w = window.open('', '_blank')
      if (w) w.document.write(`<pre>${prompt.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))}</pre>`)
    }
  }

  /** Réimporte les données de jeu développées par Claude Code
   *  (`assets/custom-exports/<id>.json`) dans le brouillon courant, images conservées,
   *  puis re-bake (les textes de cartes ont pu changer) + sauve. */
  const onReimport = async () => {
    if (!draft || busy) return
    try {
      const res = await fetch(`/__read-villain-json?id=${encodeURIComponent(draft.id)}`)
      if (!res.ok) {
        alert(
          res.status === 404
            ? 'Rien à synchroniser. Clique d’abord « Développer (Claude Code) », développe le vilain dans une session Claude Code, puis synchronise.'
            : `Synchronisation impossible (${res.status}). Serveur de dév requis.`,
        )
        return
      }
      const { json } = (await res.json()) as { json: string }
      const light = JSON.parse(json) as Partial<CustomVillain>
      const merged = mergeGameData(draft, light)
      await bakeAndSave(merged, { title: '⏳ Synchronisation…' })
    } catch (e) {
      alert(`Synchronisation impossible : ${(e as Error).message}`)
    }
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
    // Pas de modif depuis l'ouverture / dernière sauvegarde → le brouillon est déjà baké
    // (images générées) : on lance directement, sans régénérer les images (coûteux).
    const baked = dirty ? await bakeAndSave(draft) : draft
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

  /** Dépublie le vilain visé : retiré du jeu et de la liste des vilains, et de son
   *  fichier embarqué (« dans le code »). Il redevient un brouillon éditable. */
  const doUnpublish = async (v: CustomVillain) => {
    if (unpublishBusy) return
    setUnpublishBusy(true)
    try {
      await unpublish(v.id)
      setUnpublishTarget(null)
    } finally {
      setUnpublishBusy(false)
    }
  }

  // « Terminer » : publie le vilain (il rejoint la liste + le choix des vilains).
  // Exige une planche pleine, puis ouvre la modale créateur/origine.
  const onFinishClick = () => {
    if (!draft || busy) return
    if (!isDeckComplete(draft)) {
      const c = deckCounts(draft)
      alert(
        `La planche doit être pleine pour publier : ${c.villain}/${VILLAIN_DECK_SIZE} cartes Vilain et ${c.fate}/${FATE_DECK_SIZE} Fatalité (onglet « Quantité »).`,
      )
      setTab('quantity')
      return
    }
    // Première publication : exiger une victoire en partie de test (bouton « Tester »).
    if (!draft.published && !testWonIds.includes(draft.id)) {
      alert('Pour publier ce vilain, gagne d’abord une partie avec lui via le bouton « ▶ Tester ».')
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
    // EMBARQUE le vilain (JSON « chemins », images en fichiers sous public/cards/) dans
    // `src/data/published/` : chargé au démarrage, il devient disponible pour TOUS les
    // joueurs (après commit + redéploiement). Best-effort : ne marche qu'avec le serveur
    // de dév (apply: 'serve').
    let sharedMsg = ''
    try {
      // Protocole LÉGER : id en query, corps = JSON BRUT du vilain (UN SEUL stringify). Le 2e
      // JSON.stringify (qui ré-échapperait ~des dizaines de Mo de base64 sur les gros decks)
      // faisait planter l'onglet (OOM) à la publication. cf. handler /__publish-villain.
      const res = await fetch(`/__publish-villain?id=${encodeURIComponent(baked.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baked),
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
  // L'onglet « Stratégie BOT » n'est accessible qu'une fois le vilain développé
  // (au moins une carte porte un comportement encodé — cf. isVillainDeveloped).
  const developed = draft ? isVillainDeveloped(draft) : false
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
            {/* Indicateurs d'état (à gauche des groupes d'actions). */}
            {busy ? (
              <span className="text-xs text-amber-300/70">⏳ génération…</span>
            ) : (
              dirty && <span className="text-xs text-amber-300/70">● non enregistré</span>
            )}
            {!complete && !isVariant && (
              <span className="text-xs text-amber-300/70" title="Remplis la planche dans l’onglet Quantité">
                ⚠ planche incomplète
              </span>
            )}

            {/* Base ayant une variante liée : basculer vers la variante (skin). */}
            {!isVariant && linkedVariant && (
              <button
                type="button"
                onClick={() => trySwitchTo(linkedVariant)}
                disabled={busy}
                title={`Basculer vers la variante « ${linkedVariant.name} » (même règles, présentation différente).`}
                className="rounded-lg border border-sky-400/50 bg-sky-400/10 px-3 py-1.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-400/20 disabled:opacity-40"
              >
                🎭 Voir {linkedVariant.name} (variante)
              </button>
            )}

            {/* VARIANTE LIÉE : rappel de la base + resynchronisation (recompose depuis la base
                + re-bake à la couleur de la variante). Mis en avant quand la base a évolué. */}
            {isVariant && (
              <div className="flex items-center gap-1.5 rounded-lg border border-sky-400/50 bg-sky-400/10 px-2 py-1">
                <span
                  className="text-xs font-semibold text-sky-200"
                  title={
                    variantBase
                      ? `Variante liée de « ${variantBase.name} » — les mécaniques et la structure viennent de la base.`
                      : 'Variante liée : base introuvable (elle reste éditable/jouable, mais non resynchronisable).'
                  }
                >
                  🎭 {variantBase ? `Variante de ${variantBase.name}` : 'Variante (base absente)'}
                </span>
                {/* Basculer vers la BASE (édition du vilain d'origine). */}
                {variantBase && (
                  <button
                    type="button"
                    onClick={() => trySwitchTo(variantBase)}
                    disabled={busy}
                    className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/80 transition hover:border-sky-300/70 hover:text-sky-200 disabled:opacity-40"
                  >
                    Voir {variantBase.name}
                  </button>
                )}
                <Tooltip
                  label={
                    !variantBase
                      ? 'Base introuvable : resynchronisation impossible.'
                      : syncState === 'stale'
                        ? 'La base a évolué : recompose les données depuis la base et re-génère les images à la couleur de la variante.'
                        : 'Recompose la variante depuis sa base (données + images).'
                  }
                >
                  <button
                    type="button"
                    onClick={() => void onResync()}
                    disabled={busy || !variantBase}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      syncState === 'stale'
                        ? 'border-amber-300/70 bg-amber-400/20 text-amber-100 hover:bg-amber-400/30'
                        : 'border-white/20 bg-white/5 text-white/80 hover:border-sky-300/70 hover:text-sky-200'
                    }`}
                  >
                    {syncState === 'stale' ? '⟳ Resynchroniser (base modifiée)' : '↻ Resynchroniser'}
                  </button>
                </Tooltip>
              </div>
            )}

            {/* Groupe 1 — ÉDITION : exporter / développer. (Développement/Synchro masqués pour
                une variante : ses mécaniques viennent de la base.) */}
            <div className="flex items-center gap-1.5">
              <Tooltip label="Exporter ce vilain en fichier .json (sauvegarde / partage).">
                <button
                  type="button"
                  onClick={onExportJson}
                  disabled={busy}
                  className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200 disabled:opacity-50"
                >
                  ⬇ .json
                </button>
              </Tooltip>
              {/* Développement GRATUIT via Claude Code (abonnement) — web/dev uniquement.
                  Masqué pour une variante (ses mécaniques sont héritées de la base). */}
              {!isDesktopApp && !isVariant && (
                <>
                  <Tooltip
                    label={
                      developed
                        ? 'Vilain déjà développé. Pour l’ajuster, utilise les onglets « Codage Cartes » / « Bot adverse » (champ « À modifier »).'
                        : 'Écrit le JSON de jeu à jour et copie les consignes à coller dans une session Claude Code. ⚠ Ne PUBLIE pas le vilain avant de l’avoir développé.'
                    }
                  >
                    <button
                      type="button"
                      onClick={onCopyDevPrompt}
                      disabled={busy || developed}
                      className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {developed ? '✓ Développé' : promptCopied ? '✓ Consignes copiées' : '🧠 Développer (Claude Code)'}
                    </button>
                  </Tooltip>
                  <Tooltip label="Cliquez ce bouton une fois que Claude Code a développé ce vilain.">
                    <button
                      type="button"
                      onClick={onReimport}
                      disabled={busy}
                      className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200 disabled:opacity-50"
                    >
                      ⟳ Synchroniser
                    </button>
                  </Tooltip>
                </>
              )}
            </div>

            <div className="h-6 w-px bg-white/15" aria-hidden />

            {/* Groupe 2 — TEST : choisir l'adversaire puis lancer une partie de test. */}
            <div className="flex items-center gap-1.5">
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
              <Tooltip label={complete ? 'Lancer une partie de test contre le bot.' : 'Planche incomplète : remplis-la dans l’onglet Quantité.'}>
                <button
                  type="button"
                  onClick={onPlayClick}
                  disabled={busy || !complete}
                  className="rounded-lg border border-emerald-400/60 bg-emerald-400/20 px-4 py-1.5 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ▶ Tester
                </button>
              </Tooltip>
            </div>

            <div className="h-6 w-px bg-white/15" aria-hidden />

            {/* Groupe 3 — ENREGISTRER + PUBLIER : sauver le brouillon / la version jouable.
                « Enregistrer » est masqué pour un vilain DÉJÀ publié : « ↻ Mettre à jour »
                sauvegarde aussi le brouillon (bake + save + publication), donc redondant. */}
            {!draft.published && (
              <Tooltip label={dirty ? 'Enregistrer le brouillon (sans le publier).' : 'Aucune modification à enregistrer.'}>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={busy || !dirty}
                  className="rounded-lg border border-amber-400/60 bg-amber-400/20 px-4 py-1.5 text-sm font-bold text-amber-100 transition hover:bg-amber-400/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Enregistrer
                </button>
              </Tooltip>
            )}
            <Tooltip
              label={
                !complete
                  ? 'Planche incomplète : remplis-la dans l’onglet Quantité.'
                  : draft.published
                    ? 'Appliquer les modifications à la version jouable.'
                    : testWon
                      ? 'Publier : rejoindre la liste et le choix des vilains.'
                      : '🏆 Gagne d’abord un test avec ce vilain (via « ▶ Tester ») pour pouvoir le publier.'
              }
            >
              <button
                type="button"
                onClick={onFinishClick}
                disabled={busy || !canPublish}
                className="rounded-lg border border-amber-300/60 bg-amber-400/20 px-4 py-1.5 text-sm font-bold text-amber-100 transition hover:bg-amber-400/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {draft.published ? '↻ Mettre à jour' : '✓ Publier'}
              </button>
            </Tooltip>
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

            {!loaded ? (
              // Chargement des vilains embarqués (chunks lazy, cf. data/published/load.ts) :
              // sans cet état, la liste vide affichait « Aucun vilain » pendant tout le chargement.
              <div className="flex flex-col items-center gap-4 py-20 text-white/60">
                <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-amber-300" />
                <p>Chargement des vilains…</p>
              </div>
            ) : villains.length === 0 ? (
              <p className="text-white/50">
                Aucun vilain personnalisé pour l’instant. Crée-en un avec « Nouveau vilain ».
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {/* Les vilains FOURNIS DIRECTEMENT (atelierHidden, ex. Ultron) se jouent comme
                    des natifs mais ne sont pas éditables dans l'Atelier : on les masque ici.
                    Une BASE et sa VARIANTE liée sont fusionnées en une seule carte (portrait
                    partagé en diagonale) ; on n'itère donc que sur les « bases » (+ variantes
                    orphelines dont la base a disparu). */}
                {(() => {
                  const shown = villains.filter((v) => !v.atelierHidden)
                  const ids = new Set(shown.map((v) => v.id))
                  const primaries = shown.filter((v) => !v.variantOf || !ids.has(v.variantOf))
                  return primaries.map((base) => {
                    // Variante liée greffée sur la carte de sa base (au plus une par base).
                    const variant = base.variantOf ? undefined : shown.find((x) => x.variantOf === base.id)
                    const state = variant ? variantSyncState(variant, base) : 'independent'
                    return (
                      <div
                        key={base.id}
                        className="group flex flex-col overflow-hidden rounded-xl border border-white/15 bg-black/30"
                      >
                        <button
                          type="button"
                          onClick={() => startEdit(base)}
                          className="relative aspect-square w-full overflow-hidden"
                          style={{ backgroundColor: base.color }}
                        >
                          {variant ? (
                            <SplitPortrait
                              a={{ image: base.portrait, name: base.name, color: base.color }}
                              b={{ image: variant.portrait, name: variant.name, color: variant.color }}
                            />
                          ) : base.portrait ? (
                            <img src={base.portrait} alt={base.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-4xl text-white/30">
                              🎭
                            </div>
                          )}
                        </button>
                        <div className="flex flex-1 flex-col gap-1 p-3">
                          <span className="truncate font-semibold">
                            {variant ? `${base.name} / ${variant.name}` : base.name}
                          </span>
                          <span className="text-xs text-white/40">
                            {'★'.repeat(base.stars)} · {base.cards.length} cartes · {base.locations.length} lieux
                          </span>
                          {/* Variante ORPHELINE (base disparue) : signalée sur sa propre carte. */}
                          {base.variantOf && (
                            <span
                              className="truncate text-[10px] font-semibold text-sky-300/80"
                              title="Variante liée (base introuvable)"
                            >
                              🎭 Variante · <span className="text-rose-300">base absente</span>
                            </span>
                          )}
                          {/* Statut de publication : base + variante (le cas échéant). */}
                          {variant ? (
                            <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-semibold uppercase tracking-wide">
                              <span className={base.published ? 'text-emerald-300/80' : 'text-white/40'}>
                                {base.name} : {base.published ? 'publié' : 'non publié'}
                              </span>
                              <span className={variant.published ? 'text-emerald-300/80' : 'text-white/40'}>
                                {variant.name} : {variant.published ? 'publié' : 'non publié'}
                              </span>
                              {state === 'stale' && (
                                <span className="text-amber-300 normal-case">⟳ variante à resynchroniser</span>
                              )}
                            </span>
                          ) : base.published ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/80">
                              ✓ Publié
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                              Non publié
                            </span>
                          )}
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(base)}
                              className="flex-1 rounded-lg border border-white/15 bg-white/5 py-1 text-xs font-semibold text-white/70 transition hover:text-amber-200"
                            >
                              Éditer
                            </button>
                            {base.published ? (
                              // Vilain publié : bouton DÉPUBLIER (retire du jeu + de la liste).
                              <button
                                type="button"
                                onClick={() => setUnpublishTarget(base)}
                                title="Dépublier ce vilain (le retirer du jeu et de la liste des vilains)"
                                className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/50 transition hover:border-red-400/60 hover:text-red-300"
                              >
                                ✕
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const msg = variant
                                    ? `Supprimer « ${base.name} » et sa variante « ${variant.name} » ?`
                                    : `Supprimer « ${base.name} » ?`
                                  if (confirm(msg)) void (variant ? removeWithVariant(base) : remove(base.id))
                                }}
                                className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/50 transition hover:border-red-400/60 hover:text-red-300"
                              >
                                🗑
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </div>
        </Scroller>
      ) : (
        // --- Vue ÉDITION -------------------------------------------------------
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Onglets */}
          <nav className="flex gap-1 border-b border-white/10 bg-black/20 px-6">
            {(([
              ['identity', 'Identité'],
              ['board', 'Plateau'],
              ['cards', `Cartes (${draft.cards.length})`],
              // Onglets NON pertinents pour une variante (quantité + Codage + Bot adverse =
              // déck/mécaniques, hérités de la base) : masqués en mode variante. Le JOURNAL,
              // lui, reste utile (aperçu avec le nom/couleur de la variante) → toujours visible.
              ...(isVariant
                ? ([['journal', 'Journal']] as [Tab, string][])
                : ([
                    ['quantity', complete ? 'Quantité ✓' : 'Quantité'],
                    ['strategy', 'Codage Cartes'],
                    ['botplay', 'Bot adverse'],
                    ['journal', 'Journal'],
                  ] as [Tab, string][])),
            ] as [Tab, string][])).map(([key, label]) => {
              // Onglets stratégie verrouillés tant que le vilain n'est pas développé.
              const locked = STRATEGY_TABS.includes(key) && !developed
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => !locked && setTab(key)}
                  disabled={locked}
                  title={
                    locked
                      ? 'Développe d’abord le vilain (bouton « Développer (Claude Code) ») pour renseigner sa stratégie.'
                      : undefined
                  }
                  className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${
                    locked
                      ? 'cursor-not-allowed border-transparent text-white/25'
                      : tab === key
                        ? 'border-amber-400 text-amber-200'
                        : 'border-transparent text-white/50 hover:text-white/80'
                  }`}
                >
                  {locked ? `🔒 ${label}` : label}
                </button>
              )
            })}
          </nav>

          <Scroller className="flex-1 p-6">
            <div className={`mx-auto ${STRATEGY_TABS.includes(tab) || tab === 'cards' ? 'max-w-[1800px]' : 'max-w-5xl'}`}>
              {tab === 'identity' && (
                <div className="flex flex-col gap-8">
                  <IdentityTab draft={draft} patch={patch} variant={isVariant} onFramePortrait={() => setPortraitFrameOpen(true)} />
                  {/* Section VARIANTE : sur une base → créer / voir + supprimer sa variante liée ;
                      sur une variante → rappel de la base d'origine. */}
                  {isVariant ? (
                    <div className="flex flex-col gap-1 rounded-xl border border-sky-400/30 bg-sky-400/5 p-4">
                      <span className="text-xs font-semibold uppercase tracking-wide text-sky-200/70">Variante liée</span>
                      <span className="text-sm text-white/80">
                        Variante de{' '}
                        {variantBase ? (
                          <strong className="text-sky-200">{variantBase.name}</strong>
                        ) : (
                          <em className="text-rose-300/80">base introuvable</em>
                        )}
                        {' '}— les règles et le deck viennent de la base.
                      </span>
                    </div>
                  ) : linkedVariant ? (
                    <div className="flex flex-col items-start gap-1 rounded-xl border border-sky-400/30 bg-sky-400/5 p-4">
                      <span className="text-xs font-semibold uppercase tracking-wide text-sky-200/70">Variante</span>
                      <span className="text-sm text-white/80">
                        Variant : <strong className="text-sky-200">{linkedVariant.name}</strong>
                      </span>
                      {/* Bouton discret de suppression, juste sous le texte (pop-up de confirmation). */}
                      <button
                        type="button"
                        onClick={() => setDeleteVariantTarget(linkedVariant)}
                        className="text-[11px] text-white/35 underline-offset-2 transition hover:text-red-300 hover:underline"
                      >
                        Supprimer le variant
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-black/20 p-4">
                      <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Variante</span>
                      <p className="max-w-lg text-xs text-white/45">
                        Crée une 2ᵉ version de ce vilain (un « skin ») : mêmes règles et deck, mais
                        présentation propre (couleur, nom, portrait, lieux et cartes re-illustrées).
                      </p>
                      <button
                        type="button"
                        onClick={() => void onCreateVariant(draft)}
                        disabled={busy}
                        className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-400/20 disabled:opacity-40"
                      >
                        🎭 Créer un variant
                      </button>
                    </div>
                  )}
                  {/* Dos des cartes : propres à la variante (couleur + ornements surchargés). */}
                  <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
                      Dos des cartes — ornements{isVariant && ' (propres à la variante)'}
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
                  {/* 3e dos : uniquement si le vilain a au moins un paquet perso (hérité de la base
                      pour une variante ; sa config de dos reste néanmoins propre à la variante). */}
                  {(draft.extraDecks?.length ?? 0) > 0 && (
                    <ExtraBackSection draft={draft} patch={patch} />
                  )}
                </div>
              )}
              {tab === 'board' && <BoardTab draft={draft} patch={patch} variant={isVariant} />}
              {tab === 'cards' && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_23rem]">
                  <div className="min-w-0">
                    <CardsTab draft={draft} patch={patch} variant={isVariant} base={variantBase} />
                  </div>
                  <div className="xl:sticky xl:top-0 xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto">
                    <AllCardsPanel excludeId={draft.id} />
                  </div>
                </div>
              )}
              {tab === 'quantity' && <QuantityTab draft={draft} patch={patch} />}
              {tab === 'strategy' && <StrategyTab draft={draft} variant="coding" />}
              {tab === 'botplay' && <StrategyTab draft={draft} variant="botPlay" />}
              {tab === 'journal' && <StrategyTab draft={draft} variant="journal" />}
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

      {/* Modale : dépublication d'un vilain publié (« Souhaitez-vous le dépublier ? »). */}
      {unpublishTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !unpublishBusy && setUnpublishTarget(null)}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/15 bg-[#1a1620] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-amber-200">Dépublier le vilain</h2>
            <p className="text-sm text-white/70">
              Souhaitez-vous dépublier « <strong>{unpublishTarget.name}</strong> » ? Il ne sera
              plus visible dans le jeu ni dans la liste des vilains. Il restera un brouillon
              éditable ici (tu pourras le republier plus tard).
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={unpublishBusy}
                onClick={() => setUnpublishTarget(null)}
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-1.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
              >
                Non
              </button>
              <button
                type="button"
                disabled={unpublishBusy}
                onClick={() => void doUnpublish(unpublishTarget)}
                className="rounded-lg border border-red-400/60 bg-red-500/20 px-4 py-1.5 text-sm font-bold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {unpublishBusy ? '⏳…' : 'Oui, dépublier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : suppression d'une VARIANTE liée (depuis l'onglet Identité de sa base). */}
      {deleteVariantTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !deleteVariantBusy && setDeleteVariantTarget(null)}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/15 bg-[#1a1620] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-amber-200">Supprimer le variant</h2>
            <p className="text-sm text-white/70">
              Souhaitez-vous supprimer la variante « <strong>{deleteVariantTarget.name}</strong> » ?
              {deleteVariantTarget.published && ' Elle sera d’abord dépubliée (retirée du jeu).'} Cette
              action est définitive ; le vilain de base n’est pas affecté.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteVariantBusy}
                onClick={() => setDeleteVariantTarget(null)}
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-1.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deleteVariantBusy}
                onClick={() => void doDeleteVariant(deleteVariantTarget)}
                className="rounded-lg border border-red-400/60 bg-red-500/20 px-4 py-1.5 text-sm font-bold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteVariantBusy ? '⏳…' : 'Oui, supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay de progression à étapes (Génération → Sauvegarde → ✓ Terminé) pendant
          « Enregistrer »/« Publier » ; se ferme automatiquement à la fin. */}
      {bakeProgress && <SaveProgressOverlay {...bakeProgress} />}

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

      {/* DEV : panneau « prochain commit » (git status + inclusion par fichier), UNIQUEMENT
          sur la liste de l'Atelier (pas dans l'éditeur d'un vilain : `!draft`). Il se remonte
          en revenant à la liste → recoche tout, y compris le vilain qu'on vient d'enregistrer.
          Absent en build (le serveur de dév n'existe pas → endpoints /__git-* indisponibles). */}
      {import.meta.env.DEV && !draft && <CommitPanel />}
    </div>
  )
}
