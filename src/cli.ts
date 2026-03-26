#!/usr/bin/env node

/**
 * redbook CLI — Xiaohongshu (Red Note) from the command line
 *
 * Usage:
 *   redbook whoami --cookie-source chrome
 *   redbook search "Claude Code" --cookie-source chrome --json
 *   redbook read <url> --cookie-source chrome --json
 *   redbook comments <url> --cookie-source chrome --json
 *   redbook user <user-id> --cookie-source chrome --json
 *   redbook user-posts <user-id> --cookie-source chrome --json
 *   redbook feed --cookie-source chrome --json
 *   redbook post --title "..." --body "..." --images img1.jpg --cookie-source chrome
 *   redbook topics "keyword" --cookie-source chrome
 *   redbook favorites --cookie-source chrome --json
 *   redbook collect <url> --cookie-source chrome
 *   redbook uncollect <url> --cookie-source chrome
 *   redbook like <url> --cookie-source chrome
 *   redbook like <url> --undo --cookie-source chrome
 *   redbook followers <user-id> --cookie-source chrome --json
 *   redbook following <user-id> --cookie-source chrome --json
 *   redbook delete <url> --cookie-source chrome
 *   redbook health --cookie-source chrome --json
 *   redbook board <board-url> --cookie-source chrome --json
 */

import { Command } from "commander";
import kleur from "kleur";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractCookies, parseCookieString, type CookieSource } from "./lib/cookies.js";
import { XhsClient, XhsApiError } from "./lib/client.js";
import { analyzeViral, formatViralAnalysis } from "./lib/analyze.js";
import {
  selectCandidates,
  executeReplies,
  DEFAULT_DELAY_MS,
  MIN_DELAY_MS as MIN_REPLY_DELAY,
  MAX_REPLIES_HARD_CAP,
  type StrategyName,
} from "./lib/reply-strategy.js";
import { extractTemplate, formatTemplate } from "./lib/template.js";
import { buildHealthReport, type NoteDiagnostics } from "./lib/health.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const program = new Command();

program
  .name("redbook")
  .description("CLI tool for Xiaohongshu (Red Note)")
  .version(pkg.version);

// Global option for cookie source
function addCookieOption(cmd: Command): Command {
  return cmd
    .option(
      "--cookie-source <browser>",
      "Browser to read cookies from (chrome, safari, firefox)",
      "chrome"
    )
    .option(
      "--chrome-profile <name>",
      'Chrome profile directory name (e.g., "Profile 1")'
    )
    .option(
      "--cookie-string <cookies>",
      'Manual cookie string: "a1=VALUE; web_session=VALUE" (from Chrome DevTools)'
    );
}

function addJsonOption(cmd: Command): Command {
  return cmd.option("--json", "Output as JSON");
}

function loadEnvFile(): void {
  // Walk up from cwd looking for .env (stops at filesystem root)
  let dir = process.cwd();
  while (true) {
    const envPath = join(dir, ".env");
    if (existsSync(envPath)) {
      const lines = readFileSync(envPath, "utf-8").split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (key && !(key in process.env)) {
          process.env[key] = value;
        }
      }
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return; // reached root
    dir = parent;
  }
}

async function getClient(cookieSource: string, chromeProfile?: string, cookieString?: string): Promise<XhsClient> {
  if (cookieString) {
    const cookies = parseCookieString(cookieString);
    if (!cookies.a1 || !cookies.web_session) {
      console.error(kleur.red(
        "Cookie string must contain at least 'a1' and 'web_session'. " +
        "Copy them from Chrome DevTools > Application > Cookies > xiaohongshu.com"
      ));
      process.exit(1);
    }
    console.error(kleur.dim("Using manual cookie string."));
    return new XhsClient(cookies);
  }

  // Try env vars (from .env or shell environment)
  loadEnvFile();
  const envA1 = process.env.XHS_COOKIE_A1;
  const envSession = process.env.XHS_COOKIE_WEB_SESSION;
  if (envA1 && envSession) {
    const cookies = parseCookieString(`a1=${envA1}; web_session=${envSession}`);
    console.error(kleur.dim("Using cookies from environment variables (XHS_COOKIE_A1 + XHS_COOKIE_WEB_SESSION)."));
    return new XhsClient(cookies);
  }

  const cookies = await extractCookies(cookieSource as CookieSource, chromeProfile);
  return new XhsClient(cookies);
}

