import { useState } from 'react'
import { PATCH_NOTES, PATCH_TAG_META } from '../patchNotes'
import { OptionsButton } from '../components/OptionsButton'
import { Scroller } from '../components/Scroller'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { usePlayerStore } from '../store/playerStore'
import { useIsDesktopApp } from '../store/settingsStore'
import { playHover, playProfileHover } from '../sfx'

interface Props {
  /** Aller au choix du mode de partie (solo / réseau). */
  onNewGame: () => void
  /** Lancer le tutoriel interactif (apprendre à jouer). */
  onTutorial: () => void
  /** Ouvrir la liste des vilains. */
  onVillainList: () => void
  /** Ouvrir l'atelier de création de vilains (éditeur). */
  onEditor: () => void
  /** Ouvrir le rapport des tests (outil de dév). */
  onTestReport: () => void
  /** Ouvrir l'écran de profil (statistiques). */
  onProfile: () => void
  /** Rejouer la cinématique d'intro. */
  onReplayIntro: () => void
}

/** Un bouton de menu réutilisant le style « HearthStone » (cf. index.css). La variante
 *  (`classique` par défaut, `sombre` pour les outils de dév) choisit la teinte. */
function MenuButton({
  label,
  onClick,
  variant = 'classique',
}: {
  label: string
  onClick: () => void
  variant?: 'classique' | 'sombre'
}) {
  return (
    <button type="button" onClick={onClick} onMouseEnter={playHover} className={`hs-wrapper ${variant}`}>
      <span className={`hs-button ${variant}`}>
        <span className={`hs-border ${variant}`}>
          <span className={`hs-text ${variant}`}>{label}</span>
        </span>
      </span>
    </button>
  )
}

/**
 * Rend un texte de note en convertissant les marqueurs Markdown de gras `**…**`
 * en vrai gras. (Les textes des notes utilisent ce balisage ; on ne veut pas
 * afficher les astérisques bruts.)
 */
function renderRichText(text: string) {
  // Découpe en alternant segments normaux / segments gras (groupe capturé).
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((part, i) =>
    // Index impair = contenu entre `**…**` → en gras.
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-white/95">
        {part}
      </strong>
    ) : (
      part
    ),
  )
}

/**
 * Panneau « notes de version » sous forme d'accordéon : seuls les titres sont
 * listés (du plus récent au plus ancien) ; un clic sur une note la développe pour
 * révéler le détail des changements. La plus récente est ouverte par défaut.
 */
