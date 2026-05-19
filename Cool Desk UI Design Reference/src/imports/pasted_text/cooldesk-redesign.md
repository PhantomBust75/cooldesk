You are redesigning the visual layer of an existing field-service-management web app called CoolDesk. The app's information architecture, user flows, and component inventory are already finalized — you are NOT changing what's on the screen, what data is shown, or how navigation works. You are changing how it LOOKS.

The current build uses a design system that reads as a 2014-era enterprise ERP tool (think SAP, Oracle EBS, ServiceNow Classic). The product owner wants it to read as a modern 2026 SaaS product (think Linear, Attio, Stripe Dashboard, Mercury, Vercel, Cron, Pylon). Apply every change below. Do not negotiate the brief, do not preserve "brand consistency" with the old palette, do not add new sections.

═══════════════════════════════════════════════════════
PART 1 — REPLACE THE FOUNDATION TOKENS
═══════════════════════════════════════════════════════

TYPOGRAPHY
- Replace Calibri with Inter (variable font, weights 400 and 500/600 only — never use 700 except for h1/h2 display).
- Numbers in tables, KPI values, IDs, prices, timestamps: apply `font-variant-numeric: tabular-nums`. For Job IDs specifically, use Geist Mono or JetBrains Mono.
- Type scale: 11 / 12 / 13 / 14 / 15 / 18 / 24 / 32 / 48 px. Pick intentional jumps; do not interpolate.
- Body text: 15px, line-height 1.5, color #171717.
- Labels / captions: 12px or 13px, weight 500, color #737373. Sentence case — NEVER all-caps.

COLOR — KILL THE NAVY PALETTE
- Delete every use of #1E3A5F (navy) and #2E75B6 (mid-blue) from chrome, headers, sidebars, and table headers. Navy is the legacy tell.
- Neutral ramp (use these everywhere for chrome, text, borders, surfaces):
  · #0A0A0A — primary text, primary button bg
  · #171717 — heading text
  · #404040 — secondary text
  · #525252 — tertiary text / icons
  · #737373 — muted labels
  · #A3A3A3 — placeholder / disabled
  · #E5E5E5 — borders, dividers
  · #F5F5F5 — hover surface, selected nav item
  · #FAFAFA — sidebar bg, subtle surface
  · #FFFFFF — primary surface
- ONE accent color, used sparingly: #2563EB (blue-600). Used only for: focus rings, primary CTA hover, active nav indicator dot, hyperlinks. Never for headings, never for borders, never for chrome panels.
- Status hues — used ONLY inside chips, never as panel fills:
  · Amber: text #92400E on bg #FEF3C7, dot #F59E0B
  · Red:   text #991B1B on bg #FEE2E2, dot #EF4444
  · Green: text #065F46 on bg #D1FAE5, dot #10B981
  · Blue:  text #1E40AF on bg #DBEAFE, dot #3B82F6
  · Violet:text #5B21B6 on bg #EDE9FE, dot #8B5CF6
  · Gray:  text #404040 on bg #F5F5F5, dot #A3A3A3

RADIUS
- Cards: 12px
- Buttons, inputs, chips containers: 8px
- Pills / status chips: 9999px (full pill)
- Avatar: 9999px
- Sharp 0px / 4px corners are banned.

SHADOWS
- Resting cards: NO shadow. 1px border #E5E5E5 only.
- Hovered/lifted cards: `0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)` and remove the border.
- Modals: `0 10px 38px rgba(0,0,0,0.10), 0 10px 20px rgba(0,0,0,0.06)`.
- No drop shadows on buttons, no shadows on chips, no shadows on inputs.

ICONS
- Lucide icons only. Stroke 1.5px. Sizes 14 / 16 / 20 / 24 px (no other sizes).
- Icon color matches surrounding text color — never independently colored unless inside a status chip.
- Replace ALL emoji (⚠ ✓ ℹ ✕) with Lucide equivalents (alert-triangle, check, info, x).

DENSITY
- Double current vertical padding inside cards (target 20–24px) and inside table rows (target 14–16px).
- Card outer margins: 16–24px between cards in a row, 24px between row groups.
- Section gaps in main content: 32px between major sections.

