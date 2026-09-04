# AZ-104 Trainer

Application d'entraînement à la certification **Microsoft Azure Administrator (AZ-104)**,
packagée dans un conteneur Docker destiné à Google Cloud Run.

Les 542 questions, leurs explications, leurs références et leurs captures d'écran sont
extraites automatiquement de `AZ-104_dump.pdf`.

---

## Fonctionnalités

| | |
|---|---|
| **Mode entraînement** | Une question à la fois, correction et explication immédiates, longueur de session réglable (5 à 200 questions). |
| **Mode examen** | 25 / 50 / 100 questions chronométrées (75 min pour 50), aucune correction avant la fin, navigation libre, palette de questions, marquage pour relecture. |
| **Bilingue FR / EN** | Interface entièrement traduite. Le contenu des questions dispose d'une couche de traduction séparée (voir [Traduction](#traduction)) ; les questions non encore traduites s'affichent en anglais avec un badge `EN`. |
| **Glisser-déposer** | Vrai drag & drop (souris, tactile et clavier) sur les questions converties en format interactif ; correction automatique par zone. |
| **Zones actives / Hot area** | Les 194 questions interactives de l'examen sont présentées avec leur capture d'énoncé, puis le corrigé et une auto-évaluation. |
| **Progression** | Statistiques par question et par domaine, révision des erreurs, questions mises de côté, historique des examens — le tout en `localStorage`, aucun compte ni serveur d'état. |
| **Confort** | Thème clair / sombre, raccourcis clavier (`1`-`6`, `Entrée`), reprise de session, agrandissement des captures. |

### Répartition de la banque de questions

| Domaine | Questions |
|---|---|
| Identités et gouvernance | 115 |
| Stockage | 96 |
| Calcul (compute) | 116 |
| Réseau virtuel | 146 |
| Supervision et maintenance | 49 |
| Questions mixtes | 20 |
| **Total** | **542** |

Par format : 349 questions classiques, 179 *hot area*, 14 *drag & drop*.
Par type : 325 à réponse unique, 23 à réponses multiples, 194 auto-évaluées.

---

## Démarrage rapide

> **À faire après un clone.** Ce dépôt est public : ni `AZ-104_dump.pdf`, ni les questions
> extraites, ni les 782 captures n'y sont versionnés — le dump interdit explicitement sa
> redistribution. Seuls le code et la chaîne d'extraction le sont. Il faut donc régénérer
> les données une fois, à partir de votre propre copie du PDF :
>
> ```bash
> cp /chemin/vers/AZ-104_dump.pdf .   # à la racine du dépôt
> npm install --prefix tools
> npm run data                        # ~3 min : images puis questions
> ```
>
> `pdftotext` (paquet *poppler*) doit être présent dans le `PATH`. Sans cette étape, le
> build s'arrête avec un message explicite plutôt que de produire une application vide.

```bash
# Développement (Vite, rechargement à chaud sur http://localhost:5173)
npm install --prefix web
npm run dev

# Aperçu de production en local sur http://localhost:8080
npm run serve
```

`npm run serve` compile le front, copie `web/dist` vers `public/`, puis lance le serveur
Node — exactement ce que fait le conteneur.

### Docker

```bash
npm run docker:build      # docker build -t az104-trainer .
npm run docker:run        # http://localhost:8080
```

