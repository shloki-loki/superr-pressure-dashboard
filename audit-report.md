# Astra audit: individual performance under pressure

16 November 2026. This report supersedes the earlier code-reading review. Current published rankings are provisional; experiments below are isolated, not a new approved leaderboard.

## Objective and verdict

Identify reliable batters and bowlers under pressure, comparing pressure-weighted execution with their usual execution. Use a common contextual benchmark. A good performance in a losing team must still earn credit. Player identity/reputation must not change the benchmark. This is the user's confirmed objective and is consistent with the Round 1 brief.

The architecture is usable, but the current rankings are not ready to certify for submission. Confirmed defects exist in first-innings pressure, the interpretation of pressure lift, and batter credit for one extras category. Wider fairness and reliability questions remain. Passing arithmetic checks did not establish that the model behaved sensibly.

## What was checked

Read the brief and current pipeline, source audit, held-out folds, latest scored events, rankings and dashboard. Tested all 182,713 scored events from 764 eligible matches, including 95,182 first-innings states. Refit pressure models on their existing five match-held-out folds. Tested resource counterfactuals, aggregation, sample floors and three isolated ranking changes. Reviewed all six supplied source schemas and existing reconciliation results; this is not a claim that every raw record was independently checked against an external scorecard.

Coverage: 883 source matches / 200,999 events -> 792 reconciled matches / 189,179 events -> 764 IPL/T20I matches / 182,713 events. The 91 rejected matches have overlapping reasons; 28 additional emerging-team matches are outside the selected scope. Abandoned and shortened matches can still contain genuine individual performance. Exclusion is a limitation of the present reconstruction, not proof their players did nothing valuable. The nine super-over matches merit reviewing whether their regulation innings can be retained separately. Do not silently combine unsupported shortened-match states with 120-ball states.

## What is working

- All 764 eligible matches are evaluated. Every match is scored using models trained on the other four folds. The first match can therefore use later history, as requested, without using its own outcomes for its fitted baseline. This is retrospective evaluation, not a prospective prediction claim.
- No direct deduction is applied merely because the player's team lost. Match results train the pressure forecast; execution itself is based on runs/wickets relative to context.
- Smooth ranking weights use every graded event. The 80th percentile only labels/counts a reporting subset; it no longer determines which events enter rankings. Ties mean the labelled proportion need not be exactly 20%.
- Run and wicket components are explicit. Bowling excludes byes/leg-byes from charged runs and does not award run-outs as bowler wickets.
- Finals and knockout weights are applied to relative importance. Recent matches receive a bounded bonus instead of older history being erased.

## Confirmed finding 1: pressure can reward losing a wicket

Holding score, balls left and competition fixed, losing one wicket increases the first-innings batting win forecast in 8,782 of 95,182 observed pre-ball states. Removing one ball without runs increases it in 10,521 states. These are controlled counterfactual tests at actual states, not counts of those outcomes occurring.

Example: match 50360, event 14, 7/4 with 107 balls left. Forecast: 13.8668%. Changing only wickets to 7/5 gives 41.6394%. At next-ball branches, a legal dot gives 15.0139%, while a zero-run wicket gives 40.7372%. A wicket falsely becomes good news. That branch supplies 47% of this event's pressure.

Cause: when sparse nearby samples disappear, the resource model drops the wicket restriction and borrows innings with much stronger resources. Independently estimated resource distributions and the hard 35-observation switch also lack ordering constraints.

**Repair experiment:** retain same-wicket fallback samples, then constrain the 20-quantile resource surface so fewer balls or wickets cannot improve remaining runs. Rescore all five folds. All tested first-innings wicket/ball ordering violations fall to zero (tolerance 1e-9). First-innings match-equal Brier error changes from 0.223190 to 0.222913; lower is better, but this small difference is not proof of a statistically significant predictive gain. Both current top-ten memberships remain unchanged. The example's pressure falls from 1.9155 to 0.7775 percentage points.

The chase model remains unchanged in this experiment. Its audit found 2,117 smaller lost-ball ordering violations, maximum 0.3318 percentage points, and 236 very small wicket-order violations. These still require repair. The candidate also retains a hard sample switch and does not resolve opposition strength. It is an improvement with demonstrated properties, not the final validated model.

## Confirmed finding 2: the displayed lift can point the wrong way

The current overall and pressure rates each get their own sample-floor adjustment. Because their weighted denominators differ, their adjustments differ. This reverses the sign of the raw pressure-minus-overall difference for 21 eligible players: nine batters and 12 bowlers.

