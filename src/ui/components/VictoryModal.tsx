import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MenuOrbs } from './MenuOrbs'
import { villainPresentation, villainPortrait } from '../villainArt'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { playVictoryJingle, playDefeatJingle } from '../sfx'

/** Une goutte de pluie (position + cadence aléatoires), façon CodePen « rain ». */
interface Drop {
  pos: number // % depuis le bord (gauche pour l'avant, droite pour l'arrière)
  bottom: number // % (point de départ au-dessus du cadre)
  delay: string
  dur: string
}

/** Génère une rangée de gouttes (mêmes randomisations que l'exemple d'origine). */
function makeDrops(): Drop[] {
  const drops: Drop[] = []
  let inc = 0
  while (inc < 100) {
    const hundo = Math.floor(Math.random() * 98) + 1 // 1..98
    const fiver = Math.floor(Math.random() * 4) + 2 // 2..5
    inc += fiver
    drops.push({
      pos: inc,
      bottom: fiver + fiver - 1 + 100,
      delay: `0.${hundo}s`,
      dur: `0.5${hundo}s`,
    })
  }
  return drops
}

interface Props {
  /** Vilain VAINQUEUR (son nom apparaît dans le texte « … l'emporte / triomphe »). */
  winnerKey: VillainKey
  /** Vilain PERDANT (affiché à la place du vainqueur en cas de défaite). */
  loserKey: VillainKey
  /** Le joueur humain a-t-il gagné ? (titre « Victoire » sinon « Défaite »). */
  humanWon: boolean
  /** « Regarder le plateau » : ferme le modal, le plateau reste inactif. */
  onWatch: () => void
  /** « Rejouer avec les mêmes vilains » : redémarre sans changer les vilains. */
  onReplay: () => void
  /** « Accueil » : retour au menu principal. */
  onHome: () => void
  /** Proposer « Rejouer » ? (faux en réseau : un redémarrage solo n'a pas de sens). */
  canReplay?: boolean
}

/**
 * Écran de fin de partie : « VICTOIRE » / « DÉFAITE ».
 *  - Victoire : illustration du vainqueur + orbes flottants, halo doré pulsant, rayons.
 *  - Défaite : illustration du PERDANT (le vilain du joueur) sous la PLUIE (pas d'orbes).
 * Le texte « … l'emporte » désigne toujours le VAINQUEUR. Trois choix : regarder le
 * plateau / rejouer / accueil.
 */
