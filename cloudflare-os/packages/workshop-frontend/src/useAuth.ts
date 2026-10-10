import { useState, useEffect, useRef } from 'react'
import { RpcStub } from 'capnweb'
import { PublicApi, AuthenticatedApi } from '@gadgets/workshop-shared/api'
import { setReportedUserId } from './errorReporting'
import { hashPassword } from './passwordHash'

const CF_ACCESS_MODE = import.meta.env.VITE_CF_ACCESS_MODE === 'true'

interface AuthState {
  token: string | null
  authenticatedApi: RpcStub<AuthenticatedApi> | null
  isLoading: boolean
  error: string | null
}

export { CF_ACCESS_MODE }

/**
 * Nettoie un identifiant pour respecter la contrainte Cloudflare DO :
 * Regex serveur : /^[a-z][a-z0-9_]*$/
 */
export function sanitizeUsername(rawId: string): string {
  let clean = (rawId || 'etudiant').toLowerCase().replace(/[^a-z0-9]/g, '_')
  clean = clean.replace(/^[^a-z]+/, '') // commence obligatoirement par une lettre minuscule
  if (!clean) clean = 'etudiant'
  return `sc_${clean.slice(0, 20)}`
}

export function useAuth(publicApi: RpcStub<PublicApi>) {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    authenticatedApi: null,
    isLoading: true,
    error: null
  })

  const authenticatedApiRef = useRef<RpcStub<AuthenticatedApi> | null>(null)
  authenticatedApiRef.current = authState.authenticatedApi

  useEffect(() => {
    const authenticatedApi = authState.authenticatedApi
    if (!authenticatedApi) return
    let cancelled = false
    authenticatedApi.whoami().then((info) => {
      if (!cancelled && info.type === 'user') setReportedUserId(info.id)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [authState.authenticatedApi])

  const authenticateWithToken = (token: string) => {
    setAuthState(prev => {
      if (prev.authenticatedApi) {
        prev.authenticatedApi[Symbol.dispose]()
      }
      return {
        ...prev,
        authenticatedApi: null,
        isLoading: true,
        error: null
      }
    })

    const authenticatedApi = publicApi.authenticate(token)
    setAuthState({
      token,
      authenticatedApi,
      isLoading: false,
      error: null
    })
  }

  const authenticateWithCfAccess = () => {
    setAuthState(prev => {
      if (prev.authenticatedApi) {
        prev.authenticatedApi[Symbol.dispose]()
      }
      return { ...prev, authenticatedApi: null, isLoading: true, error: null }
    })
    const authenticatedApi = publicApi.authenticateFromCfAccess()
    setAuthState({
      token: null,
      authenticatedApi,
      isLoading: false,
      error: null
    })
  }

  useEffect(() => {
    let unmounted = false

    const authenticateWithStudyCloud = async (userId: string, displayName?: string) => {
      try {
        const username = sanitizeUsername(userId)
        const userPass = `sc_studycloud_pass_${username}_2026`
        const lastScId = localStorage.getItem('last_studycloud_user_id')
        const storedToken = localStorage.getItem('authToken')

        // Si même utilisateur et jeton valide déjà en cache
        if (lastScId === userId && storedToken) {
          authenticateWithToken(storedToken)
          return
        }

        if (lastScId && lastScId !== userId) {
          localStorage.removeItem('authToken')
        }

        const passwordHash = await hashPassword(username, userPass)
        let token: string | null = null

        // 1. Tenter la connexion
        try {
          token = await publicApi.login(username, passwordHash)
        } catch {
          token = null
        }

        // 2. Si le compte n'existe pas, le créer automatiquement
        if (!token) {
          try {
            token = await publicApi.createAccount(
              username, 
              displayName || `Étudiant StudyCloud`, 
              passwordHash
            )
          } catch {
            // Si le compte a été créé en parallèle, réessayer le login
            try {
              token = await publicApi.login(username, passwordHash)
            } catch {
              token = null
            }
          }
        }

        if (token && !unmounted) {
          localStorage.setItem('authToken', token)
          localStorage.setItem('last_studycloud_user_id', userId)
          authenticateWithToken(token)
        } else if (!unmounted) {
          // Relance automatique en arrière-plan sans jamais afficher d'écran de connexion
          setTimeout(() => {
            if (!unmounted) authenticateWithStudyCloud(userId, displayName)
          }, 1200)
        }
      } catch (err) {
        console.warn('[StudyCloud SSO AutoAuth]', err)
        if (!unmounted) {
          const storedToken = localStorage.getItem('authToken')
          if (storedToken) {
            authenticateWithToken(storedToken)
          } else {
            setTimeout(() => {
              if (!unmounted) authenticateWithStudyCloud(userId, displayName)
            }, 1800)
          }
        }
      }
    }

    if (CF_ACCESS_MODE) {
      authenticateWithCfAccess()
    } else {
      const urlParams = new URLSearchParams(window.location.search)
      let scUserId = urlParams.get('sc_user_id') || urlParams.get('userId')
      const scUserName = urlParams.get('sc_user_name') || urlParams.get('userName') || urlParams.get('studentName')

      // S'il n'y a pas d'ID d'utilisateur dans l'URL, récupérer le cache ou créer une session persistante
      if (!scUserId) {
        scUserId = localStorage.getItem('last_studycloud_user_id') || localStorage.getItem('sc_studycloud_user_id')
        if (!scUserId) {
          scUserId = `studycloud_${Math.random().toString(36).substring(2, 8)}`
          localStorage.setItem('sc_studycloud_user_id', scUserId)
        }
      }

      const decodedName = scUserName ? decodeURIComponent(scUserName) : undefined
      authenticateWithStudyCloud(scUserId, decodedName)
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'STUDYCLOUD_AUTH' && e.data.userId) {
        authenticateWithStudyCloud(e.data.userId, e.data.userName)
      }
    }
    window.addEventListener('message', handleMessage)

    return () => {
      unmounted = true
      window.removeEventListener('message', handleMessage)
      authenticatedApiRef.current?.[Symbol.dispose]()
    }
  }, [publicApi])

  const login = (token: string) => {
    authenticateWithToken(token)
  }

  const logout = () => {
    setReportedUserId(undefined)
    if (CF_ACCESS_MODE) {
      window.location.assign('/cdn-cgi/access/logout')
      return
    }
    setAuthState(prev => {
      if (prev.authenticatedApi) {
        prev.authenticatedApi[Symbol.dispose]()
      }
      return {
        token: null,
        authenticatedApi: null,
        isLoading: false,
        error: null
      }
    })
    localStorage.removeItem('authToken')
    window.location.reload()
  }

  return {
    ...authState,
    login,
    logout,
    isAuthenticated: !!authState.authenticatedApi
  }
}