> Le `Dockerfile` n'a pas pu être exécuté dans l'environnement de développement utilisé pour
> écrire ce projet (Docker n'y était pas installé). Le serveur, lui, a été testé tel qu'il
> tourne dans l'image.

---

## Déploiement sur Cloud Run

L'image écoute sur `$PORT` (8080 par défaut), sur `0.0.0.0`, expose `/healthz`, tourne en
utilisateur non-root et gère `SIGTERM`.

### Depuis les sources (le plus simple)

```bash
gcloud run deploy az104-trainer \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 4
```

### Via Artifact Registry

```bash
PROJECT=$(gcloud config get-value project)
REGION=europe-west1
REPO=containers

gcloud artifacts repositories create $REPO \
  --repository-format=docker --location=$REGION 2>/dev/null || true

IMAGE=$REGION-docker.pkg.dev/$PROJECT/$REPO/az104-trainer:$(git rev-parse --short HEAD)

gcloud builds submit --tag $IMAGE
gcloud run deploy az104-trainer \
  --image $IMAGE \
  --region $REGION \
  --allow-unauthenticated
```

L'application est entièrement statique côté serveur : elle tient sans problème sur
`--min-instances 0`, et tout l'état utilisateur vit dans le navigateur.

#### Restreindre l'accès

Remplacez `--allow-unauthenticated` par `--no-allow-unauthenticated` et placez un
[IAP](https://cloud.google.com/iap/docs/enabling-cloud-run) devant le service, ou accordez
`roles/run.invoker` aux comptes concernés.

---

## Architecture

```
AZ-104_dump.pdf          source ; non versionnée, non embarquée dans l'image
tools/
  extract-images.mjs     extrait les captures du PDF (pdfjs) → web/public/img/*.webp
  parse-dump.mjs         extrait les questions (pdftotext)   → web/public/data/questions.json
  translate.mjs          traduction FR via l'API Claude      → web/public/data/fr.json
web/                     application React + TypeScript + Tailwind (Vite)
  public/data/           banque de questions, traductions, questions interactives
  public/img/            782 captures d'écran (15 Mo)
server/index.js          serveur de fichiers statiques, sans dépendance
Dockerfile               build multi-étapes → image d'exécution node:22-alpine
```

Il n'y a pas d'API : le front récupère `questions.json` une fois puis fonctionne
entièrement côté client. Le serveur ne fait que servir des fichiers, avec gzip, ETag,
cache immuable sur les assets hachés et repli SPA.

### Régénérer les données depuis le PDF

```bash
npm install --prefix tools
npm run data      # extraction des images (~3 min) puis parsing
```

`extract-images.mjs` a besoin de `pdfjs-dist` et `@napi-rs/canvas` (installés dans
`tools/`) ; `parse-dump.mjs` a besoin de `pdftotext` (poppler) dans le `PATH`. Les deux
sorties sont versionnées, la régénération n'est donc nécessaire qu'en cas de changement du
PDF.

**Comment les captures sont rattachées aux questions.** Une page du PDF contient souvent la
fin d'une question, son corrigé et le début de la suivante. `extract-images.mjs` relève donc
la position verticale de chaque image ainsi que celle des repères `QUESTION: n` et
`Answer(s):`. Une image située entre `QUESTION: n` et son `Answer(s):` est un énoncé ;
au-delà, c'est le corrigé. Les 194 questions à corrigé illustré ont ainsi leurs deux images
correctement séparées.

---

## Traduction

L'interface est bilingue dès l'installation. Le **contenu** des questions se traduit
séparément, question par question, dans `web/public/data/fr.json` :

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run translate                       # tout ce qui reste à traduire
npm run translate -- --limit 50         # par lots, pour tester
npm run translate -- --model claude-sonnet-5   # moins cher, un peu moins fin
```

Le script est **reprenable** : le fichier est réécrit après chaque lot, les questions déjà
traduites sont ignorées, et une interruption ne perd rien. Un fichier partiel est un état
valide — les questions absentes s'affichent en anglais avec un badge `EN`.

Le prompt impose de laisser en anglais les noms de produits, de rôles RBAC, de cmdlets et
les identifiants de ressources, qui sont ceux affichés par le portail Azure et par l'examen.

Le dépôt est livré avec les 5 questions glisser-déposer interactives déjà traduites, afin
que le mode FR soit fonctionnel immédiatement.

---

## Questions glisser-déposer

Dans le PDF, le corrigé des questions *drag & drop* et *hot area* n'existe que sous forme
d'image : il n'y a pas de données exploitables pour rejouer l'interaction. Deux traitements
coexistent donc :

* **Par défaut** — l'énoncé est affiché avec sa capture, un bouton révèle le corrigé, puis
  l'apprenant s'auto-évalue. Le résultat compte dans le score et la progression.
* **Questions converties** — `web/public/data/interactive.json` décrit un vrai plateau de
  glisser-déposer, transcrit à la main depuis les captures. La question devient alors
  corrigée automatiquement, zone par zone, et la capture d'origine reste consultable comme
  corrigé.

Cinq questions sont converties (`3`, `68`, `143`, `507`, `540`). Pour en ajouter une :

```jsonc
"460": {
  "kind": "dragdrop",
  "prompt": "Drag the three actions into the answer area in the correct order.",
  "items":   [{ "id": "a", "label": "Create a Recovery Services vault" }],
  "targets": [{ "id": "step1", "label": "Step 1", "accepts": ["a"] }]
}
```

Les libellés français correspondants se placent dans `fr.json` sous la clé `interactive`
de la même question. Aucune recompilation des données n'est nécessaire : le fichier est
chargé au démarrage de l'application.

---

## Notes

* Les scores utilisent le seuil officiel de l'AZ-104, 700/1000, soit 70 %.
* La progression est stockée dans le navigateur (`localStorage`) : elle est propre à chaque
  appareil et n'est jamais transmise au serveur.
* `AZ-104_dump.pdf` n'est ni versionné ni inclus dans l'image Docker. L'image ne contient
  que les données déjà extraites localement par `npm run data`.
* Le dump est un document commercial dont la redistribution est interdite. Ne versionnez ni
  le PDF ni son contenu extrait sur un dépôt public : `.gitignore` s'en charge, ne l'assouplissez
  pas.
