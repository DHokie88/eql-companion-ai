# Ask EQ Oracle and Discord updates

The sidebar has **What’s New** for dated Discord updates and **Ask EQ Oracle** for
questions across the app’s saved EQL references. Every question box uses the same
connection. The global assistant searches items, spells, quests, mobs, classes,
Discord and a small application help entry. Each question is independent.

Open **Ask EQ Oracle → Global assistant connection** to save and test the computer
alias, optional address override and model name. The default is `aw` / `qwen38`.
The connection uses existing SSH authentication and strict known-host checks. It
sends bounded reference excerpts and the question to the model on aw’s loopback
port 8001. No cloud AI key is needed. Connection settings stay in this install’s
`oracle-connection.json`, outside the repository. Andrew’s VPN may require the
verified LAN address override; no VPN or SSH configuration is changed by EQO.

The model is a reference assistant, with no tools or write privileges. It does
not receive live character, combat, inventory, private chat or log files. The
reference adapter is shared and extensible; adding live character context later
requires an explicit data contract. JSON parsing and retrieval run lazily in a
worker thread, away from the thread that tails logs. Asking a question does not
refresh the source data. If the model is unavailable, matching excerpts remain
readable and the UI identifies them as reference search rather than an AI answer.

Answers must cite supplied source numbers. Unknown citation numbers and generated
URLs are discarded; uncited responses fall back to the evidence list. Citation
buttons open only allowed EQL wiki or Discord source URLs. These checks do not
prove the model’s interpretation: read the excerpts and dates for important game
decisions. Official-server origin does not make a community claim official.
Missing thread starters, unverified reply relationships, linked context and
historical guild prices retain those qualifications. Images have no OCR, and
unavailable channels and other coverage gaps are visible in What’s New.

## Refreshing Hermes’s data safely

Hermes’s source harvest remains separate from EQO. Its validated export is the
`eqo-import.zip` in Andrew’s EQL reference folder. Extract it to a review folder,
then, from this checkout, run:

```powershell
npm run import:discord -- C:\path\to\extracted-package
npm run build
npm test
npm run test:startup
```

The importer validates every schema-2 dataset and manifest count before replacing
any data. It retains the previous snapshot beside the data directory. Inspect and
remove that backup after review; do not commit it. Import data only: do not copy
the exporter’s generated loader over EQO’s factored loader/validation modules.
Restart EQO after a successful rebuild. Refreshes do not automatically change the
running app or turn Discord claims into verified facts.

Run `npm run verify:oracle -- --address <aw-address>` for an explicit live check of
both a catalog question and a Discord question. This invokes the local model.
The normal unit tests do not require a running model.
