# VehicleOS demo guide: how to run the 4-minute pitch

Written for: whoever presents, and anyone on the team who might step in. Read it once, rehearse twice, and keep it open on a second screen.

**What you present with:**
- **The deck:** [`docs/pitch/VehicleOS-pitch.pptx`](../pitch/VehicleOS-pitch.pptx). A native PowerPoint file with clickable navigation, toggles, Morph animations and speaker notes on every slide.
- **The live app:** http://localhost:3000 (`npm run dev`).

---

## 1. The 4-minute run-of-show

| Time | Where | You do | You say (short version) |
|---|---|---|---|
| 0:00–0:10 | **Slide 1** · Title | Press → | "Every used car gets re-typed four times between seller and buyer. We built one record every step shares." |
| 0:10–0:40 | **Slide 2** · Problem | Point at the four leaks, then the three people | "Dana gets quoted gross, not what she keeps. Marcus finds the no-start after he bids. Priya sends a flatbed to a car that needs a winch." |
| 0:40–1:00 | **Slide 3** · Idea | Press → | "Not another tool: one shared, versioned record. Change a fact and everything built on it is flagged out of date, and the platform won't sell on stale numbers." |
| 1:00–2:45 | **Slide 4** → **browser** | ⌘-Tab to the app and run the 5 moments (section 3) | (see section 3) |
| 2:45–3:05 | **Slides 5 → 6** · Checkout | ⌘-Tab back, press → to morph *Transport on → off* | "Most ACV sellers ship free and the buyer pays transport, so it's a yes/no at checkout. Seller nets $10,950 either way. Every *yes* is $640 of transport revenue." |
| 3:05–3:35 | **Slide 7** · ROI | Stay on Base | "Per 10,000 cars, about $243K a year, roughly $24 a car. Half of it is transport: higher attach plus pooled routing." |
| 3:35–3:50 | **Slide 10** · Real | Press → (it skips the hidden ROI variants) | "Software, tests and AI are real; the data is synthetic. Ninety days: read-only, then shadow mode, then one region live." |
| 3:50–4:00 | **Slide 11** · Close | Press → | "One record. Honest numbers. Money that shows up. Thank you." |
| Q&A | **Slide 12** · Q&A navigator | Click the card that answers the question | (see section 7) |

**If you're running long:**
- Skip the winch-outage part of the demo (moment 5) and just say it.
- On the ROI slide, say only the total and "half is transport".

---

## 2. Before you present (15 minutes before)

1. **Get everyone's code:** run `git pull`, then `npm install --legacy-peer-deps` (only needed after a teammate adds a package).
2. **Start the app:** run `npm run dev` and open http://localhost:3000 in your browser.
   - The top-right pill must be green, **Gemini live · gemini-3.5-flash**.
   - Violet **No API key · replay only** means `.env.local` wasn't loaded. Fix it and restart `npm run dev`.
3. **Rehearse the live demo once, then click Reset scenario** (top right). This matters more than anything else on this list:
   - The live AI call takes **about 25–30 s**. Rehearsing stores the result, so during the real demo the same inspector note returns **instantly**.
   - That stored result is cleared if you restart the server or edit the note text. Don't do either after rehearsing.
4. **Set up the deck:**
   - Open the `.pptx` in **PowerPoint**.
   - Use **Slide Show → Presenter View** so your speaker notes (timings and script) are on your laptop screen.
   - Click with the **mouse or trackpad**. A clicker can only go forward and back; it can't press the on-slide buttons.
5. **Set up the screen:**
   - Keep the browser tab already open on the app, zoomed to about 110–125% (⌘ +).
   - Switch between deck and app with **⌘-Tab**. Don't click "Open live demo" mid-pitch; it opens a new tab.
   - Close every other tab and app, and turn on Do Not Disturb.
6. **Check every step works:** anything saying **Not available yet** means a teammate's module isn't merged. Run `git pull` and refresh.

---

## 3. The live demo in 1:45 (five moments)

Reset first. Every number below is what the app shows; we verified each one in a full run.

