---
"@filmnotes/mobile": minor
"@filmnotes/scan-import": minor
"@filmnotes/presets": minor
"@filmnotes/backend": minor
---

A roll can name its lab: "Film bearbeiten" → **"Laborprofil"**, with **dm Foto (Drogerie)** as the
first profile and **"kein Labor (selbst gescannt)"** as the default. For a roll with the dm profile
the scan import puts each file on the frame its name carries - dm's `Neg.Nr.25` lands on frame 25,
even when the lab scanned only the frames that came out. `filmnotes-import --lab-download` fetches
the scans straight from the lab with the order number and the Secure-ID from the slip in the pickup
bag; the code is asked for, used once and never stored. The update carries a migration
(`rolls.labProfileId`). The n8n workflow no longer waits for a lab mail that never came; it only
reports the order status - re-import it and delete the old one.
