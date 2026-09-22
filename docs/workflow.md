# The routine

Shooting → notes → lab → scan import → export, as a checklist. This is the document to have open
next to the camera bag the first few times.

The app's UI is **German** by default (switchable under "Einstellungen" → "Sprache"), so every
button below is quoted with the label you actually see. Screens are named by their route so they
can be cross-referenced with the code: `/rolls/new`, `/frames/<id>` and so on.

Server-dependent steps are marked **(server)**. Everything else works with no network at all:
creating rolls, taking notes, editing equipment. Scan import, sync and export need a configured
PocketBase server — see [`deployment.md`](deployment.md).

---

## 1. Loading a roll

- [ ] Load the cartridge into the camera and close the back.
- [ ] **Check the ISO the camera actually uses.** The Minolta 7000 AF reads the DX code off the
      cartridge; the value appears on the LCD. If the film has no DX code, or you deliberately
      pull or push, the camera has to be set by hand — and the app has to be told the same thing.
- [ ] Open the app, tab **"Filme"**, press **"+"** (top right) → `/rolls/new`.
- [ ] Section **"Film"**: - **"Kamera"** — preselected with the first camera in the equipment list. - **"Filmart"** — **"Farbe"** or **"Schwarzweiß"**. This only narrows the next field. - **"Film"** — the stock, from the seeded catalogue (22 films) or your own entries.
      Picking one **sets "ISO" and "Bilder" from the preset**, so pick the film before you touch
      those two. - **"ISO"** — what the camera meters at. Must match the LCD, not the box. - **"ISO-Quelle"** — **"DX"** or **"manuell"**. This is the note-to-self about _why_ the ISO
      is what it is. - **"Bilder"** — 24 or 36. - **"Push/Pull (EV)"** — leave at 0 unless you are deliberately rating the film differently.
      A value here is an instruction for the lab; write it in **"Notizen"** as well, because the
      lab never sees the app.
- [ ] Section **"Entwicklung"**: - **"Eingelegt am"** — plain text in the form `YYYY-MM-DD` (the placeholder shows it). - **"Labor"** — where the roll will go, e.g. `dm` or `Rossmann`. It may stay empty for now;
      the field is on this screen and on **"Film bearbeiten"**. - **"Notizen"** — the free-form place for everything lab-relevant: push/pull, "please do not
      cut the negatives", the order number of the envelope.
- [ ] **"Speichern"** → you land on the roll detail screen `/rolls/<id>`, status **"eingelegt"**.

The roll id is the last path segment of that URL and is what the desktop CLI in step 4 needs.

## 2. In the field

- [ ] Take the picture first, note it afterwards. The camera does not wait.
- [ ] Roll detail → **"Bild hinzufügen"**. The frame record is created immediately (it gets the
      next free number) and you land on `/frames/<id>`, titled **"Bild {{no}} / {{total}}"**.
      The button is greyed out once the roll has as many frames as it has exposures.
- [ ] **Change only what changed.** A new frame inherits everything from the previous frame of the
      same roll that is still true when you wind on: lens, focal length, filters, flash (unit,
      head, power), exposure mode, focus mode, drive mode, support, lens hood, light, **the
      exposure itself ("Zeit", "Blende", "Belichtungskorrektur")** and **"Motiv"** and **"Ort"**.
      In a series that is almost everything — which is the point. The first frame of a roll takes
      what it can from the camera's own defaults instead ("Standard: …" fields on the camera in
      "Ausrüstung").
- [ ] **Blank every time**, because they are what you observed about _that_ frame:
      **"AF-Ergebnis"**, **"Blitzbelichtung ok"**, **"Kamera hat gepiept"**, **"Notizen"** — and
      **"Datum"/"Uhrzeit"**, which start at _now_.
- [ ] **Reset every time**, because the camera resets them too: **program shift** (cancelled when
      the meter switches off) and **AE-Lock** (held with a button). The exposure compensation is
      _not_ among them — it stays dialled in on the Minolta until you turn it back, so it follows
      you down the roll, a forgotten −1 EV included. It is in the "Belichtung" section of every
      frame, where you will see it.
