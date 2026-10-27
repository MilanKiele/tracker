# Everwell · Tracker

Minimaler Wellness-Tracker mit Next.js 16, Supabase und OpenRouter. Overview, Train, Nutrition, Body und Insights lesen ausschließlich Daten des angemeldeten Kontos. Die Oberfläche ist neu aufgebaut; Git-Verlauf, Supabase-Projekt und vorhandene Aufzeichnungen werden weiterverwendet.

## Bestehendes Projekt aktualisieren

1. Im **vorhandenen Supabase-Projekt**, dessen URL als `NEXT_PUBLIC_SUPABASE_URL` in Vercel steht, den SQL Editor öffnen. Den **gesamten Inhalt von [supabase/setup.sql](supabase/setup.sql)** in eine neue Abfrage kopieren und ausführen. Die Datei ergänzt eine leere App-Datenbank, teilweise ausgeführte Migrationen und einen bereits vollständigen Stand. Wiederholte Ausführung ist möglich. Bereits vorhandene Aufzeichnungen werden nicht gelöscht. Bei Verwendung einer bereits gepflegten Supabase-CLI-Migrationshistorie weiterhin die versionierten Migrationen mit `supabase db push` anwenden.
2. Die bisherigen Supabase- und Push-Variablen in Vercel beibehalten. Für Chat und Fotos zusätzlich den **serverseitigen** `OPENROUTER_API_KEY` setzen. `OPENROUTER_MODEL=openrouter/free` ist der Standard. `SITE_URL` in Produktion auf `https://tracker-jet-one.vercel.app` setzen.
3. Neu deployen. `AI_ALLOWED_EMAILS` kann den KI-Zugriff auf bestimmte Konto-Adressen begrenzen (Komma-getrennt). Ohne Liste dürfen alle angemeldeten Konten die KI nutzen.

Die Schemaänderungen ergänzen Tabellen, Funktionen und Spalten. Sie löschen keine bestehenden Konten, Pläne, Mahlzeiten oder Messungen. Die Funktionen für Importe, Planaktivierung und Trainingsabschluss laufen als Transaktion. Eine Import-ID schützt Wiederholungen vor Duplikaten. Alle Daten bleiben dem angemeldeten Konto zugeordnet; RPC-Funktionen prüfen `auth.uid()` und nutzen RLS. Migration 005 speichert KI-Gespräche privat im Konto; Fotos werden weiterhin nicht gespeichert.

Die ursprüngliche Version wurde lokal vor dem Umbau nach `/home/enderman/Projects/tracker.backup` kopiert, inklusive Git und lokalen Einstellungen. Nur neu erzeugbare `node_modules`, `.next` und `.turbo` wurden ausgelassen. Das Backup ist kein Datenbank-Export; vorhandene Supabase-Daten bleiben im bisherigen Projekt.

## Lokal starten

Node.js 22.18 oder neuer verwenden. `npm ci`, `.env.example` nach `.env.local` kopieren und die **bisherige** Supabase-URL sowie den öffentlichen Anon-/Publishable-Key einsetzen. Danach `npm run dev`.

Für die Einrichtung über den Supabase SQL Editor die vollständige Datei `supabase/setup.sql` ausführen. Die Datei enthält alle aktuellen Tabellen und Funktionen, ohne die frühere automatische Beispieldaten-Erzeugung. Öffentliche Supabase-Variablen müssen zur Build-Zeit auch in Vercel vorhanden sein. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` funktioniert alternativ zu `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Private Schlüssel erhalten niemals das Präfix `NEXT_PUBLIC_`.

## KI-Abläufe

- **Train:** Wünsche im Chat beschreiben, Vorschlag bearbeiten und **Plan übernehmen** drücken. Der Plan wird mit Tagen und Übungen gespeichert. **Im Kalender aktivieren** ordnet ihn der Woche zu. Eine Ganzkörper-Vorlage für drei Tage ist ebenfalls verfügbar.
- **Training:** Tag starten, beliebige Übung auswählen, Satz bestätigen, Pause und nächsten Satz erledigen. Die Reihenfolge lässt sich während der Einheit ändern. Gespeicherte Sätze bleiben bei Unterbrechungen erhalten; die Reihenfolge selbst gilt für die aktuelle Ansicht. **Training abschließen** speichert Dauer, Volumen und Rekorde.
- **Nutrition:** Foto aufnehmen, aus der Galerie wählen oder eine Mahlzeit beschreiben. Die KI erkennt Speisen und schätzt die gesamte sichtbare Portion. Alle Speisen und volle Portionen sind vorausgewählt. Ganze/halbe/doppelte Portion, Mengen und Nährwerte sind vor dem Speichern editierbar.
- **Gespräche:** Frühere KI-Chats lassen sich über **Gespräche** wieder öffnen und fortsetzen. Unter **Body → Deine Zielmaße** kannst du persönliche Zielwerte pro Messgröße eintragen; die App verwendet keine allgemeinen Idealmaß-Standards.
- **Speichern:** **Tagesbedarf** erfasst gegessenes Essen; **Kalender** speichert einen geplanten Eintrag; **Speiseauswahl** legt nur einen Bibliothekseintrag an. Geplante Mahlzeiten zählen erst nach Bestätigung als gegessen. Neue Speisen werden zusätzlich in der Bibliothek gespeichert. Bei vorhandenen Namen bleiben dort manuell bearbeitete Werte erhalten.
- Fotos werden im Browser auf höchstens 1280 Pixel verkleinert und als JPEG übertragen. Originaldateien bis 20 MB in JPG/PNG/WebP sind möglich; HEIC vorher umwandeln. Die App speichert die Fotos nicht. Text, Foto und bisherige Nachrichten der aktuellen Unterhaltung werden an OpenRouter und dessen Modellanbieter übermittelt. Das persönliche Tracker-Profil wird nicht automatisch angehängt.
- Kalorien und Nährwerte aus Fotos sind **Schätzungen**, keine Messwerte. Unbekannte zusätzliche Nährwerte bleiben leer. Die App prüft strukturierte Modellantworten mit Zod, bevor sie übernommen werden können. Ein Modell darf keine Datenbankaktionen direkt ausführen.