| # | Click | You'll see | Say |
|---|---|---|---|
| 1 · 0:15 | **Estimate net outcomes** | ACV **$13,850** (green, Recommended) vs Copart **$13,738**. Salvage is ineligible; export is unknown and **Needs review**. | "Net, not gross. ACV wins by $112 even though its sale price is $550 lower, because the seller pays no transport." |
| 2 · 0:30 | **Add inspector note**, then **Interpret with Gemini (live)** | Step 1 turns **amber, Out of date**. Findings: engine and drivable are **conflicting · severe**, each citing **EV-001-INSP-2** against the intake note. Keys stay **unknown**. Next check: **Starting/charging diagnostic**. | "Every claim cites its evidence, and the chips link to it. Conflicts stay visible and unknown stays unknown. The next-check ranking is rules, not AI." |
| 3 · 0:25 | **Confirm startsEngine = false, drivable = false…** → **Confirm simulated deal** → **Recompute net outcomes** | Revision 2. The deal is **refused: "The valuation is out of date."** After recomputing: ACV **$10,950**, Copart **$10,863**, Salvage **$9,073**, plus a "Why the recommendation changed" box. | "AI proposes, a person decides. And it won't sell on stale numbers." |
| 4 · 0:10 | **Confirm simulated deal** | Sale **$11,300**, seller proceeds **$10,950**, buyer landed **$12,365**. The shipment **needs a winch**. | "The deal already knows a non-runner needs a winch truck." |
| 5 · 0:25 | **Plan routes**, flip **Truck B winch out of service**, then **Re-plan routes** | First 360 / 375 km, with our car on Truck B (the one with the winch). After the outage, 290 / 110 km and our car is **no capable equipment**. | "No winch, no pretending. Anything it can't place is listed with a reason." |

**If the AI is slow** (nothing stored from a rehearsal), fill the wait: "While it reads, it's only allowed to cite these four evidence IDs; anything else gets dropped."

---

## 4. Using the deck's interactive parts

Everything below works in **Slide Show** mode.

| Component | Where | What it does |
|---|---|---|
| **Top tabs** (Problem · Idea · Demo · Checkout · ROI · Real · Q&A) | Every slide | Jump to that section; the white highlight slides across with Morph. |
| **"V" logo** | Every slide | Back to the title slide. |
| **Open live demo ↗** | Top right | Opens http://localhost:3000 (use ⌘-Tab during the pitch instead). |
| **Transport on / off** toggle | Slides 5–6 | The switch knob, totals and revenue animate between the two checkout states. |
| **Conservative / Base / Aggressive** | ROI slide | The bars grow and shrink between scenarios. The two extra scenarios are hidden slides reached only by clicking. |
| **Persona cards** | Slide 2 | Dana, Marcus or Priya's "today vs with VehicleOS" slide. |
| **"Live demo down?" buttons** | Slide 4 | A static, clickable version of each demo step (BestExit before/after, SecondLook, checkout, LoadLink winch on/off). |
| **Q&A navigator** | Slide 12 | 18 appendix answers in four groups. Every appendix slide has **↩ Back to Q&A navigator**. |
| **Speaker notes** | Every slide | Timing, script, and the ROI formulas. |

**Compatibility and editing:**
- **Morph animation** needs PowerPoint 2019, 2021 or 365 (Mac or Windows). Other apps show a simple fade, and the links still work.
- **Editing:** it's a normal PowerPoint file. Shapes whose names start with `!!` are paired across toggle slides, so keep those names when editing or the Morph animation won't line up.
- **ROI numbers** are illustrative placeholders, so edit them freely.

---

## 5. Judge feedback and how we answer it

These are notes from one judge, lightly cleaned up. The judge appears to be from ACV.

> - **Sellers:** most of our sellers use ACV Transportation for free, and buyers pay the transport fees.
> - Go through the **checkout process** and click **ACV Transport or not**. They can see it as **independent variables**: whether they buy it or not.
> - Tell us **how it becomes real**. Give us **more examples**, more **use cases**.
> - Be **transparent**.
> - Are you presenting a **new way to attack the problem**?
> - You talked about the problem. **This idea has this person**: show who it's for.
> - Doesn't know if this is even **real**; wants to see **if this can work**.
> - Focus on **ROI. ROI is king.** How do you make money?
> - This is what the ACV guy is saying: he wants to **know how to make money**, and **modeling this would be great**.

| What the judge asked | How we answer it | Where to show it |
|---|---|---|
| Sellers ship free; buyers pay transport | BestExit already treats ACV transport as **buyer-paid**: it's never subtracted from the seller's net. | App Step 1 footnote ("buyer-paid costs are never subtracted from seller net"); **slides 5–6** |
| Checkout: ACV Transport yes/no as an independent variable | Buyer checkout with a **Transport on/off** toggle: landed **$12,365 vs $11,725**. The seller's **$10,950 is unchanged** either way. ACV earns **$640** on a "yes". | **Slides 5–6** (main path) |
| How it becomes real; more examples and use cases | A 90-day pilot (read-only, then shadow mode, then one region live) with go/no-go targets, plus six use cases. | **Slide 10**; appendix **Pilot** and **Use cases** |
| Transparent | "Real vs simulated" spelled out. The app labels everything: Simulation, "Authored example — not a model output", Not dispatchable. ROI inputs are marked illustrative. | **Slide 10**; the app itself |
| A new way to attack the problem? | Not another point tool: **one shared, versioned record** where stale results are flagged and blocked. | **Slide 3** |
| This idea has a person | **Dana** (seller), **Marcus** (buyer) and **Priya** (dispatcher), each with a before/after slide. | **Slide 2** → persona slides |
| Is it real? Can it work? | It's **working software**. The live demo runs end to end with real AI, 34 tests pass, and the pilot sets measurable go/no-go targets. | Live demo; appendix **Tests & quality**, **Pilot** |
| ROI is king; model it | An ROI model per 10,000 vehicles with five levers and three scenarios. **Base ≈ $243K/yr, ≈ $24 per car; half of it is transport.** | **Slide 7** (+ Conservative ≈ $112K / Aggressive ≈ $475K) |