═══════════════════════════════════════════════════════
PART 2 — REBUILD SPECIFIC COMPONENTS
═══════════════════════════════════════════════════════

SIDEBAR
- Background: #FAFAFA (NOT navy). Width: 240px.
- Right edge: 1px #E5E5E5 border.
- Logo: monochrome lightning bolt in #0A0A0A, "CoolDesk" wordmark in Inter 16px medium #0A0A0A. No saturated blue square.
- Nav items: 13px medium, color #525252 default, #0A0A0A on hover, #0A0A0A on selected.
- Selected nav item: #F5F5F5 background fill, 8px radius, NO left blue indicator strip, NO blue text.
- Icons: Lucide 16px, stroke 1.5px, matching text color.
- Spacing between items: 2px vertical gap. Item internal padding: 8px 10px.
- "Collapse" control at bottom: small text button in #737373, no chevron icon competing for attention.

TOP BAR / HEADER
- White background, 1px bottom border #E5E5E5, height 56px.
- Search: 1px border #E5E5E5, 8px radius, placeholder "Search jobs, customers..." in #A3A3A3, kbd hint "⌘K" in a tiny monospace pill on the right side of the input.
- Live indicator: small green dot (6px, #10B981) + "Live" text in 12px #525252. Drop the WiFi icon — it's redundant.
- Notification bell: Lucide bell, 20px, #525252. Red dot count: 8px circle #EF4444 with white 10px tabular-nums count, top-right of the bell.
- Primary CTA "+ Log New Job": background #0A0A0A (NEAR-BLACK, NOT BLUE), text white, 13px medium, 8px radius, 10px 14px padding, no shadow. Hover: #171717.
- Avatar "OW": 32px circle, background #F5F5F5, text #171717 12px medium. Not navy.

KPI CARDS (the row of 7 metrics)
- All cards: white background, 1px border #E5E5E5, 12px radius, 20px padding, 24px height for label, ~120px total height. NO COLORED FILLS. Not blue, not yellow, not pink.
- Layout per card:
  · Top row: small Lucide icon (16px) in muted gray on the left, optional tiny status dot on the right
  · Middle: the number — 32px, weight 600, #0A0A0A, tabular-nums
  · Bottom: label in 12px medium #737373, sentence case ("Total active jobs", not "Total Active Jobs")
  · If trend exists: 12px row with arrow icon + "+12.4% vs yesterday" — arrow & percent in #10B981 (up) or #EF4444 (down), "vs yesterday" in #737373
- For Amber Alerts and Chronic Jobs cards: ONLY change is the icon color (alert-triangle in #F59E0B, alert-octagon in #EF4444). The card itself stays white. No tinted fill.

BANNERS (cancellation request, amber alerts header, etc.)
- 1px border in the relevant tint color at full saturation, very subtle background tint (4–6% opacity), 8px radius, 12px 16px padding.
- Cancellation banner: border #FDE68A, bg #FFFBEB, icon Lucide alert-circle 16px in #B45309, text in #404040 regular weight ("Cancellation request from Premium HVAC Trading · Job MN789012").
- Action buttons in banners: small (13px, 8px 12px padding, 8px radius). Primary action ("Approve"): bg #0A0A0A, text white. Secondary ("Reject"): no fill, 1px #E5E5E5 border, text #404040, hover bg #F5F5F5. NO GREEN, NO RED button fills.
- "Amber Alerts — Needs Revisit" header: drop the entire yellow banner treatment. Render as a plain section heading: 14px medium #171717 "Needs revisit" with a count badge "2" in a small gray pill (bg #F5F5F5, text #525252, 11px). The dropdown "Chronic first" stays but as a ghost button (no fill, 1px border).

STATUS CHIPS — TOTAL REBUILD
Apply the tinted pattern to ALL of these (Status column, Type column, Tags column, anywhere a label appears):
- Shape: full pill (9999px radius), 4px 10px padding (with dot) or 4px 8px (without).
- Structure: [6px dot in hue] [4px gap] [text in hue, 11px or 12px, weight 500, sentence case]
- Background: tint of hue (see color tokens above)
- NO border, NO uppercase, NO bold, NO white-on-color
- Examples:
  · "In progress" — bg #FEF3C7, text #92400E, dot #F59E0B
  · "Needs revisit" — bg #FEE2E2, text #991B1B, dot #EF4444
  · "Pending schedule" — bg #F5F5F5, text #525252, dot #A3A3A3
  · "Assigned" — bg #EDE9FE, text #5B21B6, dot #8B5CF6
  · "Scheduled" — bg #DBEAFE, text #1E40AF, dot #3B82F6
  · "Cancellation pending" — bg #FEE2E2, text #991B1B, dot #EF4444
  · "Acknowledged" — bg #D1FAE5, text #065F46, dot #10B981
- Tags ("Chronic", "Repeat", "Frequent"): same pattern. Chronic = red tint. Repeat = blue tint. Frequent = amber tint.

TYPE COLUMN ("Installation", "Complaint")
- These are NOT chips, render as plain text with a tiny Lucide icon prefix:
  · Installation: wrench icon 14px #525252 + "Installation" 13px #404040
  · Complaint: message-circle-warning icon 14px #525252 + "Complaint" 13px #404040
- No background fill, no border, no pill.

SOURCE COLUMN ("Direct", "Via [Dealer Name]")
- Plain text, NO BUTTON STYLING. The current chunky purple gradient pills are the worst offender after the navy sidebar.
- Direct: arrow-right icon 14px #737373 + "Direct" 13px #525252.
- Dealer: building-2 icon 14px #737373 + dealer name 13px #525252 (single line, truncate with ellipsis if needed, full name in tooltip).

DATA TABLE
- Header row: white background (NOT navy fill), 13px medium #525252, single 1px bottom border #E5E5E5. Column labels in sentence case ("Job ID", not "JOB ID"). Lowercase or sentence case, no all-caps.
- Body rows: white background, 14–16px vertical padding, 1px bottom border #F5F5F5 between rows (extremely subtle). NO zebra striping.
- Hover state on rows: full row bg becomes #FAFAFA, cursor pointer. Entire row is clickable — drop the separate "View →" link in the last column, replace with a single chevron-right icon 16px #A3A3A3 that becomes #171717 on row hover.
- Job IDs: render in Geist Mono / JetBrains Mono 13px, color #171717, NO underline, NO blue. The whole row is the link target.
- Brand dots: keep the colored circle pattern but reduce to 8px diameter, place inline with brand name text 13px #404040.
- Customer names: 14px regular #171717.
- Technician names: 13px #404040. "Unassigned" in 13px italic #A3A3A3.
- Dates / times: 13px tabular-nums #525252.
- Empty cell placeholder: em-dash "—" in #A3A3A3, not blank.

═══════════════════════════════════════════════════════
PART 3 — THINGS YOU MUST NOT DO
═══════════════════════════════════════════════════════
- Do not introduce gradients anywhere. None.
- Do not add a colored stripe under headings or above sections.
- Do not use white text on a saturated color background, ever, except inside the primary CTA button.
- Do not use multiple accent colors. One blue, that's it.
- Do not bring back navy "for branding" — the brief is to remove it.
- Do not capitalize labels, headers, or chip text. Sentence case only.
- Do not use solid-fill chips, ever.
- Do not use the alert/check/info emoji. Lucide icons only.
- Do not add decorative dividers, ornamental rules, or visual flourishes. Modern SaaS is restrained.
- Do not reduce whitespace to fit more on screen. Generous padding is the brief.

═══════════════════════════════════════════════════════
PART 4 — DELIVERABLE
═══════════════════════════════════════════════════════
Update the design system tokens (CSS variables / Tailwind config / Figma styles — whichever applies) and rebuild the affected components: sidebar, top bar, KPI cards, banners, status chip system, type column, source column, data table header and rows, primary CTA, avatar.

For each component changed, output:
1. The before/after token diff (which variables changed)
2. The updated component markup or Figma node spec
3. A one-line note on what visual problem the change solves

Reference apps to study before starting: Linear inbox, Attio CRM table, Stripe Dashboard payments list, Cron calendar, Pylon ticket queue. Match that tier of restraint.