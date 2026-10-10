import { useEffect } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useDocumentTitle } from "./useDocumentTitle"

export default function SignupPage() {
  const navigate = useNavigate()
  useDocumentTitle("Studio IA StudyCloud")

  useEffect(() => {
    navigate({ to: "/" })
  }, [navigate])

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center bg-[#070b14] text-white px-4 py-8">
      <div className="w-8 h-8 border-3 border-[#ff4801] border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-sm text-stone-400">Accès à votre espace StudyCloud…</p>
    </div>
  )
}
