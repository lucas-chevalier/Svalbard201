# Svalbard201

Svalbard201 est un escape game collaboratif en ligne, conçu pour être joué à plusieurs sur des postes différents. Chaque joueur incarne un rôle scientifique et doit résoudre des énigmes dans différentes salles du complexe.

## Fonctionnalités

- **Multi-joueurs** : synchronisation en temps réel via Firebase
- **Rôles** : Hydrologue, Énergéticien, Biologiste
- **Épreuves** : puzzles interactifs (pompe hydraulique, biosphère, centrale, Salle radio…)
- **Chat intégré** : communication entre joueurs
- **Progression partagée** : chaque action est visible par tous

## Installation

1. **Cloner le dépôt**
   ```sh
   git clone https://github.com/cheva-00xim79/Svalbard201.git
   cd Svalbard201
   ```

2. **Installer les dépendances**
   ```sh
   npm install
   ```

3. **Lancer le serveur de développement**
   ```sh
   npm run dev
   ```

4. **Accéder au jeu**
   Ouvre [http://localhost:5173](http://localhost:5173) dans ton navigateur.

## Jouer en équipe

- Un joueur crée une mission et partage le code généré (ex : `GV1234`).
- Les autres joueurs rejoignent la mission avec ce code.
- Chaque joueur choisit un rôle et collabore pour résoudre les énigmes.

## Structure du projet

- `src/` : code source React
  - `components/` : composants des salles et puzzles
  - `utils/` : utilitaires (génération de session, etc.)
  - `style.css` : styles principaux
- `public/` : assets et images
- `firebase.json` : configuration Firebase Hosting

## Dépendances principales

- [React](https://react.dev/)
- [Firebase](https://firebase.google.com/)
- [Vite](https://vitejs.dev/)

## Personnalisation

Pour modifier les énigmes ou les rôles, édite les fichiers dans [`src/components`](src/components).

## Univers / Lore (contexte)

Svalbard se déroule dans une station polaire orbitale expérimentale. Les joueurs incarnent une équipe de spécialistes (Hydrologue, Biologiste, Énergéticien, etc.) chargés de restaurer et maintenir différents systèmes critiques de la station pour assurer la survie de l'équipage.

Chaque salle correspond à un sous-système : centrale électrique, pompe hydraulique, salle radio, biosphère, débarras, etc. Les joueurs coopèrent en temps réel et partagent la progression via Firebase.

## Stack technique (détails)

- Langage : JavaScript (ESNext)
- Frontend : React 18 (Hooks)
- Bundler / dev : Vite + `@vitejs/plugin-react`
- Temps réel : Firebase Realtime Database (package `firebase`)
- Principales dépendances : `react`, `react-dom`, `firebase`, `lucide-react`, `uuid`
- Entrée : `src/main.jsx` → `src/App.jsx`
- Orchestrateur : `src/components/GameRoom.jsx` (sessions, `miniGameStatus`, `roomsOrder`)
- Mini-jeux principaux : `src/components/Grainotheque.jsx`, `Biosphere.jsx`, `PuzzlePompe.jsx`, `PuzzleEnergy.jsx`, `PuzzleDebarras.jsx`

## Exécution locale

1. Installer : `npm install`
2. Lancer : `npm run dev`
3. Ouvrir l'URL indiquée par Vite (ex. `http://localhost:5173`)


---

Pour toute question ou suggestion, contacte l’auteur du projet.