Mark Wood, current bowling #2:

| Quantity | Overall | Pressure |
| --- | ---: | ---: |
| Rate before sample floor | 35.869684 | 35.846968 |
| Rate after sample floor | 34.264118 | 35.653527 |

Raw lift is -0.022716. Displayed gap is +1.389409. His execution rate did not improve under pressure; different attenuation creates the positive gap.

**Correction:** display raw lift separately from the adjusted gap. Keep evidence/confidence separate from importance weights. An isolated experiment applies one shared confidence factor, min(1, raw legal balls / role floor), to both rates. It preserves every raw-lift sign; nine of ten bowling top-ten members remain, all ten batting members remain. This demonstrates a remedy for the sign problem, but the 215/299 thresholds remain uncalibrated. Do not treat this specific shared factor as the final reliability model.

## Confirmed finding 3: some batter runs receive no grade

Reconstruction marks source extras type `other` as illegal, supported by six-ball over reconciliation. The batting exposure mask admitted named no-balls but omitted `other`. In the eligible scored data, all 241 such events have missing batting grades despite containing 372 batter runs.

Examples include Dhoni's six in match 14094, event 119, and de Kock's six in match 14108, event 81. These are source-recorded bat runs, not an inference from total extras.

The source mask has been corrected to include this non-wide category. A separate rescore and verification preserve pressure, folds, match coverage and bowling values. Published scores have not yet been replaced. The exact cricket subtype of `other` still requires source documentation; the fix addresses the omission of recorded batting outcomes.

## Wide accounting: a model choice with a concrete unwanted consequence

The existing grade is a per-attempt residual, but the published rate divides by legal balls. This arithmetic is reproducible; a positive wide alone is not enough to prove a bug. It nevertheless allows an extra wide to improve total grade despite conceding an extra run for the same legal opportunity.

Actual match 50364, Starc, first innings, 168/5 with 19 balls left:

- Expected charged runs per attempt: 1.619628.
- Expected wicket probability: 0.055206; wicket value: 1.673193 runs.
- Wide grade: 1.619628 - 1 + 1.673193 × (0 - 0.055206) = +0.527257.
- Actual replacement ball is a four, graded -2.472743.
- The pair concedes five runs and sums to -1.945486. At the same saved contextual expectation, a lone four would score -2.472743: adding the wide makes the unweighted grade better by 0.527257. This is a fixed-context comparison, not a replay of a different match.

The user's wide-plus-dot intuition remains valid: one run across a legal opportunity can be good. The concern is awarding another full expected-run allowance for each extra attempt.

**Isolated alternative:** allocate the expected run/wicket allowance to legal deliveries, adjusted by held-out phase-specific legal probability; charge actual extras when they occur. A no-wicket wide costs its charged runs; the replacement can earn enough credit for the pair to be positive. This experiment uses a broad approximation, not a fully fitted legal-opportunity model. It retains eight of the ten bowling top-ten members; two enter and two leave. Batting is unchanged. A final design must handle wickets on illegal deliveries, innings-ending extras and pressure changes within the sequence explicitly.

## Ranking experiments: one change at a time

All use the same 764 matches. Columns are separate experiments, not cumulative fixes. The pressure-only repair holds execution unchanged. Wide accounting holds pressure unchanged. Rank movement is evidence of sensitivity, not evidence that familiar names ought to rank higher.

| Bowler | Current | First-innings repair only | Opportunity-accounting trial only |
| --- | ---: | ---: | ---: |
| Haider Ali | 1 | 1 | 1 |
| Mark Wood | 2 | 2 | 3 |
| Sunil Narine | 5 | 5 | 5 |
| Jasprit Bumrah | 12 | 11 | 10 |
| Rashid Khan | 15 | 15 | 9 |
| Bradley Currie | 17 | 17 | 17 |
| Adam Zampa | 146 | 143 | 118 |
| Mitchell Starc | 248 | 245 | 250 |

Sooryavanshi remains batting #1 in both the pressure-only and shared-confidence experiments. His current overall raw rate is 76.8524 and pressure raw rate 77.4660 across 561 legal balls in 30 matches. Thus his present lead chiefly reflects strong overall execution under this baseline, not a huge pressure lift (+0.6136). Narine's current bowling rank is #5, not the #1 from an earlier formula. Neither result proves the contextual baseline adequately adjusts opposition strength.

## Exact current flow and assumptions

