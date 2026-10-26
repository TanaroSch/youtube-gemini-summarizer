# YouTube → homeserver

Eigene kleine Erweiterung neben dem Gemini-Plugin im Ordner darüber. Jede hat
genau einen Kontextmenü-Eintrag, damit beide direkt im Rechtsklickmenü stehen;
mit zwei Einträgen bündelt Brave sie in einem Untermenü.

Rechtsklick auf ein Video (auch auf der Startseite) → „Auf homeserver
zusammenfassen“: im Hintergrund an `https://tools.server.tanaro.one/video/`
(eigenes Whisper-Transkript, auch ohne YouTube-Untertitel). Badge am Symbol:
✓ angenommen, = schon da, ! Fehler (dann öffnet sich die Seite). Fertig meldet
ntfy mit Link auf die Notiz; Verlauf in `KI-Briefing/Videos.md` im Vault.

Einbinden: `brave://extensions` → Entwicklermodus → „Entpackte Erweiterung
laden“ → diesen Ordner. Die ID hängt am Pfad
(`ifdaelifoimfoinobakkbeafopgmmppi` für
`~/Projects/Programming/youtube-gemini-summarizer/homeserver`) und steht in
ki-briefing unter `KIB_EXTENSION_ORIGINS`; wird der Ordner verschoben, dort
anpassen.
