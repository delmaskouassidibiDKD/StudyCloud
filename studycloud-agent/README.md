# StudyCloud Agent - Cerveau Neuronal & Pédagogique (Cloudflare Agents SDK)

Projet officiel basé sur l'architecture **Cloudflare Agents Starter** (`agents-starter`), propulsé par le **Agents SDK**, les **Durable Objects avec SQLite persistant** et **Cloudflare Workers AI** (Llama 3.3 70B Instruct).

---

## 🎯 Pourquoi ce projet résout les problèmes de l'ancien worker ?

L'ancien worker IA fonctionnait comme un simple relai monolithique sans état. Il produisait souvent :
1. Des réponses non conformes aux formats JSON stricts attendus par l'UI de StudyCloud.
2. Des pertes de contexte lors des cours longs ou des devoirs complexes.
3. Des blocages et temps d'attente excessifs sans mémoire persistante.

### La nouvelle architecture apporte :
- **Durable Objects avec SQLite intégré** : chaque session de révision, utilisateur ou matière conserve son historique, ses états et ses créations de manière permanente.
- **Moteur d'Ingénierie Pédagogique Dédié** : génération garantie au format JSON exact pour :
  - **Questionnaires QCM** (`questionnaire`, `questionnaire-test`)
  - **Tests Vrai ou Faux** avec justifications (`vrai-ou-faux`, `vrai-ou-faux-test`)
  - **Cartes Mentales arborescentes** (`carte-mentale`, `carte-mentale-2`)
  - **Cartes Mémoire Flashcards** (`carte-memoire`)
  - **Fiches de Synthèse & Résumés** (`resume`)
  - **Infographies Visuelles** (`infographie`)
  - **Exercices Écrits d'Application** (`exercices-ecrits`)
  - **Sujets de Devoir Complet avec Barème sur 20** (`devoir-complet`)
  - **Fascicules de Cours Magistral** (`pdf`)
- **Nettoyage & Réparation Automatique du JSON** : prise en charge native des formules scientifiques en LaTeX (`\\frac`, `\\Omega`, `\\beta`, etc.) sans erreurs de syntaxe.
- **Compatibilité Universelle & CORS** : communication directe avec StudyCloud (`localhost:5173`, custom domains, Pages).

---

## 🚀 Guide d'installation et de déploiement

### Étape 1 : Dépendances
Les paquets sont déjà installés dans le dossier `studycloud-agent` :
```bash
cd studycloud-agent
npm install
```

### Étape 2 : S'authentifier auprès de Cloudflare
Puisque le modèle utilise Workers AI avec `"remote": true`, une authentification interactive lie votre terminal à votre compte Cloudflare :
```bash
npx wrangler login
```
*(Cela ouvre une page web dans votre navigateur pour autoriser Wrangler).*

### Étape 3 : Tester en local
Pour lancer l'agent en mode développement :
```bash
npm run dev
```
L'interface de chat et l'API de l'agent démarrent sur `http://localhost:5173`.

### Étape 4 : Déployer en production sur Cloudflare
Pour compiler et déployer l'agent sur votre compte Cloudflare :
```bash
npm run deploy
```
Wrangler va provisionner :
- Le Worker `studycloud-agent`
- La classe Durable Object `ChatAgent` avec migration SQLite v1
- La liaison `AI` (Workers AI)

---

## 📡 Routes HTTP & Endpoints disponibles

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/ai/health` | Vérification de l'état de santé du cerveau |
| `POST` | `/api/ai/creation` | Génération de modules pédagogiques structurés pour l'Espace d'étude |
| `POST` | `/api/ai/analyze` | Audit et analyse approfondie d'un document ou cours |
| `POST` | `/api/ai/chat` | Causerie et assistance pédagogique interactive |
| `ALL` | `/agents/chat-agent/*` | Protocole Cloudflare Agents SDK (WebSockets, SSE streaming, RPC) |

---

## 🔗 Connexion avec l'application StudyCloud

Dans StudyCloud (`src/services/studyAgentService.ts` et `src/services/api.ts`) :
- L'URL de l'agent est configurée par défaut sur votre Worker (`https://studycloud-agent.delmaskouassidibi.workers.dev`).
- Si l'agent est en ligne, StudyCloud lui délègue automatiquement et en priorité toutes les créations et causeries.
- Si l'agent est en attente de déploiement, StudyCloud bascule automatiquement en douceur sur le worker standard.
