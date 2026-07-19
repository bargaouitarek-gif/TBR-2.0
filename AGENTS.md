# Règles permanentes du projet TBR

Ces règles s'appliquent à toute modification du dépôt.

## Protection des données

- Ne jamais supprimer, vider, réinitialiser ou renommer les clés `localStorage` existantes.
- Ne jamais ajouter de logique qui efface les ventes, les rendez-vous, les DCO ou les réglages de l'utilisateur.
- Préserver la compatibilité avec les données déjà enregistrées dans l'application/PWA GitHub Pages.
- Ne jamais demander à l'utilisateur de vider le cache, les données du navigateur ou de désinstaller la PWA pour résoudre un problème.

## Architecture actuelle

- L'application principale utilisée par Tarek reste l'origine GitHub Pages où les données locales existent.
- Vercel sert de backend pour les fonctions IA et les routes `/api/*`.
- Les clés secrètes (`OPENAI_API_KEY`, codes d'accès, jetons GitHub) doivent rester côté serveur et ne doivent jamais être ajoutées à `index.html` ni commitées dans le dépôt.

## Méthode de modification

- Faire des changements minimaux et ciblés.
- Vérifier `index.html`, `ai.js` et `vercel.json` ensemble lorsqu'une modification concerne l'IA ou Vercel.
- Préserver les fonctions et l'interface existantes sauf demande explicite.
- Tester la syntaxe et les routes avant de considérer une modification comme terminée.
- Expliquer clairement les fichiers modifiés et le résultat attendu.

## Règle métier DCO

- Ne jamais compenser un trop-perçu avec un moins-perçu.
- Afficher séparément chaque écart, avec le montant exact et son origine.
