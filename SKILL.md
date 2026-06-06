---
description: Search, read, analyze, and automate Xiaohongshu (小红书) content via CLI
allowed-tools: Bash, Read, Write, Glob, Grep
# OpenClaw / ClawHub metadata (clawhub install redbook)
name: redbook
version: 0.5.0
metadata:
  openclaw:
    requires:
      bins:
        - redbook
    install:
      - kind: node
        package: "@lucasygu/redbook"
        bins: [redbook]
    os: [macos]
    homepage: https://github.com/lucasygu/redbook
tags:
  - xiaohongshu
  - social-media
  - analytics
  - content-ops
---

# Redbook — Xiaohongshu CLI

Use the `redbook` CLI to search notes, read content, analyze creators, automate engagement, and research topics on Xiaohongshu (小红书/RED).

**OpenClaw users:** Install via `clawhub install redbook` or `npm install -g @lucasygu/redbook`.

> **⚠️ Research discipline (read this first).** XHS 风控 throttles *reading*, not just writing. Any research that reads more than a handful of notes MUST run through the **[Research Loop](#research-loop--rate-limit-safe-long-running-research)** — **human-paced by default** (~20 s/note, one at a time; a typical job finishes in tens of minutes, large ones spread across the day). Hammering `read` / `comments` / `analyze-viral` in a tight loop trips captcha / IP block (300012) within a few dozen hits and degrades the account for hours. ⚡ Fast mode is **emergency-only** and requires a printed warning + explicit user opt-in. Never fire reads in parallel or with zero delay.

## Usage

```
/redbook search "AI编程"              # Search notes
/redbook read <url>                   # Read a note
/redbook user <userId>                # Creator profile
/redbook analyze <userId>             # Full creator analysis (profile + posts)
```

## Quick Reference

| Intent | Command |
|--------|---------|
| Search notes | `redbook search "keyword" --json` |
| Read a note | `redbook read <url> --json` |
| Get comments | `redbook comments <url> --json --all` |
| Creator profile | `redbook user <userId> --json` |
| Creator's posts | `redbook user-posts <userId> --json` |
| Browse feed | `redbook feed --json` |
| Search hashtags | `redbook topics "keyword" --json` |
| Analyze viral note | `redbook analyze-viral <url> --json` |
| Extract content template | `redbook viral-template <url1> <url2> --json` |
| Post a comment | `redbook comment <url> --content "text"` |
| Reply to comment | `redbook reply <url> --comment-id <id> --content "text"` |
| Batch reply (preview) | `redbook batch-reply <url> --strategy questions --dry-run` |
| Like a note | `redbook like <url>` |
| Unlike a note | `redbook like <url> --undo` |
| List favorites | `redbook favorites --json` or `redbook favorites <userId> --json` |
| Collect a note | `redbook collect <url>` |
| Remove from collection | `redbook uncollect <url>` |
| List followers | `redbook followers <userId> --json` |
| List following | `redbook following <userId> --json` |
| Delete own note | `redbook delete <url>` |
| Check note health | `redbook health --json` or `redbook health --all --json` |
| List user boards | `redbook boards` or `redbook boards <userId> --json` |
| List album notes | `redbook board <board-url>` or `redbook board <boardId> --json` |
| Render markdown to cards | `redbook render content.md --style xiaohongshu` |
| Publish image note | `redbook post --title "..." --body "..." --images img.jpg` |
| Check connection | `redbook whoami` |

**Always add `--json`** when parsing output programmatically. Without it, output is human-formatted text.

---

## XHS Platform Signals

XHS is not Twitter or Instagram. These platform-specific engagement ratios reveal content type and audience behavior.

### Collect/Like Ratio (`collected_count / liked_count`)

XHS's "collect" (收藏) is a save-for-later mechanic — users build personal reference libraries. This ratio is the strongest signal of content utility.

| Ratio | Classification | Meaning |
|-------|---------------|---------|
| >40% | 工具型 (Reference) | Tutorial, checklist, template — users bookmark for reuse |
| 20–40% | 认知型 (Insight) | Thought-provoking but not saved for later |
| <20% | 娱乐型 (Entertainment) | Consumed and forgotten — engagement is passive |

### Comment/Like Ratio (`comment_count / liked_count`)

Measures how much a note triggers conversation.

| Ratio | Classification | Meaning |
|-------|---------------|---------|
| >15% | 讨论型 (Discussion) | Debate, sharing experiences, asking questions |
| 5–15% | 正常互动 (Normal) | Typical engagement pattern |
| <5% | 围观型 (Passive) | Users like but don't engage further |

### Share/Like Ratio (`share_count / liked_count`)

Measures social currency — whether users share to signal identity or help others.

| Ratio | Meaning |
|-------|---------|
| >10% | 社交货币 — people share to signal taste, identity, or help friends |
| <10% | Content consumed individually, not forwarded |

### Search Sort Semantics

| Sort | What It Reveals |
|------|----------------|
| `--sort popular` | Proven ceiling — the best a keyword can do |
| `--sort latest` | Content velocity — how much is being posted now |
| `--sort general` | Algorithm-weighted blend (default) |

### Content Form Dynamics

| Form | Tendency |
|------|----------|
| 图文 (image-text, `type: "normal"`) | Higher collect rate — users save reference content |
| 视频 (video, `type: "video"`) | Higher like rate — easier to consume passively |

---

## Analysis Modules

Each module is a composable building block. Combine them for different analysis depths.

### Module A: Keyword Engagement Matrix

**Answers:** Which keywords have the highest engagement ceiling? Which are saturated vs. underserved?

**Commands:**
```bash
redbook search "keyword1" --sort popular --json
redbook search "keyword2" --sort popular --json
# Repeat for each keyword in your list
```

**Fields to extract** from each result's `items[]`:
- `items[].note_card.interact_info.liked_count` — likes (may use Chinese numbers: "1.5万" = 15,000)
- `items[].note_card.interact_info.collected_count` — collects
- `items[].note_card.interact_info.comment_count` — comments
- `items[].note_card.user.nickname` — author

**How to interpret:**
- **Top1 ceiling** = `items[0]` likes — the best-performing note for this keyword. This is the proven demand signal.
- **Top10 average** = mean likes across `items[0..9]` — how well an average top note does.
- A high Top1 but low Top10 avg means one outlier dominates; hard to compete.
- A high Top10 avg means consistent demand; easier to break in.

**Output:** Keyword × engagement table ranked by Top1 ceiling.

| Keyword | Top1 Likes | Top10 Avg | Top1 Collects | Collect/Like |
|---------|-----------|-----------|---------------|-------------|
| keyword1 | 12,000 | 3,200 | 5,400 | 45% |
| keyword2 | 8,500 | 4,100 | 1,200 | 14% |

---

### Module B: Cross-Topic Heatmap

**Answers:** Which topic × scene intersections have demand? Where are the content gaps?

**Commands:**
```bash
# Combine base topic with scene/angle keywords
redbook search "base topic + scene1" --sort popular --json
redbook search "base topic + scene2" --sort popular --json
redbook search "base topic + scene3" --sort popular --json
```

**Fields to extract:** Same as Module A — Top1 `liked_count` for each combination.

**How to interpret:**
- High Top1 = proven demand for this intersection
- Zero or very low results = content gap (opportunity or no demand — check if the combination makes sense)
- Compare across scenes to find which angles resonate most with the base topic

**Output:** Base × Scene heatmap.

```
             scene1    scene2    scene3    scene4
base topic   ████ 8K   ██ 2K     ████ 12K  ░░ 200
```

---

### Module C: Engagement Signal Analysis

**Answers:** What type of content is each keyword? Reference, insight, or entertainment?

**Commands:** Use search results from Module A, or for a single note:
```bash
redbook analyze-viral "<noteUrl>" --json
```

**Fields to extract:**
- From search results: compute ratios from `interact_info` fields
- From `analyze-viral`: use pre-computed `engagement.collectToLikeRatio`, `engagement.commentToLikeRatio`, `engagement.shareToLikeRatio`

**How to interpret:** Apply the ratio benchmarks from [XHS Platform Signals](#xhs-platform-signals) above.

**Output:** Per-keyword or per-note classification.

| Keyword | Collect/Like | Comment/Like | Type |
|---------|-------------|-------------|------|
| keyword1 | 45% | 8% | 工具型 + 正常互动 |
| keyword2 | 12% | 22% | 娱乐型 + 讨论型 |

---

### Module D: Creator Discovery & Profiling

**Answers:** Who are the key creators in this niche? What are their strategies?

**Commands:**
```bash
# 1. Collect unique user_ids from search results across keywords
#    Extract from items[].note_card.user.user_id

# 2. For each creator:
redbook user "<userId>" --json
redbook user-posts "<userId>" --json
```

**Fields to extract:**
- From `user`: `interactions[]` where `type === "fans"` → follower count
- From `user-posts`: `notes[].interact_info.liked_count` for all posts → compute avg, median, max
- From `user-posts`: `notes[].display_title` → content patterns, posting frequency

**How to interpret:**
- **Avg vs. Median likes:** Large gap means viral outliers inflate the average. Median is the "true" baseline.
- **Max / Median ratio:** >5× means they've had breakout hits. Study those notes specifically.
- **Post frequency:** Count notes to estimate posting cadence. Prolific creators (>3/week) vs. quality-focused (<1/week).

**Output:** Creator comparison table.

| Creator | Followers | Avg Likes | Median | Max | Posts | Style |
|---------|----------|-----------|--------|-----|-------|-------|
| @creator1 | 12万 | 3,200 | 1,800 | 45,000 | 89 | Tutorial |
| @creator2 | 5.4万 | 8,100 | 6,500 | 22,000 | 34 | Story |

---

### Module E: Content Form Breakdown

**Answers:** Do image-text or video notes perform better for this topic?

**Commands:**
```bash
redbook search "keyword" --type image --sort popular --json
redbook search "keyword" --type video --sort popular --json
```

**Fields to extract:**
- Compare Top1 and Top10 avg `liked_count` and `collected_count` between the two result sets
- Note the `type` field: `"normal"` = image-text, `"video"` = video

**Output:** Form × engagement table.

| Form | Top1 Likes | Top10 Avg | Collect/Like |
|------|-----------|-----------|-------------|
| 图文 | 8,000 | 2,400 | 42% |
| 视频 | 15,000 | 5,100 | 18% |

---

### Module F: Opportunity Scoring

**Answers:** Which keywords should I target? Where is the best effort-to-reward ratio?

**Input:** Keyword matrix from Module A.

**Scoring logic:**
- **Demand** = Top1 likes ceiling (proven audience size)
- **Competition** = density of high-engagement results (how many notes in Top10 have >1K likes)
- **Score** = Demand × (1 / Competition density)

**Tier thresholds** (based on Top1 likes):

| Tier | Top1 Likes | Meaning |
|------|-----------|---------|
| S | >100,000 (10万+) | Massive demand — hard to compete but huge upside |
| A | 20,000–100,000 | Strong demand — competitive but winnable |
| B | 5,000–20,000 | Moderate demand — good for growing accounts |
| C | <5,000 | Niche — low competition, low ceiling |

**Output:** Tiered keyword list.

| Tier | Keyword | Top1 | Competition | Opportunity |
|------|---------|------|-------------|------------|
| A | keyword1 | 45K | Medium (6/10 >1K) | High |
| B | keyword3 | 12K | Low (2/10 >1K) | Very High |
| S | keyword2 | 120K | High (10/10 >1K) | Medium |

---

### Module G: Audience Inference

**Answers:** Who is the audience for this niche? What do they want?

**Input:** Engagement ratios from Module C + comment themes from `analyze-viral` + content patterns.

**Fields to extract** from `analyze-viral` JSON:
- `comments.themes[]` — recurring phrases and keywords from comment section
- `comments.questionRate` — % of comments that are questions (learning intent)
- `engagement.collectToLikeRatio` — save behavior signals intent
- `hook.hookPatterns[]` — what title patterns attract this audience

**Inference rules:**
- High collect rate + high question rate → learning-oriented audience (students, professionals)
- High comment rate + emotional themes → community-oriented audience (sharing experiences)
- High share rate → aspiration-oriented audience (lifestyle, identity signaling)
- Comment language patterns → age/education signals (formal = older, slang = younger)

**Output:** Audience persona summary — demographics, intent, content preferences.

---

### Module H: Content Brainstorm

**Answers:** What specific content should I create, backed by data?

**Input:** Opportunity scores (Module F) + audience persona (Module G) + heatmap gaps (Module B).

**For each content idea, specify:**
- **Target keyword** — from opportunity scoring
- **Hook angle** — based on `hookPatterns` that work for this niche
- **Content type** — 工具型/认知型/娱乐型 based on what the audience wants
- **Form** — 图文 or 视频 based on Module E
- **Engagement target** — realistic based on Top10 avg for this keyword
- **Competitive reference** — specific note URL that proves this angle works

**Output:** Ranked content ideas with data backing.

| # | Keyword | Hook Angle | Type | Target Likes | Reference |
|---|---------|-----------|------|-------------|-----------|
| 1 | keyword3 | "N个方法..." (List) | 工具型 图文 | 5K+ | [top note URL] |
| 2 | keyword1 | "为什么..." (Question) | 认知型 视频 | 10K+ | [top note URL] |

---

### Module I: Comment Operations

**Answers:** Which comments deserve a reply? What is the comment quality distribution?

**Commands:**
```bash
# 1. Fetch all comments
redbook comments "<noteUrl>" --all --json

# 2. Preview reply candidates (dry run)
redbook batch-reply "<noteUrl>" --strategy questions --dry-run --json

# 3. Execute replies with template (5 min delay with ±30% jitter)
redbook batch-reply "<noteUrl>" --strategy questions \
  --template "感谢提问！关于{content}，..." \
  --max 10
```

**Fields to extract from `--dry-run` JSON:**
- `candidates[].commentId` — target comments
- `candidates[].isQuestion` — boolean, detected question
- `candidates[].likes` — engagement signal
- `candidates[].hasSubReplies` — whether already answered
- `skipped` — how many comments were filtered out
- `totalComments` — total fetched

**Strategies:**
- `questions` — replies to comments ending with `？` or `?` (learning-oriented audience)
- `top-engaged` — replies to highest-liked comments (maximum visibility)
- `all-unanswered` — replies to comments with no existing sub-replies (fill gaps)

**How to interpret:**
- High question rate (>15%) = audience is learning-oriented → reply to build authority
- High top-engaged comments (>100 likes) = reply to visible comments for maximum reach
- Many unanswered comments = engagement gap, opportunity to increase reply rate

**Safety:** Hard cap 30 replies per batch, minimum 3-minute delay with ±30% jitter (default 5 min), `--dry-run` by default (no template = preview only), immediate stop on captcha. See [Rate Limits & Safety](#rate-limits--safety) for details.

**Output:** Reply plan table with candidate comments, strategy match reason, and status.

---

### Module J: Viral Replication

**Answers:** What structural template can I extract from successful notes to guide new content creation?

**Commands:**
```bash
# 1. Find top notes for a keyword
redbook search "keyword" --sort popular --json

# 2. Extract structural template from 2-3 top performers
redbook viral-template "<url1>" "<url2>" "<url3>" --json
```

**Fields to extract from `viral-template` JSON:**
- `dominantHookPatterns[]` — hook types appearing in majority of notes
- `titleStructure.commonPatterns[]` — specific title formula
- `titleStructure.avgLength` — target title length
- `bodyStructure.lengthRange` — target word count [min, max]
- `bodyStructure.paragraphRange` — target paragraph count
- `engagementProfile.type` — reference/insight/entertainment
- `audienceSignals.commonThemes[]` — what the audience talks about

**How to interpret:**
- Consistent hook patterns across notes = proven formula for this niche
- Narrow body length range = audience has clear content length preference
- High collect/like in profile = audience saves content → create reference material
- Common comment themes = topics to address in new content

**Composition with other modules:**
- Uses Module A results to identify top URLs for template extraction
- Feeds into Module H (Content Brainstorm) as structural constraint
- Uses Module C classification to validate engagement profile

**Output:** Content template spec — the structural skeleton for content creation. An LLM (via the composed workflow) uses this template to generate actual title, body, hashtags, and cover image prompt.

---

### Module K: Engagement Automation

**Answers:** How should I manage ongoing engagement with my audience?

This module is a workflow that composes Modules I and J with human oversight.

**Workflow:**
1. **Monitor** — `redbook comments "<myNoteUrl>" --all --json` to fetch recent comments
2. **Filter** — `redbook batch-reply --strategy questions --dry-run` to identify reply candidates
3. **Review** — Human reviews dry-run output (or LLM reviews with persona guidelines)
4. **Execute** — `redbook batch-reply --strategy questions --template "..." --max 10`
5. **Report** — Summary of replies sent, errors encountered, rate limit status

**Safety rules:**
- Always `--dry-run` first, human approval before execution
- Maximum 30 replies per session (hard cap)
- Minimum 3-minute delay between replies, default 5 minutes, with ±30% random jitter
- Never reply to the same comment twice (check `hasSubReplies`)
- Stop immediately on captcha — do not retry
- See [Rate Limits & Safety](#rate-limits--safety) for XHS risk control thresholds

**Anti-spam guidelines:**
- Vary reply templates across batches
- Limit to 1-2 batch runs per note per day
- Prioritize quality (targeted strategy) over quantity
- Uniform timing patterns trigger bot detection — jitter is applied automatically

---

### Module L: Card Rendering

**Answers:** How do I turn markdown content into Xiaohongshu-ready image cards?

**Commands:**
```bash
# Render markdown to styled PNG cards
redbook render content.md --style xiaohongshu

# Custom style and output directory
redbook render content.md --style dark --output-dir ./cards

# JSON output (for programmatic use)
redbook render content.md --json
```

**Input:** Markdown file with YAML frontmatter:
```markdown
---
emoji: "🚀"
title: "5个AI效率技巧"
subtitle: "Claude Code 实战"
---

## 技巧一：...
Content here...

---

## 技巧二：...
More content...
```

**Output:** `cover.png` + `card_1.png`, `card_2.png`, ... in the same directory.

**Card specs:**
- **Size:** 1080×1440 (3:4 ratio, standard XHS image)
- **DPR:** 2 (retina quality, actual output 2160×2880)
- **Styles:** purple, xiaohongshu, mint, sunset, ocean, elegant, dark

**Pagination modes:**
- `auto` (default) — smart split on heading/paragraph boundaries using character-count heuristic
- `separator` — manual split on `---` in markdown

**How to interpret:**
- Uses the user's existing Chrome for rendering (via `puppeteer-core`) — no browser download needed
- Purely offline — no XHS API or cookies required
- Output images are ready for `redbook post --images cover.png card_1.png ...`

**Dependencies:** Requires `puppeteer-core` and `marked` (optional, install with `npm install -g puppeteer-core marked`).

**Composition with other modules:**
- Pairs with Module H (Content Brainstorm) — generate content ideas, write markdown, render to cards
- Pairs with Module J (Viral Replication) — extract template, write content matching the template, render
- Output feeds into `redbook post --images` for publishing

---

### Module M: Note Health Check (限流检测)

**Answers:** Are any of my notes being secretly rate-limited by XHS?

XHS assigns a hidden `level` field to each note in the creator backend API. This level controls recommendation distribution but is **never shown in the UI**. Your note may look "normal" while secretly receiving zero recommendations.

**Commands:**
```bash
# Check all notes (first page)
redbook health

# Check all pages
redbook health --all

# JSON output for programmatic use
redbook health --all --json
```

**Level definitions:**

| Level | Status | Meaning |
|-------|--------|---------|
| 4 | 🟢 Normal | Full recommendation distribution |
| 2-3 | 🟡 Baseline | Basically normal, minor constraints |
| 1 | ⚪ New | Under review (new post) |
| -1 | 🔴 Soft limit | Mild throttling, decreased recommendations |
| -5 to -101 | 🔴 Moderate | Moderate throttling, minimal promotion |
| -102 | ⛔ Severe | Irreversible — must delete and repost |

**Additional checks:**
- **Sensitive word detection** — flags titles containing automation/AI keywords (自动化, AI生成, 批量, etc.)
- **Tag count warning** — flags notes with >5 hashtags (risk factor)

**How to interpret:**
- Level -1 or below = your note is being throttled. Consider editing or deleting + reposting.
- Level -102 = irreversible. Delete the note and create fresh content.
- Sensitive word hits = risky title keywords that may trigger throttling. Rephrase.
- Excessive tags = potential spam signal. Use 3-5 targeted tags.

**Output:** Terminal dashboard with color-coded distribution summary, limited notes list, and risk factor warnings.

**Discovery credit:** [@xxx111god](https://x.com/xxx111god) — [xhs-note-health-checker](https://github.com/jzOcb/xhs-note-health-checker)

---

## Composed Workflows

Combine modules for different analysis depths.

### Quick Topic Scan (~5 min)
**Modules:** A → C → F

Search 3–5 keywords, classify engagement type, rank opportunities. Good for quickly validating whether a niche is worth deeper research.

### Content Planning
**Modules:** A → B → E → F → H

Build keyword matrix, map topic × scene intersections, check content form performance, score opportunities, brainstorm specific content ideas.

### Creator Competitive Analysis
**Modules:** A → D

Find who dominates a niche and study their content strategy, posting frequency, and engagement patterns.

### Full Niche Analysis
**Modules:** A → B → C → D → E → F → G → H

The comprehensive playbook — keyword landscape, cross-topic heatmap, engagement signals, creator profiles, content form analysis, opportunity scoring, audience personas, and data-backed content ideas.

### Single Note Deep-Dive
**Command:** `redbook analyze-viral "<url>" --json`

No module composition needed — `analyze-viral` returns hook analysis, engagement ratios, comment themes, author baseline comparison, and a 0-100 viral score in one call.

### Viral Pattern Research → Content Template
```bash
# 1. Find top notes
redbook search "keyword" --sort popular --json

# 2. Extract template from top 3 notes (replaces manual synthesis)
redbook viral-template "<url1>" "<url2>" "<url3>" --json
```

`viral-template` automates what previously required manual synthesis across `analyze-viral` results. It outputs a `ContentTemplate` JSON that captures dominant hooks, body structure ranges, engagement profile, and audience signals.

### Reply Management
**Modules:** I

Single-module workflow for managing comment engagement on your notes. Use `batch-reply --dry-run` to audit, then execute with a template.

### Content Replication
**Modules:** A → J → H → L

Keyword research → viral template extraction → data-backed content brainstorm → render to image cards. The template provides structural constraints that guide Module H's content ideas. Module L renders the final markdown to XHS-ready PNGs.

### Content Creation End-to-End
**Modules:** A → J → H → L → `post`

The full pipeline: research keywords → extract viral template → brainstorm content → write markdown → render to styled image cards → publish via `redbook post --images cover.png card_1.png ...`

### Account Health Monitoring
**Modules:** M

Run `redbook health --all` periodically to catch throttled notes early. If level drops below 1, investigate the note's content for policy violations. Combine with Module I to check if throttled notes still have unanswered comments worth replying to.

### Full Operations
**Modules:** A → C → I → J → K → M

Comprehensive automation playbook — keyword analysis, engagement classification, comment operations, viral replication templates, and engagement automation workflow.

---

## Rate Limits & Safety

XHS enforces aggressive anti-spam (风控) that detects automated behavior through device fingerprinting, activity ratio monitoring, and timing pattern analysis. The CLI applies safe defaults based on platform research.

### Safe Thresholds

| Action | Safe Interval | CLI Default | Hard Cap |
|--------|--------------|-------------|----------|
| Post a note | 3-4 hours (2-3 notes/day max) | N/A (manual) | — |
| Comment | ≥3 minutes | N/A (manual) | — |
| Reply | ≥3 minutes | N/A (manual) | — |
| Batch reply delay | ≥3 minutes | 5 min ±30% jitter | — |
| Batch reply count | — | 10 | 30 |

### Anti-Detection Measures

- **Timing jitter:** ±30% random variation on all batch delays. Uniform intervals are a bot signature.
- **Hard caps:** Maximum 30 replies per batch (down from 50). No override.
- **Rate limit warnings:** `post`, `comment`, and `reply` commands display safe interval reminders after each action.
- **Captcha circuit breaker:** Batch operations stop immediately on captcha (NeedVerify).

### What Triggers Risk Control

- **Uniform timing** — replying at exact 3-second intervals flags bot detection
- **High frequency** — >50 interactions/minute across any action type
- **Activity ratio anomaly** — more comments than post views signals inauthentic behavior
- **Device fingerprint mismatch** — XHS fingerprints 21 hardware parameters

### Best Practices for Agents

1. Always `--dry-run` first, review candidates, then execute
2. Use the default 5-minute delay — do not override `--delay` below 180000 (3 min)
3. Limit batch runs to 1-2 per note per day
4. Vary reply templates between batches
5. Space `post` commands 3-4 hours apart (2-3 notes/day maximum)

---

## Research Loop — Rate-Limit-Safe Long-Running Research

The [Rate Limits & Safety](#rate-limits--safety) section above paces *writes*. This section paces **reads** — the part research actually hammers. `read`, `comments`, and `analyze-viral` each hit the note-detail API (with `xsec_token`); fire 30–50 in a tight loop and XHS returns `NeedVerify` / captcha or IP-blocks you (300012), and a tripped account stays degraded for **hours**. So research here is **paced, not parallel**: one note in flight, spaced to look like a human reading rather than a script scraping.

The mechanism is a **file-based loop**: a queue of work items on disk, one item processed per "tick", every result checkpointed immediately. Because all state lives in files, the loop is **resumable and survives the session ending** — a fresh session (or a Push heartbeat) picks up exactly where the last left off. Pairs with the `/checkpoint-research` skill for the synthesis step.

### Pace — the safe band (why these numbers)

These are calibrated to XHS's documented read-side safe band, not guesswork. Community crawlers ([MediaCrawler](https://github.com/NanmiCoder/MediaCrawler)) default to **~2 s/request, single-threaded** (`CRAWLER_MAX_SLEEP_SEC = 2`, `MAX_CONCURRENCY_NUM = 1`); reverse-engineering write-ups put the "looks-human" frequency at **3–8 s/request** and the per-IP ceiling at **≤5 requests/min** (~12 s average). This skill runs on your **real logged-in cookies + residential IP + real Chrome fingerprint** — the *lowest*-detection profile (the thing scrapers spend most of their effort faking). So the binding risk isn't request signature, it's **behavioral**: a human doesn't open 100 note-detail pages in two minutes. We therefore pace to a human reading cadence — comfortably inside the safe band — rather than to the absolute minimum. (5-minute gaps, an earlier guess, are ~25× slower than the ceiling and buy nothing.)

### The real rule: behave like a human reading (not "go slow")

Detection here is **distributional, not a rate threshold.** XHS doesn't ask "more than N requests?" — it models what a human session looks like and flags the *unlikely* ones. Pure speed isn't the tell; the **shape** of the behavior is. Three things give a script away:

- **Timing micro-structure.** A human's gaps between actions are high-variance and heavy-tailed (2 s, then 40 s, then 5 min — they read, scroll, get distracted). A script emits a tight, low-variance stream. *Three distinct searches in five seconds has near-zero variance and is faster than a person can read a result page* — that single fact is a stronger signal than the total count.
- **Session macro-structure.** Humans browse depth-first: search → open a note → dwell → open a related note → wander. A scrape is breadth-first enumeration: search A, search B, search C… never clicking in, never dwelling. A keyword list run top-to-bottom *is* the signature.
- **Action composition.** Real sessions mix likes, collects, dwell, scroll, video-watch. A research run is 100% read with zero dwell and zero engagement — an impossible ratio for a person.

So the rule is **not "go slow."** It's **make the session indistinguishable from a person reading**: human-shaped *variance* (jitter + the occasional long pause, not merely a bigger constant), one note at a time *with dwell*, depth over breadth, a ceiling because people don't open hundreds of things, and **stop at the first sign of friction** (a human who hits a captcha backs off; a bot retries — so the circuit breaker is itself human-like behavior).

**Safety-first is the *more* agentic posture, not the timid one.** An agent's real advantage isn't speed — it's *patience at scale*: it can run a human-shaped loop for eight hours, which no person will. Aggression imitates the one human trait that gets you caught (impatience) and wastes the one the agent uniquely has (tireless patience). Lean into the patience.

**This is a pattern, not a blacklist.** The numbers here were calibrated from a real incident — a beverage-trend sweep that fired *3 distinct searches in ~5 seconds* across ~17 unrelated keywords and drew an account-level warning. What's encoded is the *behavioral invariant* (human-shaped timing, one-in-flight, ceiling, dwell, breaker), **not** "don't run those queries." It generalizes to any topic and any platform. The incident is the calibration sample that tells us where the human/bot line sits — not a rule about matcha.

### Three modes

| Mode | Pace per note | ~Reads/min | Use when | Gate |
|------|--------------|-----------|----------|------|
| 🚶 **Steady (default)** | **20 s ± 50% jitter** (≈10–35 s) | ~2–3 | All routine / multi-note research | **None — this is the default.** |
| 🐢 **Deep / overnight** | 60–120 s | ~0.5–1 | Very large corpora, or minimizing footprint | Opt in for big jobs |
| ⚡ **Fast (emergency)** | **5 s ± jitter floor**, max 30-note burst then cooldown | ~10+ (over the safe ceiling) | A genuine deadline that cannot wait | MUST print the [fast-mode warning](#-fast-mode-warning-emergency-only) verbatim **and** get explicit user opt-in |

**Invariants (all modes):** never zero-delay, never parallel, exactly one note in flight, and — except for warned Fast mode — **never exceed ~5 reads/min sustained.** At the Steady pace a 100-note queue finishes in ~35–50 min; only very large queues or Deep mode stretch toward end-of-day.

### Strict rules (non-negotiable)

1. **The loop is mandatory; Steady is the default pace.** Any research touching more than ~5 notes runs through the loop at Steady pace. Deep/overnight and especially Fast are explicit opt-ins — Fast additionally requires the printed warning + user confirmation.
2. **One note in flight.** Never batch or parallelize reads. No `for url in …; do redbook read …; done` without the inter-item delay. No background `&` fan-out. (`MAX_CONCURRENCY = 1`, like the reference crawlers.)
3. **Stay under ~5 reads/min, always jittered.** The per-IP safe ceiling is ~5 requests/min (~12 s/note); Steady (20 s) sits comfortably under it. Apply ±50% random jitter to every wait — uniform intervals are a bot signature. Only warned Fast mode may cross the ceiling.
4. **Cap comment pagination.** Comment / sub-comment reads are the highest-risk endpoint — they trip 风控 first (deep comment crawls fail even at very long sleeps). Keep `--comment-pages ≤ 3`, count each comment page against the pace + budget like any other read, and never deep-crawl a comment thread.
5. **Checkpoint every item.** Write each result to disk and update the manifest *before* the next tick. Nothing in memory only.
6. **Respect the daily budget.** Default soft cap **~200 detail-reads/day** — anomalous *volume* is its own 风控 trigger, independent of pace. When `consumedToday >= dailyBudget`, stop until the next calendar day — do not "just finish a few more".
7. **Circuit breaker is absolute.** On the first 风控 signal (see [Circuit breaker](#circuit-breaker)), STOP the entire loop, persist state, surface to the user, and **do not auto-retry through it.** Resume only on an explicit human "resume".
8. **Reads, not writes.** This loop is for reading/analysis only. Engagement actions (comment/reply/like) keep their own [write-side limits](#rate-limits--safety) and are never folded into a research tick.

### State contract (resumable, survives session death)

All state lives under one job directory — default `research/xhs/<job-slug>/` in the **private content repo** (ask if unclear which repo):

| File | Role |
|------|------|
| `queue.jsonl` | The work queue, one item per line: `{ "id": "001", "kind": "read\|comments\|analyze-viral\|search\|user\|user-posts", "arg": "<url-or-keyword-or-userId>", "status": "pending\|done\|error", "note": "" }` |
| `results/<id>.json` | Raw `--json` output for each processed item (the corpus) |
| `loop-state.json` | `{ "mode": "steady\|deep\|fast", "intervalSec": 20, "jitterPct": 50, "dailyBudget": 200, "consumedToday": 0, "budgetDate": "YYYY-MM-DD", "lastTickAt": "<iso>", "breaker": "ok\|tripped", "breakerReason": null }` (Deep: `intervalSec` 60–120; Fast: `intervalSec` 5 + `mode:"fast"`) |
| `manifest.md` | Human-readable plan + progress (checkmark per done item) — the recovery checkpoint, updated every tick |
| `SUMMARY.md` | Final synthesis, written once the queue drains |

**Seeding the queue:** the cheap list endpoints (`search`, `feed`, `user-posts` — no `xsec_token` cost) are how you *build* the queue, not part of the paced loop. Run a `search`/`feed` up front, extract each `webUrl`, and write one `read`/`analyze-viral` item per note into `queue.jsonl`. Then the loop drains the expensive detail-reads at the Steady pace. Always carry the fresh `webUrl` (with token) as the item `arg` — tokens expire, so don't queue bare noteIds (see [xsec_token](#xsec_token--required-for-reading--sharing-notes)).

### One tick = one note

A tick is the unit both drivers call. It processes exactly one item and stops:

1. **Load `loop-state.json`.** If `breaker != "ok"` → exit immediately (surface the reason; do not process).
2. **Roll the daily budget.** If `budgetDate` != today, reset `consumedToday = 0`, `budgetDate = today`. If `consumedToday >= dailyBudget` → exit until tomorrow.
3. **Pop the next `pending` item** from `queue.jsonl`. If none remain → **finalize**: synthesize `SUMMARY.md` from `results/`, mark the loop complete, and tell the driver to stop. Done.
4. **Run exactly one read:** `redbook <kind> "<arg>" --json`.
5. **Inspect the result for a 风控 signal** (empty `{}`, `NeedVerify`/captcha, `Session expired`, IP block 300012). If found → **trip the breaker**: set `breaker:"tripped"` + `breakerReason`, leave the item `pending` (not consumed), persist, surface to the user, STOP. (See [Circuit breaker](#circuit-breaker).)
6. **On success:** write `results/<id>.json`, set the item `status:"done"`, check it off in `manifest.md`, `consumedToday += 1`, set `lastTickAt`.
7. **Stop.** One note only — the driver re-invokes after the (jittered) interval.

### Drivers — keeping the loop running in the background

The same tick, driven two ways. Pick by how long the job must outlive the current session:

**A) In-session pacing (default — Steady).** The simplest driver and the right one for most jobs: run ticks back-to-back inside one session, sleeping `intervalSec` ± jitter between each read. At Steady pace a 100-note queue finishes in ~35–50 min — comfortably within one session — and every item is checkpointed, so a crash just resumes. No scheduler needed. (Pace *per read*; don't fake it with one long blocking `sleep`.)

**B) `/loop` self-paced (Deep / overnight / survives idle gaps).** For Deep mode or jobs spanning hours, drive ticks with `/loop` *without* an interval (self-paced): do one tick, then `ScheduleWakeup` for `intervalSec` + jitter, and re-fire. `ScheduleWakeup` clamps to **≥60 s**, so it fits Deep (60–120 s) — not sub-minute Steady (run that in-session, per A). The loop ends itself when the queue drains (Step 3) or the breaker trips (Step 5).

**C) Hook — Push recurring issue (multi-day / true background, survives app restarts).** Best for "run this every day" research or corpora too big for one day. Create a **recurring issue** (`recurringIntervalSec` — a few minutes per tick, or a daily sweep) assigned to a redbook-capable agent. Each occurrence is a **fresh session = one tick** against the same job directory — so the issue body must point at the job dir and say "run exactly one tick, then exit." It keeps firing until a human retires it; the agent finalizes + comments when the queue drains, and comments + leaves it for human attention if the breaker trips. (Push "scout" pattern — the schedule lives on the issue, the agent's Auto switch gates it.)

> **Why file-state, not a long-lived process:** a single blocking `sleep`-loop dies with the terminal and can't be resumed. The queue + `loop-state.json` + per-item result files mean *any* future session — `/loop` wake, Push heartbeat, or a human re-running the tick — continues exactly where the last stopped, and the partial corpus is never lost.

### ⚡ Fast-mode warning (emergency only)

Before **any** fast-mode run, print this verbatim and require an explicit "yes, fast mode" from the user. Do not proceed on silence or a vague affirmative:

```
⚠️  XHS FAST RESEARCH MODE — elevated 风控 risk
    Reading at ~12 notes/min crosses the safe ~5/min ceiling and
    materially raises the chance of:
      • captcha / NeedVerify mid-run (stops the loop)
      • IP block (error 300012) for hours
      • account-level recommendation throttling
    Steady mode (the default, ~20s/note) stays inside the safe band
    and still finishes a typical job in well under an hour.
    Proceed with fast mode for this run only? (yes / no)
```

Fast mode still obeys the floor (≥5 s ± jitter between notes — never zero), caps a burst at 30 notes then forces a cooldown back to Steady pace, and the circuit breaker still hard-stops on the first 风控 signal. Fast mode raises the *pace* past the safe ceiling; it never removes the floor or the breaker.

### Circuit breaker

Trip the breaker and STOP the whole loop on the **first** of any of these from a read:

| Signal | Where it shows |
|--------|----------------|
| `NeedVerify` / captcha | error message or response flag |
| Empty `{}` response | usually expired/invalid `xsec_token` or anti-scrape — re-seed the queue with fresh `webUrl`s, don't retry blindly |
| `Session expired` / "No 'a1' cookie" | cookie invalid — re-login in Chrome before resuming |
| IP block `300012` | hard rate limit — wait it out / switch network |

On trip: set `loop-state.breaker:"tripped"` + `breakerReason`, leave the current item `pending`, persist, and surface to the user (or comment on the Push issue). **Never auto-retry through a block** — that's what escalates a soft throttle into a multi-hour block. Resume only after a human clears the cause and explicitly says to continue.

---

## API vs Browser Limitations

The following operations work reliably via API:
- **Reading**: search, notes, comments, user profiles, feed, favorites
- **Writing**: top-level comments, comment replies, collect/uncollect notes
- **Analysis**: viral scoring, template extraction, batch reply planning

The following operations are unreliable via API (frequently trigger captcha):
- Publishing notes (use `--private` for higher success rate)
- Bulk operations at very high frequency

The following operations require browser automation (not supported by this CLI):
- Captcha solving, real-time notifications
- Like/follow (heavy anti-automation enforcement)
- DM/private messaging
- Cover image generation (use external tools like Gemini/DALL-E)

---

## Command Details

### `redbook search <keyword>`

Search for notes by keyword. Returns note titles, URLs, likes, author info.

```bash
redbook search "Claude Code教程" --json
redbook search "AI编程" --sort popular --json        # Sort: general, popular, latest
redbook search "Cursor" --type image --json           # Type: all, video, image
redbook search "MCP Server" --page 2 --json           # Pagination
```

**Options:**
- `--sort <type>`: `general` (default), `popular`, `latest`
- `--type <type>`: `all` (default), `video`, `image`
- `--page <n>`: Page number (default: 1)

### `redbook read <url>`

Read a note's full content — title, body text, images, likes, comments count.

```bash
redbook read "https://www.xiaohongshu.com/explore/abc123" --json
```

Accepts full URLs or short note IDs. Falls back to HTML scraping if API returns captcha.

### `redbook comments <url>`

Get comments on a note. Use `--all` to fetch all pages.

```bash
redbook comments "https://www.xiaohongshu.com/explore/abc123" --json
redbook comments "https://www.xiaohongshu.com/explore/abc123" --all --json
```

### `redbook user <userId>`

Get a creator's profile — nickname, bio, follower count, note count, likes received.

```bash
redbook user "5a1234567890abcdef012345" --json
```

The userId is the hex string from the creator's profile URL.

### `redbook user-posts <userId>`

List all notes posted by a creator. Returns titles, URLs, likes, timestamps.

```bash
redbook user-posts "5a1234567890abcdef012345" --json
```

### `redbook feed`

Browse the recommendation feed.

```bash
redbook feed --json
```

### `redbook topics <keyword>`

Search for topic hashtags. Useful for finding trending topics to attach to posts.

```bash
redbook topics "Claude Code" --json
```

### `redbook favorites [userId]`

List a user's collected (bookmarked) notes. Defaults to the current logged-in user when no userId is provided.

```bash
redbook favorites --json                        # Your own favorites
redbook favorites "5a1234567890abcdef" --json   # Another user's favorites
redbook favorites --all --json                  # Fetch all pages
```

**Options:**
- `--all`: Fetch all pages of favorites (default: first page only)

**Note:** Other users' favorites are only visible if they haven't set their collection to private.

### `redbook collect <url>`

Collect (bookmark) a note to your favorites.

```bash
redbook collect "https://www.xiaohongshu.com/explore/abc123"
```

### `redbook uncollect <url>`

Remove a note from your collection.

```bash
redbook uncollect "https://www.xiaohongshu.com/explore/abc123"
```

### `redbook analyze-viral <url>`

Analyze why a viral note works. Returns a deterministic viral score (0–100).

```bash
redbook analyze-viral "https://www.xiaohongshu.com/explore/abc123" --json
redbook analyze-viral "https://www.xiaohongshu.com/explore/abc123" --comment-pages 5
```

**Options:**
- `--comment-pages <n>`: Comment pages to fetch (default: 3, max: 10)

**JSON output structure:**
Returns `{ note, score, hook, content, visual, engagement, comments, relative, fetchedAt }`.

- `score.overall` (0–100) — composite of hook (20) + engagement (20) + relative (20) + content (20) + comments (20)
- `hook.hookPatterns[]` — detected title patterns (Identity Hook, Emotion Word, Number Hook, Question, etc.)
- `engagement` — likes, comments, collects, shares + ratios (collectToLikeRatio, commentToLikeRatio, shareToLikeRatio)
- `relative.viralMultiplier` — this note's likes / author's median likes
- `relative.isOutlier` — true if viralMultiplier > 3
- `comments.themes[]` — top recurring keyword phrases from comments

### `redbook viral-template <url> [url2] [url3]`

Extract a reusable content template from 1-3 viral notes. Analyzes each note (same pipeline as `analyze-viral`) and synthesizes common structural patterns.

```bash
redbook viral-template "<url1>" "<url2>" "<url3>" --json
redbook viral-template "<url1>" --comment-pages 5 --json
```

**Options:**
- `--comment-pages <n>`: Comment pages to fetch per note (default: 3, max: 10)

**JSON output structure:**
Returns `{ dominantHookPatterns, titleStructure, bodyStructure, engagementProfile, audienceSignals, sourceNotes, generatedAt }`.

- `dominantHookPatterns[]` — hook types appearing in majority of input notes
- `titleStructure.avgLength` — average title length across notes
- `bodyStructure.lengthRange` — [min, max] body length
- `engagementProfile.type` — "reference" / "insight" / "entertainment"
- `audienceSignals.commonThemes[]` — merged comment themes across notes

### `redbook comment <url>`

Post a top-level comment on a note.

```bash
redbook comment "<noteUrl>" --content "Great post!" --json
```

**Options:**
- `--content <text>` (required): Comment text

### `redbook reply <url>`

Reply to a specific comment on a note.

```bash
redbook reply "<noteUrl>" --comment-id "<commentId>" --content "Thanks for asking!" --json
```

**Options:**
- `--comment-id <id>` (required): Comment ID to reply to (from `comments --json` output)
- `--content <text>` (required): Reply text

### `redbook batch-reply <url>`

Reply to multiple comments using a filtering strategy. Always preview with `--dry-run` first.

```bash
# Preview which comments match the strategy
redbook batch-reply "<noteUrl>" --strategy questions --dry-run --json

# Execute replies with a template (default 5 min delay with jitter)
redbook batch-reply "<noteUrl>" --strategy questions \
  --template "感谢提问！{content}" --max 10
```

**Options:**
- `--strategy <name>`: `questions` (default), `top-engaged`, `all-unanswered`
- `--template <text>`: Reply template with `{author}`, `{content}` placeholders
- `--max <n>`: Max replies (default: 10, hard cap: 30)
- `--delay <ms>`: Delay between replies in ms (default: 300000 / 5 min, min: 180000 / 3 min). ±30% random jitter applied automatically.
- `--dry-run`: Preview candidates without posting (default when no template)

**Safety:** Stops immediately on captcha. No template = dry-run only. Delays include random jitter to avoid uniform timing patterns that trigger XHS bot detection.

### `redbook render <file>`

Render a markdown file with YAML frontmatter into styled PNG image cards. Uses the user's existing Chrome installation — no browser download needed.

```bash
redbook render content.md --style xiaohongshu
redbook render content.md --style dark --output-dir ./cards
redbook render content.md --pagination separator --json
```

**Options:**
- `--style <name>`: `purple`, `xiaohongshu` (default), `mint`, `sunset`, `ocean`, `elegant`, `dark`
- `--pagination <mode>`: `auto` (default), `separator` (split on `---`)
- `--output-dir <dir>`: Output directory (default: same as input file)
- `--width <n>`: Card width in px (default: 1080)
- `--height <n>`: Card height in px (default: 1440)
- `--dpr <n>`: Device pixel ratio (default: 2)

**Requires:** `puppeteer-core` and `marked` (`npm install -g puppeteer-core marked`). Does NOT require XHS cookies — purely offline rendering.

**Override Chrome path:** Set `CHROME_PATH` environment variable if Chrome is not in the standard location.

### `redbook whoami`

Check connection status. Verifies cookies are valid and shows the logged-in user.

```bash
redbook whoami
```

### `redbook post` (Limited)

Publish an image note. **Frequently triggers captcha (type=124) on the creator API.** Image upload works, but the publish step is unreliable. For posting, consider using browser automation instead.

```bash
redbook post --title "标题" --body "正文" --images cover.png --json
redbook post --title "测试" --body "..." --images img.png --private --json
```

**Options:**
- `--title <title>`: Note title (required)
- `--body <body>`: Note body text (required)
- `--images <paths...>`: Image file paths (required, at least one)
- `--topic <keyword>`: Search and attach a topic hashtag
- `--private`: Publish as private note

### Global Options

All commands accept:
- `--cookie-source <browser>`: `chrome` (default), `safari`, `firefox`
- `--chrome-profile <name>`: Chrome profile directory name (e.g., "Profile 1"). Auto-discovered if omitted.
- `--json`: Output as JSON

---

## Technical Reference

### xsec_token — Required for Reading & Sharing Notes

The XHS API requires a valid `xsec_token` to fetch note content. Without it, `read`, `comments`, and `analyze-viral` return `{}`.

**The same token is also required for shareable URLs.** Any `https://www.xiaohongshu.com/explore/<id>` URL without `?xsec_token=...&xsec_source=...` is 302-redirected by XHS's anti-scrape layer to `https://www.xiaohongshu.com/404/sec_*?source=xhs_sec_server&originalUrl=...`. This affects anyone who clicks the URL — Safari, iOS link previews, agent action buttons, etc.

**`webUrl` — use this (since v0.7.0):**

Every note-returning command (`feed`, `search`, `user-posts`, `favorites`, `board`, `read`, `post`) now includes a `webUrl` field with the token baked in and the correct `xsec_source`. Consumers should use `webUrl` directly — do not construct URLs by hand.

```bash
redbook feed --json | jq '.items[0].webUrl'
# => "https://www.xiaohongshu.com/explore/<id>?xsec_token=<t>&xsec_source=pc_feed"
```

`xsec_source` is set per-command: `pc_feed`, `pc_search`, `pc_user`, `pc_board`, `pc_share`.

**Key rules:**

1. **Tokens expire.** A URL with `?xsec_token=...` from a previous session will return `{}`. Never cache or reuse old URLs.
2. **`search` and `feed` always return fresh tokens.** Every item includes a valid `xsec_token` + a pre-built `webUrl`.
3. **noteId alone returns `{}`.** Running `redbook read <noteId>` without a token almost always fails.

**The correct workflow — always search first:**

```bash
# WRONG — stale URL or bare noteId, will likely return {}
redbook read "689da7b0000000001b0372c6" --json
redbook read "https://www.xiaohongshu.com/explore/689da7b0?xsec_token=OLD_TOKEN" --json

# RIGHT — search first, then use the fresh URL with token
redbook search "AI编程" --sort popular --json
# Extract the webUrl from search results, then:
redbook read "<webUrl from search result>" --json
```

**For agents:** Prefer `webUrl` from the response. When only a bare noteId is available, search first to obtain a fresh token, then use the returned `webUrl`.

**Commands that need xsec_token:** `read`, `comments`, `analyze-viral`
**Commands that do NOT need xsec_token:** `search`, `user`, `user-posts`, `feed`, `whoami`, `topics`

### Chinese Number Formats in API Responses

The XHS API returns abbreviated numbers with Chinese unit suffixes:

| API value | Actual number |
|-----------|---------------|
| `"1.5万"` | 15,000 |
| `"2.4万"` | 24,000 |
| `"1.2亿"` | 120,000,000 |
| `"115"` | 115 |

`万` = ×10,000. `亿` = ×100,000,000. Numbers under 10,000 are plain integers as strings.

The `analyze-viral` command handles this automatically. When parsing `--json` output manually, watch for these suffixes in `interact_info` fields (`liked_count`, `collected_count`, etc.).

### Error Handling

| Error | Meaning | Fix |
|-------|---------|-----|
| `{}` empty response | Missing or expired xsec_token | Search first to get a fresh token |
| "No 'a1' cookie" | Not logged into XHS in browser | Log into xiaohongshu.com in Chrome |
| "Session expired" | Cookie too old | Re-login in Chrome |
| "NeedVerify" / captcha | Anti-bot triggered | Wait and retry, or reduce request frequency |
| "IP blocked" (300012) | Rate limited | Wait or switch network |

---

## Output Format Guidance

When producing analysis reports, use these formats:

**Data tables:** Markdown tables with exact field mappings. Always include the metric unit.

**Heatmaps:** ASCII bar charts for cross-topic comparison:
```
             职场    生活    教育    创业
AI编程       ████ 8K  ██ 2K   ████ 12K ░░ 200
Claude Code  ██ 3K    ░░ 100  ██ 4K    █ 1K
```

**Creator comparison:** Structured table with both quantitative metrics and qualitative style assessment.

**Final reports:** Use this section order:
1. Market Overview (demand signals, content velocity)
2. Keyword Landscape (engagement matrix, opportunity tiers)
3. Cross-Topic Heatmap (topic × scene intersections)
4. Audience Persona (demographics, intent, preferences)
5. Competitive Landscape (creator profiles, strategy patterns)
6. Content Opportunities (tiered recommendations with data backing)
7. Content Ideas (specific hooks, angles, targets)

## Programmatic API

```typescript
import { XhsClient } from "@lucasygu/redbook";
import { loadCookies } from "@lucasygu/redbook/cookies";

const cookies = await loadCookies("chrome");
const client = new XhsClient(cookies);

const results = await client.searchNotes("AI编程", 1, 20, "popular");
const topics = await client.searchTopics("Claude Code");
```

## Requirements

- Node.js >= 22
- Logged into xiaohongshu.com in Chrome (or Safari/Firefox with `--cookie-source`)
- macOS (cookie extraction uses native keychain access)
- **For card rendering only:** `puppeteer-core` and `marked` (`npm install -g puppeteer-core marked`). Uses your existing Chrome — no additional browser download.
