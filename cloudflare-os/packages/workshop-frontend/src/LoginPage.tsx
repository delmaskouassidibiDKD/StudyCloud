import { useEffect, useState } from 'react'
import { RpcStub } from 'capnweb'
import { PublicApi } from '@gadgets/workshop-shared/api'
import { hashPassword } from './passwordHash'
import { sanitizeUsername } from './useAuth'
import { useDocumentTitle } from './useDocumentTitle'

interface LoginPageProps {
  rpcStub: RpcStub<PublicApi>
  onLoginSuccess?: () => void
}

export default function LoginPage({ rpcStub, onLoginSuccess }: LoginPageProps) {
  const [statusMessage, setStatusMessage] = useState('Connexion à votre espace StudyCloud…')
  useDocumentTitle('Studio IA StudyCloud')

  useEffect(() => {
    let unmounted = false

    const runAutoAuth = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        let scUserId = urlParams.get('sc_user_id') || urlParams.get('userId')
        const scUserName = urlParams.get('sc_user_name') || urlParams.get('userName')

        if (!scUserId) {
          scUserId = localStorage.getItem('last_studycloud_user_id') || localStorage.getItem('sc_studycloud_user_id')
          if (!scUserId) {
            scUserId = `studycloud_${Math.random().toString(36).substring(2, 8)}`
            localStorage.setItem('sc_studycloud_user_id', scUserId)
          }
        }

        const username = sanitizeUsername(scUserId)
        const userPass = `sc_studycloud_pass_${username}_2026`
        const displayName = scUserName ? decodeURIComponent(scUserName) : 'Étudiant StudyCloud'

        const passwordHash = await hashPassword(username, userPass)
        let token: string | null = null

        try {
          token = await rpcStub.login(username, passwordHash)
        } catch {
          token = null
        }

        if (!token) {
          try {
            token = await rpcStub.createAccount(username, displayName, passwordHash)
          } catch {
            try {
              token = await rpcStub.login(username, passwordHash)
            } catch {
              token = null
            }
          }
        }

        if (token && !unmounted) {
          localStorage.setItem('authToken', token)
          localStorage.setItem('last_studycloud_user_id', scUserId)
          if (onLoginSuccess) {
            onLoginSuccess()
          } else {
            window.location.replace('/')
          }
        } else if (!unmounted) {
          setStatusMessage('Synchronisation de votre profil…')
          setTimeout(runAutoAuth, 1200)
        }
      } catch (err) {
        console.error('[LoginPage AutoAuth]', err)
        if (!unmounted) {
          setStatusMessage('Préparation de votre espace IA…')
          setTimeout(runAutoAuth, 1800)
        }
      }
    }

    runAutoAuth()

    return () => {
      unmounted = true
    }
  }, [rpcStub, onLoginSuccess])

  return (
    <div className="relative flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto bg-[#070b14] text-white px-4 py-8">
      {/* Motifs géométriques discrets d'arrière-plan */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle, #ff4801 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-sm text-center">
        {/* Logo DelmasRobot / Flamme IA */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff4801] to-[#b32b00] flex items-center justify-center shadow-xl shadow-[#ff4801]/30 mb-5 animate-pulse">
          <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v8" />
            <path d="m4.93 10.93 4.24 4.24" />
            <path d="M2 18h8" />
            <path d="M20 18h2" />
            <path d="m19.07 10.93-4.24 4.24" />
            <circle cx="12" cy="18" r="4" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-white mb-2 tracking-tight">Studio IA StudyCloud</h1>
        <p className="text-xs text-stone-400 mb-6 max-w-xs">{statusMessage}</p>

        <div className="w-8 h-8 border-3 border-[#ff4801] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}
