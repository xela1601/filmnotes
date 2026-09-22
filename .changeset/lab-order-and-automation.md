---
"@filmnotes/mobile": minor
"@filmnotes/scan-import": minor
"@filmnotes/backend": minor
---

The lab's order number ties a delivery to a roll, and the import can start from a link.

A roll carries the lab's own order number ("Auftragsnummer Labor", migration
`1758700000_roll_lab_order_id`), and the scan-import CLI accepts an http(s) URL as its source — so
the download link the lab mails arrives in the app in one step, by hand or from a workflow.
`--json` prints one line of counts and failures for a caller that is a program.

`automation/n8n/filmnotes-scan-import.json` is an optional, importable workflow: the mail with the
link triggers it, the order number finds the roll, the CLI does the upload, the roll moves to
"developed" and a summary comes back by mail; a second branch asks the lab about open orders. n8n
does transport and notification only — the upload stays the one code path the app and the CLI share.
