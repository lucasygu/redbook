# redbook — 小红书命令行工具

小红书 CLI 工具：搜索笔记、阅读内容、分析博主、发布图文。使用浏览器 Cookie 认证，无需 API Key。

[English](#english) | 中文

> ### 最快上手方式
>
> 把这段话发给你的 AI 助手（Claude Code、Cursor、Codex、Windsurf、OpenClaw 等）：
>
> **"帮我用 npm 安装 `@lucasygu/redbook` 这个小红书 CLI 工具，然后运行 `redbook whoami` 验证是否能正常连接。GitHub 地址：https://github.com/lucasygu/redbook"**
>
> OpenClaw 用户也可以直接：**`clawhub install redbook`**
>
> AI 会自动完成安装、验证连接、处理可能的 Cookie 问题。你只需要确保已在 Chrome 中登录 xiaohongshu.com。
>
> 安装完成后，试试：**"帮我分析'AI编程'这个话题在小红书上的竞争格局"** —— AI 会自动搜索关键词、分析互动数据、发现头部博主、给出内容建议。

## 安装

```bash
npm install -g @lucasygu/redbook
# 或通过 ClawHub（OpenClaw 生态）
clawhub install redbook
```

需要 Node.js >= 22。支持 **macOS、Windows、Linux**。使用 Chrome 浏览器的 Cookie —— 请先在 Chrome 中登录 xiaohongshu.com。

安装后运行 `redbook whoami` 验证连接。CLI 会自动检测所有 Chrome 配置文件，找到你的小红书登录状态。

- **macOS** —— 如果遇到钥匙串弹窗，请点击"始终允许"
- **Windows** —— Chrome 127+ 使用了 App-Bound Encryption，CLI 会自动启动 Chrome headless 模式读取 Cookie（需要先关闭 Chrome）。如果自动提取失败，可以用 `--cookie-string` 手动传入

## 能做什么

- **话题研究** —— 搜索关键词，分析哪些话题有流量、哪些是蓝海
- **竞品分析** —— 找到头部博主，对比粉丝量、互动数据、内容风格
- **爆款拆解** —— 分析爆款笔记的标题钩子、互动比例、评论主题
- **爆款模板** —— 从多篇爆款笔记提取内容模板（标题结构、正文结构、钩子模式）
- **限流检测** —— 检测笔记是否被隐形限流（通过创作者后台 API 的隐藏 level 字段）
- **收藏专辑** —— 查看收藏专辑内容，分析专辑内的笔记
- **收藏管理** —— 查看收藏列表、收藏/取消收藏笔记（支持自己和其他用户的公开收藏）
- **评论管理** —— 发评论、回复评论、按策略批量回复（问题优先 / 高赞优先 / 未回复优先）
- **图文卡片** —— Markdown 渲染为小红书风格的 PNG 图文卡片（7 种配色主题）
- **内容策划** —— 基于数据发现内容机会，生成有数据支撑的选题建议
- **受众洞察** —— 从互动信号推断目标用户画像

通过 AI 助手使用时，这些工作流可以自动串联完成。直接使用 CLI 时，每个命令也可以独立运行。

## 快速开始

```bash
# 检查连接
redbook whoami

# 搜索笔记
redbook search "AI编程" --sort popular

# 阅读笔记
redbook read https://www.xiaohongshu.com/explore/abc123

# 获取评论
redbook comments https://www.xiaohongshu.com/explore/abc123 --all

# 浏览推荐页
redbook feed

# 查看博主信息
redbook user "<profileUrl>"
redbook user-posts "<profileUrl>"

# 搜索话题标签
redbook topics "Claude Code"

# 查看收藏（默认当前用户）
redbook favorites --json
redbook favorites <userId> --json --all

# 收藏/取消收藏
redbook collect "<noteUrl>"
redbook uncollect "<noteUrl>"

# 分析爆款笔记
redbook analyze-viral https://www.xiaohongshu.com/explore/abc123

# 从多篇爆款提取内容模板
redbook viral-template "<url1>" "<url2>" "<url3>" --json

# 发评论
redbook comment "<noteUrl>" --content "写得好！"

# 回复评论
redbook reply "<noteUrl>" --comment-id "<id>" --content "感谢提问！"

# 按策略批量回复（先预览再执行）
redbook batch-reply "<noteUrl>" --strategy questions --dry-run
redbook batch-reply "<noteUrl>" --strategy questions --template "感谢！{content}" --max 10

# 查看收藏专辑
redbook boards                          # 列出自己的专辑
redbook boards <userId>                 # 列出他人的专辑
redbook board "https://www.xiaohongshu.com/board/abc123"
redbook board abc123 --json

# 检测笔记限流状态
redbook health
redbook health --all --json

# 将 Markdown 渲染为图文卡片（需要可选依赖）
redbook render content.md --style xiaohongshu
redbook render content.md --style dark --output-dir ./cards

# 发布图文笔记
redbook post --title "标题" --body "正文内容" --images cover.png
redbook post --title "测试" --body "..." --images img.png --private
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `whoami` | 查看当前登录账号 |
| `search <关键词>` | 搜索笔记 |
| `read <url>` | 阅读单篇笔记 |
| `comments <url>` | 获取笔记评论 |
| `user <userId\|profileUrl>` | 查看用户资料 |
| `user-posts <userId\|profileUrl>` | 列出用户所有笔记 |
| `feed` | 获取推荐页内容 |
| `post` | 发布图文笔记（易触发验证码，详见下方说明） |
| `topics <关键词>` | 搜索话题/标签 |
| `favorites [userId]` | 查看收藏笔记列表（默认当前用户） |
| `collect <url>` | 收藏（书签）笔记 |
| `uncollect <url>` | 取消收藏笔记 |
| `health` | 检测笔记隐形限流（通过创作者后台隐藏 level 字段） |
| `boards [userId]` | 列出用户的收藏专辑（默认当前用户） |
| `board <url>` | 查看收藏专辑内容（接受专辑 URL 或 ID） |
| `analyze-viral <url>` | 分析爆款笔记（钩子、互动、结构） |
| `viral-template <url...>` | 从 1-3 篇爆款笔记提取内容模板 |
| `comment <url>` | 发表评论 |
| `reply <url>` | 回复指定评论 |
| `batch-reply <url>` | 按策略批量回复评论（支持预览模式） |
| `render <文件>` | Markdown 渲染为小红书图文卡片 PNG（需可选依赖） |

### 通用选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--cookie-source <浏览器>` | Cookie 来源浏览器（chrome, safari, firefox） | `chrome` |
| `--chrome-profile <名称>` | Chrome 配置文件目录名（如 "Profile 1"），默认自动检测 | 自动 |
| `--cookie-string <cookies>` | 手动传入 Cookie 字符串：`"a1=值; web_session=值"`（从 Chrome DevTools 复制） | 无 |
| `--json` | JSON 格式输出 | `false` |

### 用户主页选项

`user` 和 `user-posts` 可以接受完整主页 URL，例如 `https://www.xiaohongshu.com/user/profile/<id>?xsec_token=...&xsec_source=pc_search`。如果只有用户 ID，但接口返回 `code=-1`，请从搜索结果或浏览器地址栏复制带 `xsec_token` 的主页 URL，或手动传入：

```bash
redbook user "<userId>" --xsec-token "<token>" --xsec-source pc_search --json
redbook user-posts "<userId>" --xsec-token "<token>" --xsec-source pc_search --json
```

### 搜索选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--sort <类型>` | `general`（综合）、`popular`（热门）、`latest`（最新） | `general` |
| `--type <类型>` | `all`（全部）、`video`（视频）、`image`（图文） | `all` |
| `--page <页码>` | 页码 | `1` |

### 分析选项（analyze-viral / viral-template）

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--comment-pages <n>` | 获取评论页数 | `3` |

### 批量回复选项（batch-reply）

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--strategy <策略>` | `questions`（提问）、`top-engaged`（高赞）、`all-unanswered`（未回复） | `questions` |
| `--template <模板>` | 回复模板，支持 `{author}`, `{content}` 占位符 | 无（预览模式） |
| `--max <数量>` | 最大回复数（上限 30） | `10` |
| `--delay <毫秒>` | 回复间隔（最小 180000ms/3分钟），自动添加 ±30% 随机抖动 | `300000`（5分钟） |
| `--dry-run` | 只预览不发送 | 无模板时自动开启 |

> ⚠️ **风控安全：** 小红书检测均匀时间间隔的自动化行为。回复间隔已自动添加 ±30% 随机抖动，避免触发机器人检测。建议每天每篇笔记最多批量回复 1-2 次。

### 渲染选项（render）

将 Markdown 文件渲染为小红书风格的 PNG 图文卡片。使用本机 Chrome 渲染，无需额外下载浏览器。

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--style <名称>` | 配色：purple, xiaohongshu, mint, sunset, ocean, elegant, dark | `xiaohongshu` |
| `--pagination <模式>` | 分页：auto（自动拆分）、separator（按 `---` 拆分） | `auto` |
| `--output-dir <目录>` | 输出目录 | 与输入文件同目录 |
| `--width <像素>` | 卡片宽度 | `1080` |
| `--height <像素>` | 卡片高度 | `1440` |
| `--dpr <倍率>` | 设备像素比 | `2` |

**可选依赖：** 需要安装 `puppeteer-core` 和 `marked`：
```bash
npm install -g puppeteer-core marked
```

### 发布选项（post）

发布功能目前**容易触发验证码**（type=124）。图片上传正常，但发布步骤经常被拦截。如需发布笔记，建议使用浏览器自动化。

| 选项 | 说明 |
|------|------|
| `--title <标题>` | 笔记标题（必填） |
| `--body <正文>` | 笔记正文（必填） |
| `--images <路径...>` | 图片文件路径（必填） |
| `--topic <关键词>` | 附加话题标签 |
| `--private` | 发布为私密笔记 |

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| `No 'a1' cookie found` | 在 Chrome 中登录 xiaohongshu.com，然后重试 |
| Windows 上 `-101` 错误 | Chrome 127+ 的 App-Bound Encryption 导致。先**关闭 Chrome**，再运行命令（CLI 会自动启动 Chrome headless 读取 Cookie）。如仍失败，用 `--cookie-string` 手动传入 |
| Windows `--cookie-string` 用法 | Chrome 按 F12 → Application → Cookies → xiaohongshu.com，复制 `a1` 和 `web_session` 的值：`redbook whoami --cookie-string "a1=值; web_session=值"` |
| macOS 钥匙串弹窗 | 输入密码后点击"始终允许"，CLI 需要读取 Chrome 的加密 Cookie |
| 多个 Chrome 配置文件 | CLI 自动扫描所有配置文件（macOS / Windows / Linux）。如需指定：`--chrome-profile "Profile 1"` |
| 使用 Brave/Arc 等浏览器 | 尝试 `--cookie-source safari`，或在 Chrome 中登录 |

## 工作原理

`redbook` 从 Chrome 读取小红书的登录 Cookie，然后用 TypeScript 实现的签名算法对 API 请求签名。

**三层 Cookie 提取策略：**
1. **sweet-cookie**（快速路径）—— 直接读取 Chrome 的 SQLite 数据库，macOS 上即开即用
2. **CDP 回退**（Windows 自动触发）—— 启动 Chrome headless，通过 DevTools Protocol 读取 Cookie，绕过 Chrome 127+ 的 App-Bound Encryption
3. **`--cookie-string`**（手动兜底）—— 从 Chrome DevTools 复制 Cookie 字符串，任何平台通用

**两套签名系统：**
- **主 API**（`edith.xiaohongshu.com`）—— 读取：搜索、推荐页、笔记、评论、用户资料。使用 144 字节 x-s 签名（v4.3.1）
- **创作者 API**（`creator.xiaohongshu.com`）—— 写入：上传图片、发布笔记。使用 AES-128-CBC 签名

## 分析模块（A-M）

内置 13 个可组合的分析模块，覆盖从关键词研究到内容发布的完整工作流：

| 模块 | 功能 |
|------|------|
| A. 关键词矩阵 | 分析各关键词的互动天花板和竞争密度 |
| B. 跨话题热力图 | 发现话题 × 场景的内容空白 |
| C. 互动信号分析 | 分类内容类型（工具型 / 认知型 / 娱乐型） |
| D. 博主画像 | 对比头部博主的粉丝、互动、风格 |
| E. 内容形式分析 | 图文 vs. 视频的表现对比 |
| F. 机会评分 | 按性价比排序关键词 |
| G. 受众推断 | 从互动信号推断用户画像 |
| H. 选题策划 | 数据驱动的内容创意 |
| I. 评论运营 | 按策略筛选和批量回复评论 |
| J. 爆款复刻 | 从爆款笔记提取内容模板 |
| K. 互动自动化 | 组合 I + J 的自动化运营工作流 |
| L. 图文卡片 | Markdown → 小红书风格 PNG 图文卡片（7 种配色） |
| M. 限流检测 | 通过创作者后台隐藏 level 字段检测笔记限流状态 |

详见 [SKILL.md](SKILL.md) 的模块文档和组合工作流。

## AI 助手集成

### Claude Code

安装后自动注册为 Claude Code 技能。在 Claude Code 中使用 `/redbook` 命令：

```
/redbook search "AI编程"                        # 搜索笔记
/redbook read <url>                             # 阅读笔记
/redbook user <profileUrl>                      # 查看博主
/redbook analyze-viral <url>                    # 分析爆款笔记
```

你可以直接用自然语言下达复杂任务：

- *"分析'AI编程'在小红书的竞争格局，找出蓝海关键词"*
- *"对比这三个博主的内容策略和互动数据"*
- *"拆解这篇爆款笔记，告诉我为什么火了"*
- *"帮我回复这篇笔记下面的提问评论"*

Claude 会自动组合多个命令，解析 JSON 数据，输出结构化分析报告。

### OpenClaw / ClawHub

官方支持 [OpenClaw](https://openclaw.ai) 和 [ClawHub](https://docs.openclaw.ai/tools/clawhub) 生态。通过 ClawHub 安装：

```bash
clawhub install redbook
```

安装后在 OpenClaw 中可直接使用所有 `redbook` 命令。SKILL.md 同时兼容 Claude Code 和 OpenClaw 两个生态。

## 编程接口

```typescript
import { XhsClient } from "@lucasygu/redbook";
import { loadCookies } from "@lucasygu/redbook/cookies";

const cookies = await loadCookies("chrome");
const client = new XhsClient(cookies);

const results = await client.searchNotes("AI编程", 1, 20, "popular");
const topics = await client.searchTopics("Claude Code");
```

## 致谢

签名算法移植自以下开源项目（MIT 协议）：

- [Cloxl/xhshow](https://github.com/Cloxl/xhshow) — 主 API 签名（x-s, x-s-common）
- [Spider_XHS](https://github.com/JoeanAmier/XHS-Downloader) — 创作者 API 签名
- [ReaJason/xhs](https://github.com/ReaJason/xhs) — API 端点参考

Cookie 提取使用 [@steipete/sweet-cookie](https://github.com/nicklockwood/sweet-cookie)。

限流检测灵感来自 [jzOcb/xhs-note-health-checker](https://github.com/jzOcb/xhs-note-health-checker)（[@xxx111god](https://x.com/xxx111god) 发现了创作者后台 API 的隐藏 level 字段）。

## 免责声明

本工具使用非官方 API。小红书可能随时更改或封锁这些接口。请合理使用，风险自负。本项目与小红书无任何关联。

---

<a id="english"></a>

# English

A fast CLI tool for [Xiaohongshu (小红书 / RED)](https://www.xiaohongshu.com) — search notes, read content, analyze creators, and publish posts. Uses browser cookie auth (no API key needed).

> ### Easiest way to get started
>
> Paste this to your AI coding agent (Claude Code, Cursor, Codex, Windsurf, OpenClaw, etc.):
>
> **"Install the `@lucasygu/redbook` Xiaohongshu CLI tool via npm and run `redbook whoami` to verify it works. Repo: https://github.com/lucasygu/redbook"**
>
> OpenClaw users can also run: **`clawhub install redbook`**
>
> The agent will handle installation, verify the connection, and troubleshoot any cookie issues. Just make sure you're logged into xiaohongshu.com in Chrome first.
>
> Once installed, try: **"Analyze the competitive landscape for 'AI编程' on Xiaohongshu"** — the agent will search keywords, analyze engagement data, profile top creators, and suggest content opportunities.

## Install

```bash
npm install -g @lucasygu/redbook
# Or via ClawHub (OpenClaw ecosystem)
clawhub install redbook
```

Requires Node.js >= 22. Supports **macOS, Windows, and Linux**. Uses cookies from your Chrome browser session — you must be logged into xiaohongshu.com in Chrome.

After installing, run `redbook whoami` to verify the connection. The CLI auto-detects all Chrome profiles to find your XHS session.

- **macOS** — If Keychain prompt appears, click "Always Allow"
- **Windows** — Chrome 127+ uses App-Bound Encryption. The CLI auto-launches Chrome headless to read cookies (close Chrome first). If auto-extraction fails, use `--cookie-string` as fallback

## What You Can Do

- **Topic research** — Search keywords, analyze which topics have demand vs. gaps
- **Competitive analysis** — Find top creators, compare followers, engagement, content style
- **Viral note breakdown** — Analyze title hooks, engagement ratios, comment themes
- **Viral templates** — Extract content templates from multiple viral notes (hook patterns, body structure, engagement profile)
- **Rate-limit detection** — Detect hidden throttling on your notes via the creator API's secret `level` field
- **Collection albums** — List notes in a collection album (收藏专辑) for batch analysis
- **Favorites management** — List collected notes, collect/uncollect notes (own and other users' public collections)
- **Comment management** — Post comments, reply to comments, batch-reply with strategies (questions / top-engaged / unanswered)
- **Image cards** — Render markdown to styled PNG cards for XHS posts (7 color themes)
- **Content planning** — Discover content opportunities with data-backed topic suggestions
- **Audience insights** — Infer target audience from engagement signals

When used through an AI agent, these workflows chain together automatically. Each CLI command also works standalone.

## Quick Start

```bash
# Check connection
redbook whoami

# Search notes
redbook search "AI编程" --sort popular

# Read a note
redbook read https://www.xiaohongshu.com/explore/abc123

# Get comments
redbook comments https://www.xiaohongshu.com/explore/abc123 --all

# Browse your feed
redbook feed

# Look up a creator
redbook user "<profileUrl>"
redbook user-posts "<profileUrl>"

# Search hashtags
redbook topics "Claude Code"

# List favorites (defaults to current user)
redbook favorites --json
redbook favorites <userId> --json --all

# Collect/uncollect notes
redbook collect "<noteUrl>"
redbook uncollect "<noteUrl>"

# Analyze a viral note
redbook analyze-viral https://www.xiaohongshu.com/explore/abc123

# Extract content template from viral notes
redbook viral-template "<url1>" "<url2>" "<url3>" --json

# Post a comment
redbook comment "<noteUrl>" --content "Great post!"

# Reply to a comment
redbook reply "<noteUrl>" --comment-id "<id>" --content "Thanks for asking!"

# Batch reply with strategy (preview first, then execute)
redbook batch-reply "<noteUrl>" --strategy questions --dry-run
redbook batch-reply "<noteUrl>" --strategy questions --template "Thanks! {content}" --max 10

# List user's collection boards
redbook boards                          # your own boards
redbook boards <userId>                 # another user's boards
redbook board "https://www.xiaohongshu.com/board/abc123" --json

# Check note health / rate-limiting status
redbook health
redbook health --all --json

# Render markdown to image cards (requires optional deps)
redbook render content.md --style xiaohongshu
redbook render content.md --style dark --output-dir ./cards

# Publish (requires image)
redbook post --title "标题" --body "正文" --images cover.png
redbook post --title "测试" --body "..." --images img.png --private
```

## Commands

| Command | Description |
|---------|-------------|
| `whoami` | Check connection and show current user info |
| `search <keyword>` | Search notes by keyword |
| `read <url>` | Read a note by URL |
| `comments <url>` | Get comments on a note |
| `user <userId\|profileUrl>` | Get user profile info |
| `user-posts <userId\|profileUrl>` | List a user's posted notes |
| `feed` | Get homepage feed |
| `post` | Publish an image note (captcha-prone, see below) |
| `topics <keyword>` | Search for topics/hashtags |
| `favorites [userId]` | List collected/favorited notes (defaults to current user) |
| `collect <url>` | Collect (bookmark) a note |
| `uncollect <url>` | Remove a note from your collection |
| `health` | Detect hidden rate-limiting on your notes (via creator API's secret level field) |
| `boards [userId]` | List user's collection boards (defaults to current user) |
| `board <url>` | List notes in a collection album (accepts board URL or ID) |
| `analyze-viral <url>` | Analyze why a viral note works (hooks, engagement, structure) |
| `viral-template <url...>` | Extract a content template from 1-3 viral notes |
| `comment <url>` | Post a top-level comment |
| `reply <url>` | Reply to a specific comment |
| `batch-reply <url>` | Batch reply to comments with filtering strategy (supports dry-run) |
| `render <file>` | Render markdown to styled PNG image cards for XHS posts (optional deps) |

### Global Options

| Option | Description | Default |
|--------|-------------|---------|
| `--cookie-source <browser>` | Browser to read cookies from (chrome, safari, firefox) | `chrome` |
| `--chrome-profile <name>` | Chrome profile directory name (e.g., "Profile 1"). Auto-detected if omitted. | auto |
| `--cookie-string <cookies>` | Manual cookie string: `"a1=VALUE; web_session=VALUE"` (from Chrome DevTools) | none |
| `--platform <name>` | Backend: `xhs` (mainland xiaohongshu.com) or `rednote` (global rednote.com) | `xhs` |
| `--global` | Shorthand for `--platform rednote` (the international RedNote app) | — |
| `--json` | Output as JSON | `false` |

> **Global RedNote users:** if you're logged into the international **RedNote** app (`rednote.com`, not mainland `xiaohongshu.com`), add `--global` to every command. The two are separate backends with separate sessions — without `--global` you'll get `guest` / `登录已过期`. The signing algorithm is identical; only the API host (`webapi.rednote.com`) and cookie domain (`.rednote.com`) differ.

### User Profile Options

`user` and `user-posts` accept full profile URLs such as `https://www.xiaohongshu.com/user/profile/<id>?xsec_token=...&xsec_source=pc_search`. If a bare user ID returns `code=-1`, copy a fresh profile URL from search results or the browser address bar, or pass the token explicitly:

```bash
redbook user "<userId>" --xsec-token "<token>" --xsec-source pc_search --json
redbook user-posts "<userId>" --xsec-token "<token>" --xsec-source pc_search --json
```

### Search Options

| Option | Description | Default |
|--------|-------------|---------|
| `--sort <type>` | `general`, `popular`, `latest` | `general` |
| `--type <type>` | `all`, `video`, `image` | `all` |
| `--page <n>` | Page number | `1` |

### Analyze-Viral / Viral-Template Options

| Option | Description | Default |
|--------|-------------|---------|
| `--comment-pages <n>` | Number of comment pages to fetch | `3` |

### Batch-Reply Options

| Option | Description | Default |
|--------|-------------|---------|
| `--strategy <name>` | `questions`, `top-engaged`, `all-unanswered` | `questions` |
| `--template <text>` | Reply template with `{author}`, `{content}` placeholders | none (dry-run) |
| `--max <n>` | Max replies to send (hard cap: 30) | `10` |
| `--delay <ms>` | Delay between replies in ms (min: 180000 / 3 min), ±30% random jitter applied automatically | `300000` (5 min) |
| `--dry-run` | Preview candidates without posting | auto when no template |

> ⚠️ **Rate limit safety:** XHS detects uniform timing patterns as bot behavior. Reply delays include ±30% random jitter automatically. Limit to 1-2 batch runs per note per day. See SKILL.md for full rate limit guidance.

### Render Options

Render a markdown file to styled PNG image cards. Uses your existing Chrome for rendering — no browser download needed.

| Option | Description | Default |
|--------|-------------|---------|
| `--style <name>` | Color style: purple, xiaohongshu, mint, sunset, ocean, elegant, dark | `xiaohongshu` |
| `--pagination <mode>` | Pagination: auto, separator | `auto` |
| `--output-dir <dir>` | Output directory | same as input |
| `--width <n>` | Card width in pixels | `1080` |
| `--height <n>` | Card height in pixels | `1440` |
| `--dpr <n>` | Device pixel ratio | `2` |

**Optional dependencies:** Requires `puppeteer-core` and `marked`:
```bash
npm install -g puppeteer-core marked
```

### Post Options

Publishing **frequently triggers captcha** (type=124). Image upload works, but the publish step is unreliable. For posting, consider using browser automation instead.

| Option | Description |
|--------|-------------|
| `--title <title>` | Note title (required) |
| `--body <body>` | Note body text (required) |
| `--images <paths...>` | Image file paths (required) |
| `--topic <keyword>` | Topic/hashtag to search and attach |
| `--private` | Publish as private note |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `No 'a1' cookie found` | Log into xiaohongshu.com in Chrome, then retry |
| Windows `-101` error | Chrome 127+ App-Bound Encryption. **Close Chrome first**, then re-run (CLI auto-launches Chrome headless to read cookies). If it still fails, use `--cookie-string` |
| Windows `--cookie-string` | Press F12 in Chrome → Application → Cookies → xiaohongshu.com. Copy `a1` and `web_session` values: `redbook whoami --cookie-string "a1=VALUE; web_session=VALUE"` |
| macOS Keychain prompt | Enter your password and click "Always Allow" — the CLI needs to decrypt Chrome's cookies |
| Multiple Chrome profiles | The CLI auto-scans all profiles (macOS / Windows / Linux). To pick one: `--chrome-profile "Profile 1"` |
| Using Brave/Arc/other | Try `--cookie-source safari`, or log into xiaohongshu.com in Chrome |

## How It Works

`redbook` reads your XHS session cookies from Chrome and signs API requests using a TypeScript port of the XHS signing algorithm.

**Three-tier cookie extraction:**
1. **sweet-cookie** (fast path) — reads Chrome's SQLite cookie database directly. Works instantly on macOS
2. **CDP fallback** (auto on Windows) — launches Chrome headless and reads cookies via DevTools Protocol, bypassing Chrome 127+ App-Bound Encryption
3. **`--cookie-string`** (manual fallback) — paste cookie values from Chrome DevTools. Works on any platform

**Two signing systems:**
- **Main API** (`edith.xiaohongshu.com`) — for reading: search, feed, notes, comments, user profiles. Uses x-s signature with 144-byte payload (v4.3.1).
- **Creator API** (`creator.xiaohongshu.com`) — for writing: upload images, publish notes. Uses simpler AES-128-CBC signing.

## Analysis Modules (A-M)

13 composable analysis modules covering the full workflow from keyword research to content publishing:

| Module | Purpose |
|--------|---------|
| A. Keyword Matrix | Analyze engagement ceiling and competition density per keyword |
| B. Cross-Topic Heatmap | Find topic × scene content gaps |
| C. Engagement Signals | Classify content type (reference / insight / entertainment) |
| D. Creator Profiling | Compare top creators' followers, engagement, style |
| E. Content Form | Image-text vs. video performance comparison |
| F. Opportunity Scoring | Rank keywords by effort-to-reward ratio |
| G. Audience Inference | Infer user persona from engagement signals |
| H. Content Brainstorm | Data-backed content ideas |
| I. Comment Operations | Filter and batch-reply to comments by strategy |
| J. Viral Replication | Extract content templates from viral notes |
| K. Engagement Automation | Combined I + J workflow for operations |
| L. Card Rendering | Markdown → styled PNG image cards for XHS posts (7 color themes) |
| M. Note Health Check | Detect hidden rate-limiting via creator API's secret level field |

See [SKILL.md](SKILL.md) for full module documentation and composed workflows.

## AI Agent Integration

### Claude Code

Installs automatically as a Claude Code skill. Use `/redbook` in Claude Code:

```
/redbook search "AI编程"                        # Search notes
/redbook read <url>                             # Read a note
/redbook user <profileUrl>                      # Creator profile
/redbook analyze-viral <url>                    # Analyze a viral note
```

You can give natural language instructions for complex tasks:

- *"Analyze the competitive landscape for 'AI编程' on Xiaohongshu and find blue ocean keywords"*
- *"Compare the content strategies of these three creators"*
- *"Break down this viral note and tell me why it worked"*
- *"Reply to the question comments on my latest post"*

Claude will automatically combine multiple commands, parse JSON data, and produce structured analysis reports.

### OpenClaw / ClawHub

Officially supports [OpenClaw](https://openclaw.ai) and [ClawHub](https://docs.openclaw.ai/tools/clawhub). Install via ClawHub:

```bash
clawhub install redbook
```

All `redbook` commands are available in OpenClaw after installation. The SKILL.md is compatible with both Claude Code and OpenClaw ecosystems.

## Programmatic Usage

```typescript
import { XhsClient } from "@lucasygu/redbook";
import { loadCookies } from "@lucasygu/redbook/cookies";

const cookies = await loadCookies("chrome");
const client = new XhsClient(cookies);

const results = await client.searchNotes("AI编程", 1, 20, "popular");
const topics = await client.searchTopics("Claude Code");
```

## Acknowledgments

Signing algorithms ported from these open-source projects (MIT licensed):

- [Cloxl/xhshow](https://github.com/Cloxl/xhshow) — Main API signing (x-s, x-s-common)
- [Spider_XHS](https://github.com/JoeanAmier/XHS-Downloader) — Creator API signing
- [ReaJason/xhs](https://github.com/ReaJason/xhs) — API endpoint reference

Cookie extraction via [@steipete/sweet-cookie](https://github.com/nicklockwood/sweet-cookie).

Rate-limit detection inspired by [jzOcb/xhs-note-health-checker](https://github.com/jzOcb/xhs-note-health-checker) ([@xxx111god](https://x.com/xxx111god) discovered the hidden `level` field in the creator backend API).

## Disclaimer

This tool uses unofficial/private APIs. Xiaohongshu may change or block these APIs at any time. Use responsibly and at your own risk. This project is not affiliated with Xiaohongshu.

## License

MIT