function PatchNotesPanel() {
  // Version actuellement développée (la plus récente au démarrage), ou null si tout replié.
  const [openVersion, setOpenVersion] = useState<string | null>(PATCH_NOTES[0]?.version ?? null)
  return (
    <div className="flex w-[22rem] max-w-[90vw] flex-col rounded-2xl border border-white/15 bg-black/40 p-4 backdrop-blur-sm">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-200">
        📋 Notes de version
      </h2>
      <Scroller className="max-h-[36rem]">
        <ul className="flex flex-col gap-1 pr-2">
          {PATCH_NOTES.map((note, noteIdx) => {
            const isOpen = openVersion === note.version
            return (
              <li key={`${note.version}-${noteIdx}`}>
                <button
                  type="button"
                  onClick={() => setOpenVersion(isOpen ? null : note.version)}
                  onMouseEnter={playHover}
                  className="flex w-full flex-col gap-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="flex items-baseline gap-1.5 text-sm font-semibold text-purple-200">
                      <span className="shrink-0 text-amber-300/70">{isOpen ? '▾' : '▸'}</span>
                      v{note.version} — {note.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-white/40">{note.date}</span>
                  </span>
                  {note.tags && note.tags.length > 0 && (
                    <span className="flex flex-wrap gap-1 pl-4">
                      {note.tags.map((tag) => {
                        const meta = PATCH_TAG_META[tag]
                        return (
                          <span
                            key={tag}
                            className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${meta.className}`}
                          >
                            {meta.emoji} {meta.label}
                          </span>
                        )
                      })}
                    </span>
                  )}
                </button>
                {isOpen && (
                  <ul className="mt-1 space-y-1 pb-2 pl-4 pr-2">
                    {note.changes.map((c, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-snug text-white/75">
                        <span className="shrink-0 text-amber-300/80">•</span>
                        <span>{renderRichText(c)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </Scroller>
    </div>
  )
}

/** Modale « Crédits » : texte simple, fermable au clic en dehors ou sur « Fermer ». */
function CreditsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-[28rem] max-w-[90vw] flex-col items-center gap-6 rounded-2xl border border-white/15 bg-[#15101f] p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-amber-200">Crédits</h2>
        <div className="space-y-3 text-sm leading-relaxed text-white/80">
          <p className="text-lg font-semibold text-purple-200">Disney Villainous</p>
          <p>
            Développement : Jules &amp; Alexis
            <br />
            Assistant : Claude Code
          </p>
          <p className="border-t border-white/10 pt-3 text-xs leading-relaxed text-white/45">
            Application non officielle. Il s'agit d'un projet personnel, réalisé uniquement à des
            fins privées et de loisir, qui ne sera jamais publié ni distribué. Il n'a aucun but
            commercial : aucune somme d'argent n'est ni ne sera perçue d'aucune manière. Disney
            Villainous, ainsi que les noms, personnages et univers Disney associés, demeurent la
            propriété de leurs détenteurs respectifs. Aucune affiliation ni approbation officielle
            n'est revendiquée.
          </p>
        </div>
        <div className="w-44">
          <MenuButton label="Fermer" onClick={onClose} />
        </div>
      </div>
    </div>
  )
}

/**
 * Menu principal : logo, entrées (Nouvelle partie, Liste des villains, Options),
 * et un panneau de notes de version listant les changements récents.
 */
export function MainMenu({ onNewGame, onTutorial, onVillainList, onEditor, onTestReport, onProfile, onReplayIntro }: Props) {
  const playerName = usePlayerStore((s) => s.name)
  // L'Atelier des vilains est un outil de création réservé au dév : masqué dans
  // l'exe (et en simulation « .exe »), comme le Mode test et la Banque de sons.
  const isDesktopApp = useIsDesktopApp()
  // Confirmation avant de fermer l'application (bouton « Quitter »).
  const [confirmQuit, setConfirmQuit] = useState(false)
  // Ouverture de la modale « Crédits » (bouton sous les notes de version).
  const [showCredits, setShowCredits] = useState(false)
  // Ferme la fenêtre Electron → `window-all-closed` → `app.quit()`. (Sans effet dans
  // un onglet de navigateur classique, mais le jeu cible l'app de bureau.)
  const quitApp = () => window.close()
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-14 overflow-hidden p-6 text-white">
      {/* Arrière-plan (photo + voile + orbes) fourni par <MenuBackground/> à la racine. */}

      {/* Notes de version : ancrées en haut à gauche, avec le bouton « Crédits » dessous. */}
      <div className="absolute left-6 top-6 z-10 flex flex-col items-start gap-3">
        <PatchNotesPanel />
        <button
          type="button"
          onClick={() => setShowCredits(true)}
          onMouseEnter={playHover}
          title="Crédits"
          className="flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-sm font-semibold text-white/70 backdrop-blur-sm transition hover:border-amber-300/70 hover:text-amber-200"
        >
          ⭐ Crédits
        </button>
      </div>

      {/* Profil : avatar rond ancré en haut à droite. */}
      <button
        type="button"
        onClick={onProfile}
        onMouseEnter={playProfileHover}
        title="Mon profil"
        aria-label="Mon profil"
        className="group absolute right-6 top-6 z-10 flex flex-col items-center gap-1 transition hover:brightness-110"
      >
        <PlayerAvatar
          size={70}
          className="opacity-50 transition group-hover:border-amber-300/80 group-hover:opacity-100"
        />
        {playerName.trim() && (
          <span className="max-w-[8rem] truncate text-sm font-semibold text-white/60 transition group-hover:text-amber-200">
            {playerName}
          </span>
        )}
      </button>

      <header className="relative z-10 text-center">
        <img
          src="/titre_villainous.png"
          alt="Disney Villainous"
          className="mx-auto w-[52rem] max-w-[92vw] drop-shadow-[0_6px_24px_rgba(0,0,0,0.95)]"
        />
        <p className="mt-4 text-base uppercase tracking-[0.4em] text-amber-300/70">
          Quel méchant sommeille en vous ?
        </p>
      </header>

      <nav className="relative z-10 flex w-[32rem] max-w-[90vw] flex-col gap-5">
        <MenuButton label="Nouvelle partie" onClick={onNewGame} />
        <MenuButton label="Liste des villains" onClick={onVillainList} />
        <MenuButton label="🎓 Tutoriel" onClick={onTutorial} />
        {!isDesktopApp && <MenuButton label="Atelier des vilains" onClick={onEditor} variant="sombre" />}
        {!isDesktopApp && <MenuButton label="Rapport des tests" onClick={onTestReport} variant="sombre" />}
        <MenuButton label="Quitter" onClick={() => setConfirmQuit(true)} />
      </nav>

      {/* Cinématique : rejoue la vidéo d'intro. Ancré en bas à gauche. */}
      <button
        type="button"
        onClick={onReplayIntro}
        onMouseEnter={playHover}
        title="Revoir la cinématique d'introduction"
        className="absolute bottom-6 left-6 z-10 flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-sm font-semibold text-white/70 backdrop-blur-sm transition hover:border-amber-300/70 hover:text-amber-200"
      >
        🎬 Cinématique
      </button>

      {/* Options : bouton icône (engrenage) ancré en bas à droite. */}
      <OptionsButton />

      {/* Modale « Crédits ». */}
      {showCredits && <CreditsModal onClose={() => setShowCredits(false)} />}

      {/* Confirmation de fermeture (mêmes boutons / bruitages que le menu). */}
      {confirmQuit && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => setConfirmQuit(false)}
        >
          <div
            className="flex flex-col items-center gap-6 rounded-2xl border border-white/15 bg-[#15101f] p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xl font-bold text-amber-200">Quitter le jeu ?</span>
            <div className="flex gap-4">
              <div className="w-44">
                <MenuButton label="Quitter" onClick={quitApp} />
              </div>
              <div className="w-44">
                <MenuButton label="Annuler" onClick={() => setConfirmQuit(false)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
