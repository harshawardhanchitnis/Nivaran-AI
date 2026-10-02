# Model reading benchmark

Run on 2026-10-02. One call per model per document; small sample, clean synthetic documents.
Treat it as a smoke test of each model, not a ranking of quality on real evidence.

These measurements were supplied by the owner before task routing was implemented: 11 direct
reading attempts, outside the app's usage counter. Codex has preserved the supplied JSON and
table; it has not rerun this historical benchmark. Neither tool choice, drafting nor PDFs read
as extracted text was measured here. The two lineup orders are the owner's routing choice,
informed by this small reading sample, rather than a demonstrated ranking for every task.
The script now requires `--live --max-calls 6 --session <ignored-session-file>` and charges calls;
future runs write separate `model-benchmark-live.*` files and do not overwrite this table.

| Model | Document | Expected facts right | Wrong | Missing | Invented | Quotes verbatim | Seconds | Notes |
|---|---|---|---|---|---|---|---|---|
| gemini-3.8-flash | invoice.pdf | failed | | | | | 7.9 | This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later. |
| gemini-3.8-flash | support.png | 6/6 | – | – | – | 6/6 | 4.6 |  |
| gemini-3.7-flash | invoice.pdf | failed | | | | | 3.9 | This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later. |
| gemini-3.7-flash | support.png | 6/6 | – | – | – | 6/6 | 34.7 |  |
| gemini-3.6-flash | invoice.pdf | 5/5 | – | – | – | 8/8 | 9.6 |  |
| gemini-3.6-flash | support.png | 6/6 | – | – | – | 6/6 | 9.5 |  |
| gemini-3.5-flash | invoice.pdf | 5/5 | – | – | – | 5/5 | 5.8 |  |
| gemini-3.5-flash | support.png | 6/6 | – | – | – | 6/6 | 8.1 |  |
| gemini-3.5-flash-lite | invoice.pdf | 5/5 | – | – | – | 8/8 | 2.5 |  |
| gemini-3.5-flash-lite | support.png | 6/6 | – | – | – | 6/6 | 2.7 |  |
| qwen/qwen3.8-27b | support.png | 6/6 | – | – | – | 7/7 | 1.1 | refund_reference stored as "None" |

## Bounded routing check, 2 October 2026

The implemented router was checked with six actual provider attempts and three logical charges.
The complete recorded output is in `model-routing-live.json`. No additional provider calls were
made to force quota errors or to retest the timeout cooldowns.

| Task | Actual attempts in order | Result |
|---|---|---|
| PDF with a text layer | Qwen: HTTP 200, 0.888 s provider time | unpdf-extracted text only; nine candidates across the five expected invoice fields; 2.128 s overall. |
| Image | Gemini 3.6: timeout at 8.008 s; 3.8: timeout at 8.010 s; 3.5: timeout at 8.007 s; 3.5 Lite: HTTP 200 in 2.069 s | Six candidates across six expected fields; 28.259 s overall; three signed timeout cooldowns saved. |
| Tool choice | Qwen: HTTP 200, 0.720 s provider time | Chose `get_next_step`; run and tool-call event recorded Qwen. The tool failed because T7 was not implemented yet; 1.106 s overall. |

These are manual fixture results, not the twelve-case product evaluation. No new live scanned-PDF,
drafting or image-quote check was made. Fake-provider unit tests cover stored skipping, expiry,
quota/rate-limit/demand fallback, one charge and exclusion of Qwen from binary PDFs. A regression
test treats Qwen's `refund_reference = "None"` as absent for the quote
"No refund reference has been issued".

The owner reported limits of 20 RPD for each of the four Flash models and 500 RPD for Flash Lite.
The configured app caps are 15 logical calls per user and 15 globally per UTC day, shared by all
tasks. Each model is attempted at most once per logical call. These caps leave headroom below
the smallest reported daily limit; they do not add the model quotas together. Existing provider
usage and a quota shared across models can reduce that headroom. Groq's exact limits and whether
models share a quota were not supplied. Provider exhaustion still triggers routing and cooldowns.
The app counter resets at UTC midnight; Google's RPD quota resets at
[Pacific midnight](https://ai.google.dev/gemini-api/docs/rate-limits). The 15/15 app caps therefore
do not guarantee avoiding every provider daily limit across those different windows. The router
uses provider reset hints, or the daily reset for an explicit Google RPD exhaustion, to skip that model.
