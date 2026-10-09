# FX Project — Neo-Brutalism Script Uploader

Clean rebuild for FX Project. It uses only the Neo-Brutalism visual direction (heavy black borders, offset shadows, pastel blocks, bold type) from the supplied reference project. The original app layout/features are not carried over.

## Features
- Responsive homepage with search, script cards, upload total and download total.
- Upload ZIP with script name, description, author and optional download password.
- Upload progress and success state.
- Detail page with protected/public download.
- Passwords hashed with bcrypt; hashes and storage paths are never returned by public APIs.
- ZIP files and metadata stored in a separate GitHub repository through GitHub Contents API.
- Vercel-friendly Next.js App Router project.

## 1. Create the private storage repository
Create a repository named `fx-project-storage` and upload the contents of the separate **FX-Project-Storage.zip** starter into its root. Ensure `data/scripts.json` exists and contains `[]`, and the `scripts/` directory exists.

## 2. Create a GitHub token
Use a fine-grained personal access token. Select only the `fx-project-storage` repository and grant **Contents: Read and write**. Keep the token secret; never use it in browser/client code.

## 3. Deploy the website
Upload this project to a separate GitHub repository, e.g. `fx-project-web`. Import that repository into Vercel. Framework preset: Next.js. Build command: `npm run build`; install command: `npm install`.

Add these Environment Variables in Vercel → Project → Settings → Environment Variables:

| Name | Value |
| --- | --- |
| `GITHUB_STORAGE_TOKEN` | Fine-grained token above |
| `GITHUB_STORAGE_OWNER` | GitHub username/organization owning storage repo |
| `GITHUB_STORAGE_REPO` | `fx-project-storage` |
| `GITHUB_STORAGE_BRANCH` | `main` (or actual default branch) |
| `NEXT_PUBLIC_SITE_URL` | Deployed website URL, e.g. `https://fx-project.vercel.app` |
| `MAX_UPLOAD_BYTES` | `3500000` (optional) |

Redeploy after saving environment variables.

## 4. Test after deployment
1. Open the website and check the empty library loads.
2. Upload a small ZIP you own or have permission to distribute.
3. Confirm `scripts/<id>.zip` and `data/scripts.json` appear in the private storage repo.
4. Open the script detail page and test download.
5. Upload another script with a password and test both incorrect and correct passwords.

## Limits and security notes
- The upload is capped at about 2.8 MB because standard Vercel serverless request bodies have limits. Larger uploads should use direct-to-storage uploads or a dedicated object store.
- Basic ZIP signature validation is not malware scanning and does not protect against ZIP bombs. Only distribute trusted files.
- The in-memory rate guard is best-effort only; serverless instances do not share memory. Before opening uploads to the public, add persistent edge/WAF rate limiting and abuse controls.
- GitHub Contents API + one JSON metadata file is suitable for a small project, not high concurrency. Concurrent metadata changes can still race; use a database/object store for a larger community.
- Download counts are best-effort and may occasionally be inaccurate if downloads happen at the same time.
- Never expose `GITHUB_STORAGE_TOKEN` to client-side code or commit it to GitHub.

## Telegram notifications and report page

The site has a `/report` page. Reports are sent to the Telegram chat configured below, and each successful script upload triggers an admin notification containing the script ID, name, author/developer, description, file size, password-protection status, upload time, download count, and script link.

Add these environment variables in Vercel → Project → Settings → Environment Variables (Production, and Preview if needed):

- `TELEGRAM_BOT_TOKEN`: token from Telegram's official `@BotFather` after creating a bot.
- `TELEGRAM_CHAT_ID`: the admin's private chat ID or a private admin group ID.

Setup:
1. Create a bot using `@BotFather` and copy the token. Keep it secret.
2. Open the bot in Telegram and press Start. For a group, add the bot and send a message in that group.
3. Find the chat ID using a trusted Telegram bot/API method, then set `TELEGRAM_CHAT_ID` in Vercel.
4. Redeploy after setting the environment variables.
5. Test `/report` and then upload a test ZIP. Check the configured Telegram chat.

Security note: notifications intentionally **never include the original download password**. The password is stored as a bcrypt hash, which cannot be used to recover the original password, and sending secrets to chat history would expose them to anyone with access to that chat. The notification only tells the admin whether password protection is enabled. Do not place bot tokens in client-side code or variables prefixed with `NEXT_PUBLIC_`.

The Telegram notification is best-effort: if Telegram is temporarily unavailable, an upload that has already been saved will still succeed. The in-memory rate limiter is also only a light per-instance guard; configure a persistent rate limit/WAF before opening the public upload/report forms widely.

## Thumbnail script
Uploader dapat menambahkan thumbnail opsional JPG, PNG, atau WEBP (maksimal 300 KB). Gambar disimpan di repository storage pada folder `thumbnails/`, lalu ditampilkan pada kartu library/detail melalui endpoint thumbnail website. Jika `NEXT_PUBLIC_SITE_URL` benar, notifikasi upload Telegram menggunakan foto thumbnail sebagai cover; jika tidak ada thumbnail, bot mengirim pesan teks.

## Telegram
Laporan dan upload memakai `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID`. Pesan upload memuat ID, nama, author, deskripsi, ukuran, status proteksi password (bukan password aslinya), waktu, dan tautan. Password asli tidak pernah dikirim ke Telegram.


## Upload diagnostics update
The publish form now reads API responses defensively and shows HTTP status/request ID when the server responds with an error. The upload API writes request-phase diagnostics to Vercel Runtime Logs without logging file contents or credentials. For compatibility with Vercel request-body limits, the default ZIP cap is 2.8 MB and thumbnail cap is 300 KB. Set `MAX_UPLOAD_BYTES` no higher than `2800000`.
