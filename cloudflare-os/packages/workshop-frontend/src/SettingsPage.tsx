import { useKumoToastManager } from '@cloudflare/kumo'
import { useAuthenticatedApi } from './AuthContext'
import { useState, useEffect, useRef } from 'react'
import { AiChatAuthorInfo, validateCommitEmail } from '@gadgets/workshop-shared/api'
import { hashPassword } from './passwordHash'
import { CF_ACCESS_MODE } from './useAuth'
import { User, Pencil, Check, X, Lock, Camera, Copy, Eye, EyeSlash } from '@phosphor-icons/react'
import { useAvatar, invalidateAvatarCache } from './useAvatar'
import { compressAvatar, avatarBlobUrl } from './avatarUtils'
import UsageSettings from './components/billing/UsageSettings'
import { useDocumentTitle } from './useDocumentTitle'
import { isImeComposing } from './keyboardEvent'

// Shared, on-language control classes (match the rest of the app: Workspaces/Blueprints headers,
// the gatekeepers toolbar, the command palette). Kept here so the profile page reads as part of the
// system rather than a stack of default Kumo cards.
const PRIMARY_BTN =
  'press inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-kumo-brand px-3.5 text-[13px] font-medium tracking-[-0.25px] text-white transition-colors hover:bg-kumo-brand-hover disabled:cursor-not-allowed disabled:opacity-60'
const ICON_BTN =
  'press grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-kumo-inactive transition-colors hover:bg-kumo-tint hover:text-kumo-default'
const INPUT =
  'h-10 w-full rounded-lg border border-kumo-line bg-kumo-base px-3 text-[16px] text-kumo-default placeholder:text-kumo-inactive transition-[border-color,box-shadow] focus:border-kumo-ring focus:outline-none focus:ring-[3px] focus:ring-kumo-ring/15 sm:h-9 sm:text-[14px]'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 text-[12px] font-medium uppercase tracking-[0.08em] text-kumo-inactive">
      {children}
    </h2>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium tracking-[-0.1px] text-kumo-subtle">{children}</p>
  )
}

// On-language password field: same input/focus treatment as the rest of the app, with an inline
// show/hide toggle (replacing Kumo's SensitiveInput, which read as dated against the new look).
function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  description,
  error,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  description?: string
  error?: string | null
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative mt-1.5">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`${INPUT} pr-10 ${error ? 'border-kumo-danger focus:border-kumo-danger' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-kumo-inactive transition-colors hover:text-kumo-default"
        >
          {show ? <EyeSlash size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-[12px] tracking-[-0.1px] text-kumo-danger">{error}</p>
      ) : description ? (
        <p className="mt-1 text-[12px] tracking-[-0.1px] text-kumo-subtle">{description}</p>
      ) : null}
    </div>
  )
}

