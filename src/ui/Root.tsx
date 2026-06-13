import { useEffect } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import App from './App'
import { MainMenu } from './screens/MainMenu'
import { VillainList } from './screens/VillainList'
import { VillainSelect } from './screens/VillainSelect'
import { Profile } from './screens/Profile'
import { SoundTest } from './screens/SoundTest'
import { MenuMusicPlayer } from './components/MenuMusicPlayer'
import { playClick } from './sfx'

/** Chemins des écrans (une route par page). */
const ROUTES = {
  menu: '/',
  select: '/nouvelle-partie',
  game: '/partie',
  villains: '/vilains',
  profile: '/profil',
  sounds: '/sons',
} as const

// --- Écrans câblés à la navigation par URL ---------------------------------

function MenuRoute() {
  const navigate = useNavigate()
  return (
    <MainMenu
      onNewGame={() => navigate(ROUTES.select)}
      onVillainList={() => navigate(ROUTES.villains)}
      onProfile={() => navigate(ROUTES.profile)}
      onSoundTest={() => navigate(ROUTES.sounds)}
    />
  )
}

function SelectRoute() {
  const navigate = useNavigate()
  return (
    <VillainSelect
      onStart={() => navigate(ROUTES.game)}
      onBack={() => navigate(ROUTES.menu)}
    />
  )
}

function GameRoute() {
  const navigate = useNavigate()
  return <App onExit={() => navigate(ROUTES.menu)} />
}

function VillainListRoute() {
  const navigate = useNavigate()
  return <VillainList onBack={() => navigate(ROUTES.menu)} />
}

function ProfileRoute() {
  const navigate = useNavigate()
  return <Profile onBack={() => navigate(ROUTES.menu)} />
}

function SoundTestRoute() {
  const navigate = useNavigate()
  return <SoundTest onBack={() => navigate(ROUTES.menu)} />
}

/** Musique de menu : jouée sur les écrans hors-jeu, sauf la banque de sons (qui
 *  doit rester silencieuse) et l'écran de jeu (qui a sa propre musique). */
function MenuMusic() {
  const { pathname } = useLocation()
  if (pathname === ROUTES.game || pathname === ROUTES.sounds) return null
  return <MenuMusicPlayer />
}

/**
 * Racine de l'application : une route par écran (menu, choix du vilain, jeu,
 * liste des vilains, profil, banque de sons). Le jeu lui-même vit dans <App/>.
 */
export default function Root() {
  // Son de clic sur TOUS les boutons (non désactivés), partout dans l'app.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest('button')
      if (btn && !(btn as HTMLButtonElement).disabled) playClick()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.menu} element={<MenuRoute />} />
        <Route path={ROUTES.select} element={<SelectRoute />} />
        <Route path={ROUTES.game} element={<GameRoute />} />
        <Route path={ROUTES.villains} element={<VillainListRoute />} />
        <Route path={ROUTES.profile} element={<ProfileRoute />} />
        <Route path={ROUTES.sounds} element={<SoundTestRoute />} />
        {/* Route inconnue → menu. */}
        <Route path="*" element={<Navigate to={ROUTES.menu} replace />} />
      </Routes>
      <MenuMusic />
    </BrowserRouter>
  )
}
