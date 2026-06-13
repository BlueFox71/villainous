import { useEffect, useState } from 'react'
import App from './App'
import { MainMenu } from './screens/MainMenu'
import { VillainList } from './screens/VillainList'
import { VillainSelect } from './screens/VillainSelect'
import { Profile } from './screens/Profile'
import { SoundTest } from './screens/SoundTest'
import { MenuMusicPlayer } from './components/MenuMusicPlayer'
import { playClick } from './sfx'

type Screen = 'menu' | 'select' | 'game' | 'villains' | 'profile' | 'sounds'

/**
 * Racine de l'application : aiguille entre le menu principal, le choix du vilain,
 * l'écran de jeu et la liste des vilains. Le jeu lui-même vit dans <App/>.
 */
export default function Root() {
  const [screen, setScreen] = useState<Screen>('menu')

  // Son de clic sur TOUS les boutons (non désactivés), partout dans l'app.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest('button')
      if (btn && !(btn as HTMLButtonElement).disabled) playClick()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  if (screen === 'game') return <App onExit={() => setScreen('menu')} />

  // Écrans hors-jeu : on rend l'écran courant + la musique de menu (continue
  // pendant la navigation entre les écrans du menu).
  const inner =
    screen === 'select' ? (
      <VillainSelect onStart={() => setScreen('game')} onBack={() => setScreen('menu')} />
    ) : screen === 'villains' ? (
      <VillainList onBack={() => setScreen('menu')} />
    ) : screen === 'profile' ? (
      <Profile onBack={() => setScreen('menu')} />
    ) : screen === 'sounds' ? (
      <SoundTest onBack={() => setScreen('menu')} />
    ) : (
      <MainMenu
        onNewGame={() => setScreen('select')}
        onVillainList={() => setScreen('villains')}
        onProfile={() => setScreen('profile')}
        onSoundTest={() => setScreen('sounds')}
      />
    )
  return (
    <>
      {inner}
      {/* La banque de sons sert à écouter les bruitages : on coupe la musique de menu. */}
      {screen !== 'sounds' && <MenuMusicPlayer />}
    </>
  )
}
