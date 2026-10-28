# Analysis operating context

The analysis API reads fixed, non-personal operating facts from
`center_integration.operating_context`. ChatGPT has no write permission.
`get_operation_summary` and `analyze_program_engagement` return a per-period
`operating_context` when satisfaction is requested.

For 2026-09-07 through 2026-10-06, the operator explicitly reported that
satisfaction surveys were not conducted. This statement is stored with
`operator_report` provenance and applies only within that date range.
It does not apply to check-in surveys or future reporting periods.

The API checks recorded responses before using the report. Positive responses
and a non-conduct report produce `conflicting_evidence`; it never hides or
changes response counts. No report and no responses produce `unknown`, rather
than a claim that collection failed. Partial date coverage remains unknown.

To maintain facts, save only an explicitly confirmed domain, exact KST start
and exclusive end dates, and `conducted` or `not_conducted` status in a reviewed
parameterized migration. Preserve the operator-report provenance. Do not store
names, narrative answers, or conjectured business explanations. New domains
require a reviewed contract extension. No admin menu is added.

Program-catalog absence and unverified visit coverage remain distinct from
missing programs or missing visit records. Do not infer existing-user retention
from aggregate visits divided by unique visitors.
