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
| **Bilingue FR / EN** | Interface **et** 542 questions entièrement traduites — énoncés, options, explications. Bascule instantanée, les noms Azure restant en anglais (voir [Traduction](#traduction)). |
| **Grilles Oui / Non** | Les questions « choisissez Oui si l'affirmation est vraie » sont de vraies grilles cliquables, corrigées ligne par ligne. |
| **Glisser-déposer** | Vrai drag & drop (souris, tactile et clavier) sur **les 14 questions** de ce format ; correction automatique par zone. |
| **Zones actives / Hot area** | Les 150 questions à zones actives non encore transcrites sont présentées avec leur capture d'énoncé, puis le corrigé et une auto-évaluation. |
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

La banque de questions générée (`web/public/data/questions.json` et les 782 captures de
`web/public/img/`) est versionnée : un clone se lance, se construit et se déploie tel quel,
sans étape préalable. Seul `AZ-104_dump.pdf` reste hors du dépôt — 17 Mo, et il ne sert
qu'à régénérer la banque (voir [Régénérer les données](#régénérer-les-données-depuis-le-pdf)).

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

La banque de questions étant versionnée, les trois méthodes de déploiement fonctionnent sans
préparation particulière :

| Méthode | Ce qu'elle construit | Lit `cloudbuild.yaml` |
|---|---|---|
| Portail Cloud Run, « déployer depuis un dépôt » | clone le dépôt, build le `Dockerfile` | non |
| Déclencheur Cloud Build (console GCP) | ce que dit sa configuration | oui, si le déclencheur pointe dessus |
| `gcloud run deploy --source .` | votre dossier local | non |

### Depuis le portail Cloud Run

Connectez le dépôt GitHub, laissez le type de build sur **Dockerfile**, chemin `/Dockerfile`.
Rien d'autre à configurer.

### Depuis les sources (le plus simple en ligne de commande)

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

### Avec `gcloud builds submit` (build seul)

Attention : `gcloud builds submit --tag …` **construit et pousse l'image, mais ne déploie
rien**. Son journal se termine sur `PUSH` puis `DONE`, sans étape `Deploy` : le service
Cloud Run n'est ni créé ni mis à jour, et continue de servir la révision précédente (ou
n'existe pas). Il faut enchaîner explicitement :

```bash
PROJECT=$(gcloud config get-value project)
IMAGE=gcr.io/$PROJECT/az104_test:latest

gcloud builds submit --tag $IMAGE          # construit et pousse
gcloud run deploy az104-trainer \          # ...et déploie
  --image $IMAGE \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 512Mi
```

Pour éviter cet oubli, préférez `gcloud run deploy --source .` (qui fait les deux) ou un
déclencheur configuré sur `cloudbuild.yaml`, dont la dernière étape est justement `deploy`.

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

### Intégration continue

Le portail Cloud Run suffit pour redéployer à chaque push : il clone le dépôt et construit
le `Dockerfile`, ce qui fonctionne puisque la banque de questions est versionnée.

`cloudbuild.yaml` est **facultatif**. Il n'est lu que par un déclencheur Cloud Build dont la
configuration pointe explicitement dessus (« Fichier de configuration Cloud Build », chemin
`/cloudbuild.yaml`) — le portail, lui, ne le lit jamais. Il apporte des images taguées dans
Artifact Registry et une étape de déploiement paramétrable :

```bash
gcloud artifacts repositories create containers \
  --repository-format=docker --location=europe-west1
```

Le compte de service Cloud Build a alors besoin de `roles/run.admin` et de
`roles/iam.serviceAccountUser` pour l'étape `deploy`.

---

## Architecture

```
AZ-104_dump.pdf          source ; non versionnée, non embarquée dans l'image
tools/
  extract-images.mjs     extrait les captures du PDF (pdfjs) → web/public/img/*.webp
  parse-dump.mjs         extrait les questions (pdftotext)   → web/public/data/questions.json
  images.json            métadonnées de l'extraction (positions, pages)
  translate.mjs          traduction par API (optionnelle)    → web/public/data/<lang>.json
  fr/NNN.json            traductions écrites à la main, un fichier par lot
web/                     application React + TypeScript + Tailwind (Vite)
  public/data/           banque de questions, traductions, questions interactives
  public/img/            782 captures d'écran (15 Mo)
  scripts/check-data.mjs garde de build : refuse de construire une app sans questions
server/index.js          serveur de fichiers statiques, sans dépendance
Dockerfile               build multi-étapes → image d'exécution node:22-alpine
cloudbuild.yaml          pipeline Cloud Build facultatif (build, push, deploy)
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

L'interface est bilingue, et le **contenu** des questions se traduit séparément, question par
question, dans `web/public/data/<lang>.json`. Le français est complet ; l'anglais est la
source et n'a pas de fichier.

### État de la traduction

**Les 542 questions sont traduites** — énoncé, options, explication, et les libellés des
questions interactives. Aucun badge `EN` ne subsiste en mode français.

Les noms de produits, de rôles RBAC, de cmdlets et les identifiants de ressources restent en
anglais : ce sont ceux qu'affichent le portail Azure et l'examen, et souvent ceux sur
lesquels porte la question. Traduire « Storage File Data SMB Share Elevated Contributor » ou
`assignableScopes` rendrait la question fausse.

```bash
npm run check:translations      # cohérence fr.json ↔ banque ↔ questions interactives
```

Ce script vérifie que le nombre de paragraphes traduits correspond à la source, que les clés
d'options existent, que chaque affirmation d'une grille transcrite est traduite, et qu'une
liste de choix traduite garde la longueur de la source — la réponse étant un index dedans.

### Comment la traduction est organisée

`fr.json` n'est pas écrit à la main : il est assemblé depuis `tools/fr/NNN.json`, un fichier
par lot d'une vingtaine de questions.

```bash
npm run data:translations       # tools/fr/*.json → web/public/data/fr.json
```

Le script fusionne clé par clé, si bien qu'un lot ajoutant un énoncé n'efface pas les
libellés interactifs écrits par un lot antérieur, et il signale les conflits réels — deux lots
qui définiraient la même clé pour la même question.

Pour ajouter une langue, créez `tools/<lang>/` et lancez `npm run data:translations -- <lang>`.
Le sélecteur de langue de l'interface, lui, se complète dans `web/src/lib/i18n.ts`.

### Retraduire par API

`tools/translate.mjs` fait le même travail automatiquement, si vous régénérez la banque ou
ajoutez une langue :

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run translate -- --lang es
```

Le point important pour un dump d'examen : la traduction part du **texte déjà extrait**, pas
du PDF. Retraduire le PDF avec un traducteur généraliste abîmerait les noms de rôles RBAC, de
cmdlets et de ressources. Le prompt de `translate.mjs` les verrouille en anglais et ne traduit
que la prose autour.

---

## Questions interactives

Dans le PDF, le corrigé des questions *hot area* et *drag & drop* n'existe que sous forme
d'image : rien n'y est directement exploitable pour rejouer l'interaction. Deux traitements
coexistent donc :

* **Par défaut** — l'énoncé est affiché avec sa capture, un bouton révèle le corrigé, puis
  l'apprenant s'auto-évalue. Le résultat compte dans le score et la progression.
* **Questions transcrites** — `web/public/data/interactive.json` décrit la question sous une
  forme réellement jouable, relevée à la main sur les captures. Elle devient alors corrigée
  automatiquement, et la capture d'origine reste consultable comme corrigé.

État actuel : **43 questions transcrites** — 23 grilles Oui/Non, 7 séries de menus
déroulants et 13 plateaux de glisser-déposer. **Les 14 questions de format glisser-déposer
sont toutes jouables**, plus aucune n'est laissée en capture. Il reste 150 zones actives
affichées en capture.

Une remarque de modélisation : le plateau *déplace* les pions, il ne les copie pas, donc un
même élément ne peut pas occuper deux cibles à la fois. Les questions du dump qui autorisent
« once, more than once, or not at all » et réutilisent effectivement la même réponse se
transcrivent en menus déroulants — c'est le cas de la question 161. `check-interactive.mjs`
refuse un plateau où un élément est réclamé par deux cibles.

### Transcrire automatiquement (recommandé)

La transcription n'a rien de manuel par nature : l'image de corrigé contient à la fois le
libellé de chaque ligne **et** la réponse surlignée en vert. Un modèle multimodal peut donc
la reconstruire. C'est ce que fait `tools/transcribe-hotspots.mjs` :

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run data:transcribe -- --limit 10        # commencez petit, relisez
npm run check:interactive                    # valide la structure produite
npm run data:transcribe                      # puis le reste
```

Le script écrit question par question (donc reprenable), saute celles déjà transcrites, et
refuse d'inventer : si les captures ne montrent pas clairement à la fois le libellé et la
réponse, il répond `unclear` et la question reste en mode capture. Une clé de corrigé fausse
est pire qu'une image — **relisez un échantillon avant de publier**.

### Ajouter une grille Oui / Non à la main

Le corrigé de ces questions montre à la fois les affirmations et la colonne cochée en vert,
une seule capture suffit donc à les relever. Ajoutez une ligne à `tools/yesno-seed.json`,
au format `["affirmation", true|false]` où le booléen indique si **Oui** est la bonne
réponse :

```jsonc
"163": [["User1 can create a support request.", true],
        ["User1 can delete VM1.", false]]
```

puis développez le fichier vers `interactive.json` :

```bash
npm run data:interactive
```

Le script vérifie que chaque identifiant existe bien dans la banque, que la question est
bien de format `hotspot`, et refuse les lignes mal formées.

### Ajouter des menus déroulants à la main

Même principe dans `tools/dropdown-seed.json`, au format
`["libellé", ["choix", …], index de la bonne réponse]` :

```jsonc
"137": [["You can create a premium file share in",
         ["contoso101 only", "contoso104 only"], 1]]
```

### Ajouter un glisser-déposer

Directement dans `interactive.json` :

```jsonc
"167": {
  "kind": "dragdrop",
  "prompt": "Drag the three actions into the answer area, in the order they must be performed.",
  "items":   [{ "id": "i1", "label": "Create a Recovery Services vault." }],
  "targets": [{ "id": "step1", "label": "Step 1", "accepts": ["i1"] }]
}
```

Dans tous les cas, les libellés français se placent dans `fr.json` sous la clé `interactive`
de la même question — `statements` pour une grille, `fields` pour des menus déroulants,
`items` / `targets` pour un plateau. Aucune recompilation n'est nécessaire : les fichiers
sont chargés au démarrage de l'application.

---

## Notes

* Les scores utilisent le seuil officiel de l'AZ-104, 700/1000, soit 70 %.
* La progression est stockée dans le navigateur (`localStorage`) : elle est propre à chaque
  appareil et n'est jamais transmise au serveur.
* `AZ-104_dump.pdf` n'est ni versionné ni inclus dans l'image : seules les données extraites
  le sont, ce qui suffit à construire et déployer.
* Le dump d'origine est un document commercial dont la licence interdit la redistribution.
  La banque extraite étant publiée ici, gardez ce point en tête si vous diffusez le dépôt ou
  le service au-delà d'un usage de révision personnelle.
