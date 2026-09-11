import React, { Component, ReactNode } from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';

class ErrorBoundary extends React.Component {
  props!: { children?: React.ReactNode };
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6">
          <div className="bg-white border-3 border-stone-800 rounded-3xl p-8 max-w-md w-full shadow-[8px_8px_0px_0px_#1c1917] text-center space-y-4">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl border-2 border-stone-800 flex items-center justify-center mx-auto font-extrabold text-xl">
              !
            </div>
            <h2 className="text-xl font-extrabold text-stone-900">Oups, un petit problème est survenu</h2>
            <p className="text-xs text-stone-600 font-medium leading-relaxed">
              {this.state.error?.message || "Une erreur inattendue est survenue lors de l'affichage."}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
              >
                Recharger l'application
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="w-full py-2.5 bg-[#F5F1E9] hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
              >
                Réinitialiser les données (Cache)
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lock initial viewport height so virtual keyboard doesn't resize the app
const initialHeight = window.innerHeight;
document.documentElement.style.setProperty('--app-height', `${initialHeight}px`);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);