function output(data: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

function handleError(err: unknown): never {
  if (err instanceof XhsApiError) {
    console.error(kleur.red(`Error: ${err.message}`));
    if (err.code) console.error(kleur.dim(`Code: ${err.code}`));
  } else if (err instanceof Error) {
    console.error(kleur.red(`Error: ${err.message}`));
  } else {
    console.error(kleur.red("Unknown error"));
  }
  process.exit(1);
}

// ─── whoami ─────────────────────────────────────────────────────────────────

const whoamiCmd = program.command("whoami").description("Check connection and show current user info");
addCookieOption(whoamiCmd);
addJsonOption(whoamiCmd);

whoamiCmd.action(async (opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const info = await client.getSelfInfo();
    if (opts.json) {
      output(info, true);
    } else {
      const user = info as Record<string, unknown>;
      console.log(kleur.green("Connected to Xiaohongshu"));
      console.log(`  User: ${kleur.bold(String(user.nickname ?? user.nick_name ?? "unknown"))}`);
      console.log(`  ID:   ${user.user_id ?? "unknown"}`);
      if (user.red_id) console.log(`  RedID: ${user.red_id}`);
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── search ─────────────────────────────────────────────────────────────────

const searchCmd = program
  .command("search <keyword>")
  .description("Search notes by keyword")
  .option("--page <n>", "Page number", "1")
  .option("--sort <type>", "Sort: general, popular, latest", "general")
  .option("--type <type>", "Note type: all, video, image", "all");
addCookieOption(searchCmd);
addJsonOption(searchCmd);

searchCmd.action(async (keyword, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const sortMap: Record<string, "general" | "popularity_descending" | "time_descending"> = {
      general: "general",
      popular: "popularity_descending",
      latest: "time_descending",
    };
    const typeMap: Record<string, 0 | 1 | 2> = { all: 0, video: 1, image: 2 };

    const result = await client.searchNotes(
      keyword,
      parseInt(opts.page),
      20,
      sortMap[opts.sort] ?? "general",
      typeMap[opts.type] ?? 0
    );

    if (opts.json) {
      output(result, true);
    } else {
      const data = result as { items?: Array<{ note_card?: { title?: string; user?: { nickname?: string }; note_id?: string; interact_info?: Record<string, string> } }> };
      if (data.items) {
        for (const item of data.items) {
          const card = item.note_card;
          if (!card) continue;
          console.log(
            `${kleur.bold(card.title ?? "(no title)")} — ${kleur.dim(`@${card.user?.nickname ?? "?"}`)}` +
            `  ${kleur.cyan(card.note_id ?? "")}`
          );
          if (card.interact_info) {
            const info = card.interact_info;
            console.log(
              `  ${kleur.dim(`♥ ${info.liked_count ?? 0}  💬 ${info.comment_count ?? 0}  ⭐ ${info.collected_count ?? 0}`)}`
            );
          }
        }
      }
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── read ───────────────────────────────────────────────────────────────────

const readCmd = program
  .command("read <url>")
  .description("Read a note by URL (tries HTML fallback first)")
  .option("--api", "Force API mode (requires xsec_token in URL)");
addCookieOption(readCmd);
addJsonOption(readCmd);

readCmd.action(async (url, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const { noteId, xsecToken } = parseNoteUrl(url);

    let result: unknown;
    if (opts.api || xsecToken) {
      try {
        const feedResult = (await client.getNoteById(
          noteId,
          xsecToken ?? ""
        )) as { items?: Array<{ note_card?: unknown }> };
        result = feedResult?.items?.[0]?.note_card ?? feedResult;
      } catch {
        // Fall back to HTML
        result = await client.getNoteFromHtml(noteId, xsecToken ?? "");
      }
    } else {
      result = await client.getNoteFromHtml(noteId, xsecToken ?? "");
    }

    // Warn when result is empty and xsec_token was missing
    const isEmpty = !result || (typeof result === "object" && Object.keys(result as object).length === 0);
    if (isEmpty && !xsecToken) {
      console.error(kleur.yellow(
        "Note returned empty. This usually means the request needs an xsec_token.\n" +
        "Tip: use a full URL with xsec_token from search results or the browser, e.g.:\n" +
        `  redbook read "https://www.xiaohongshu.com/explore/${noteId}?xsec_token=TOKEN"`
      ));
    }

    if (opts.json) {
      output(result, true);
    } else {
      const note = result as Record<string, unknown>;
      console.log(kleur.bold(String(note.title ?? "(no title)")));
      console.log(kleur.dim(`by @${(note.user as Record<string, unknown>)?.nickname ?? "unknown"}`));
      console.log();
      console.log(String(note.desc ?? ""));
      if (note.interact_info) {
        const info = note.interact_info as Record<string, string>;
        console.log();
        console.log(
          `♥ ${info.liked_count ?? 0}  💬 ${info.comment_count ?? 0}  ⭐ ${info.collected_count ?? 0}  📤 ${info.share_count ?? 0}`
        );
      }
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── comments ───────────────────────────────────────────────────────────────

const commentsCmd = program
  .command("comments <url>")
  .description("Get comments on a note")
  .option("--all", "Fetch all pages of comments");
addCookieOption(commentsCmd);
addJsonOption(commentsCmd);

commentsCmd.action(async (url, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const { noteId, xsecToken } = parseNoteUrl(url);

    const allComments: unknown[] = [];
    let cursor = "";
    let hasMore = true;

    while (hasMore) {
      const res = (await client.getComments(noteId, cursor, xsecToken ?? "")) as {
        comments?: unknown[];
        has_more?: boolean;
        cursor?: string;
      };

      if (res.comments) allComments.push(...res.comments);
      hasMore = opts.all ? (res.has_more ?? false) : false;
      cursor = res.cursor ?? "";
    }

    if (opts.json) {
      output(allComments, true);
    } else {
      for (const comment of allComments) {
        const c = comment as Record<string, unknown>;
        const user = c.user_info as Record<string, unknown> | undefined;
        console.log(
          `${kleur.bold(`@${user?.nickname ?? "?"}`)} — ${String(c.content ?? "")}`
        );
        if (c.like_count) console.log(kleur.dim(`  ♥ ${c.like_count}`));
      }
      console.log(kleur.dim(`\n${allComments.length} comments`));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── user ───────────────────────────────────────────────────────────────────

const userCmd = program
  .command("user <userId>")
  .description("Get user profile info");
addCookieOption(userCmd);
addJsonOption(userCmd);

userCmd.action(async (userId, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const info = await client.getUserInfo(userId);
    output(info, opts.json ?? false);
  } catch (err) {
    handleError(err);
  }
});

// ─── user-posts ─────────────────────────────────────────────────────────────

const userPostsCmd = program
  .command("user-posts <userId>")
  .description("List a user's posted notes");
addCookieOption(userPostsCmd);
addJsonOption(userPostsCmd);
userPostsCmd.option("--cursor <cursor>", "Resume pagination from a cursor (last note_id)");
userPostsCmd.option("--all", "Fetch all pages (paginate until no more results)");
userPostsCmd.option("--delay <ms>", "Delay in ms between page fetches (default: 3000)", "3000");

userPostsCmd.action(async (userId, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);

    if (opts.all) {
      let cursor: string = opts.cursor ?? "";
      const allNotes: Array<Record<string, unknown>> = [];
      let page = 1;
      while (true) {
        const res = (await client.getUserNotes(userId, cursor)) as {
          notes?: Array<Record<string, unknown>>;
          has_more?: boolean;
          cursor?: string;
        };
        const notes = res.notes ?? [];
        allNotes.push(...notes);
        process.stderr.write(`Page ${page}: +${notes.length} notes (total: ${allNotes.length})\n`);
        if (!res.has_more || !res.cursor || notes.length === 0) break;
        cursor = res.cursor;
        page++;
        await new Promise((r) => setTimeout(r, parseInt(opts.delay)));
      }
      if (opts.json) {
        output({ notes: allNotes, total: allNotes.length }, true);
      } else {
        for (const note of allNotes) {
          console.log(
            `${kleur.bold(String(note.display_title ?? "(no title)"))}  ${kleur.dim(String(note.note_id ?? ""))}  [${String(note.type ?? "?")}]`
          );
        }
        console.log(kleur.dim(`\n${allNotes.length} notes total`));
      }
      return;
    }

    const result = await client.getUserNotes(userId, opts.cursor ?? "");
    if (opts.json) {
      output(result, true);
    } else {
      const data = result as { notes?: Array<{ display_title?: string; note_id?: string; type?: string }> };
      if (data.notes) {
        for (const note of data.notes) {
          console.log(
            `${kleur.bold(note.display_title ?? "(no title)")}  ${kleur.dim(note.note_id ?? "")}  [${note.type ?? "?"}]`
          );
        }
        console.log(kleur.dim(`\n${data.notes.length} notes`));
      }
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── feed ───────────────────────────────────────────────────────────────────

const feedCmd = program
  .command("feed")
  .description("Get homepage feed")
  .option("--category <cat>", "Feed category", "homefeed_recommend");
addCookieOption(feedCmd);
addJsonOption(feedCmd);

feedCmd.action(async (opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const result = await client.getHomeFeed(opts.category);
    output(result, opts.json ?? false);
  } catch (err) {
    handleError(err);
  }
});

// ─── post ───────────────────────────────────────────────────────────────────

const postCmd = program
  .command("post")
  .description("Publish an image note")
  .requiredOption("--title <title>", "Note title")
  .requiredOption("--body <body>", "Note body text")
  .option("--images <paths...>", "Image file paths")
  .option("--topic <keyword>", "Topic/hashtag keyword to search and attach")
  .option("--private", "Publish as private note");
addCookieOption(postCmd);
addJsonOption(postCmd);

postCmd.action(async (opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const imageFiles: string[] = opts.images ?? [];

    if (imageFiles.length === 0) {
      console.error(kleur.red("At least one image is required. Use --images <path>"));
      process.exit(1);
    }

    // Upload images
    console.log(kleur.dim("Uploading images..."));
    const fileIds: string[] = [];
    for (const filePath of imageFiles) {
      const { fileId, token } = await client.getUploadPermit("image");
      const ext = filePath.toLowerCase().split(".").pop();
      const contentType =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      await client.uploadFile(fileId, token, filePath, contentType);
      fileIds.push(fileId);
      console.log(kleur.dim(`  Uploaded: ${filePath} → ${fileId}`));
    }

    // Search for topic if specified
    let topics: Array<{ id: string; name: string; type: string }> = [];
    if (opts.topic) {
      const topicResult = (await client.searchTopics(opts.topic)) as Array<{
        id: string;
        name: string;
        type: string;
      }>;
      if (topicResult.length > 0) {
        topics = [topicResult[0]];
        console.log(kleur.dim(`  Topic: #${topicResult[0].name}`));
      }
    }

    // Create the note
    console.log(kleur.dim("Publishing note..."));
    const result = await client.createImageNote(opts.title, opts.body, fileIds, {
      topics,
      isPrivate: opts.private ?? false,
    });

    if (opts.json) {
      output(result, true);
    } else {
      console.log(kleur.green("Note published!"));
      const r = result as Record<string, unknown>;
      if (r.note_id) {
        console.log(`  URL: https://www.xiaohongshu.com/explore/${r.note_id}`);
      }
      console.error(kleur.yellow("⚠ Rate limit: wait ≥3-4 hours before the next post (2-3 notes/day max)."));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── topics ─────────────────────────────────────────────────────────────────

const topicsCmd = program
  .command("topics <keyword>")
  .description("Search for topics/hashtags to use in posts");
addCookieOption(topicsCmd);
addJsonOption(topicsCmd);

topicsCmd.action(async (keyword, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const result = await client.searchTopics(keyword);
    if (opts.json) {
      output(result, true);
    } else {
      const data = result as { topic_info_dtos?: Array<{ name?: string; id?: string; view_num?: number }> };
      const topics = data.topic_info_dtos ?? (Array.isArray(result) ? result as Array<{ name?: string; id?: string; view_num?: number }> : []);
      for (const topic of topics) {
        console.log(
          `#${kleur.bold(topic.name ?? "?")}  ${kleur.dim(`id:${topic.id ?? "?"}`)}  ${kleur.dim(`views:${topic.view_num ?? "?"}`)}`
        );
      }
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── favorites ──────────────────────────────────────────────────────────────

const favoritesCmd = program
  .command("favorites [userId]")
  .description("List a user's collected/favorited notes (defaults to current user)")
  .option("--all", "Fetch all pages");
addCookieOption(favoritesCmd);
addJsonOption(favoritesCmd);

favoritesCmd.action(async (userId, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);

    if (!userId) {
      const me = (await client.getSelfInfo()) as Record<string, unknown>;
      userId = String(me.user_id ?? "");
      if (!userId) {
        console.error(kleur.red("Could not determine current user ID"));
        process.exit(1);
      }
    }

    const allNotes: unknown[] = [];
    let cursor = "";
    let hasMore = true;

    while (hasMore) {
      const res = (await client.getUserCollectedNotes(userId, 30, cursor)) as {
        notes?: unknown[];
        has_more?: boolean;
        cursor?: string;
      };

      if (res.notes) allNotes.push(...res.notes);
      hasMore = opts.all ? (res.has_more ?? false) : false;
      cursor = res.cursor ?? "";
    }

    if (opts.json) {
      output(allNotes, true);
    } else {
      for (const note of allNotes) {
        const n = note as Record<string, unknown>;
        const user = n.user as Record<string, unknown> | undefined;
        console.log(
          `${kleur.bold(String(n.display_title ?? n.title ?? "(no title)"))}  ${kleur.dim(String(n.note_id ?? ""))}  ${kleur.dim(`@${user?.nickname ?? "?"}`)}`
        );
      }
      console.log(kleur.dim(`\n${allNotes.length} collected notes`));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── collect ────────────────────────────────────────────────────────────────

const collectCmd = program
  .command("collect <url>")
  .description("Collect (bookmark) a note");
addCookieOption(collectCmd);
addJsonOption(collectCmd);

collectCmd.action(async (url, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const { noteId } = parseNoteUrl(url);
    const result = await client.collectNote(noteId);
    if (opts.json) {
      output(result, true);
    } else {
      console.log(kleur.green("Note collected!"));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── uncollect ──────────────────────────────────────────────────────────────

const uncollectCmd = program
  .command("uncollect <url>")
  .description("Remove a note from your collection");
addCookieOption(uncollectCmd);
addJsonOption(uncollectCmd);

uncollectCmd.action(async (url, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const { noteId } = parseNoteUrl(url);
    const result = await client.uncollectNote(noteId);
    if (opts.json) {
      output(result, true);
    } else {
      console.log(kleur.green("Note removed from collection!"));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── like ──────────────────────────────────────────────────────────────────

const likeCmd = program
  .command("like <url>")
  .description("Like a note")
  .option("--undo", "Unlike the note instead");
addCookieOption(likeCmd);
addJsonOption(likeCmd);

likeCmd.action(async (url, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const { noteId } = parseNoteUrl(url);
    if (opts.undo) {
      const result = await client.unlikeNote(noteId);
      if (opts.json) { output(result, true); } else { console.log(kleur.green("Note unliked!")); }
    } else {
      const result = await client.likeNote(noteId);
      if (opts.json) { output(result, true); } else { console.log(kleur.green("Note liked!")); }
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── followers ─────────────────────────────────────────────────────────────

const followersCmd = program
  .command("followers <userId>")
  .description("List a user's followers")
  .option("--all", "Fetch all pages");
addCookieOption(followersCmd);
addJsonOption(followersCmd);

followersCmd.action(async (userId, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const allUsers: unknown[] = [];
    let cursor = "";
    let hasMore = true;

    while (hasMore) {
      const res = (await client.getUserFollowers(userId, cursor)) as {
        users?: unknown[];
        has_more?: boolean;
        cursor?: string;
      };
      if (res.users) allUsers.push(...res.users);
      hasMore = opts.all ? (res.has_more ?? false) : false;
      cursor = res.cursor ?? "";
    }

    if (opts.json) {
      output(allUsers, true);
    } else {
      for (const user of allUsers) {
        const u = user as Record<string, unknown>;
        console.log(
          `${kleur.bold(String(u.nickname ?? "?"))}  ${kleur.dim(String(u.user_id ?? ""))}  ${kleur.dim(String(u.desc ?? "").slice(0, 60))}`
        );
      }
      console.log(kleur.dim(`\n${allUsers.length} followers`));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── following ─────────────────────────────────────────────────────────────

const followingCmd = program
  .command("following <userId>")
  .description("List accounts a user follows")
  .option("--all", "Fetch all pages");
addCookieOption(followingCmd);
addJsonOption(followingCmd);

followingCmd.action(async (userId, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const allUsers: unknown[] = [];
    let cursor = "";
    let hasMore = true;

    while (hasMore) {
      const res = (await client.getUserFollowing(userId, cursor)) as {
        users?: unknown[];
        has_more?: boolean;
        cursor?: string;
      };
      if (res.users) allUsers.push(...res.users);
      hasMore = opts.all ? (res.has_more ?? false) : false;
      cursor = res.cursor ?? "";
    }

    if (opts.json) {
      output(allUsers, true);
    } else {
      for (const user of allUsers) {
        const u = user as Record<string, unknown>;
        console.log(
          `${kleur.bold(String(u.nickname ?? "?"))}  ${kleur.dim(String(u.user_id ?? ""))}  ${kleur.dim(String(u.desc ?? "").slice(0, 60))}`
        );
      }
      console.log(kleur.dim(`\n${allUsers.length} following`));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── delete ────────────────────────────────────────────────────────────────

const deleteCmd = program
  .command("delete <url>")
  .description("Delete your own note");
addCookieOption(deleteCmd);
addJsonOption(deleteCmd);

deleteCmd.action(async (url, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const { noteId } = parseNoteUrl(url);
    const result = await client.deleteNote(noteId);
    if (opts.json) {
      output(result, true);
    } else {
      console.log(kleur.green("Note deleted!"));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── boards ──────────────────────────────────────────────────────────────────

const boardsCmd = program
  .command("boards [user-id]")
  .description("List user's collection boards (收藏专辑列表)");
addCookieOption(boardsCmd);
addJsonOption(boardsCmd);

boardsCmd.action(async (userId, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    let uid = userId;
    if (!uid) {
      const me = (await client.getSelfInfo()) as Record<string, string>;
      uid = me.user_id;
    }
    console.error(kleur.dim(`Listing boards for ${uid}...`));
    const data = (await client.getUserBoards(uid)) as Record<string, unknown>;
    if (opts.json) {
      output(data, true);
    } else {
      const boards = (data.boards ?? []) as Array<Record<string, unknown>>;
      const count = (data.board_count ?? boards.length) as number;
      console.log(kleur.dim(`${count} board(s)\n`));
      for (const b of boards) {
        const id = (b.id ?? "") as string;
        const name = (b.name ?? "(untitled)") as string;
        const total = (b.total ?? 0) as number;
        const privacy = b.privacy === 1 ? kleur.yellow(" [private]") : "";
        console.log(`  ${kleur.bold(name)}  ${kleur.dim(`${total} notes`)}${privacy}  ${kleur.dim(id)}`);
        if (b.desc && b.desc !== "暂无简介") console.log(`    ${kleur.dim(b.desc as string)}`);
      }
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── board ───────────────────────────────────────────────────────────────────

const boardCmd = program
  .command("board <url>")
  .description("List notes in a collection album (收藏专辑)");
addCookieOption(boardCmd);
addJsonOption(boardCmd);

boardCmd.action(async (url, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const boardId = parseBoardUrl(url);

    console.error(kleur.dim(`Fetching board ${boardId}...`));

    let result: {
      boardId: string;
      name: string;
      desc: string;
      noteCount: number;
      notes: Array<{ note_id: string; title: string; author: string; type: string; url: string }>;
    };

    // Try REST API first, fall back to HTML scraping
    try {
      const [info, feeds] = await Promise.all([
        client.getBoardInfo(boardId) as Promise<Record<string, unknown>>,
        client.getBoardNotes(boardId) as Promise<Record<string, unknown>>,
      ]);
      const rawNotes = (feeds.notes ?? []) as Array<Record<string, unknown>>;
      const notes = rawNotes.map((n) => ({
        note_id: (n.note_id ?? n.id ?? "") as string,
        xsec_token: (n.xsec_token ?? "") as string,
        title: (n.display_title ?? n.title ?? "") as string,
        type: (n.type ?? "") as string,
        author: ((n.user as Record<string, unknown>)?.nick_name ??
                 (n.user as Record<string, unknown>)?.nickname ?? "") as string,
        url: `https://www.xiaohongshu.com/explore/${n.note_id ?? n.id}`,
      }));
      result = {
        boardId,
        name: (info.name ?? "") as string,
        desc: (info.desc ?? "") as string,
        noteCount: (info.total ?? notes.length) as number,
        notes,
      };
    } catch {
      // REST API failed — fall back to HTML scraping
      console.error(kleur.dim("REST API unavailable, falling back to HTML scraping..."));
      result = (await client.getBoardFromHtml(boardId)) as typeof result;
    }

    if (opts.json) {
      output(result, true);
    } else {
      if (result.name) console.log(kleur.bold(result.name));
      if (result.desc) console.log(kleur.dim(result.desc));
      console.log();
      for (const note of result.notes) {
        console.log(
          `  ${kleur.bold(note.title || "(no title)")}  ${kleur.dim(`@${note.author || "?"}`)}  [${note.type || "?"}]`
        );
        console.log(`    ${kleur.cyan(note.url)}`);
      }
      console.log(kleur.dim(`\n${result.notes.length} notes`));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── health ──────────────────────────────────────────────────────────────────

const healthCmd = program
  .command("health")
  .description("Check note distribution health — detect hidden rate-limiting (限流)")
  .option("--all", "Fetch all pages of notes");
addCookieOption(healthCmd);
addJsonOption(healthCmd);

healthCmd.action(async (opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);

    // Fetch notes from creator backend (v2 endpoint returns hidden level field)
    console.error(kleur.dim("Fetching notes from creator backend..."));
    const allNotes: Record<string, unknown>[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const res = (await client.getCreatorNoteList(0, page)) as {
        notes?: Record<string, unknown>[];
        has_more?: boolean;
      };
      if (res.notes) allNotes.push(...res.notes);
      hasMore = opts.all ? (res.has_more ?? false) : false;
      page++;
    }

    if (allNotes.length === 0) {
      console.log(kleur.yellow("No notes found."));
      return;
    }

    const report = buildHealthReport(allNotes);

    if (opts.json) {
      output(report, true);
      return;
    }

    // ─── Terminal Dashboard ──────────────────────────────────────────────
    console.log(kleur.bold("\n📊 Note Health Report"));
    console.log(kleur.dim("───────────────────────────────────────"));

    // Distribution summary
    for (const [label, count] of Object.entries(report.distribution)) {
      const bar = "█".repeat(Math.min(count, 40));
      console.log(`  ${label.padEnd(14)} ${kleur.dim(bar)} ${count}`);
    }

    console.log(kleur.dim(`\n  Total: ${report.totalNotes} notes`));

    // Limited notes (level < 1)
    if (report.limitedNotes.length > 0) {
      console.log(kleur.red(kleur.bold(`\n⚠ ${report.limitedNotes.length} notes with limited distribution:`)));
      for (const n of report.limitedNotes) {
        const flags = formatFlags(n);
        console.log(`  ${n.levelMeta.emoji} ${kleur.red(`L${n.level}`.padEnd(6))} ${truncate(n.title, 50)}${flags}`);
      }
    } else {
      console.log(kleur.green("\n✓ All notes have normal distribution!"));
    }

    // Sensitive word warnings
    if (report.sensitiveNotes.length > 0) {
      console.log(kleur.yellow(`\n⚠ ${report.sensitiveNotes.length} notes with risk factors:`));
      for (const n of report.sensitiveNotes) {
        const reasons: string[] = [];
        if (n.sensitiveHits.length > 0) reasons.push(`敏感词: ${n.sensitiveHits.join("、")}`);
        if (n.tagWarning) reasons.push(`标签过多(${n.tagCount}个)`);
        console.log(`  ${kleur.dim(n.noteId.slice(0, 8))} ${truncate(n.title, 40)} ${kleur.yellow(reasons.join(" | "))}`);
      }
    }

    console.log();
  } catch (err) {
    handleError(err);
  }
});

function formatFlags(n: NoteDiagnostics): string {
  const parts: string[] = [];
  if (n.sensitiveHits.length > 0) parts.push(kleur.yellow(`⚠️${n.sensitiveHits.join("、")}`));
  if (n.tagWarning) parts.push(kleur.yellow(`📛${n.tagCount}tags`));
  return parts.length > 0 ? "  " + parts.join(" ") : "";
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// ─── analyze-viral ──────────────────────────────────────────────────────────

const analyzeViralCmd = program
  .command("analyze-viral <url>")
  .description("Analyze why a viral note works — hooks, engagement, structure");
analyzeViralCmd.option("--comment-pages <n>", "Comment pages to fetch (max 10)", "3");
addCookieOption(analyzeViralCmd);
addJsonOption(analyzeViralCmd);

analyzeViralCmd.action(async (url, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const { noteId, xsecToken } = parseNoteUrl(url);

    // 1. Fetch the note (same pattern as `read` — prefer HTML, API when xsec_token present)
    let note: Record<string, unknown>;
    if (xsecToken) {
      try {
        const feedResult = (await client.getNoteById(
          noteId,
          xsecToken
        )) as { items?: Array<{ note_card?: Record<string, unknown> }> };
        note = feedResult?.items?.[0]?.note_card ?? {};
        if (!note.user) {
          note = (await client.getNoteFromHtml(noteId, xsecToken)) as Record<string, unknown>;
        }
      } catch {
        note = (await client.getNoteFromHtml(noteId, xsecToken)) as Record<string, unknown>;
      }
    } else {
      note = (await client.getNoteFromHtml(noteId, "")) as Record<string, unknown>;
    }

    const user = (note.user as Record<string, unknown>) ?? {};
    const userId = String(user.user_id ?? "");

    if (!userId) {
      console.error(kleur.red("Could not extract author user_id from note"));
      process.exit(1);
    }

    // 2. Fetch comments, author posts, and author info in parallel
    const commentPages = Math.min(parseInt(opts.commentPages) || 3, 10);

    const fetchComments = async () => {
      const all: Record<string, unknown>[] = [];
      let cursor = "";
      for (let i = 0; i < commentPages; i++) {
        try {
          const res = (await client.getComments(noteId, cursor, xsecToken ?? "")) as {
            comments?: Record<string, unknown>[];
            has_more?: boolean;
            cursor?: string;
          };
          if (res.comments) all.push(...res.comments);
          if (!res.has_more) break;
          cursor = res.cursor ?? "";
        } catch {
          break; // Comment fetch failed, continue with what we have
        }
      }
      return all;
    };

    const fetchAuthorPosts = async () => {
      try {
        const res = (await client.getUserNotes(userId)) as {
          notes?: Record<string, unknown>[];
        };
        return res.notes ?? [];
      } catch {
        return [];
      }
    };

    const fetchAuthorInfo = async () => {
      try {
        const res = (await client.getUserInfo(userId)) as Record<string, unknown>;
        // Follower count is in interactions array: {type: "fans", count: "30510"}
        const interactions = (res.interactions ?? []) as Array<{ type?: string; count?: string }>;
        const fansEntry = interactions.find((i) => i.type === "fans");
        if (fansEntry?.count) {
          // Handle Chinese abbreviated numbers (e.g., "3.1万")
          const s = fansEntry.count.trim();
          if (s.endsWith("万")) return Math.round(parseFloat(s.slice(0, -1)) * 10000);
          if (s.endsWith("亿")) return Math.round(parseFloat(s.slice(0, -1)) * 100000000);
          return parseInt(s, 10) || 0;
        }
        return 0;
      } catch {
        return 0;
      }
    };

    console.error(kleur.dim("Fetching comments, author posts, and profile..."));
    const [comments, authorPosts, authorFollowers] = await Promise.all([
      fetchComments(),
      fetchAuthorPosts(),
      fetchAuthorInfo(),
    ]);

    // 3. Run analysis
    const analysis = analyzeViral(noteId, note, comments, authorPosts, authorFollowers);

    if (opts.json) {
      output(analysis, true);
    } else {
      console.log(formatViralAnalysis(analysis));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── viral-template ──────────────────────────────────────────────────────────

const viralTemplateCmd = program
  .command("viral-template <urls...>")
  .description("Extract a content template from 1-3 viral notes")
  .option("--comment-pages <n>", "Comment pages to fetch per note (max 10)", "3");
addCookieOption(viralTemplateCmd);
addJsonOption(viralTemplateCmd);

viralTemplateCmd.action(async (urls: string[], opts) => {
  try {
    if (urls.length > 3) {
      console.error(kleur.red("Maximum 3 URLs allowed"));
      process.exit(1);
    }

    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const commentPages = Math.min(parseInt(opts.commentPages) || 3, 10);
    const analyses = [];

    for (const url of urls) {
      const { noteId, xsecToken } = parseNoteUrl(url);
      console.error(kleur.dim(`Analyzing ${noteId}...`));

      // Fetch note
      let note: Record<string, unknown>;
      if (xsecToken) {
        try {
          const feedResult = (await client.getNoteById(noteId, xsecToken)) as {
            items?: Array<{ note_card?: Record<string, unknown> }>;
          };
          note = feedResult?.items?.[0]?.note_card ?? {};
          if (!note.user) {
            note = (await client.getNoteFromHtml(noteId, xsecToken)) as Record<string, unknown>;
          }
        } catch {
          note = (await client.getNoteFromHtml(noteId, xsecToken)) as Record<string, unknown>;
        }
      } else {
        note = (await client.getNoteFromHtml(noteId, "")) as Record<string, unknown>;
      }

      const user = (note.user as Record<string, unknown>) ?? {};
      const userId = String(user.user_id ?? "");
      if (!userId) {
        console.error(kleur.yellow(`Skipping ${noteId} — could not extract author`));
        continue;
      }

      // Fetch comments, author posts, author info in parallel
      const fetchComments = async () => {
        const all: Record<string, unknown>[] = [];
        let cursor = "";
        for (let i = 0; i < commentPages; i++) {
          try {
            const res = (await client.getComments(noteId, cursor, xsecToken ?? "")) as {
              comments?: Record<string, unknown>[];
              has_more?: boolean;
              cursor?: string;
            };
            if (res.comments) all.push(...res.comments);
            if (!res.has_more) break;
            cursor = res.cursor ?? "";
          } catch { break; }
        }
        return all;
      };

      const fetchAuthorPosts = async () => {
        try {
          const res = (await client.getUserNotes(userId)) as { notes?: Record<string, unknown>[] };
          return res.notes ?? [];
        } catch { return []; }
      };

      const fetchAuthorInfo = async () => {
        try {
          const res = (await client.getUserInfo(userId)) as Record<string, unknown>;
          const interactions = (res.interactions ?? []) as Array<{ type?: string; count?: string }>;
          const fansEntry = interactions.find((i) => i.type === "fans");
          if (fansEntry?.count) {
            const s = fansEntry.count.trim();
            if (s.endsWith("万")) return Math.round(parseFloat(s.slice(0, -1)) * 10000);
            if (s.endsWith("亿")) return Math.round(parseFloat(s.slice(0, -1)) * 100000000);
            return parseInt(s, 10) || 0;
          }
          return 0;
        } catch { return 0; }
      };

      const [comments, authorPosts, authorFollowers] = await Promise.all([
        fetchComments(), fetchAuthorPosts(), fetchAuthorInfo(),
      ]);

      analyses.push(analyzeViral(noteId, note, comments, authorPosts, authorFollowers));
    }

    if (analyses.length === 0) {
      console.error(kleur.red("No notes could be analyzed"));
      process.exit(1);
    }

    const template = extractTemplate(analyses);

    if (opts.json) {
      output(template, true);
    } else {
      console.log(formatTemplate(template));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── comment ─────────────────────────────────────────────────────────────────

const commentCmd = program
  .command("comment <url>")
  .description("Post a top-level comment on a note")
  .requiredOption("--content <text>", "Comment text");
addCookieOption(commentCmd);
addJsonOption(commentCmd);

commentCmd.action(async (url, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const { noteId } = parseNoteUrl(url);
    const result = await client.postComment(noteId, opts.content);
    if (opts.json) {
      output(result, true);
    } else {
      console.log(kleur.green("Comment posted!"));
      console.error(kleur.yellow("⚠ Rate limit: wait ≥3 minutes before the next comment to avoid risk control."));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── reply ───────────────────────────────────────────────────────────────────

const replyCmd = program
  .command("reply <url>")
  .description("Reply to a comment on a note")
  .requiredOption("--comment-id <id>", "Comment ID to reply to")
  .requiredOption("--content <text>", "Reply text");
addCookieOption(replyCmd);
addJsonOption(replyCmd);

replyCmd.action(async (url, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const { noteId } = parseNoteUrl(url);
    const result = await client.replyComment(noteId, opts.commentId, opts.content);
    if (opts.json) {
      output(result, true);
    } else {
      console.log(kleur.green("Reply posted!"));
      console.error(kleur.yellow("⚠ Rate limit: wait ≥3 minutes before the next reply to avoid risk control."));
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── batch-reply ─────────────────────────────────────────────────────────────

const batchReplyCmd = program
  .command("batch-reply <url>")
  .description("Reply to multiple comments using a strategy")
  .option("--strategy <name>", "Filter strategy: questions, top-engaged, all-unanswered", "questions")
  .option("--template <text>", "Reply template with {author}, {content} placeholders")
  .option("--max <n>", `Max replies to send (hard cap: ${MAX_REPLIES_HARD_CAP})`, "10")
  .option("--delay <ms>", `Delay between replies in ms (min: ${MIN_REPLY_DELAY / 1000}s)`, String(DEFAULT_DELAY_MS))
  .option("--dry-run", "Preview candidates without posting");
addCookieOption(batchReplyCmd);
addJsonOption(batchReplyCmd);

batchReplyCmd.action(async (url, opts) => {
  try {
    const client = await getClient(opts.cookieSource, opts.chromeProfile, opts.cookieString);
    const { noteId, xsecToken } = parseNoteUrl(url);
    const strategy = opts.strategy as StrategyName;
    const max = Math.min(parseInt(opts.max) || 10, MAX_REPLIES_HARD_CAP);
    const isDryRun = opts.dryRun || !opts.template;

    // Fetch all comments
    console.error(kleur.dim("Fetching comments..."));
    const allComments: Record<string, unknown>[] = [];
    let cursor = "";
    let hasMore = true;
    while (hasMore) {
      const res = (await client.getComments(noteId, cursor, xsecToken ?? "")) as {
        comments?: Record<string, unknown>[];
        has_more?: boolean;
        cursor?: string;
      };
      if (res.comments) allComments.push(...res.comments);
      hasMore = res.has_more ?? false;
      cursor = res.cursor ?? "";
    }

    // Select candidates
    const plan = selectCandidates(allComments, strategy, max);
    plan.noteId = noteId;

    if (isDryRun || opts.json) {
      if (opts.json) {
        output(plan, true);
      } else {
        console.log(kleur.bold(`\nBatch Reply Plan — ${strategy}`));
        console.log(kleur.dim(`${plan.totalComments} comments → ${plan.candidates.length} candidates (${plan.skipped} skipped)\n`));
        for (const c of plan.candidates) {
          console.log(
            `  ${kleur.cyan(c.commentId.slice(0, 8))}  ${kleur.bold(`@${c.author}`)}  ${kleur.dim(`♥ ${c.likes}`)}`
          );
          console.log(`    ${c.content.slice(0, 80)}${c.content.length > 80 ? "..." : ""}`);
        }
        if (!opts.template) {
          console.log(kleur.yellow("\nDry run (no --template provided). Add --template to execute."));
        } else {
          console.log(kleur.yellow("\nDry run mode. Remove --dry-run to execute."));
        }
      }
      return;
    }

    // Execute replies
    const delayMs = parseInt(opts.delay) || DEFAULT_DELAY_MS;
    console.error(kleur.dim(`Sending ${plan.candidates.length} replies (delay: ~${Math.round(delayMs / 60000)}min ±30% jitter)...`));
    console.error(kleur.yellow("⚠ Rate limit: XHS enforces anti-spam — replies spaced ≥3min apart with jitter."));
    const results = await executeReplies(
      client,
      noteId,
      plan.candidates,
      opts.template,
      delayMs,
      {}
    );

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    if (opts.json) {
      output(results, true);
    } else {
      console.log(kleur.green(`\n${succeeded} replies sent`));
      if (failed > 0) {
        console.log(kleur.red(`${failed} failed`));
        for (const r of results.filter((r) => !r.success)) {
          console.log(kleur.dim(`  @${r.author}: ${r.error}`));
        }
      }
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── render ──────────────────────────────────────────────────────────────────

const renderCmd = program
  .command("render <file>")
  .description("Render markdown to styled PNG cards for Xiaohongshu posts")
  .option("--style <name>", "Color style: purple, xiaohongshu, mint, sunset, ocean, elegant, dark", "xiaohongshu")
  .option("--pagination <mode>", "Pagination: auto, separator", "auto")
  .option("--output-dir <dir>", "Output directory (default: same as input file)")
  .option("--width <n>", "Card width in px", "1080")
  .option("--height <n>", "Card height in px", "1440")
  .option("--dpr <n>", "Device pixel ratio", "2");
addJsonOption(renderCmd);

renderCmd.action(async (file, opts) => {
  try {
    const { renderCards } = await import("./lib/render.js");
    const result = await renderCards(file, {
      style: opts.style,
      pagination: opts.pagination,
      outputDir: opts.outputDir,
      width: parseInt(opts.width),
      height: parseInt(opts.height),
      dpr: parseInt(opts.dpr),
    });

    if (opts.json) {
      output(result, true);
    } else {
      console.log(kleur.green(`\nRendered ${result.totalCards + 1} images:`));
      console.log(`  Cover: ${kleur.bold(result.coverPath)}`);
      for (const p of result.cardPaths) {
        console.log(`  Card:  ${kleur.bold(p)}`);
      }
    }
  } catch (err) {
    handleError(err);
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseBoardUrl(url: string): string {
  if (url.includes("xiaohongshu.com/board/")) {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1];
  }
  return url; // assume raw board ID
}

function parseNoteUrl(url: string): {
  noteId: string;
  xsecToken: string | null;
} {
  // Handle full URLs like https://www.xiaohongshu.com/explore/abc123?xsec_token=xxx
  // or https://www.xiaohongshu.com/discovery/item/abc123
  // or just a note ID
  let noteId: string;
  let xsecToken: string | null = null;

  if (url.includes("xiaohongshu.com")) {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    noteId = pathParts[pathParts.length - 1];
    xsecToken = urlObj.searchParams.get("xsec_token");
  } else if (url.includes("xhslink.com")) {
    // Short link — just use it as-is, would need redirect following
    noteId = url;
  } else {
    noteId = url;
  }

  return { noteId, xsecToken };
}

program.parse();
