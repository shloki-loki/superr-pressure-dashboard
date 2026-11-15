# Focused Drona/Karn review of v2

Reviewed 16 November 2026 against `pressure_v2.py`, `rankings_v2.py`, their execution/feature helpers, `pressure-v2-method.md` and `v2-validation.md`. This is a conceptual and code-reading review, not another model run. The independent arithmetic validation is strong evidence that the files implement the stated rules; it is not evidence that every modelling assumption is correct.

## What the method actually measures

The retrospective cohort is all **764 reconciled IPL/T20I matches and 182,713 delivery events**, not all 883 supplied matches. Five deterministic, interleaved match folds ensure that a match's own deliveries and result do not train its scoring models. Other matches from later dates can train those models. This is appropriate for the requested full-history retrospective comparison, but does not simulate predictions available on the match date.

For every pre-ball position, the model considers hypothetical outcomes `e = (team runs, legal-ball indicator, wicket indicator)`. It estimates their probabilities from training matches through four successive pooling levels:

1. Same innings and IPL/T20I family, prior strength 20.
2. Add powerplay/middle/death phase, prior strength 20.
3. Add six-ball bucket, wickets-lost pair and required-rate band, prior strength 40.
4. Replace the coarse resource buckets with exact legal balls remaining and wickets lost, prior strength 40.

Starting with the whole-training-sample event distribution, each update is exactly

`q_e = (count_e + strength × previous_q_e) / (cohort_count + strength)`.

Required-rate bands use runs needed per ball with boundaries 0.75, 1.25, 1.75 and 2.5; first innings use a single sentinel band. The same hypothetical distribution is used for batting and bowling pressure.

For a chase, hypothetical win credit comes from a logistic model of required rate, log balls remaining, wickets remaining, their pairwise interactions, and IPL indicator. Its exact feature vector is `[1, r, t, u, r×t, r×u, t×u, IPL]`, where `r = clip(need/max(balls,1) − 1.4, −4, 8)`, `t = log(1+max(balls,1))/4`, and `u = wickets_remaining/10`. Terminal branches override the regression: win = 1, regulation tie = 0.5, loss = 0.

For setting, a logistic defence model uses `[1, z, IPL, z×IPL]`, where `z = (final_total−160)/40`. After each hypothetical outcome, the model obtains 20 remaining-run quantiles (2.5% through 97.5%) for that new resource state, adds each to the new score and averages its defence estimate. Below 35 exact observations it substitutes nearby resource states, scaling their remaining runs by the ratio of balls remaining. A completed innings has no projected further runs. This is an empirical T20 resource projection, not official DLS.

If branch `e` has probability `q_e` and win credit `v_e`, then

`central win credit μ = Σ q_e v_e`

`delivery pressure L = Σ q_e |v_e − μ|`.

Pressure is in probability units and lies between 0 and 0.5. Multiply by 100 for percentage points. The realised ball outcome does not enter this pressure calculation. Batting downside probability is `Σ q_e 1(v_e<μ)`; bowling downside reverses that inequality (code ignores deviations within 1e−10). Downside severity is the conditional mean adverse deviation. Apart from that numerical tolerance, both sides' probability × severity equal `L/2`; the two downside displays decompose the same swing, not independent pressure measures.

## How the player ratings are calculated

Execution is context-adjusted run value, not observed win-probability added. Let `C` be the estimated run cost of a wicket and hats denote held-out contextual peer expectations:

`bat value = (bat runs − expected bat runs) − C × (striker dismissed − expected striker dismissal)`

`bowl value = (expected charged runs − charged runs) + C × (credited wicket − expected credited wicket)`.

Peer expectations pool innings/phase, competition family, batting-order role, batting/bowling styles, competition and venue. Wicket cost uses the observed difference in first-innings remaining runs between adjacent wicket states, pooled toward a broader resource curve. It is an association, not an experimentally identified causal wicket cost.

Let `g_i` be 1 for regular matches, 1.25 for other knockouts and 1.50 for finals. Let `m` be mean pressure over legal deliveries in that innings (or over both innings under shared scaling). Then the smooth pressure weight is

`h_i = (1 + L_i/m)/2`, and `w_i = g_i h_i`.

Thus zero-pressure deliveries still receive half weight; average-pressure deliveries receive unit weight before stage weighting. With execution `x_i`, legal indicator `a_i`, and the 50-ball zero-value prior:

