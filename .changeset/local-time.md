---
"@filmnotes/domain": patch
"@filmnotes/mobile": patch
"@filmnotes/exporters": patch
---

Dates and times are local, not UTC.

Timestamps are stored as UTC instants, which is right for storage and wrong for everything a
photographer reads: a frame shot at 00:30 in Munich was dated the day before — in the editor, in the
caption and in the WordPress post. Everything visible now goes through the device's own time zone,
and the exporters date a frame by its local calendar day.

The date and time fields are strict about what they accept: "9:5" used to become midnight and
2026-13-45 became February 2027, both silently. Both are reported now and block saving until they
are a real date.
