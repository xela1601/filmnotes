# Minolta 7000 AF – Ausrüstungs-Preset für eine Foto-Tracking-App

**Stand:** 18. September 2026
**Zweck:** Vollständige Beschreibung einer konkreten analogen Kameraausrüstung (Minolta 7000 AF mit Zubehör) als **initialer Preset** für eine App, die pro Bild eines Films erfasst, welches Zubehör und welche Einstellungen verwendet wurden. Enthält: Inventar mit technischen Daten, alle an dieser Kamera einstellbaren Parameter mit gültigen Wertebereichen, kameraspezifische Regeln/Abhängigkeiten, Vorschlag für ein Datenmodell und ein maschinenlesbarer JSON-Preset am Ende.
**Quellen:** Fotos des Nutzers (Typenschilder, Aufdrucke), Original-Bedienungsanleitung Minolta 7000 (deutsch) bzw. Maxxum 7000 (englisch, „Technical Details" S. 62–65), Herstellerdaten der Objektive. Werte, die nicht aus Fotos oder Anleitung stammen, sind mit **(ca.)** markiert.

---

## 1. Kameragehäuse

| Feld | Wert |
|---|---|
| Hersteller / Modell | Minolta 7000 AF (Vertriebsnamen: Maxxum 7000 in USA, α-7000 in Japan) |
| Typ | 35-mm-Kleinbild-SLR, mikrocomputergesteuert, erste erfolgreiche SLR mit Autofokus im Gehäuse (Markteinführung 1985) |
| Bajonett | Minolta A-Bajonett (identisch mit Sony A-Mount); alle Minolta-AF-/Sony-A-Objektive passen |
| Filmformat | 135 (Kleinbild), 24 × 36 mm, 24 oder 36 Aufnahmen |
| Verschluss | elektronisch gesteuerter, vertikal ablaufender Schlitzverschluss |
| Verschlusszeiten automatisch (P, A) | stufenlos 1/2000 s – 30 s, Anzeige auf die nächste halbe Stufe gerundet |
| Verschlusszeiten manuell (S, M) | 1/2000 s – 30 s in **ganzen Stufen** plus **bulb** (nur M) |
| Blitzsynchronzeit | 1/100 s (in P unter EV 12: 1/60 s) |
| Belichtungsprogramme | **P** (Multi-Programm, automatisch nach Brennweite: Weitwinkel < 35 mm, Standard 35–105 mm, Tele > 105 mm), **A** Blendenpriorität, **S** Zeitpriorität, **M** manuell mit Nachführmessung |
| Programm-Shift | in P, halbe Stufen, gilt bis 10 s nach Loslassen des Auslösers, wird nach Aufnahme gelöscht |
| Blendenwahl | in A und M in **halben Stufen**; in S wählt die Kamera stufenlos |
| Belichtungsmessung | TTL, mittenbetont integral, Silizium-Fotozelle im Prisma; zweite Zelle im Spiegelkasten für TTL-Blitzmessung |
| Messbereich (AE) | EV −1 bis 20 (ISO 100, f/1.4) |
| Belichtungskorrektur | −4 bis +4 EV in **halben Stufen**; bleibt bis zum Zurückstellen aktiv |
| Belichtungsspeicher (AE lock) | Taste hinten rechts neben dem Okular; hält Messwert solange gedrückt; nicht in M |
| ISO-Bereich | 25–6400 in **Drittelstufen** (Umgebungslicht); 25–1000 für TTL-Blitz; automatisch per **DX-Code**, manuell über ISO-Taste + ▲▼; nach Schließen der Rückwand 10 s im LCD angezeigt |
| Autofokus | TTL-Phasendetektion, Motor im Gehäuse treibt das Objektiv an; Messfeld: kleines Rechteck in der Suchermitte; Arbeitsbereich EV 2–19 (ISO 100) |
| Fokusmodi | **AF** (Einzelautofokus mit Fokusspeicher bei halb gedrücktem Auslöser) und **M** (manuell mit Schärfesignalen) – Schalter vorne links unten am Bajonett |
| Schärfesignale im Sucher (unten links) | grüner Punkt = scharf; roter Pfeil ◄/► = Drehrichtung bei M; beide rote Pfeile blinkend = AF findet keine Schärfe |
| Filmtransport | motorisch: automatisches Einfädeln, Vorlauf auf Bild 1, Einzelbild **S**, Serie **C** bis 2 Bilder/s, motorisches Rückspulen (manuell gestartet: R-Taste + Rückspulschalter links neben dem Okular), automatischer Stopp |
| Selbstauslöser | elektronisch, 10 s, abbrechbar (DRIVE-Stellung **S.T.**) |
| Datenanzeige (LCD oben) | Programm, Programm-Shift, Zeit, Blende, Korrektur, ISO, Bildzähler, Drive, Selbstauslöser-Countdown, bulb-Sekunden, Batteriewarnung, Über-/Unterbelichtungswarnung |
| Sucher | fester Pentaprismensucher, 94 % Bildfeld, 0,85× (50 mm, ∞), Acute-Matte-Mattscheibe; LCD unten rechts (Programm, Zeit, Blende, Korrektur); LEDs für Fokus, Blitzbereitschaft, Blitz-OK |
| Tonsignal | Hauptschalterstellung mit Lautsprechersymbol: Piep bei Schärfe, Filmende, Selbstauslöser und als Verwacklungswarnung in P/A unter 1/30 s (< 35 mm), 1/60 s (35–105 mm), 1/125 s (> 105 mm) |
| Stromversorgung | 4 × AAA 1,5 V Alkali im Batteriehalter BH-70S (Griff, Schraube an der Unterseite); interne Lithiumzelle als Speicherpuffer; ca. 25 Filme à 24 Bilder pro Satz |
| Bedienelemente | Hauptschalter LOCK / ON / ♪ · P-Taste (Reset) · ▲▼ Zeit-/Funktionstasten (oben rechts) · MODE, +/–, DRIVE, ISO unter Klappe oben links · Blendentasten ▲▼ vorne rechts vom Bajonett · Auslöser mit Berührungsschalter (Messung 10 s) · AE-Lock hinten · Rückspulschalter + R hinten links · Rückwandentriegelung linke Seite |
| Maße / Gewicht | 52 × 91,5 × 138 mm, 555 g ohne Objektiv und Batterien |
| Sonstiges | Fernsteueranschluss vorn am Griff, Okulardeckel am Gurt, Filmfenster in der Rückwand, Kontakte für Zubehörrückwand (Program Back) und Control Grip |

### 1.1 Individueller Zustand dieses Exemplars (Stand 18.09.2026)
- Seriennummer: nicht erfasst
- LCD oben: mehrere schwarze Flecken (Alterungsfehler „ausgelaufenes LCD"), alle Anzeigen lesbar
- Batteriefach war mit ausgelaufenen Alkali-Batterien korrodiert, wurde gereinigt; Kamera schaltet mit frischen Batterien ein
- Funktionstests Autofokus / Verschluss / Blendenschluss / Lichtdichtungen: angeleitet, Ergebnis **nicht berichtet**
- Beim Kauf des neuen Films befand sich ein **alter, teilbelichteter Film unbekannter Sorte** im Gehäuse; Rückspulen angeleitet, Ergebnis nicht berichtet
- Bekannte typische Defekte des Modells, die die App ggf. als „Kamera-Notizen" vorhalten sollte: klebende Blendenmagnete (Überbelichtung bei kleinen Blenden), LCD-Bleeding, Batteriekorrosion, gealterte Lichtdichtungen der Rückwand

---

## 2. Objektive (alle Minolta AF, A-Bajonett, erste Generation 1985)

### 2.1 Minolta AF Zoom 35-70 mm f/4
| Feld | Wert |
|---|---|
| Aufdruck | „AF LENS 35-70", Minolta, Japan |
| Brennweite | 35–70 mm (Zoomring, stufenlos; Markierungen 35 / 50 / 70) |
| Lichtstärke | konstant f/4 |
| Blendenbereich | f/4 – f/22 |
| Blendenwerte in halben Stufen (Kamera-Anzeige) | 4 · 4.8 · 5.6 · 6.7 · 8 · 9.5 · 11 · 13 · 16 · 19 · 22 |
| Nahgrenze | 1,0 m (ca.); Makrostellung bei 35 mm ca. 1:4 (ca.) |
| Filtergewinde | 49 mm |
| Gewicht | ca. 255 g |
| Montierte Filter | Hama UV 390 (O-Haze) M49 (dauerhaft), Kenko-Filter Ø49 aufschraubbar |
| Multi-Programm der Kamera | 35–70 mm → immer Standardprogramm |
| Verwacklungsgrenze (Faustregel) | ≥ 1/60 s aus der Hand |
| Typische Verwendung | Immerdrauf: Reise, Straße, Landschaft (35), Gruppen, Innen mit Blitz |
| Zustand | Glas laut Foto klar; am Gehäuse montiert |

### 2.2 Minolta AF 50 mm f/1.7
| Feld | Wert |
|---|---|
| Aufdruck | „AF LENS 50", Minolta, Japan (erste Version mit Blendenskala 1.7–22 im Fenster) |
| Brennweite | 50 mm fest |
| Lichtstärke | f/1.7 |
| Blendenbereich | f/1.7 – f/22 |
| Blendenwerte in halben Stufen | 1.7 · 2 · 2.4 · 2.8 · 3.4 · 4 · 4.8 · 5.6 · 6.7 · 8 · 9.5 · 11 · 13 · 16 · 19 · 22 |
| Nahgrenze | 0,45 m (ca.), Abbildungsmaßstab ca. 1:6,7 |
| Optischer Aufbau | 6 Linsen / 5 Gruppen (ca.) |
| Filtergewinde | 49 mm |
| Gewicht | ca. 185 g |
| Montierte Filter | UV 390 (O-Haze) M49 (dauerhaft), Kenko-Filter Ø49 aufschraubbar |
| Multi-Programm der Kamera | Standardprogramm |
| Verwacklungsgrenze | ≥ 1/60 s |
| Typische Verwendung | wenig Licht ohne Blitz (f/1.7–2), Portrait mit Freistellung (f/2–2.8), Straße; schärfster Bereich f/4–8 |
| Zustand | Gummiring mit weißem Belag (Nutzer: Staub; alternativ Weichmacher-Ausblühung, kosmetisch) |

### 2.3 Minolta AF Zoom 70-210 mm f/4 („Beercan")
| Feld | Wert |
|---|---|
| Aufdruck | „AF LENS 70-210", „A 70-210/4 JAPAN", MACRO-Markierung bei 210 |
| Brennweite | 70–210 mm (Markierungen 70 / 100 / 150 / 210) |
| Lichtstärke | konstant f/4 |
| Blendenbereich | f/4 – f/32 |
| Blendenwerte in halben Stufen | 4 · 4.8 · 5.6 · 6.7 · 8 · 9.5 · 11 · 13 · 16 · 19 · 22 · 27 · 32 |
| Nahgrenze | 1,1 m (ca.); Makrostellung bei 210 mm ca. 1:4 (ca.) |
| Optischer Aufbau | 12 Linsen / 9 Gruppen (ca.) |
| Filtergewinde | 55 mm |
| Gewicht / Länge | ca. 695 g / ca. 149 mm |
| Montierte Filter / Zubehör | Hama UV 390 (O-Haze) M55 (dauerhaft), Gegenlichtblende (Minolta, Tubus); Kenko-Filter Ø49 passen **nicht** |
| Multi-Programm der Kamera | 70–105 mm Standard, 106–210 mm Teleprogramm (kurze Zeiten) |
| Verwacklungsgrenze | ≥ 1/250 s bei 210 mm (Kamera piept unter 1/125 s) |
| Typische Verwendung | Portrait aus Distanz (100–135 mm, f/4–5.6), Sport/Tiere (S 1/500), Details, Makro bei 210 mm |
| Zustand | Glas laut Foto klar |

---

## 3. Blitz: Minolta Program Flash 2800 AF

| Feld | Wert |
|---|---|
| Typ | Systemblitz für Minolta-AF-Kameras, TTL-Blitzautomatik, Schwenkreflektor (nach oben kippbar), AF-Messblitz (dunkelrotes Fenster vorn) |
| Leitzahl | 28 (ISO 100, Meter) → ISO 400: 56 |
| Reichweite (direkt) | ISO 400: f/4 ≈ 7 m · f/5.6 ≈ 5 m · f/8 ≈ 3,5 m · f/11 ≈ 2,5 m; ISO 200: f/4 ≈ 5 m; indirekt (Decke) etwa halbe Reichweite |
| Bedienelemente (Rückseite) | OFF/ON · TEST (rot) · EXP/OK-Lampe (Belichtungskontrolle nach Aufnahme) · Lo/Hi (Hi = volle Leistung, Lo = reduzierte Leistung für Nahaufnahmen < 1,5 m und Serien; Reduktionsfaktor nicht verifiziert) · ISO-Schieber und Belichtungsrechner-Tafel (Blenden 4–16, Entfernungen m/ft, PROGRAM-Markierung) |
| Stromversorgung | 4 × AA |
| Zusammenspiel mit der 7000 | Kamera stellt Synchronzeit 1/100 s automatisch (P, A); automatischer Aufhellblitz bei Tageslicht in P und A; in M nur Zeiten ≤ 1/100 s (kürzere werden zurückgesetzt); Langzeitsynchronisation bis 30 s über AE-Lock; AF-Messblitz fokussiert im Dunkeln bis ca. 5 m; Abschaltautomatik nach 15 min ohne Auslöserberührung; Blitzbereitschaft und Blitz-OK werden im Sucher angezeigt |
| Reflektorstellungen | direkt (0°) und gekippt (Winkelrasten nicht verifiziert; für die App genügt: direkt / indirekt-Decke) |
| Zustand | Funktion und Batteriefach **nicht geprüft** |
| Offen | Auf einem Foto war möglicherweise ein zweiter kleiner Aufsteckblitz (evtl. Program Flash 1800 AF) auf dem Blitzschuh – **nicht geklärt** |

---

## 4. Filter

| Filter | Gewinde | Typ / Wirkung | Belichtungsfaktor | AF-Verträglichkeit | passt auf |
|---|---|---|---|---|---|
| Hama UV 390 (O-Haze) M49 | 49 mm | UV-Sperrfilter, Schutz, keine sichtbare Farbwirkung | 0 EV | ja | 35-70, 50 (je einer montiert) |
| Hama UV 390 (O-Haze) M55 | 55 mm | UV-Sperrfilter, Schutz | 0 EV | ja | 70-210 (montiert) |
| Kenko Skylight Ø49 | 49 mm | leicht wärmend (rosa), Schutz; bei S/W-Film wirkungslos | 0 EV | ja | 35-70, 50 |
| Kenko PL Ø49 | 49 mm | **linearer** Polfilter: dunklerer Himmel, Reflexe auf Wasser/Glas/Laub; wirkt am stärksten 90° zur Sonne; drehbar | ca. 1,5–2 EV (Kamera misst durch den Filter, keine Korrektur nötig) | **nein** – laut Minolta-Anleitung funktioniert der AF der 7000 mit linearem Polfilter nicht → manuell fokussieren oder erst fokussieren, dann aufschrauben | 35-70, 50 |
| Kenko Center Focus 49S | 49 mm | Effektfilter: Bildmitte klar, Rand weichgezeichnet; Wirkung nur bei offener Blende (f/1.7–4) sichtbar | ≈ 0 EV | eingeschränkt (im Zweifel M) | 35-70, 50 |
| Kenko Two Field Focus 49S | 49 mm | Split-Field-Nahlinse: eine Bildhälfte Nahbereich, andere Hälfte normal; Dioptrienwert nicht abgelesen | 0 EV | eingeschränkt (im Zweifel M) | 35-70, 50 |

Regel für die App: Filter der Größe 49 mm nur mit 35-70 und 50 kombinierbar; 55 mm nur mit 70-210. Mehrere Filter stapelbar (UV + Effekt), bei 35 mm Vignettierungsgefahr.

---

## 5. Weiteres Zubehör
- Minolta Gegenlichtblende (Tubus, für 70-210)
- Minolta Kameragurt, schwarz mit roten Streifen, mit Okulardeckel (für Selbstauslöser/Stativ)
- Kenko-Filteretui (Kunstleder, 4 Fächer)
- Alukoffer mit Schaumstoff-Trennwänden (Rostflecken an den Kanten); für unterwegs wird eine Fototasche/Rucksack genutzt
- Kein Stativ im Set (Mini-Stativ/Bohnensack empfohlen), keine Fernauslösung (Selbstauslöser als Ersatz)
- Batterien: 4 × AAA (Kamera), 4 × AA (Blitz), jeweils Ersatzsatz empfohlen

---

## 6. Filme

| Feld | Wert |
|---|---|
| Aktuell gekauft | **AgfaPhoto APX 400 Professional**, 135-36, Schwarzweiß-Negativfilm, ISO 400, klassischer S/W-Prozess (nicht C-41); DX-Code wahrscheinlich vorhanden, **nach Einlegen ISO-Anzeige im LCD prüfen**, sonst manuell ISO 400 setzen |
| Zuvor im Gehäuse | alter, teilbelichteter Film unbekannter Sorte (Vorbesitzer), wird zurückgespult und ggf. entwickelt |
| Empfehlung für Farbe | Kodak Ultramax 400 / Fujifilm 400 (Universal), Kodak Gold 200 (Sonne) |
| Filmpreise (Sept. 2026, Drogerie) | Fomapan 200 Creative 7,99 € · AgfaPhoto APX 400 8,99 € · Fomapan 400 Action 8,99 € · Wolfen Farbfilm 200 14,99 € |
| Entwicklung | Drogerie (Rossmann: Kleinbild 5–8 Werktage, CD möglich) oder Online-Labor mit Downloadlink (z. B. Urbanfilmlab: Entwicklung + Scan Large 13 €, XL 17 €; MeinFilmLab; Fotobrell; Onfilmlab) |

Rollen-Attribute, die die App pro Film speichern sollte: Filmname, Hersteller, ISO nominal, ISO an Kamera (DX/manuell), Typ (C-41 Farbnegativ / S/W / E-6 Dia), Bildanzahl 24/36, Einlegedatum, Rückspuldatum, Labor, Scan-Auflösung, Push/Pull, Link zu Scans.

---

## 7. Einstellbare Parameter pro Aufnahme – gültige Werte an dieser Kamera

| Parameter | Wertebereich | Abhängigkeit |
|---|---|---|
| `exposure_mode` | P, A, S, M | bestimmt, welche Felder der Nutzer wählt: P keins (optional Shift), A Blende, S Zeit, M beide |
| `shutter_speed` | manuell (S/M): 30", 15", 8", 4", 2", 1", 1/2, 1/4, 1/8, 1/15, 1/30, 1/60, 1/125, 1/250, 1/500, 1/1000, 1/2000, bulb (nur M); automatisch (P/A): zusätzlich halbe Stufen (Anzeige z. B. 45, 90, 180, 350, 750, 1500, 0"7, 1"5, 3", 6", 12", 20") | bei Blitz: 1/100 (P/A automatisch), in M ≤ 1/100 |
| `aperture` | halbe Stufen aus der Liste des montierten Objektivs (Abschnitt 2) | in S wählt die Kamera stufenlos → Feld optional/ungefähr |
| `focal_length_mm` | 35-70: 35–70 · 50: 50 · 70-210: 70–210 | Zoom-Position ist am Objektiv ablesbar, nicht in der Kamera |
| `exposure_compensation_ev` | −4,0 … +4,0 in 0,5-Schritten, Standard 0 | nicht in M |
| `program_shift` | true/false | nur in P |
| `ae_lock` | true/false | nicht in M |
| `focus_mode` | AF, M | – |
| `af_result` | green (scharf), red_blink (kein Fokus möglich), manual | – |
| `drive_mode` | S (Einzelbild), C (Serie 2 B/s), ST (Selbstauslöser 10 s) | – |
| `iso_camera` | 25–6400 in Drittelstufen; Quelle DX oder manuell | pro Rolle, nicht pro Bild |
| `metering` | center_weighted (fest) | – |
| `flash` | none, program_2800af | – |
| `flash_head` | direct, bounce | nur wenn Blitz |
| `flash_power` | Hi, Lo | nur wenn Blitz |
| `flash_ok_lamp` | true/false | Rückmeldung nach der Aufnahme |
| `filters` | Mehrfachauswahl aus Abschnitt 4, gefiltert nach Gewinde des Objektivs | Polfilter → `focus_mode` sollte M sein (Warnung) |
| `lens_hood` | true/false | nur 70-210 |
| `support` | handheld, braced, tripod, beanbag | – |
| `beep_warning` | true/false (Verwacklungswarnung gehört) | – |
| `light` | sun, cloudy, shade, indoor_window, indoor_artificial, night, backlight, snow_beach | frei erweiterbar |
| `subject` | portrait, landscape, street, sport, macro, group, night, other | frei erweiterbar |
| `notes` | Freitext | – |

Plausibilitätsregeln, die die App prüfen kann:
1. Blitz montiert + `exposure_mode` M + `shutter_speed` kürzer als 1/100 → Kamera setzt 1/100 (Hinweis anzeigen).
2. `filters` enthält Kenko PL + `focus_mode` AF → Warnung „AF funktioniert mit linearem Polfilter nicht".
3. `shutter_speed` bulb nur bei M.
4. `exposure_compensation_ev` ≠ 0 bei M → nicht wirksam.
5. Verwacklungswarnung: Zeit länger als 1/60 (35-70, 50) bzw. 1/125 (70-210 > 105 mm) → Hinweis „Kamera piept in Stellung ♪".
6. Filtergewinde muss zum Objektiv passen (49 vs. 55 mm).
7. Bildnummer 1…24/36 fortlaufend; Kamera zählt vorwärts ab 1 nach dem automatischen Vorlauf.
8. Blende außerhalb des Objektivbereichs (z. B. f/1.7 am Zoom) unzulässig.

---

## 8. Vorgeschlagenes Datenmodell (Kurzform)

```
Camera { id, make, model, mount, shutter_speeds_manual[], shutter_speeds_auto_extra[], modes[], comp_range, comp_step, iso_range, iso_step, flash_sync, drive_modes[], focus_modes[], metering, notes }
Lens { id, make, model, focal_min, focal_max, aperture_min (Lichtstärke), aperture_max, aperture_values[], filter_thread_mm, min_focus_m, macro, weight_g, default_filter_ids[] }
Flash { id, make, model, guide_number_iso100_m, power_levels[], head_positions[], af_illuminator, batteries }
Filter { id, make, model, thread_mm, type, exposure_factor_ev, af_compatible }
FilmStock { id, name, maker, iso, process (C41|BW|E6), exposures, dx_coded }
Roll { id, camera_id, film_stock_id, iso_set, iso_source (DX|manual), loaded_at, unloaded_at, lab, scan_url, notes }
Frame { id, roll_id, frame_no, taken_at, lens_id, focal_length_mm, exposure_mode, shutter_speed, aperture, exposure_compensation_ev, program_shift, ae_lock, focus_mode, af_result, drive_mode, flash_id, flash_head, flash_power, flash_ok, filter_ids[], lens_hood, support, light, subject, notes, gps? }
```

---

## 9. Maschinenlesbarer Preset (JSON)

```json
{
  "preset_name": "Minolta 7000 AF – Familienausrüstung",
  "created": "2026-09-18",
  "camera": {
    "id": "minolta_7000af",
    "make": "Minolta",
    "model": "7000 AF",
    "aliases": ["Maxxum 7000", "Alpha 7000"],
    "year": 1985,
    "format": "135",
    "mount": "Minolta A / Sony A",
    "exposure_modes": ["P", "A", "S", "M"],
    "shutter_speeds_manual": ["30\"", "15\"", "8\"", "4\"", "2\"", "1\"", "1/2", "1/4", "1/8", "1/15", "1/30", "1/60", "1/125", "1/250", "1/500", "1/1000", "1/2000", "bulb"],
    "shutter_speeds_auto_half_stops": ["20\"", "12\"", "6\"", "3\"", "1\"5", "0\"7", "1/3", "1/6", "1/10", "1/20", "1/45", "1/90", "1/180", "1/350", "1/750", "1/1500"],
    "bulb_only_in": ["M"],
    "aperture_step": 0.5,
    "shutter_step_manual": 1.0,
    "exposure_compensation": { "min": -4.0, "max": 4.0, "step": 0.5, "not_in_modes": ["M"] },
    "program_shift": { "modes": ["P"], "step": 0.5 },
    "ae_lock": { "available": true, "not_in_modes": ["M"], "location": "rear, right of eyepiece" },
    "iso": { "min": 25, "max": 6400, "step_ev": 0.333, "dx_auto": true, "ttl_flash_max": 1000 },
    "metering": "TTL center-weighted",
    "metering_range_ev_iso100": [-1, 20],
    "autofocus": { "type": "TTL phase detection, body motor", "range_ev_iso100": [2, 19], "field": "center", "focus_lock": "half-press" },
    "focus_modes": ["AF", "M"],
    "af_signals": ["green_in_focus", "red_arrow_left", "red_arrow_right", "both_red_blink_no_focus"],
    "drive_modes": ["S", "C", "ST"],
    "continuous_fps": 2,
    "self_timer_s": 10,
    "flash_sync": "1/100",
    "flash_sync_low_light_P": "1/60",
    "multi_program_by_focal_length": { "wide_below_mm": 35, "standard_mm": [35, 105], "tele_above_mm": 105 },
    "beep_shake_warning": { "below_35mm": "1/30", "35_to_105mm": "1/60", "above_105mm": "1/125" },
    "viewfinder": { "coverage_pct": 94, "magnification": 0.85 },
    "power": { "camera": "4x AAA", "memory_backup": "internal lithium cell" },
    "dimensions_mm": [138, 91.5, 52],
    "weight_g_body": 555,
    "condition_notes": [
      "LCD oben mit schwarzen Flecken, lesbar",
      "Batteriefach nach Korrosion gereinigt",
      "Funktionstests AF/Verschluss/Blende ausstehend"
    ]
  },
  "lenses": [
    {
      "id": "minolta_af_35_70_f4",
      "make": "Minolta",
      "model": "AF Zoom 35-70mm f/4",
      "focal_min_mm": 35,
      "focal_max_mm": 70,
      "max_aperture": 4.0,
      "min_aperture": 22,
      "aperture_values": [4, 4.8, 5.6, 6.7, 8, 9.5, 11, 13, 16, 19, 22],
      "filter_thread_mm": 49,
      "min_focus_m": 1.0,
      "macro": "bei 35 mm, ca. 1:4",
      "weight_g": 255,
      "default_filter_ids": ["hama_uv390_49_a"],
      "handheld_min_shutter": "1/60",
      "is_default_lens": true
    },
    {
      "id": "minolta_af_50_f17",
      "make": "Minolta",
      "model": "AF 50mm f/1.7",
      "focal_min_mm": 50,
      "focal_max_mm": 50,
      "max_aperture": 1.7,
      "min_aperture": 22,
      "aperture_values": [1.7, 2, 2.4, 2.8, 3.4, 4, 4.8, 5.6, 6.7, 8, 9.5, 11, 13, 16, 19, 22],
      "filter_thread_mm": 49,
      "min_focus_m": 0.45,
      "macro": null,
      "weight_g": 185,
      "default_filter_ids": ["hama_uv390_49_b"],
      "handheld_min_shutter": "1/60"
    },
    {
      "id": "minolta_af_70_210_f4_beercan",
      "make": "Minolta",
      "model": "AF Zoom 70-210mm f/4 (Beercan)",
      "focal_min_mm": 70,
      "focal_max_mm": 210,
      "max_aperture": 4.0,
      "min_aperture": 32,
      "aperture_values": [4, 4.8, 5.6, 6.7, 8, 9.5, 11, 13, 16, 19, 22, 27, 32],
      "filter_thread_mm": 55,
      "min_focus_m": 1.1,
      "macro": "bei 210 mm, ca. 1:4",
      "weight_g": 695,
      "default_filter_ids": ["hama_uv390_55"],
      "lens_hood": true,
      "handheld_min_shutter": "1/250"
    }
  ],
  "flashes": [
    {
      "id": "minolta_program_2800af",
      "make": "Minolta",
      "model": "Program Flash 2800 AF",
      "guide_number_iso100_m": 28,
      "power_levels": ["Hi", "Lo"],
      "head_positions": ["direct", "bounce"],
      "af_illuminator": true,
      "af_illuminator_range_m": 5,
      "ttl": true,
      "batteries": "4x AA",
      "auto_off_min": 15,
      "sync_with_camera": "1/100",
      "condition_notes": ["Funktion ungeprüft"]
    }
  ],
  "filters": [
    { "id": "hama_uv390_49_a", "make": "Hama", "model": "UV 390 (O-Haze)", "thread_mm": 49, "type": "UV", "exposure_factor_ev": 0, "af_compatible": true, "mounted_on": "minolta_af_35_70_f4" },
    { "id": "hama_uv390_49_b", "make": "Hama", "model": "UV 390 (O-Haze)", "thread_mm": 49, "type": "UV", "exposure_factor_ev": 0, "af_compatible": true, "mounted_on": "minolta_af_50_f17" },
    { "id": "hama_uv390_55", "make": "Hama", "model": "UV 390 (O-Haze)", "thread_mm": 55, "type": "UV", "exposure_factor_ev": 0, "af_compatible": true, "mounted_on": "minolta_af_70_210_f4_beercan" },
    { "id": "kenko_skylight_49", "make": "Kenko", "model": "Skylight", "thread_mm": 49, "type": "skylight", "exposure_factor_ev": 0, "af_compatible": true },
    { "id": "kenko_pl_49", "make": "Kenko", "model": "PL (linear)", "thread_mm": 49, "type": "polarizer_linear", "exposure_factor_ev": 1.5, "af_compatible": false, "warning": "AF der 7000 funktioniert mit linearem Polfilter nicht" },
    { "id": "kenko_center_focus_49", "make": "Kenko", "model": "Center Focus 49S", "thread_mm": 49, "type": "effect_center_soft", "exposure_factor_ev": 0, "af_compatible": "limited" },
    { "id": "kenko_two_field_focus_49", "make": "Kenko", "model": "Two Field Focus 49S", "thread_mm": 49, "type": "split_field_closeup", "exposure_factor_ev": 0, "af_compatible": "limited" }
  ],
  "accessories": [
    { "id": "hood_70_210", "type": "lens_hood", "for_lens": "minolta_af_70_210_f4_beercan" },
    { "id": "eyepiece_cap", "type": "eyepiece_cap", "note": "am Gurt, für Selbstauslöser/Stativ" },
    { "id": "strap", "type": "strap", "note": "Minolta, schwarz/rot" },
    { "id": "alu_case", "type": "case", "note": "Alukoffer, Rostflecken" }
  ],
  "film_stocks": [
    { "id": "agfaphoto_apx_400", "name": "AgfaPhoto APX 400 Professional", "maker": "AgfaPhoto/Lupus Imaging", "iso": 400, "process": "BW", "exposures": 36, "dx_coded": "wahrscheinlich – nach Einlegen im LCD prüfen", "in_stock": true },
    { "id": "unknown_old_roll", "name": "Alter Film des Vorbesitzers", "maker": null, "iso": null, "process": null, "exposures": null, "dx_coded": null, "note": "teilbelichtet, zurückgespult, ggf. entwickeln" }
  ],
  "defaults_for_new_frame": {
    "exposure_mode": "P",
    "drive_mode": "S",
    "focus_mode": "AF",
    "exposure_compensation_ev": 0,
    "program_shift": false,
    "ae_lock": false,
    "lens_id": "minolta_af_35_70_f4",
    "filter_ids": ["hama_uv390_49_a"],
    "flash_id": null,
    "support": "handheld"
  },
  "validation_rules": [
    "bulb nur bei exposure_mode M",
    "aperture muss in lens.aperture_values des gewählten Objektivs liegen",
    "filter.thread_mm muss lens.filter_thread_mm entsprechen",
    "kenko_pl_49 + focus_mode AF → Warnung (AF deaktiviert)",
    "flash + exposure_mode M + shutter kürzer als 1/100 → Kamera setzt 1/100",
    "exposure_compensation_ev ≠ 0 in M → unwirksam",
    "shutter länger als lens.handheld_min_shutter bei support handheld → Verwacklungshinweis",
    "focal_length_mm innerhalb [lens.focal_min_mm, lens.focal_max_mm]",
    "frame_no 1..roll.exposures"
  ]
}
```

---

## 10. Nicht verifizierte / offene Angaben (für den App-Agenten)
- Objektivdaten mit **(ca.)** (Nahgrenzen, Gewichte, Linsenaufbau) stammen aus Herstellerdaten aus dem Gedächtnis, nicht aus den Fotos – für die App als Richtwerte ausreichend, bei Bedarf gegen Minolta-Datenblätter prüfen.
- Lo-Leistungsfaktor und Kippwinkel des 2800 AF nicht verifiziert.
- Dioptrienwert des Two Field Focus nicht abgelesen.
- DX-Codierung des APX 400 nicht bestätigt.
- Zweiter Blitz auf dem Blitzschuh: unklar, ob vorhanden.
- Seriennummern von Gehäuse und Objektiven nicht erfasst.
- Ergebnisse der Funktionstests (AF, Verschluss, Blende, Lichtdichtungen) und der Rückspulaktion nicht berichtet.