1. Reconstruct pre-ball score, wickets, legal balls left, and target when chasing.
2. Use other matches to estimate possible event probabilities q. Current pressure context uses IPL/T20I family, innings, phase, balls and wickets left, and chase demand. It does not explicitly adjust player identity, opponent strength or venue.
3. Estimate batting win credit V after each possible event. The first innings projects a distribution of remaining runs and chances of defending resulting totals. It does not currently use DLS.
4. Compute central credit m = sum(q × V). Pressure L = sum(q × abs(V - m)). Multiply by 100 to express percentage points. It is expected swing, not the observed ball's swing.
5. Estimate expected runs and wicket probability from peer delivery groups. Execution uses innings, phase, competition, batting-order group, batting hand, bowling style, venue, balls/wickets remaining and chase demand. Later pooled groups can override earlier ones; this is a heuristic sequence, not exact simultaneous control of every variable.
6. Batter grade x = runs - expected runs - wicket value × (dismissal - expected dismissal). Bowler grade x = expected charged runs - charged runs + wicket value × (credited wicket - expected wicket). Positive is better for the player. Player names and personal career expectations are not used.
7. **Assumption:** match importance a = stage × recency. Stage is 1/1.25/1.5 for regular/other knockout/final. All finals use 1.5; there is no extra T20I-final tier. Recency is 1 + 0.5 × max(0, 1 - days-old/730), anchored to latest eligible data.
8. **Assumption:** pressure multiplier h = (1 + L / innings-average L) / 2. This converts pressure into influence on an average. Zero pressure gets 0.5, average pressure gets 1, three-times-average gets 2. It is not a second win probability. Current maximum is nearly 16. Separate innings scales intentionally give equal absolute swings different weights.
9. Weighted grade means a × x (overall) or a × h × x (pressure). Weighted legal exposure means a × legal-indicator or a × h × legal-indicator. These are influence units, not extra real balls. Without floors: overall O = 100 sum(a x)/sum(a legal); pressure P = 100 sum(a h x)/sum(a h legal). Raw lift = P - O. Current floors alter those denominators separately, causing the defect above.
10. **Assumptions:** 100 legal balls/five matches for eligibility; role floors 215/299; blend 0.3O + 0.7P. The blend is equivalently O + 0.7(P-O) when using the same component definitions. It combines ordinary strength and pressure reweighting, but does not by itself measure consistency.

For the earlier dot example: probability 22.54%, post-dot credit 57.71%, central credit 58.80%. The 1.09 percentage-point gap is one branch's gap. Its contribution to total pressure is 0.2254 × 1.09 = approximately 0.2457 percentage points using rounded numbers. Total pressure adds all branches. The stored unrounded calculation is approximately 0.2449 percentage points for this branch.

## Remaining work before a defensible submission

- Repair and validate chase ordering; combine first-innings repair and extras coverage, then rerun the full pipeline.
- Choose coherent extras/opportunity accounting and validate at sequence boundaries, rather than quietly changing the meaning of the grade.
- Validate the peer baseline against a simpler balls/wickets/phase model. Add complexity only when it improves held-out prediction and fairness. Current pooled T20I groups do not fully account for opposition quality.
- Revisit wicket value: it is an association from first-innings remaining runs, not a causal estimate; an ordinary last-ball wicket currently retains a mean value near 0.963 runs despite no later legal balls remaining.
- Separate raw performance, pressure lift and confidence. Calibrate reliability with match-level resampling, predictive/stability checks and uncertainty ranges. Importance-weighted balls are not independent evidence. Current match deletion freezes all fitted models.
- Compare shared versus innings-specific pressure scales and influence caps using held-out stability. The 70/30 blend, floors, recency and stage factors are policy choices, not facts learned from data.
- Review recoverable exclusions and publish a reasoned coverage ledger. Prepare the two ordered top-ten lists and methodology document required by the brief; the dashboard supports these outputs.

No need to reopen the settled objective or personalize the standard. Finish these tests, retain changes that pass them, and report rank movements with their causes.

## Reproducibility

`audit_pressure_independent.py` and `audit-pressure-numerical.json` reproduce the pressure and floor findings. In `deep-audit/`, `repair_resource_experiment.py` and `resource-repair-report.json` document the pressure candidate; `execution_audit.py` and `execution-findings.json` document the opportunity experiment; `compare_experiments.py`, `experiment-comparisons.json` and the two role comparison CSVs compare rankings. Candidate scored files and ranking outputs are kept separately from production.
