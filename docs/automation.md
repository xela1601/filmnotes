# Lab orders: the status by n8n, the scans by one command

A roll that goes to a lab comes back in two parts: the lab reports the order as finished, and the
digital images can be downloaded. The first is automated here — n8n asks the lab every six hours
and mails you when something changed. The second is **one command you run**, because the lab hands
the download code over on paper, in the pickup bag, and no workflow can read that.

**Nothing here is required.** A roll scanned at home, or a lab without a profile, is imported
exactly as before:

| Way                   | Command                                                                          | When                                                                  |
| --------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| In the app            | "Filme" → the roll → "Scans importieren"                                         | the files are on the phone, or you want to correct the mapping        |
| Desktop, from files   | `npm run import -w @filmnotes/scan-import -- --roll <rollId> <folder\|zip\|url>` | the files are on the computer: a home scanner's card, a CD, a ZIP     |
| Desktop, from the lab | `npm run import -w @filmnotes/scan-import -- --roll <rollId> --lab-download`     | the roll has a lab profile and the lab's slip is in front of you      |
| Automated status      | the n8n workflow below                                                           | the roll is at the lab and you want to know when to go and collect it |

Until September 2026 this document described a second branch that waited for the lab's mail with
a download link. That mail never existed — dm prints the credential on a slip instead — and the
branch was removed (T-024). It is in the git history, should a lab that mails links ever turn up.

## What ties a lab order to a roll

Two fields on the roll, in the app under "Film bearbeiten":

- **"Laborprofil"** — which lab the roll went to, or _kein Labor_ for one scanned at home. The
  profile knows where to ask about orders, where the scans are downloaded, and how the lab names
  its files.
- **"Auftragsnummer Labor"** — the lab's order number **as printed**. For dm that is the 12-digit
  number on the slip in the pickup bag, e.g. `004304-540996`. The status API answers the same for
  the full number and for its second half alone, so type it the way it stands on the paper.

The workflow finds the rolls to ask about by their status "im Labor" and a non-empty order number.

## Lab profiles

A lab is data, not code: [`packages/presets/data/lab-profiles.json`](../packages/presets/data/lab-profiles.json).
Each profile has a name, an optional **status** endpoint, an optional **download** endpoint (both
URL templates with `{placeholders}` and the list of parameters they need), an optional
**file-name pattern** whose capture group is the frame number, and notes. A second lab is another
entry — as long as its status API answers in the same shape; a lab that answers differently needs
code, and the profile cannot hide that.

What deliberately is **not** in a profile:

- **The branch.** dm's status URL needs `config` and `shop`, which identify the branch and so,
  roughly, where you live. They stay placeholders in the public profile; the real values live in
  the git-ignored `automation/n8n/local-values.md` and in n8n's environment.
- **The one-time download code.** It is asked for when the download runs and never stored.

## The dm route, as measured on the first roll (order 540996, September 2026)

- **Handing in:** the order bag at the branch; development "Colorentwicklung Amateur mit
  Bildbestimmung" — _with picture selection_: the lab prints, scans and charges only the frames
  that carry an image. The first roll had 12 of 36, so 12 prints and 12 scans came back.
- **Status:** `PROCESSING` (2026-09-21) → `SHIPPED` (to the branch) → `DELIVERED` (2026-09-26,
  "Dein Auftrag liegt zur Abholung bereit."), five days.
- **Collecting:** the pickup bag holds prints, negatives and a slip "Download Deiner digitalen
  Bilder" with the order number, a **Secure-ID** and the date until which the images can be
  downloaded — six weeks. The slip's QR code only opens `foto.dm.de`; it carries no credentials.
- **Downloading:** `foto.dm.de/download` takes order number and Secure-ID and calls CEWE's API,
  `api.cewe-myphotos.com/api/imageCD/{order}/{secureId}/download`, which answers with a ZIP. That
  is what `--lab-download` calls directly.
- **The files:** `_Bild000_Neg.Nr.25.jpg` … — a running index from 0, then the **negative number**,
  which is the frame. JPEG, 2088 × 1392 px (2.9 MP), scanned on an allcop fastScan 20. The first
  roll's scans were all rotated by 180° (tracked as T-025).

