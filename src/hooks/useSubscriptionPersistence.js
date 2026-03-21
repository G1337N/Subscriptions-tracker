import { useEffect } from 'react'
import { exportSubscriptions } from '../lib/subscriptionExport'
import { getSettings as getDesktopSettings, importLegacyStore, isTauriRuntime, listSubscriptions as listDesktopSubscriptions } from '../tauriApi'

export const useSubscriptionBootstrap = ({
  defaultAppSettings,
  normalizeSettings,
  normalizeSubscription,
  parseLocalState,
  setAppSettings,
  setSubscriptions,
  setThemePreference,
  themeOptions,
  setPersistenceError,
  setIsLoaded,
}) => {
  useEffect(() => {
    let mounted = true

    const syncExport = async (nextSubscriptions) => {
      try {
        await exportSubscriptions(nextSubscriptions)
      } catch (error) {
        console.error('Failed to export subscriptions on load:', error)
        if (mounted) {
          setPersistenceError('Subscriptions loaded, but export to ~/subscriptions/subscriptions.json failed.')
        }
      }
    }

    const loadSubscriptions = async () => {
      try {
        if (isTauriRuntime) {
          await importLegacyStore()
          const [desktopSubscriptions, settings] = await Promise.all([
            listDesktopSubscriptions(),
            getDesktopSettings(),
          ])

          if (!mounted) return

          const normalizedSubscriptions = desktopSubscriptions.map(normalizeSubscription)
          setSubscriptions(normalizedSubscriptions)
          const normalizedSettings = normalizeSettings(settings)
          setAppSettings(normalizedSettings)
          if (typeof normalizedSettings.themePreference === 'string' && themeOptions.includes(normalizedSettings.themePreference)) {
            setThemePreference(normalizedSettings.themePreference)
          }
          setPersistenceError('')
          await syncExport(normalizedSubscriptions)
        } else {
          const localState = parseLocalState()
          if (!mounted) return

          if (localState) {
            if (Array.isArray(localState.subscriptions)) {
              setSubscriptions(localState.subscriptions.map(normalizeSubscription))
            }

            const nextSettings = normalizeSettings(localState.settings || { themePreference: localState.themePreference })
            setAppSettings(nextSettings)
            if (typeof nextSettings.themePreference === 'string' && themeOptions.includes(nextSettings.themePreference)) {
              setThemePreference(nextSettings.themePreference)
            }
          } else {
            setAppSettings(defaultAppSettings)
          }
        }
      } catch {
        if (mounted) {
          setPersistenceError('Could not load your saved subscriptions.')
        }
      } finally {
        if (mounted) {
          setIsLoaded(true)
        }
      }
    }

    loadSubscriptions()

    return () => {
      mounted = false
    }
  }, [defaultAppSettings, normalizeSettings, normalizeSubscription, parseLocalState, setAppSettings, setSubscriptions, setThemePreference, themeOptions, setPersistenceError, setIsLoaded])
}

export const useBrowserPersistence = ({
  appSettings,
  isLoaded,
  subscriptions,
  localStorageStateKey,
  setPersistenceError,
  toPersistedState,
}) => {
  useEffect(() => {
    if (!isLoaded || isTauriRuntime) return

    try {
      window.localStorage.setItem(localStorageStateKey, JSON.stringify(toPersistedState(subscriptions, appSettings)))
      setPersistenceError('')
    } catch {
      setPersistenceError('Persistence failed: unable to save your data.')
    }
  }, [appSettings, isLoaded, subscriptions, localStorageStateKey, setPersistenceError, toPersistedState])
}