`Overall = 100 × Σ(g_i x_i) / [Σ(g_i a_i) + 50]`

`Pressure-weighted = 100 × Σ(w_i x_i) / [Σ(w_i a_i) + 50]`

`Delta = Pressure-weighted − Overall`

`Selection score = 0.70 × Pressure-weighted + 0.30 × Overall`.

Sums include the player's finite-valued events. Wides have no batting value; non-wide no-balls can have batting value. Bowling values include wides/no-balls. Illegal events contribute value but not legal-ball exposure. These are adjusted runs per 100 legal balls, with shrinkage toward zero; they are not percentages or 0–100 ratings.

Eligibility requires at least 100 legal balls and five matches. Pressure effective sample is `(Σ w_i a_i)² / Σ(w_i² a_i)`. The 80th-percentile pressure count is descriptive only: neither scoring nor eligibility uses a high-pressure cutoff. Ranking sorts by selection score, then overall rating only on an exact score tie, then player ID. This does not implement a separate “close enough” tie region.

The documented real example is match 50364: Rajasthan 168/5, 19 balls left. Its model-fold exact bucket has 14 legal non-wicket dots in 56 events; pooled dot probability is 22.5355%. Dot-branch win credit 57.7113% versus central 58.7980% contributes **0.2449 percentage points** to total pressure **1.1369 points**. The realised wide is graded separately. The validator's 16/78 count uses all other matches, so it is a different comparison cohort, not a contradiction.

## Prioritized limitations and presentation requirements

1. **Use accurate labels now.** “Overall baseline” includes high-pressure deliveries. “Pressure-weighted performance” also includes every scored delivery, smoothly reweighted. Delta is that reweighting difference, not high-versus-low pressure improvement or proof of clutch temperament. Stage multipliers affect both ratings. Display model-derived ratings and units, not implied official ratings.
2. **Matchup and difficulty adjustment remain incomplete.** The win model omits venue, team/opponent quality and player strength; execution expectations omit required rate and explicit wickets remaining (except the wicket-cost component). Broad T20I comparisons can therefore reward favourable opposition or mix contexts with different incentives. This is the largest substantive fairness caveat. Style/venue pooling is not a complete opponent-strength correction.
3. **Smooth weighting does not mean a globally smooth state model.** Event probabilities still use phase/rate/resource buckets. First-innings projection hard-switches from nearby samples to exact samples at 35 observations. Neither the projection nor logistic model enforces monotonicity: extra wickets or runs need not always move forecasts in the cricket-intuitive direction. Sparse-state artefacts can affect leverage even when arithmetic is perfect. Check these properties before claiming physically consistent probabilities.
4. **Reliability is not yet fully established.** A 50-ball prior, weight sensitivity and deletion of each match's aggregate contributions are useful safeguards. The deletion check freezes model fits, pressure means and event values; it is not a full refit or uncertainty interval. No minimum effective pressure sample or match-to-match consistency penalty enters selection. Do not equate top rank with demonstrated consistency without showing these diagnostics.
5. **Several choices are policy assumptions.** The 70/30 blend, 50-ball prior, 20/40 pooling strengths, 35-state threshold and 1.25/1.50 stage factors are transparent but not proven optimal. Separate innings scaling deliberately gives each innings comparable average weighting despite different absolute leverage. Also, stage weights enlarge exposure and therefore weaken shrinkage, not just emphasize big matches.
6. **Baseline pooling is sequential, not a clean nested hierarchy.** The final venue cohort drops style and competition-ID conditioning from previous levels; several cohorts reuse the same observations. Interpret this as heuristic regularization, not independent Bayesian evidence or exact simultaneous control of every listed feature.
7. **Scope and automation need clear boundaries.** All retained history is scored, but unreconciled/out-of-scope matches remain excluded. A dashboard may automatically display and recombine generated results; it does not refresh underlying source data or retrain models unless a separate rerun pipeline exists. Country/T20I-team labels need provenance and an unknown state rather than guessed nationality.

**Release judgment:** suitable as a transparent, reproducible retrospective prototype with these limitations visible. Arithmetic validation supports reproducibility. It does not yet justify calling the rankings a definitive measurement of pressure temperament, future performance, or fully adjusted player quality.