## Importing a finished dm order

```bash
npm run import -w @filmnotes/scan-import -- --roll roll0abc123def45 --lab-download --dry-run
npm run import -w @filmnotes/scan-import -- --roll roll0abc123def45 --lab-download
```

The CLI logs in, reads the roll's lab profile and order number, asks for the Secure-ID from the
slip (hidden, like the password — never as a flag, which would leave it in the shell history),
downloads the ZIP and plans the import: with dm's profile each file goes onto the frame its name
carries, so `Neg.Nr.25` lands on frame 25 even though it is the first file. `--dry-run` shows that
plan and stops. **A second run uploads a second set of scans** — nothing is skipped, so look at
the `--dry-run` first. (Earlier versions of this document promised that a re-run skips files
already uploaded; the CLI never did that.)

A wrong Secure-ID, or one whose six weeks are over, ends in `HTTP 404` from the lab, with the code
itself kept off the screen.

**The mapping is still yours to check.** Open the roll's scan import screen in the app to see the
pairs; the edge number on a negative and the camera's frame counter can differ by one.

## Setting up the status poll

1. **Import the workflow**: n8n → Workflows → Import from file →
   [`automation/n8n/filmnotes-scan-import.json`](../automation/n8n/filmnotes-scan-import.json)
   ("filmnotes – lab order status"). n8n may upgrade the node versions on import; that is fine. An
   installation that still has the old workflow with the mail branch: import this one and delete
   the old one.

2. **One credential**: an **SMTP** credential on your own mail host (`mail.example.org` stands in
   for it — this file is public, the real name lives in `automation/n8n/local-values.md`, the
   password only in n8n's credential store). Replace the `REPLACE_SMTP_CREDENTIAL` placeholder by
   picking it in the node "Mail: order status" once.

3. **Five environment variables** for the n8n instance (not in the workflow, so they never end up
   in an export):

   ```bash
   FILMNOTES_SERVER_URL=https://pb.example.com          # the PocketBase instance
   FILMNOTES_EMAIL=me@example.com                       # the app user
   FILMNOTES_PASSWORD=…                                 # its password
   FILMNOTES_NOTIFY_EMAIL=alex@example.com              # where the status mail goes
   FILMNOTES_LAB_STATUS_URL=https://spot.photoprintit.com/spotapi/orderInfo/forShop?config=<config>&shop=<shop>&order={order}
   ```

   `FILMNOTES_LAB_STATUS_URL` is the dm profile's status template with your branch filled in;
   `local-values.md` holds `config` and `shop`. `FILMNOTES_REPO`, which the removed import node
   needed, is no longer read. The first three are the same variables the CLI reads from `.env`.

## What the lab answers

`spot.photoprintit.com/spotapi/orderInfo/forShop?config=…&shop=…&order=…` answers JSON; this is
the real answer for order 540996, shortened, with the branch address replaced:

```json
{
  "summaryStateCode": "DELIVERED",
  "summaryStateText": "Dein Auftrag liegt zur Abholung bereit.",
  "summaryDate": "2026-09-26",
  "orderNo": "540996",
  "deliveryType": 0,
  "deliveryText": "dm-drogerie markt\nMusterstraße 1\n00000 Musterstadt",
  "subOrders": [{ "stateCode": "DELIVERED", "trackingNumber": null, "trackingUrl": null }]
}
```

`summaryStateCode` is what the workflow reads; `PROCESSING`, `NEW`, `RECEIVED`, `ORDERED` and
`IN_PRODUCTION` count as "still working on it" and are not worth a mail. Every other code is — an
unknown one included, so a state nobody has seen yet reaches you instead of being swallowed.
`deliveryType: 0` means the order is collected in the branch named in `deliveryText`. The answer
also lists the ordered positions (development, number of prints) — which is where the "12 prints"
of the first roll could be read before it was collected.

## What the workflow does

```
Every 6 hours
  └─ PocketBase: log in → rolls with status "at_lab" and an order number
       └─ one roll at a time: ask the lab about its order
            └─ not "still working on it" → mail the status
```

Once the mail says the order is ready: collect it, then run the import above with the slip.
