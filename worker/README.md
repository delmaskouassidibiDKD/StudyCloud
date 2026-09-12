# ⚡ Cloudflare Worker API - StudyCloud

Ce dossier contient le code complet du **Cloudflare Worker** qui sert d'intermédiaire universel entre l'application StudyCloud, la base de données **Cloudflare D1** et le stockage **Cloudflare R2**.

---

## 🛠️ Architecture du Worker
- **Langage** : TypeScript natif (Fetch API standard).
- **Zéro dépendance d'exécution** : Vitesse d'exécution maximale en bordure (Edge) dans le monde entier (< 50ms).
- **CORS universel** : Permet à StudyCloud d'appeler l'API en local (`localhost`) comme en production.
- **Stockage R2 direct** : Endpoints `/api/storage/upload` et `/api/storage/file/:key` pour uploader et streamer les fichiers PDF, Word et images.

---

## 🚀 Comment Déployer le Worker

### Option A : Déploiement Direct via le Dashboard Cloudflare (Recommandé)

1. Rendez-vous sur votre compte **Cloudflare** > **Workers & Pages** > Votre Worker StudyCloud.
2. Cliquez sur **Edit code** (Éditer le code).
3. Ouvrez le fichier unique officiel [`worker/CLOUDFLARE_WORKER.js`](./CLOUDFLARE_WORKER.js), copiez tout son contenu (Ctrl+A puis Ctrl+C).
4. Collez-le dans l'éditeur Cloudflare et cliquez sur **Deploy** (Déployer).
5. **C'est tout !** Le Worker intègre désormais l'auto-migration automatique de toute la base D1 (`ensureDatabaseSchema`), la purge automatique des comptes expirés et toutes les fonctionnalités récentes.
6. **Lier la base D1 et le Bucket R2 au Worker** :
   - Allez dans les paramètres de votre Worker (`Settings` > `Variables and Bindings`).
   - Sous **D1 Database Bindings** :
     - Variable name : `DB`
     - D1 database : Sélectionnez votre base `studycloud-db`.
   - Sous **R2 Bucket Bindings** :
     - Variable name : `BUCKET`
     - R2 bucket : Sélectionnez votre bucket `studycloud-files`.
   - Cliquez sur **Save and Deploy**.
3. **Attacher votre Domaine Personnalisé** :
   - Dans le tableau de bord du Worker > onglet **Settings** > **Triggers** (ou **Domains & Routes**).
   - Cliquez sur **Add Custom Domain**.
   - Entrez `api-worker.dkd-technologies.com`. Cloudflare configurera automatiquement le DNS et le certificat SSL gratuit !
   - Votre API officielle sera accessible en direct sur : **`https://api-worker.dkd-technologies.com`**.

---

### Option B : Déploiement via la CLI Wrangler

1. Dans le dossier `worker/`, ouvrez `wrangler.toml` et mettez à jour votre `database_id` :
   ```bash
   npx wrangler d1 list
   ```
2. Déployez le worker en une seule commande :
   ```bash
   npx wrangler deploy
   ```
   *Wrangler attachera automatiquement le domaine personnalisé configuré dans `wrangler.toml` (`api-worker.dkd-technologies.com`).*

---

## 📡 Endpoints API Disponibles

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/health` | Vérification de l'état du serveur |
| `POST` | `/api/users/sync` | Enregistrement / Synchronisation du profil étudiant |
| `GET / PUT` | `/api/users/:id/preferences` | Préférences d'affichage et thème |
| `GET / POST` | `/api/matieres` | Gestion des matières scolaires |
| `DELETE` | `/api/matieres/:id` | Suppression d'une matière |
| `GET / POST` | `/api/files` | Gestion des métadonnées de fichiers |
| `DELETE` | `/api/files/:id` | Suppression du fichier dans D1 et R2 |
| `PUT` | `/api/storage/upload?key=...` | Envoi d'un fichier binaire vers Cloudflare R2 |
| `GET` | `/api/storage/file/:key` | Récupération / Visualisation d'un fichier R2 |
| `GET / POST` | `/api/shares` | Création et liste des dossiers partagés |
| `GET` | `/api/shares/:id` | Consultation publique d'un partage |
| `POST` | `/api/shares/:id/verify-pin` | Déverrouillage d'un partage par code PIN |
| `GET / PUT` | `/api/schedule/config` | Configuration de la grille horaire |
| `GET / POST` | `/api/schedule/slots` | Créneaux et cours de l'emploi du temps |
| `GET / POST` | `/api/grades` | Notes, bulletins, devoirs et moyennes |
| `GET / POST` | `/api/notes` | Bloc-notes Keep |
| `GET / POST` | `/api/calendar` | Événements et planning des examens |
| `GET / POST` | `/api/alarms` | Alarmes de réveil et rappels |
| `GET / POST` | `/api/study-sessions` | Sessions de concentration complétées |
| `GET / PUT` | `/api/shop/profile` | Profil vendeur de la boutique étudiante |
| `GET / POST` | `/api/products` | Articles en vente et boosts publicitaires |
| `GET / POST` | `/api/cart` | Panier d'achat |
| `GET / POST` | `/api/published-documents` | Bibliothèque publique par école & filière |
| `GET / POST` | `/api/notifications` | Alertes et notifications |
| `GET / POST` | `/api/chat` | Historique de discussion Assistant Delmas |
| `GET / POST` | `/api/subscriptions` | Formules et abonnements actifs |