**Be upfront about two things:**
- **The checkout toggle is a concept slide.** The app computes the "transport on" landed cost today; the on/off switch is the next build.
- **The ROI inputs are placeholders.** The model's structure is the point. Say "give us your attach rate and dry-run cost and we'll rerun it."

---

## 6. The ROI model, explained (for Q&A)

Per **10,000 vehicles**, with a baseline transport attach rate of 40%, an average transport price of $400 and a carrier cost of $340 per shipment:

| Lever | Formula | Base |
|---|---|---|
| Transport attach ↑ (checkout) | vehicles × attach uplift × $400 × margin | 10,000 × 5 pts × $400 × 15% = **$30K** |
| Pooled routing (LoadLink) | shipped × $340 × pooling saving | 4,500 × $340 × 6% = **$92K** |
| Dry runs avoided | shipped × 15% non-runners × dry-run rate × cost × prevented | 4,500 × 15% × 12% × $200 × 75% = **$12K** |
| Arbitrations avoided (SecondLook) | vehicles × arbitration rate × cost × avoided | 10,000 × 4% × $400 × 20% = **$32K** |
| Sellers retained (BestExit) | vehicles × retained × $775 fees per car | 10,000 × 1% × $775 = **$78K** |
| **Total** | | **≈ $243K / yr · ≈ $24 per car** |

- **Range:** Conservative ≈ $112K (≈ $11/car); Aggressive ≈ $475K (≈ $48/car).
- **Fees per car:** $775 is $350 seller fee + $425 buyer fee from the demo's fee table.
- **AI cost:** about 10k tokens per AI read.

---

## 7. Q&A: likely questions and where to click

| Question | Short answer | Click |
|---|---|---|
| Is this real ACV or Copart data? | No. Everything is synthetic, the combination is announced but not closed, and nothing touches real systems. | Real (slide 10) |
| How do you make money? | Mostly transport: more buyers say yes at checkout, and pooling makes each truck cheaper. Then avoided dry runs, avoided arbitrations, retained sellers. | ROI (slide 7) |
| Where is the AI, exactly? | Only in SecondLook, reading messy notes. Money and routing are deterministic and auditable. | AI guardrails |
| How do you stop hallucinations? | Strict schema; every claim must cite evidence it was given or it's dropped; unknown is allowed; a person confirms. | AI guardrails |
| What if the AI is down? | It shows "Rules only" and never quietly swaps in examples. The authored replay is labeled as not model output. | AI guardrails |
| Why did the recommendation change? | Each change is listed with a code (input revised, comparables, costs, eligibility). | Value · before / after |
| How did four people build this in a day? | Frozen contracts: each person owned one pure module file, and the foundation handled the rest. | Architecture |
| Is the customer data or key exposed? | The key stays on the server. Emails and phone numbers are masked before anything goes to the model. | AI guardrails |
| What's next? | RightBuyer (P2); PartsBridge and ReadyToMove (P3); the checkout toggle; time windows; real data adapters. | Roadmap |

---

## 8. If something goes wrong on stage

| You see | Do this | Say |
|---|---|---|
| The browser won't load | Go back to the deck, slide 4: click the **"Live demo down?"** buttons | "Here's the same run, step by step." |
| "Interpret with Gemini" is greyed out | Click **Use authored replay** | "This is a labeled example run; the live path works the same way." |
| Amber **"Rules only — model provider error"** | Click **Interpret** once more, or **Use authored replay** | "When the AI isn't available, we show rules-only results instead of inventing any." |
| Violet **"Not available yet"** | Skip the step | "That module is being merged; the platform degrades honestly." |
| Red **"valuation is out of date"** on the deal | That's expected: recompute Step 1 first | (It's a feature; see moment 3.) |
| Clicked out of order | **Reset scenario**, top right | |
| A deck button does nothing | You're in edit mode, not Slide Show | Press ⌘-Return (Mac) to start Slide Show |
