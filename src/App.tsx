import { useState } from 'react'
import { AboutScreen } from './ui/screens/AboutScreen'
import { TitleScreen } from './ui/screens/TitleScreen'

/**
 * Temporary mount for the design lane's visual verification.
 * The app-shell lane will replace this with the hash router later.
 * Append `?save` to the URL to see the enabled Continue state.
 */
export default function App() {
  const [screen, setScreen] = useState<'title' | 'about'>(() =>
    globalThis.location.search.includes('about') ? 'about' : 'title',
  )

  if (screen === 'about') {
    return (
      <AboutScreen
        onBack={() => {
          setScreen('title')
        }}
      />
    )
  }

  return (
    <TitleScreen
      hasSave={globalThis.location.search.includes('save')}
      onNewRun={() => {
        /* wired by the app-shell lane */
      }}
      onContinue={() => {
        /* wired by the app-shell lane */
      }}
      onEnterSeed={() => {
        /* wired by the app-shell lane */
      }}
      onStats={() => {
        /* wired by the app-shell lane */
      }}
      onSettings={() => {
        /* wired by the app-shell lane */
      }}
      onAbout={() => {
        setScreen('about')
      }}
    />
  )
}
