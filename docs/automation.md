# Automating the scan import with n8n

The lab needs 7–10 working days, and then two things happen: the order is marked finished, and an
email with a download link arrives (dm: the link is valid six weeks). Both can be handled by n8n,
which then does what you would otherwise do by hand — download the archive, run the import, move
the roll to "developed" and tell you about it.

**Nothing here is required.** The import works exactly as before without n8n, and the automation
uses the same code path:

| Way            | Command                                                                          | When                                                                           |
| -------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| In the app     | "Filme" → the roll → "Scans importieren"                                         | the files are on the phone, or you want to correct the mapping while importing |
| On the desktop | `npm run import -w @filmnotes/scan-import -- --roll <rollId> <folder\|zip\|url>` | the files are on the computer, or you have the download link                   |
| Automated      | the n8n workflow below                                                           | the lab mail arrives and you want it done                                      |

The CLI accepts a **URL** as its source since this round, so "download link → import" needs no
intermediate step, by hand or from a workflow.

## What ties a delivery to a roll

`Roll.labOrderId` — the lab's order number, in the app under "Film bearbeiten" →
**"Auftragsnummer Labor"** (dm prints a 12-digit number on the receipt of the order bag). The
workflow reads the number out of the mail and asks PocketBase which roll carries it. No number on
any roll, or the same number twice, and the workflow mails you instead of guessing.

## Setting it up

1. **Import the workflow**: n8n → Workflows → Import from file →
   [`automation/n8n/filmnotes-scan-import.json`](../automation/n8n/filmnotes-scan-import.json).
   n8n may upgrade the node versions on import; that is fine.

2. **Two credentials**, both on `mail.example.org`:
   - an **IMAP** credential for the mailbox the lab writes to (node "Lab mail arrives")
   - an **SMTP** credential for the three mail nodes
     Replace the `REPLACE_IMAP_CREDENTIAL` / `REPLACE_SMTP_CREDENTIAL` placeholders by picking the
     credentials in the nodes once.

3. **Five environment variables** for the n8n instance (not in the workflow, so they never end up
   in an export):

   ```bash
   FILMNOTES_SERVER_URL=https://pb.example.com          # the PocketBase instance
   FILMNOTES_EMAIL=me@example.com                       # the app user
   FILMNOTES_PASSWORD=…                                 # its password
   FILMNOTES_REPO=/srv/filmnotes                        # checkout the CLI runs from
   FILMNOTES_NOTIFY_EMAIL=alex@example.com              # where the summary goes
   FILMNOTES_LAB_STATUS_URL=https://spot.photoprintit.com/spotapi/orderInfo/forShop?config=<config>&shop=<shop>&order={order}
   ```

   The first three are the same variables the CLI reads from `.env`, so a shell on that machine can
   run the import by hand with the identical configuration.

4. **The CLI has to be runnable** on the machine n8n runs on: a checkout at `$FILMNOTES_REPO` with
   `npm install` done once, and Node 22. If n8n runs in a container without the checkout, replace
   the "Run filmnotes-import" node with an **SSH** node that runs the same command on the host —
   the command is in one place for exactly that reason.

## The two places that need your first real delivery

Both are Code nodes, both work defensively, and both are marked in the workflow:

- **"Extract order and download link"** — picks the order number and the download URL out of the
  mail. It accepts `orderID=540996-624893` and plain numbers, and takes the first link that looks
  like a download. When your first lab mail is in, open the execution, look at the node's input and
  tighten the two regular expressions.
- **"Is the order finished?"** — reads the lab's order info. The response shape of
  `spot.photoprintit.com/spotapi/orderInfo/forShop` is not documented, so the node looks for
  anything resembling a state field and otherwise mails you the raw payload. One look at a real
  answer is enough to make it exact.

Until then the workflow still does something useful: it tells you what the lab says, and the import
branch runs as soon as a mail with a link arrives.

## What the workflow does, step by step

```
Lab mail (IMAP)
  └─ extract order number + download link
       └─ PocketBase: log in → roll with that labOrderId
            ├─ exactly one roll → filmnotes-import --json --yes <link>
            │                      └─ uploaded > 0 → roll status = "developed"
            │                           └─ mail: "23 von 24 Scans hochgeladen"
            └─ none or several   → mail: "Scans da, aber kein passender Film"

Every 6 hours
  └─ rolls with status "at_lab" and an order number
       └─ ask the lab about each order → mail the status
```

The import itself is unchanged: the CLI downloads the archive, proposes the file-to-frame mapping by
natural filename order, uploads each scan and marks a half-written record deleted if its file does
not arrive. A second run is a retry, not a duplicate — files that already have an uploaded scan on
that roll are skipped.

**The mapping is still yours to check.** The automation uploads with the proposed assignment; open
the roll's scan import screen in the app to see the pairs and correct them where the lab dropped a
frame.

## Without n8n, from the download link

```bash
npm run import -w @filmnotes/scan-import -- \
  --roll roll0abc123def45 \
  --dry-run \
  'https://…/download/540996'      # plan only, nothing is uploaded

npm run import -w @filmnotes/scan-import -- --roll roll0abc123def45 'https://…/download/540996'
```

`--json` prints one line — `{"uploaded":24,"skipped":0,"failed":[],"files":24,"dryRun":false}` —
which is what the workflow reads.
