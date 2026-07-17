// Bandeau du TUTORIEL interactif : affiche la consigne de l'étape courante en bas de
// l'écran. Étape informative → bouton « Suivant »/« Terminer » ; étape « action » →
// rappel que le jeu attend l'action indiquée (le verrouillage vit dans gameStore.submit).
import { useGameStore } from '../store/gameStore'
import { TUTORIAL_STEPS } from '../tutorial/steps'

/** Rend un texte avec `**gras**` en <strong>. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="text-amber-200">{p}</strong> : <span key={i}>{p}</span>))}
    </>
  )
}

export function TutorialOverlay({ onFinish }: { onFinish: () => void }) {
  const tutorial = useGameStore((s) => s.tutorial)
  const tutorialNext = useGameStore((s) => s.tutorialNext)
  const endTutorial = useGameStore((s) => s.endTutorial)
  if (!tutorial) return null
  const step = TUTORIAL_STEPS[tutorial.stepIndex]
  if (!step) return null
  const isLast = tutorial.stepIndex >= TUTORIAL_STEPS.length - 1
  const quit = () => { endTutorial(); onFinish() }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center p-4">
      <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-amber-400/40 bg-[#160f08]/95 p-4 text-white shadow-[0_0_24px_rgba(0,0,0,0.6)]">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-amber-300/80">
            🎓 Tutoriel · étape {tutorial.stepIndex + 1}/{TUTORIAL_STEPS.length}
          </span>
          <button
            type="button"
            onClick={quit}
            className="text-[11px] text-white/40 transition hover:text-rose-300"
          >
            Quitter le tuto
          </button>
        </div>
        <p className="text-sm leading-relaxed text-white/85">
          <RichText text={step.text} />
        </p>
        <div className="mt-3 flex items-center justify-end gap-2">
          {step.info ? (
            isLast ? (
              <button
                type="button"
                onClick={quit}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-bold text-black transition hover:bg-amber-400"
              >
                Terminer
              </button>
            ) : (
              <button
                type="button"
                onClick={tutorialNext}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-bold text-black transition hover:bg-amber-400"
              >
                Suivant →
              </button>
            )
          ) : (
            <span className="text-[11px] italic text-amber-200/60">Effectue l'action indiquée pour continuer…</span>
          )}
        </div>
      </div>
    </div>
  )
}
