# Meeting Intelligence KI

Lokale Next.js-Web-App zur strategischen Vorbereitung, Durchführung und Nachbereitung von Meetings.

## Start

```bash
npm install
npm run dev
```

Danach ist die App standardmäßig unter `http://localhost:3000` erreichbar.

Falls ein anderer Paketmanager genutzt wird:

```bash
pnpm install
pnpm dev
```

oder

```bash
yarn install
yarn dev
```

## KI-Anbindung

Die aktuelle Version nutzt Mock-Funktionen in `lib/aiService.ts`. Diese Funktionen liefern strukturierte Beispieldaten und können später durch OpenAI, Claude oder einen anderen Anbieter ersetzt werden.

## Aufnahme und Transkription

Im Bereich `Meeting aufnehmen` kann eine Aufnahme im Browser gestartet oder eine vorhandene Audiodatei hochgeladen werden. Die Transkription ist aktuell noch ein Mock und schreibt das Beispiel-Transkript direkt in den Bereich `Transkript analysieren`.

## Datenschutz

Die App führt keine automatische Web-Recherche durch. Analysefunktionen arbeiten nur mit Daten, die Nutzer selbst eingeben.