export function VictoryModal({ winnerKey, loserKey, humanWon, onWatch, onReplay, onHome, canReplay = true }: Props) {
  // Gouttes de pluie (défaite) : générées une fois par montage.
  const frontDrops = useMemo(() => makeDrops(), [])
  const backDrops = useMemo(() => makeDrops(), [])

  // Jingle d'apparition de l'écran : victoire ou défaite (une seule fois, même en
  // StrictMode qui monte le composant deux fois en développement).
  const jinglePlayedRef = useRef(false)
  useEffect(() => {
    if (jinglePlayedRef.current) return
    jinglePlayedRef.current = true
    if (humanWon) playVictoryJingle()
    else playDefeatJingle()
  }, [humanWon])

  // Image : le vainqueur si victoire, sinon le perdant (le vilain du joueur).
  const shownKey = humanWon ? winnerKey : loserKey
  const img = villainPresentation(shownKey) ?? villainPortrait(shownKey)
  // Le texte cite TOUJOURS le vainqueur.
  const winnerName = VILLAIN_REGISTRY[winnerKey]?.def.name ?? ''

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden bg-black/85">
      {humanWon ? (
        <>
          {/* Victoire : orbes flottants + rayons tournants + halo doré pulsant. */}
          <MenuOrbs />
          <div className="victory-rays" aria-hidden />
          <div
            className="victory-halo"
            aria-hidden
            style={{ background: 'radial-gradient(circle, rgba(250,204,21,0.45) 0%, rgba(250,204,21,0) 65%)' }}
          />
        </>
      ) : (
        <>
          {/* Défaite : halo sombre (pas d'orbes). La PLUIE est rendue plus bas,
              DEVANT l'image, concentrée au centre (sur le vilain perdant). */}
          <div
            className="victory-halo"
            aria-hidden
            style={{ background: 'radial-gradient(circle, rgba(60,80,120,0.35) 0%, rgba(0,0,0,0) 65%)' }}
          />
        </>
      )}

      <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center">
        <h1
          className={`text-6xl font-black tracking-[0.15em] drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)] sm:text-7xl ${
            humanWon ? 'victory-title text-amber-300' : 'defeat-title text-slate-300'
          }`}
        >
          {humanWon ? 'VICTOIRE' : 'DÉFAITE'}
        </h1>

        <img
          src={img}
          alt={VILLAIN_REGISTRY[shownKey]?.def.name ?? ''}
          className={`villain-fade-bottom victory-pop max-h-[46vh] w-auto object-contain drop-shadow-[0_12px_44px_rgba(0,0,0,0.75)] ${
            humanWon ? '' : 'brightness-75 grayscale-[0.4]'
          }`}
        />

        <p className="text-lg font-semibold text-white/85">
          {humanWon ? `${winnerName} triomphe !` : `${winnerName} l'emporte…`}
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onWatch}
            className="rounded-xl border border-white/25 px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/10"
          >
            👁 Regarder le plateau
          </button>
          {canReplay && (
            <button
              type="button"
              onClick={onReplay}
              className="rounded-xl border border-amber-400/60 bg-amber-400/15 px-5 py-2.5 text-sm font-bold text-amber-100 transition hover:bg-amber-400/30"
            >
              🔁 Rejouer (mêmes vilains)
            </button>
          )}
          <button
            type="button"
            onClick={onHome}
            className="rounded-xl border border-white/25 px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/10"
          >
            🏠 Accueil
          </button>
        </div>
      </div>

      {/* Défaite : PLUIE (gouttes + tige + éclaboussure) DEVANT le vilain (z > contenu).
          Deux rangées : avant (gauche, nette) et arrière (droite, pâle, décalée). */}
      {!humanWon && (
        <div className="defeat-rain-wrap" aria-hidden>
          <div className="rain front-row">
            {frontDrops.map((d, i) => (
              <div key={i} className="drop" style={{ left: `${d.pos}%`, bottom: `${d.bottom}%`, animationDelay: d.delay, animationDuration: d.dur }}>
                <div className="stem" style={{ animationDelay: d.delay, animationDuration: d.dur }} />
                <div className="splat" style={{ animationDelay: d.delay, animationDuration: d.dur }} />
              </div>
            ))}
          </div>
          <div className="rain back-row">
            {backDrops.map((d, i) => (
              <div key={i} className="drop" style={{ right: `${d.pos}%`, bottom: `${d.bottom}%`, animationDelay: d.delay, animationDuration: d.dur }}>
                <div className="stem" style={{ animationDelay: d.delay, animationDuration: d.dur }} />
                <div className="splat" style={{ animationDelay: d.delay, animationDuration: d.dur }} />
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .victory-halo {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 90vh;
          height: 90vh;
          pointer-events: none;
          filter: blur(8px);
          animation: victoryHalo 3.6s ease-in-out infinite;
        }
        @keyframes victoryHalo {
          0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.95; transform: translate(-50%, -50%) scale(1.12); }
        }
        .victory-rays {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 160vh;
          height: 160vh;
          pointer-events: none;
          transform: translate(-50%, -50%);
          background: repeating-conic-gradient(
            from 0deg,
            rgba(255, 226, 130, 0.12) 0deg 6deg,
            rgba(255, 226, 130, 0) 6deg 18deg
          );
          mask-image: radial-gradient(circle, black 0%, transparent 62%);
          -webkit-mask-image: radial-gradient(circle, black 0%, transparent 62%);
          animation: victoryRays 26s linear infinite;
        }
        @keyframes victoryRays {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .victory-title { animation: victoryTitle 2.4s ease-in-out infinite; }
        @keyframes victoryTitle {
          0%, 100% { text-shadow: 0 4px 24px rgba(0,0,0,0.85), 0 0 10px rgba(250,204,21,0.35); }
          50% { text-shadow: 0 4px 24px rgba(0,0,0,0.85), 0 0 26px rgba(250,204,21,0.85); }
        }
        .victory-pop { animation: victoryPop 0.5s cubic-bezier(0.18, 0.9, 0.3, 1.2) both; }
        @keyframes victoryPop {
          0% { opacity: 0; transform: scale(0.7) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        /* DÉFAITE : le mot apparaît droit, puis s'incline lourdement à 45° vers le
           bas (effet dramatique de « chute »). */
        .defeat-title { animation: defeatTilt 0.32s cubic-bezier(0.6, 0, 0.7, 1) 0.55s both; }
        @keyframes defeatTilt {
          0% { transform: rotate(0deg) translateY(0); }
          100% { transform: rotate(45deg) translateY(0.18em); }
        }
        /* Pluie de défaite (d'après l'effet « rain » de CodePen) : gouttes faites
           d'une tige qui tombe + une éclaboussure à l'impact. Rendue DEVANT le vilain. */
        .defeat-rain-wrap { position: absolute; inset: 0; pointer-events: none; z-index: 20; }
        .rain { position: absolute; left: 0; width: 100%; height: 100%; }
        .rain.front-row { z-index: 2; }
        .rain.back-row { z-index: 1; bottom: 60px; opacity: 0.5; }
        .drop {
          position: absolute;
          bottom: 100%;
          width: 15px;
          height: 120px;
          pointer-events: none;
          animation: drop 0.5s linear infinite;
        }
        @keyframes drop {
          0% { transform: translateY(0vh); }
          75% { transform: translateY(90vh); }
          100% { transform: translateY(90vh); }
        }
        .stem {
          width: 1px;
          height: 60%;
          margin-left: 7px;
          background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.35));
          animation: stem 0.5s linear infinite;
        }
        @keyframes stem {
          0% { opacity: 1; }
          65% { opacity: 1; }
          75% { opacity: 0; }
          100% { opacity: 0; }
        }
        .splat {
          width: 15px;
          height: 10px;
          border-top: 2px dotted rgba(255,255,255,0.5);
          border-radius: 50%;
          opacity: 1;
          transform: scale(0);
          animation: splat 0.5s linear infinite;
        }
        @keyframes splat {
          0% { opacity: 1; transform: scale(0); }
          80% { opacity: 1; transform: scale(0); }
          90% { opacity: 0.5; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.5); }
        }
      `}</style>
    </div>,
    document.body,
  )
}