## Kostenlose Modelle

[`openrouter/free`](https://openrouter.ai/docs/guides/routing/routers/free-router) wählt ein kostenloses Modell passend zu Bildverständnis und JSON-Ausgabe. Alternativ ist ein konkretes Modell mit `:free` erlaubt. Die App blockiert kostenpflichtige Modellnamen und verwendet keinen kostenpflichtigen Fallback.

[OpenRouter-Limits](https://openrouter.ai/docs/api/reference/limits) gelten für das gemeinsame API-Konto; kostenlose Konten haben typischerweise 50 Anfragen pro Tag und 20 pro Minute. Verfügbarkeit und Modellqualität können schwanken. Die Datenbank begrenzt diese App zusätzlich auf 30 Versuche pro Konto und 45 insgesamt pro UTC-Tag, mit mindestens acht Sekunden Abstand je Konto. Fehlgeschlagene Versuche zählen mit. Manuelle Eingaben bleiben verfügbar.

## PWA und Push

Manifest, Installationssymbole, Service Worker und Offline-Seite bleiben vorhanden. Der Service Worker speichert keine privaten Daten oder API-Antworten. Zum Bearbeiten und Speichern ist eine Verbindung erforderlich.

Für Push die bisherigen VAPID-Schlüssel, `VAPID_SUBJECT`, `CRON_SECRET` und den serverseitigen `SUPABASE_SERVICE_ROLE_KEY` beibehalten. Geräte und Ruhezeiten werden unter **Konto → Benachrichtigungen** verwaltet. Auf iOS die App zuerst über Teilen → Zum Home-Bildschirm hinzufügen installieren.

Der Vercel-Hobby-Cron läuft täglich um **07:00 UTC** mit bis zu 59 Minuten Zeitabweichung. Er sendet aktivierte Check-ins und Erinnerungen an verpasste Trainings. Liegt der Lauf in einer Ruhezeit, wird die Nachricht ausgelassen. Individuelle minutengenaue Zustellung erfordert einen häufigeren externen Scheduler oder einen passenden Vercel-Tarif.

## Prüfen

- `npm run lint`
- `npm run build`
- `npm run test:ai` prüft Portionen, Nährwert-Validierung, Datum und Planstruktur.
- `npm run test:db` führt die echten Migrationen in einer isolierten PGlite-Postgres-Datenbank aus. Geprüft werden Import-Rollback, Wiederholungen, volle Portionen, Bibliothekswerte, Training, Rekorde, Quoten und Zugriffstrennung zwischen zwei Konten. Es wird keine Verbindung zur echten Supabase-Datenbank aufgebaut.

## Fehler: `relation public.meal_entries does not exist`

Migration 004 ist ein Upgrade und setzt die Basistabellen aus 001 voraus. Der Fehler bedeutet, dass diese Basistabelle im ausgewählten Projekt fehlt. Ausschließlich Zugangsdaten in Vercel zu hinterlegen erstellt noch keine Tabellen.

Im **selben Supabase-Projekt wie die Vercel-Projekt-URL** die gesamte Datei [`supabase/setup.sql`](supabase/setup.sql) im SQL Editor ausführen. Sie läuft in einer Transaktion, erstellt fehlende App-Tabellen und Funktionen und bewahrt vorhandene Datensätze. Sie kann wiederholt ausgeführt werden. Bei unbekannten, inkompatiblen eigenen Tabellenstrukturen bricht sie ab, statt bestehende Tabellen zu ersetzen. Danach die App neu laden; für die SQL-Einrichtung allein ist kein Vercel-Redeploy nötig.

`npm run db:setup` erzeugt diese Datei aus den versionierten Schema-Quellen neu. `npm run test:setup` prüft eine leere Datenbank, teilweise vorhandene Tabellen, wiederholte Ausführung auf einem vollständigen Projekt und den Transaktionsabbruch bei inkompatiblen Tabellen. Die SQL-Editor-Datei schreibt keine Supabase-CLI-Migrationshistorie.
