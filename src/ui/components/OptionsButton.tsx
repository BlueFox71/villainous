import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OptionsModal } from './OptionsModal'

/**
 * Bouton icône « Options » (engrenage) ancré en bas à droite de l'écran, ouvrant
 * la modale de réglages. Partagé par tous les écrans hors-jeu (menu, choix du
 * mode, choix des vilains, réseau, liste des vilains). La banque de sons est
 * atteinte par navigation directe vers `/sons`.
 */
export function OptionsButton() {
  const [showOptions, setShowOptions] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <button
        type="button"
        onClick={() => setShowOptions(true)}
        title="Options"
        aria-label="Options"
        className="group absolute bottom-6 right-6 z-10 flex h-16 w-16 items-center justify-center rounded-full transition hover:scale-110"
      >
        <img
          src="/parameters.png"
          alt=""
          className="h-full w-full object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.7)] transition-transform duration-500 group-hover:rotate-90"
        />
      </button>

      {showOptions && (
        <OptionsModal
          onClose={() => setShowOptions(false)}
          onSoundTest={() => navigate('/sons')}
        />
      )}
    </>
  )
}
