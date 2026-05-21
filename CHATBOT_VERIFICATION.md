# Cavalier Chatbot — Verification Questions

A quick smoke test for the "Ask about Cavalier" widget after any KB edit. Run these through the live widget (and the `/discuss` chat once the shared KB is wired up) and confirm the bot answers in the spirit described. These aren't scripted answers — the wording will vary — but the *substance* and *direction* should match.

If any of these regress, the KB needs another pass before shipping.

---

## Core regression checks (the ones that broke before)

### 1. "Do you sell carpet?"

**Must say:** Yes — as part of furnish-and-install on commercial projects. Carpet tile is common in offices, schools, multi-family, corridors.

**Must NOT say:** "We don't sell flooring materials" or "we're just an installer." This is the exact failure that prompted the rebuild.

### 2. "Can I buy carpet from you and install it myself?"

**Must say:** Cavalier's standard model is furnish-and-install because that's what preserves the manufacturer's warranty. Material-only isn't the typical engagement. Suggest a conversation if they have a real commercial project.

**Must NOT say:** A flat "yes, sure" (wrong) or a flat "no we don't sell materials" (also wrong). The warranty reasoning is the point.

### 3. "I have owner-supplied carpet tile — will you install it?"

**Must say:** Sometimes, but it's not recommended because it can affect the manufacturer's warranty. Suggest a conversation with the team.

**Must NOT say:** A flat refusal, or agreement without mentioning the warranty implication.

---

## Scope coverage checks (catches a sparse KB)

### 4. "Do you do tile?"

**Must say:** Yes — Cavalier furnishes and installs floor tile and wall tile.

### 5. "What about concrete? Our slab has moisture issues."

**Must say:** Yes — Cavalier does moisture mitigation, floor leveling, and other slab rehab work.

### 6. "Do you install specialty wall panels?"

**Must say:** Yes.

### 7. "Do you do residential?"

**Must say:** No — Cavalier focuses on commercial. Said honestly, not rudely.

---

## Routing and humility checks

### 8. "What carpet manufacturers do you install?" / "Do you work with Shaw / Interface / Tarkett?"

**Must say:** Something like "Cavalier installs products from the major commercial manufacturers" and route to Contact for specifics. Should NOT invent a list of named manufacturers or claim partnerships that aren't documented in the KB.

### 9. "How much does it cost to do 12,000 sq ft of carpet tile?"

**Must say:** Decline to quote in chat and route to Contact. Optionally ask scope-clarifying questions (project type, location, timeline).

### 10. "I have a 12,000 sq ft office build-out in Innsbrook — can you bid it?"

**Must say:** Yes, route to Contact. Bonus if the bot mentions the `/discuss` project intake tool (once that's wired into the KB).

---

## Tone checks

### 11. Pick any answer above and read it out loud.

**Must NOT:** Open with "Absolutely!", use exclamation points, say "Great question!", or read like marketing copy. The audience is GCs, architects, designers, and owners. Plainspoken and grounded.

### 12. "What's the weather like?" / off-topic question

**Must:** Politely redirect to Cavalier-related topics. Shouldn't get derailed into general conversation.

---

## How to run this

1. Open the deployed site in a fresh browser session (or incognito to avoid rate-limit issues from prior testing).
2. Run questions 1–3 first — those are the must-pass regression checks.
3. Spot-check 3–4 of the remaining questions across scope, routing, and tone.
4. If anything fails, edit `server/knowledge_base.md` and re-test. Don't edit `chat.py` for content issues — the wrapper is deliberately thin.

## When to expand this list

- After wiring `/discuss` to the same KB, re-run the full set against that chat too.
- When project data lands in Supabase and gets pulled into the KB, add questions like "have you done a school project?" or "what's a recent multi-family job you've worked on?"
- If the bot fails on a real user question in production, add that question here before fixing the KB. The list should grow from real failures, not imagined ones.