const CommitEmailRow = ({ initialCommitEmail }: { initialCommitEmail?: string }) => {
  const { authenticatedApi } = useAuthenticatedApi()
  const toasts = useKumoToastManager()
  const [commitEmail, setCommitEmail] = useState(initialCommitEmail)
  const [isEditing, setIsEditing] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const startEditing = () => {
    setInput(commitEmail ?? '')
    setError(null)
    setIsEditing(true)
  }

  const handleSave = async () => {
    const email = input.trim() || null
    if (email !== null) {
      try {
        validateCommitEmail(email)
      } catch {
        setError('Saisissez une adresse comme nom@example.com')
        return
      }
    }

    setSaving(true)
    try {
      await authenticatedApi.setOwnCommitEmail(email)
      setCommitEmail(email ?? undefined)
      setIsEditing(false)
      toasts.add({ title: email ? 'E-mail de validation mis à jour' : 'E-mail de validation effacé', variant: 'success' })
    } catch (err) {
      console.error('Failed to update commit email:', err)
      toasts.add({ title: "Échec de la mise à jour de l'e-mail de validation", variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-end gap-2 px-5 py-4">
      <div className="min-w-0 flex-1">
        <FieldLabel>E-mail de validation (commit)</FieldLabel>
        {isEditing ? (
          <>
            <input
              type="email"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(null) }}
              onKeyDown={(e) => {
                if (isImeComposing(e)) return
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') setIsEditing(false)
              }}
              placeholder="nom@example.com"
              aria-label="E-mail de validation"
              autoComplete="email"
              autoFocus
              className={`mt-1.5 ${INPUT} ${error ? 'border-kumo-danger focus:border-kumo-danger' : ''}`}
            />
            <p className={`mt-1 text-[12px] tracking-[-0.1px] ${error ? 'text-kumo-danger' : 'text-kumo-subtle'}`}>
              {error ?? 'Laissez vide pour utiliser une adresse basée sur votre identifiant.'}
            </p>
          </>
        ) : commitEmail ? (
          <p className="mt-1 truncate text-[14px] tracking-[-0.25px] text-kumo-default">{commitEmail}</p>
        ) : (
          <p className="mt-1 text-[14px] tracking-[-0.25px] text-kumo-inactive">
            Non défini — les validations utilisent une adresse basée sur votre identifiant
          </p>
        )}
      </div>
      {isEditing ? (
        <>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            aria-label="Enregistrer l'e-mail de validation"
            className={PRIMARY_BTN}
          >
            <Check size={15} weight="bold" />
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            aria-label="Annuler"
            className={ICON_BTN}
          >
            <X size={15} />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          aria-label="Modifier l'e-mail de validation"
          className={ICON_BTN}
        >
          <Pencil size={14} />
        </button>
      )}
    </div>
  )
}

export default function SettingsPage() {
  useDocumentTitle('Profil')

  const { authenticatedApi } = useAuthenticatedApi()
  const toasts = useKumoToastManager()
  const [userInfo, setUserInfo] = useState<AiChatAuthorInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  // Avatar state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null)

  // Revoke preview blob URL on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (localAvatarPreview) URL.revokeObjectURL(localAvatarPreview)
    }
  }, [localAvatarPreview])

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  // Whether this account has a password (false for OAuth-created accounts). Null while loading.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)

  const avatarUrl = useAvatar(authenticatedApi, userInfo?.id)

  // Determine whether to show the change-password section.
  useEffect(() => {
    let cancelled = false
    authenticatedApi.hasPasswordLogin()
      .then((v: boolean) => { if (!cancelled) setHasPassword(v) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [authenticatedApi])

  // Fetch user info
  useEffect(() => {
    let cancelled = false
    const fetchUserInfo = async () => {
      try {
        const info = await authenticatedApi.whoami()
        if (cancelled) return
        setUserInfo(info)
        setNameInput(info.name)
      } catch (error) {
        console.error('Failed to fetch user info:', error)
        if (!cancelled) toasts.add({ title: "Échec du chargement des informations de l'utilisateur", variant: 'error' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchUserInfo()
    return () => { cancelled = true }
  }, [authenticatedApi])

  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      toasts.add({ title: "Le nom d'affichage ne peut pas être vide", variant: 'error' })
      return
    }

    try {
      await authenticatedApi.setOwnDisplayName(nameInput.trim())
      setUserInfo(prev => prev ? { ...prev, name: nameInput.trim() } : null)
      setIsEditingName(false)
      toasts.add({ title: "Nom d'affichage mis à jour", variant: 'success' })
    } catch (err) {
      console.error('Failed to update display name:', err)
      toasts.add({ title: "Échec de la mise à jour du nom d'affichage", variant: 'error' })
    }
  }

  const handleCancelEdit = () => {
    setNameInput(userInfo?.name || '')
    setIsEditingName(false)
  }

  const handleCopyId = async () => {
    if (!userInfo?.id) return
    try {
      await navigator.clipboard.writeText(userInfo.id)
      toasts.add({ title: 'Identifiant utilisateur copié', variant: 'success' })
    } catch {
      toasts.add({ title: 'Échec de la copie', variant: 'error' })
    }
  }

  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toasts.add({ title: 'Veuillez sélectionner un fichier image', variant: 'error' })
      return
    }
    setAvatarUploading(true)
    try {
      const compressed = await compressAvatar(file)
      // Show preview immediately
      if (localAvatarPreview) URL.revokeObjectURL(localAvatarPreview)
      setLocalAvatarPreview(avatarBlobUrl(compressed))
      // Upload
      await authenticatedApi.setAvatar(compressed)
      // Invalidate cache so the hook refetches
      if (userInfo?.id) invalidateAvatarCache(userInfo.id)
      toasts.add({ title: 'Avatar mis à jour', variant: 'success' })
    } catch (err) {
      console.error('Failed to upload avatar:', err)
      setLocalAvatarPreview(null)
      toasts.add({ title: "Échec du téléversement de l'avatar", variant: 'error' })
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!userInfo) return
    if (!currentPassword || !newPassword || !confirmPassword) return
    if (newPassword.length < 8) {
      setPasswordError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas')
      return
    }

    setPasswordLoading(true)
    setPasswordError(null)

    try {
      const oldHash = await hashPassword(userInfo.id, currentPassword)
      const newHash = await hashPassword(userInfo.id, newPassword)
      await authenticatedApi.changePassword(oldHash, newHash)
      toasts.add({ title: 'Mot de passe modifié avec succès', variant: 'success' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Échec de la modification du mot de passe'
      setPasswordError(errorMessage)
    } finally {
      setPasswordLoading(false)
    }
  }

  const displayAvatarUrl = localAvatarPreview || avatarUrl

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[13px] tracking-[-0.25px] text-kumo-subtle">Chargement du profil…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 pb-16 sm:px-10">
      <header className="px-1 pb-2 pt-6 sm:pt-10">
        <h1 className="text-2xl font-semibold tracking-tight text-kumo-default">Profil</h1>
        <p className="mt-1 text-[13px] leading-[18px] tracking-[-0.25px] text-kumo-subtle">
          Gérez les informations de votre compte, votre avatar et votre sécurité.
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-9">
        {/* Account */}
        <section className="flex flex-col gap-3">
          <SectionLabel>Compte</SectionLabel>
          <div className="divide-y divide-kumo-line overflow-hidden rounded-xl border border-kumo-line bg-kumo-base">
            {/* Avatar */}
            <div className="flex items-center gap-4 px-5 py-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="press group relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-kumo-fill disabled:cursor-wait"
              >
                {displayAvatarUrl ? (
                  <img src={displayAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User size={28} className="text-kumo-subtle" />
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <Camera size={18} className="text-white" />
                </div>
                {avatarUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-kumo-base/80">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-kumo-brand border-t-transparent" />
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleAvatarUpload(file)
                  e.target.value = ''
                }}
              />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium tracking-[-0.25px] text-kumo-default">
                  {userInfo?.name}
                </p>
                <p className="mt-0.5 text-[12px] leading-4 tracking-[-0.2px] text-kumo-subtle">
                  Cliquez sur l'avatar pour importer une nouvelle photo
                </p>
              </div>
            </div>

            {/* Display name */}
            <div className="flex items-end gap-2 px-5 py-4">
              <div className="min-w-0 flex-1">
                <FieldLabel>Nom d'affichage</FieldLabel>
                {isEditingName ? (
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (isImeComposing(e)) return
                      if (e.key === 'Enter') handleSaveName()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    placeholder="Entrez votre nom d'affichage"
                    autoFocus
                    className={`mt-1.5 ${INPUT}`}
                  />
                ) : (
                  <p className="mt-1 text-[14px] tracking-[-0.25px] text-kumo-default">
                    {userInfo?.name}
                  </p>
                )}
              </div>
              {isEditingName ? (
                <>
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={!nameInput.trim()}
                    aria-label="Enregistrer le nom d'affichage"
                    className={PRIMARY_BTN}
                  >
                    <Check size={15} weight="bold" />
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    aria-label="Annuler"
                    className={ICON_BTN}
                  >
                    <X size={15} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  aria-label="Modifier le nom d'affichage"
                  className={ICON_BTN}
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>

            <CommitEmailRow initialCommitEmail={userInfo?.commitEmail} />

            {/* User ID */}
            <div className="flex items-center gap-2 px-5 py-4">
              <div className="min-w-0 flex-1">
                <FieldLabel>Identifiant utilisateur</FieldLabel>
                <p className="mt-1 truncate font-mono text-[12px] tracking-[-0.1px] text-kumo-subtle">
                  {userInfo?.id}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyId}
                aria-label="Copier l'identifiant utilisateur"
                className={ICON_BTN}
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        </section>

        {/* Usage & billing — only when the Cloudflare limits flow is enabled server-side */}
        <UsageSettings />

        {/* Security — only for password accounts (hidden under CF Access or gatekeeper sign-in) */}
        {!CF_ACCESS_MODE && hasPassword === true && (
          <section className="flex flex-col gap-3">
            <SectionLabel>Sécurité</SectionLabel>
            <div className="rounded-xl border border-kumo-line bg-kumo-base p-5">
              <div className="flex max-w-sm flex-col gap-4">
                <PasswordField
                  label="Mot de passe actuel"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder="Entrez le mot de passe actuel"
                  autoComplete="current-password"
                />

                <PasswordField
                  label="Nouveau mot de passe"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Entrez le nouveau mot de passe"
                  description="Doit contenir au moins 8 caractères"
                  autoComplete="new-password"
                />

                <PasswordField
                  label="Confirmer le nouveau mot de passe"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirmez le nouveau mot de passe"
                  autoComplete="new-password"
                  error={passwordError}
                />

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                    className={PRIMARY_BTN}
                  >
                    <Lock size={14} weight="bold" />
                    {passwordLoading ? 'Modification…' : 'Changer le mot de passe'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
