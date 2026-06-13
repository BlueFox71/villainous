import { useState } from 'react'
import { PATCH_NOTES } from '../patchNotes'
import { OptionsModal } from '../components/OptionsModal'
import { Scroller } from '../components/Scroller'

interface Props {
  /** Aller au choix du mode de partie (solo / réseau). */
  onNewGame: () => void
  /** Ouvrir la liste des vilains. */
  onVillainList: () => void
  /** Ouvrir l'écran de profil (statistiques). */
  onProfile: () => void
  /** Ouvrir la page de test des sons. */
  onSoundTest: () => void
}

/** Un bouton de menu réutilisant le style « HearthStone » (cf. index.css). */
function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="hs-wrapper classique">
      <span className="hs-button classique">
        <span className="hs-border classique">
          <span className="hs-text classique">{label}</span>
        </span>
      </span>
    </button>
  )
}

/** Panneau « notes de version » : liste claire des changements, du plus récent au plus ancien. */
function PatchNotesPanel() {
  return (
    <div className="flex w-[22rem] max-w-[90vw] flex-col rounded-2xl border border-white/15 bg-black/40 p-4 backdrop-blur-sm">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-200">
        📋 Notes de version
      </h2>
      <Scroller className="max-h-[36rem]">
        <ul className="flex flex-col gap-4 pr-2">
          {PATCH_NOTES.map((note) => (
            <li key={note.version}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-purple-200">
                  v{note.version} — {note.title}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-white/40">{note.date}</span>
              </div>
              <ul className="mt-1 space-y-1">
                {note.changes.map((c, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-snug text-white/75">
                    <span className="shrink-0 text-amber-300/80">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Scroller>
    </div>
  )
}

/**
 * Menu principal : logo, entrées (Nouvelle partie, Liste des villains, Options),
 * et un panneau de notes de version listant les changements récents.
 */
export function MainMenu({ onNewGame, onVillainList, onProfile, onSoundTest }: Props) {
  const [showOptions, setShowOptions] = useState(false)

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-14 overflow-hidden bg-[#0b0a12] p-6 text-white">
      {/* Image de fond floutée + voile sombre pour ne pas gêner le premier plan. */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/menu_bg_disney.jpg)' }}
        aria-hidden
      />
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 0%, rgba(37,20,71,0.55) 0%, rgba(19,12,36,0.75) 45%, rgba(11,10,18,0.9) 100%)',
        }}
        aria-hidden
      />

      {/* Notes de version : ancrées en haut à gauche. */}
      <div className="absolute left-6 top-6 z-10">
        <PatchNotesPanel />
      </div>

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
        <MenuButton label="Mon profil" onClick={onProfile} />
        <MenuButton label="Banque de sons" onClick={onSoundTest} />
        <MenuButton label="Options" onClick={() => setShowOptions(true)} />
      </nav>

      {showOptions && <OptionsModal onClose={() => setShowOptions(false)} />}
    </div>
  )
}
