# Supabase 集成说明（多人可见 + 24 小时自动过期）

本仓库包含：

- `index.html`：前端页面，支持 **本地 IndexedDB 存储**（默认）或开启 **Supabase（多人可见）** 上传。
- `cleanup.js`：后端清理脚本（Node ESM），使用 Supabase 的 `service_role` key 列出并删除 `media_meta` 中 `expires_at <= now()` 的记录与对应的存储对象。
- `package.json`：为 `cleanup.js` 提供依赖（`@supabase/supabase-js`）
- `.github/workflows/cleanup.yml`：GitHub Actions 定时触发清理（每 30 分钟）
- `sql/create_media_meta.sql`：创建 `media_meta` 表的 SQL（运行在 Supabase SQL Editor）

---

## 快速上手（步骤）

### 1) 在 Supabase 控制台创建项目
- 注册并创建一个新项目，记下 `SUPABASE_URL`（形如 `https://xxxxx.supabase.co`）与 **ANON public key**（用于前端浏览器上传），以及 **service_role** key（仅后端使用，不要公开）。

### 2) 创建 Storage Bucket
- 在 Supabase 仪表盘 → Storage → Create bucket：创建名为 `public-media` 的 bucket。
  - 如果你希望文件无需签名即可访问（简单），点击 bucket 右上角菜单并选择 **Make public**。否则请保持 Private 并使用后端签名 URL（本示例使用 public bucket 更简单）。

### 3) 在 SQL Editor 中创建 `media_meta` 表
- 复制仓库中的 `sql/create_media_meta.sql` 到 Supabase SQL 编辑器并运行（或在 SQL Editor 中运行）：这会创建 `media_meta` 表并给 `expires_at` 建索引。

### 4) 部署前端
- 你可以将 `index.html` 上传到 GitHub 仓库并启用 GitHub Pages（main 分支 / root），或直接使用任何静态托管（Netlify / Vercel / Surge 等）。
- 前端使用方法：
  1. 打开页面，若想让文件对他人可见，切换上方的 **开启 Supabase（多人可见）**，并填写 `Supabase URL` 与 `Supabase ANON KEY`。
  2. 选择或拖拽文件，默认会上传到 `public-media` 并在 `media_meta` 表写入 metadata（包含 `expires_at`）。
  3. 若不启用 Supabase，则文件保存在浏览器 IndexedDB（本机私有）并按本地 24 小时过期规则自动清理。

> 浏览器端仅使用 ANON public key（可公开），**绝对不要**把 `service_role` key 放到前端代码或仓库。

### 5) 启用自动清理（推荐）
- 将仓库 push 到 GitHub 后，在仓库 Settings → Secrets → Actions 添加以下 Secrets：
  - `SUPABASE_URL`：你的 Supabase 项目 URL（示例：https://xxxxx.supabase.co）
  - `SUPABASE_SERVICE_ROLE`：Supabase service_role key（后端专用）
- 确保 `.github/workflows/cleanup.yml` 已包含并在 `main` 分支可见。GitHub Actions 将按 cron 定期运行 `cleanup.js`，删除所有已到期的文件与 metadata。

### 6) 手动触发或调试 cleanup 脚本
- 在本地或 CI 中你也可以运行：
```bash
export SUPABASE_URL="https://xxxxx.supabase.co"
export SUPABASE_SERVICE_ROLE="eyJhbGciOiJ..."
npm ci
node cleanup.js
```

---

## 安全与注意事项
- **service_role key** 拥有最高权限，必须妥善保管并仅在后端环境使用（例如 GitHub Actions Secrets / Vercel Environment Variables / Cloudflare Worker Secrets / Supabase Edge Function）。
- 使用 public bucket 可以直接通过 `getPublicUrl` 获得可访问链接；若对隐私要求高，请使用 private bucket + 后端签名 URL（`createSignedUrl`）并在前端使用短期签名链接。
- 为避免被滥用，考虑：
  - 在 Supabase 数据库中为 `media_meta` 建立 RLS（Row Level Security）策略或在上传逻辑中限制单 IP/单用户上传速率（更多实现需要后端）。
  - 对上传文件大小、类型、MIME 做校验（前端已做基本校验）。

---

## 我能帮你做的下一步（可选）
- 我可以把 `index.html` 的 Supabase 配置替换成使用你现有的 `SUPABASE_URL` / ANON KEY（仅当你提供它们且确认公开），或进一步把前端改为使用 OAuth 登录并将 uploader 与用户绑定。
- 我也可以把 cleanup 脚本部署为 Supabase Edge Function 或 Cloudflare Worker，并示范如何使用 `createSignedUrl` 实现 private bucket 的短期访问。

---
