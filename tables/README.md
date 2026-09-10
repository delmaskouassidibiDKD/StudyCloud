# 🗄️ Tables & Base de Données StudyCloud (Cloudflare D1)

Ce dossier contient le schéma SQL officiel pour la base de données relationnelle **Cloudflare D1** (moteur SQLite distribué).

## 📄 Fichiers
- `schema.sql` : Script complet de création de toutes les 21 tables et index pour tous les modules de l'application.

---

## 🚀 Comment appliquer ce schéma sur Cloudflare

### Méthode 1 : Avec la CLI Wrangler (Recommandé)

1. **Exécuter le schéma en local pour tester :**
   ```bash
   npx wrangler d1 execute d1-studycloud --local --file=./tables/schema.sql
   ```

2. **Déployer le schéma en production sur Cloudflare (sur votre base `d1-studycloud`) :**
   ```bash
   npx wrangler d1 execute d1-studycloud --remote --file=./tables/schema.sql
   ```

---

### Méthode 2 : Directement depuis le Dashboard Cloudflare

1. Rendez-vous sur votre tableau de bord **Cloudflare** > **Storage & Databases** > **D1 SQL Database**.
2. Cliquez sur votre base **`d1-studycloud`**.
3. Cliquez sur l'onglet **Console**.
4. Copiez l'intégralité du contenu de `tables/schema.sql` et collez-le dans la console SQL.
5. Cliquez sur **Execute**.

---

## 📊 Récapitulatif des 22 Tables

1. **`users`** : Profil étudiant (nom, email, école, filière, avatar).
2. **`user_preferences`** : Préférences UI (mode grille/liste, thème sombre).
3. **`matieres`** : Matières scolaires (coefficients, couleurs, catégories).
4. **`files`** : Fichiers avec pointeurs vers le bucket R2 et flags d'importation/session d'étude.
5. **`shared_folders`** : Liens et dossiers de partage avec ou sans mot de passe/PIN.
6. **`shared_folder_files`** : Fichiers associés aux dossiers partagés.
7. **`schedule_config`** : Configuration des jours et tranches horaires de l'emploi du temps.
8. **`schedule_slots`** : Cours programmés, professeurs et salles.
9. **`grade_settings`** : Échelle de notation (sur 20, 100, etc.).
10. **`grades`** : Notes, évaluations, trimestres et moyennes.
11. **`notes`** : Bloc-notes Keep avec mémos, épingles et images.
12. **`calendar_events`** : Événements, examens et révisions.
13. **`alarms`** : Alarmes de réveil et rappels d'étude.
14. **`study_sessions`** : Historique des sessions de concentration / minuteur.
15. **`shop_profiles`** : Profils vendeurs de la boutique (téléphone, WhatsApp).
16. **`products`** : Articles en vente, prix, images R2, boosts sponsorisés.
17. **`cart_items`** : Panier d'achat étudiant.
18. **`published_documents`** : Bibliothèque universitaire publique par école et filière.
19. **`notifications`** : Boîte de réception et alertes système.
20. **`chat_messages`** : Historique des discussions avec l'Assistant Delmas.
21. **`user_subscriptions`** : Abonnements et forfaits actifs.
22. **`ai_generated_contents`** : Résumés, cartes mentales, flashcards, questionnaires et infographies générés par l'IA.
