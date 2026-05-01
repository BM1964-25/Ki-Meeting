# Architektur-Notizen

## API-Schlüssel und KI-Anbindung

Aktueller Stand: Die App nutzt Mock-Funktionen in `lib/aiService.ts` und benötigt keinen API-Schlüssel.

Merken für später:

- Für lokale Einzelplatz-Nutzung kann jeder Nutzer seinen eigenen API-Schlüssel lokal speichern, z. B. in `.env.local`, lokalem Browser-Speicher oder einer lokalen Desktop-/Backend-Konfiguration.
- Für eine öffentlich erreichbare Web-App, z. B. GitHub Pages, sollte kein API-Schlüssel direkt im Frontend-Code oder dauerhaft im Browser gespeichert werden.
- Für echte KI-Funktionen in einer veröffentlichten App ist ein kleines Backend oder eine Serverless-Funktion sinnvoll, z. B. Vercel Functions, Netlify Functions oder eigener Server.
- Dieses Backend würde den API-Schlüssel sicher halten und Anfragen an OpenAI, Claude oder andere Anbieter stellvertretend ausführen.

Nächster sinnvoller Ausbau:

1. Mock-Funktionen strukturell beibehalten.
2. Einen Provider-Layer vorbereiten: `mock`, später `openai`, `claude`, `custom`.
3. Einstellungen in der App so gestalten, dass lokale Nutzung und Server-Betrieb getrennt gedacht werden.