- [ ] Sections to walk through: **"Belichtung"** (the fields shown depend on the mode — in P there
      is no **"Zeit"**/**"Blende"** to enter), **"Optik"**, **"Fokus & Transport"**, **"Blitz"**,
      **"Kontext"**.
- [ ] **"Ort"** is free text; **"Aktuelle Position verwenden"** adds coordinates (it asks for the
      location permission the first time, and only then). **"Datum"** and **"Uhrzeit"** are
      prefilled with _now_ and are plain text fields (`JJJJ-MM-TT`, `HH:MM`) — correct them if you
      write the note later in the evening.
- [ ] **"Speichern & nächstes"** for the next frame (the button is not shown on the last frame of
      the roll), or **"Speichern"** to go back to the roll.

### The section "Hinweise"

Everything the domain rules find about the current combination shows up there while you type.
Three levels:

- **Red (error) blocks saving.** Both save buttons are disabled until it is resolved.
- **Orange (warning)** is a "you probably do not want this".
- **Grey (info)** is "the camera will do something you should know about".

| Hint                                                                                                                                                                                                  | When                                                                                                                                                                                       | What it means                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| _"Autofokus funktioniert mit linearem Polfilter nicht – manuell fokussieren."_ (warning)                                                                                                              | focus mode **"AF"** and a mounted filter is marked as not AF-compatible — in the seeded kit that is the **Kenko PL (linear) 49**                                                           | The linear polarizer kills the phase-detect AF. Switch **"Fokus"** to **"Manuell"** and focus by hand, then set **"AF-Ergebnis"** to **"Manuell fokussiert"**.                             |
| _"Verwacklungsgefahr: länger als {{limit}} aus der Hand."_ (warning)                                                                                                                                  | a shutter speed slower than the lens's handheld limit while **"Halt"** is empty or **"Aus der Hand"**. Seeded limits: 1/60 for the 35-70 and the 50 mm, **1/250 for the 70-210 "Beercan"** | Brace yourself, use the flash, or set **"Halt"** to **"Abgestützt"** / **"Stativ"** / **"Bohnensack"** once you have — the warning then goes away, and later you know why a frame is soft. |
| _"Mit Blitz erzwingt die Kamera die Synchronzeit {{sync}}."_ (info)                                                                                                                                   | a flash is set, mode **M**, and the chosen time is faster than the camera's sync speed (1/100 on the 7000 AF)                                                                              | The camera overrides you. Record 1/100 in **"Zeit"**, otherwise the note lies about the frame.                                                                                             |
| _"Belichtungskorrektur hat im Modus M keine Wirkung."_ (info)                                                                                                                                         | compensation ≠ 0 in mode M                                                                                                                                                                 | Harmless; the camera ignores it.                                                                                                                                                           |
| _"Bulb ist nur im Modus M verfügbar."_ (error)                                                                                                                                                        | Bulb outside M                                                                                                                                                                             |                                                                                                                                                                                            |
| _"Diese Blende gibt es am gewählten Objektiv nicht."_ / _"Diese Verschlusszeit bietet die Kamera in diesem Modus nicht an."_ / _"Brennweite liegt außerhalb des Bereichs dieses Objektivs."_ (errors) | the value is not on the lens or not offered by the camera in that mode                                                                                                                     | Usually the wrong lens is selected in **"Objektiv"**.                                                                                                                                      |
| _"Filter {{filter}} hat {{filterThread}} mm, das Objektiv {{lensThread}} mm."_ (error)                                                                                                                | a filter whose thread does not fit the lens                                                                                                                                                | The filter list is filtered by thread; this only appears after changing the lens under a mounted filter.                                                                                   |
| _"Bildnummer liegt außerhalb der Länge des Films."_ / _"Diese Bildnummer ist auf dem Film schon vergeben."_ (errors)                                                                                  | frame number out of 1…exposures, or a duplicate                                                                                                                                            |                                                                                                                                                                                            |

Field tips:

- **"Kamera hat gepiept"** — the 7000 AF beeps when it thinks the exposure is out of range. Tick
  it; it explains a bad frame six weeks later far better than memory does.
- **"AF-Ergebnis"** — **"Grün (scharf)"**, **"Rot (blinkt)"**, **"Manuell fokussiert"**. The red
  one is the single most useful note on the whole screen.
- **"Licht"** (Sonne / Bewölkt / Schatten / Gegenlicht / …) costs one tap and is what makes the
  scans comparable afterwards.

## 3. Roll finished

- [ ] Last frame shot → roll detail → the **"Status"** picker → **"belichtet"**. This also stamps
      the unload date internally (the first move away from "eingelegt" does).
- [ ] **Rewind and take the cartridge out of the camera.** Do this before the app step if you are
      the kind of person who trusts a checklist more than a rewound leader.
- [ ] Hand it in, then set **"Status"** → **"im Labor"**.
- [ ] Record the lab: **"Film bearbeiten"** → **"Labor"**. There is **no separate lab date field**
      — put the hand-in date and the envelope/order number into **"Notizen"**; the export and the
      import do not need it, you do.
- [ ] Later, **"entwickelt"** is set for you by the scan import (step 4), and **"archiviert"** is
      yours to set when the negatives are filed away.

### What to agree with the lab

The import in step 4 matches files onto frames **by filename order**, so the file naming is the
one thing that actually matters:

- [ ] **Scan resolution.** Ask for the largest they do ("groß"/"XL", ideally ≥ 3000 px on the long
      edge). The WordPress export uploads the file as it is, so this is the ceiling for the blog.
- [ ] **File naming: sequential, in shooting order**, e.g. `img001.jpg` … `img036.jpg`. Files
      named after the lab's job number in arbitrary order destroy the automatic mapping (you can
      still fix it by hand, for 36 frames, once).
- [ ] **Format JPEG or TIFF.** **Not HEIC** — the server rejects `.heic`/`.heif` outright, and the
      app will let you pick such a file and then fail on upload.
- [ ] **All frames, including the failures.** A lab that silently drops the blank frames shifts
      every following file by one; the import has ▲/▼ for exactly that, but only if you notice.
- [ ] **Delivery**: download link (ZIP), CD, or USB stick — all three work, the CD/stick just
      needs copying to the computer first.
- [ ] If you pushed or pulled, say so **at hand-in**, not on the phone afterwards.
- [ ] Ask them **not to cut the negatives** if you want to scan them again yourself later.

## 4. Scans arrive **(server)**

Scan files are stored on the server, never on the device, so this step needs a configured server.
Without one the screen offers only **"Server einrichten"**.

### 4a. In the app

- [ ] Get the files onto the device: download the ZIP, or copy `DCIM/` off the CD and put the
      folder somewhere the file picker can reach.
- [ ] Roll detail → **"Scans importieren"** → `/scans/<rollId>`.
- [ ] **"Dateien wählen"** — pick the images (multi-select) **or one ZIP archive**; the ZIP is
      unpacked inside the app. To start over: **"Andere Dateien wählen"**.
- [ ] **Check the mapping against your notes.** The files are sorted the way a file browser sorts
      them (`img2.jpg` before `img10.jpg`) and the n-th file is assigned to the n-th frame — the
      filename is _not_ parsed for a frame number. Each row shows the thumbnail next to the frame
      it landed on (**"→ #{{frameNo}}"**) and that frame's notes, which is what makes the check
      possible: the note says "Hafen, Gegenlicht" and the thumbnail had better be the harbour.
- [ ] Fix what is wrong, per row: - **"▲"** / **"▼"** shift this row **and every row after it** by one frame. This is the
      repair for a lab that dropped or added a single scan. - **"✕"** takes the scan off its frame (**"keinem Bild zugeordnet"**). - the **"Bild"** picker assigns one specific frame number. A frame holds at most one scan,
      so assigning a taken frame frees the scan that was there.
- [ ] **"Hochladen"**. Result: **"{{uploaded}} von {{total}} Scans hochgeladen."**, and any
      failures listed as **"Fehlgeschlagen: {{files}}"** — a single bad file does not abort the rest, and a
      half-uploaded record is cleaned up, so you can simply retry those files.
- [ ] If the roll was **"belichtet"** or **"im Labor"**, it is now **"entwickelt"** and the screen
      says **"Der Film ist jetzt als entwickelt markiert."** A roll still on **"eingelegt"** is
      _not_ advanced — set the status by hand.
- [ ] Surplus files (more scans than frames) are uploaded unassigned and can be attached later.

### 4b. From the desktop, with the CLI

Faster for 36 full-resolution files, and it does not need the phone at all. Details in
[`../tools/scan-import/README.md`](../tools/scan-import/README.md).

```bash
# The roll id is the last segment of the roll's URL in the app.
export FILMNOTES_PASSWORD='…'                       # or let the CLI prompt

# 1. Look at the plan first – nothing is uploaded.
npm run import -w @filmnotes/scan-import -- \
  --server https://pb.example.org \
  --email me@example.org \
  --roll 7t3k9ab12cd34ef \
  --dry-run ~/scans/2026-09-kodak-gold-200

# 2. Looks right? Run it for real (leave out --yes to be asked once).
npm run import -w @filmnotes/scan-import -- \
  --server https://pb.example.org \
  --email me@example.org \
  --roll 7t3k9ab12cd34ef \
  --yes ~/scans/2026-09-kodak-gold-200
```

`mise run import -- --server … --dry-run ~/scans/…` is the same command. A `.zip` is accepted in
place of the folder, and a folder is searched recursively, so the `DCIM/100LAB/` layout of a
drugstore CD works as it is. **Give the source as an absolute path** (or `~/…`): `npm run -w`
runs the script with `tools/scan-import` as the working directory, so a relative path is
resolved from there, not from where you typed it.

The CLI prints the same mapping as a table (`# | file | frame | notes`) — read it against your
notes exactly as in 4a. It uses the same matching code, so a roll imported from the terminal can
still be corrected on the phone. Note: the CLI **does not** advance the roll status; set
**"entwickelt"** yourself. Running it twice creates a second set of scans, so always
`--dry-run` first.

### 4c. Automatically, when the lab mail arrives

Optional, and it uses the same CLI: n8n watches the mailbox, takes the download link out of the
mail, finds the roll by its order number (`Film bearbeiten` → "Auftragsnummer Labor"), runs the
import, sets the roll to "developed" and mails you the result. Setup and the two places that need
adjusting once your first delivery arrives: [`automation.md`](automation.md).

The mapping still wants a look afterwards — open the roll's scan import screen and correct the
pairs where the lab dropped a frame.

## 5. Publishing **(server)**

Export needs the uploaded scan, so it needs the server. One frame at a time from
`/export/frame/<id>`, or a whole roll from `/export/roll/<id>`.

### One frame

- [ ] Frame screen → **"Exportieren"**, or roll detail → **"Film exportieren"** for the roll view.
- [ ] **"Ziel"**: **"WordPress-Entwurf"** or **"Teilen (Bild + Text)"**. Those are the only two
      targets; there is no dedicated Instagram or Mastodon exporter — those go through the share
      sheet.
- [ ] **"Bild"** shows which scan will be attached (**"Scan {{fileName}}"**). Without an uploaded
      scan you get **"Kein hochgeladener Scan – es wird nur der Text exportiert."**, and the
      WordPress target refuses with **"Dieses Ziel braucht einen hochgeladenen Scan."**
- [ ] **"Bildtext"** is prefilled from the caption template (film · camera · lens @ focal,
      exposure, filters, 📍 location · date, your notes, hashtags) and is **editable for this one
      export**. Edit it here; the stored template is not changed.
- [ ] **"Exportieren"**.

### WordPress

- [ ] Set it up once: **"Einstellungen"** → **"WordPress"** → **"Blog-Adresse"**,
      **"Benutzername"**, **"Anwendungspasswort"**. The application password is created in
      WordPress under **Profil → Anwendungspasswörter**, not your login password.
- [ ] **"Verbindung testen"** → **"Verbunden als {{name}}."**, then **"Speichern"**.
- [ ] Exporting uploads the scan to the media library and creates the post **always as a draft**:
      _"Beiträge werden immer als Entwurf angelegt – veröffentlicht wird in WordPress."_ The post
      gets a title (`Film – #Nr – Ort`), a metadata table, your notes, and the scan as featured
      image.
- [ ] **"Beitrag öffnen"** jumps into WordPress. Review it there — check the title, crop the
      image, add categories and tags (the export sets none) — and **publish from WordPress**.

### Share package

- [ ] **"Teilen (Bild + Text)"** copies the caption to the clipboard **and** opens the OS share
      sheet with the image (on the web: `navigator.share`, or clipboard plus an image download).
      Confirmation: **"Bildtext und Bild wurden weitergegeben."**
- [ ] In Instagram or Mastodon, pick the image from the share sheet and paste the caption. The
      clipboard step exists precisely because those apps do not accept a caption from a share
      intent.

### A whole roll

- [ ] `/export/roll/<rollId>` lists **"Bilder mit Scan"** — only frames whose scan is uploaded,
      all preselected. **"Alle auswählen"** / **"Auswahl aufheben"**, then
      **"{{count}} Bilder exportieren"**.
- [ ] They run one after another with a **"{{done}} / {{total}}"** counter; the result is
      **"{{ok}} von {{total}} Bildern exportiert."** plus a per-frame list under
      **"Fehlgeschlagen:"**. There is no caption editing here — the template caption is used, so
      for anything you care about, export that frame individually.

### Where the export log is

On the frame export screen, section **"Frühere Exporte"**: target and time per export, tappable
when the target returned a URL, otherwise **"Dieses Bild wurde noch nicht exportiert."** There is
no global export history screen. Exports are logged only on success.

> **Caveat.** The hint under **"Bildtext"** says template and hashtags come from the settings, but
> there is no settings screen for them yet. In practice every caption uses the built-in template
> and the hashtags `#analog #35mm #filmphotography` plus one derived from the film stock, unless
> you edit the text per export.

## 6. Sync and backup

### When sync happens

Be aware of this, it is not what you would guess:

- **Nothing syncs when the app starts**, and nothing syncs in the background.
- Sync lives on **"Einstellungen"** → **"Server"**. Open that screen and press
  **"Jetzt synchronisieren"** (**"Synchronisiere …"** while it runs). Afterwards:
  **"Zuletzt: {{time}}"** and **"{{pushed}} gesendet, {{pulled}} empfangen"**.
- While that screen is open, bringing the app to the foreground triggers a sync too, at most once
  a minute.
- So: **make it a habit** — after a shooting session, and before picking up the other device, open
  "Einstellungen" → "Server" and tap **"Jetzt synchronisieren"**.
- **Uploading scans does not need a sync run.** The scan import authenticates on its own.

Setting it up: **"Einstellungen"** → **"Server"** → **"Server-URL"**, **"E-Mail"**,
**"Passwort"** → **"Verbinden"** → **"Verbunden als {{email}}"**. Without a server you see
**"Kein Server konfiguriert – die App funktioniert lokal weiter."**, which is a statement of fact,
not a problem. **"Trennen"** logs out and keeps all local data.

The **first sync against an empty server uploads the seeded equipment and film stocks**, so the
first device to connect populates the server. Do not enter that data on the server by hand.

### What happens on a conflict

Every record carries the client's own timestamp, and sync is **last-write-wins on that
timestamp**: whichever device saved a record later wins, field-by-field is not attempted. On a tie
the local copy wins and you are told: **"{{count}} Konflikte lokal entschieden"**. Deletions sync
like any other change (they are soft deletes). There is no conflict dialog.

Practical consequence: **do not edit the same roll on two devices between two syncs.** Sync after
shooting, sync before you continue elsewhere.

**"Synchronisierung fehlgeschlagen."** is the only error the screen shows, whatever went wrong —
server unreachable, wrong password, one rejected record. An expired login normally repairs itself
(the app re-authenticates with the password it stored on the device); if it does not, press
**"Verbinden"** again. Failed uploads stay queued and go out on the next run, so a failed sync
loses nothing. See the troubleshooting table in [`deployment.md`](deployment.md).

### Backup

- [ ] **The server is the backup that matters.** Scan files exist only there — the app caches
      thumbnails by URL. Back up the `pb_data` volume (database _and_ files) as described in
      [`deployment.md`](deployment.md) §6, and check once a year that a restore actually works.
- [ ] **Before "Lokale Daten zurücksetzen"** (Einstellungen, red button), sync. That button wipes
      the device's copy _and_ the queue of not-yet-uploaded changes.
- [ ] **Negatives are the real archive.** Keep them; the scans are a rendering of them, and the
      notes in this app are what tells you which negative is which.

---

## The short version

```
loading    tab "Filme" → "+" → film stock → "Speichern"
shooting   "Bild hinzufügen" → change what changed → "Speichern & nächstes"
finished   "Status" → "belichtet" → rewind → hand in → "Status" → "im Labor"
scans      "Scans importieren" → "Dateien wählen" → check thumbnails vs. notes → "Hochladen"
publish    frame → "Exportieren" → "WordPress-Entwurf" → review and publish in WordPress
sync       "Einstellungen" → "Server" → "Jetzt synchronisieren"   (after every session)
```
