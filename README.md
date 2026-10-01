# gws-automation

Google フォームの回答から、Google ドキュメントのテンプレートを使って PDF を作成し、回答者・担当者へメールで送信して、スプレッドシートに記録するツールです。Google Apps Script だけで動くため、維持費はかかりません。

仕様は [docs/spec.md](docs/spec.md) を参照してください。

> 現在の進捗：**M0（開発環境の土台）完了**。フォーム連携などの機能は M1 以降で実装します。

## 開発者向けセットアップ

### 必要なもの

- Node.js 24（`.nvmrc` 参照）
- pnpm（Node.js に同梱の corepack で有効化）
- Google アカウント

### 1. 依存パッケージのインストール

```bash
corepack enable pnpm
pnpm install
```

### 2. Apps Script API を有効にする（初回のみ）

ブラウザで <https://script.google.com/home/usersettings> を開き、「Google Apps Script API」を **オン** にします。オフのままだと `clasp push` が失敗します。

### 3. clasp にログインする（初回のみ）

```bash
pnpm exec clasp login
```

ブラウザが開くので、使う Google アカウントで許可します。認証情報は `~/.clasprc.json` に保存されます（リポジトリには含めません）。

### 4. スクリプトプロジェクトを用意する

**新しく作る場合**（スプレッドシートと、そこに紐づくスクリプトがまとめて作成されます）：

```bash
pnpm exec clasp create --type sheets --title "gws-automation" --rootDir dist
```

**既存のスクリプトを使う場合**：`.clasp.json.example` を `.clasp.json` にコピーし、`scriptId` を書き換えます。スクリプト ID は Apps Script エディタの「プロジェクトの設定」→「スクリプト ID」で確認できます。

```bash
cp .clasp.json.example .clasp.json
```

`.clasp.json` は導入先ごとに異なるため、Git には含めません。

### 5. ビルドして反映する

```bash
pnpm push
```

TypeScript を `dist/Code.js` にまとめてから、Apps Script に反映します。

### 6. 動作確認

```bash
pnpm exec clasp open-script
```

開いた Apps Script エディタで関数 `healthCheck` を選んで実行し、実行ログに `gws-automation is ready` と表示されれば成功です。

## 開発コマンド

| コマンド | 内容 |
|---|---|
| `pnpm build` | `src/main.ts` を esbuild で `dist/Code.js` にバンドル |
| `pnpm push` | ビルドして `clasp push` |
| `pnpm test` | Vitest で単体テスト |
| `pnpm typecheck` | TypeScript の型チェック |
| `pnpm lint` / `pnpm format` | Biome によるチェック / 自動修正 |
| `pnpm check` | lint・型チェック・テスト・ビルドをまとめて実行（CI と同じ内容） |

## 仕組みのメモ

- clasp 3 は TypeScript を変換しないため、esbuild で 1 ファイルにまとめてから push します。
- Apps Script から名前で呼ばれる関数（トリガー・メニュー・エディタから実行する関数）は、`src/main.ts` で `globalThis` に公開します。`scripts/build.mjs` がそれを検出し、エディタの関数一覧にも出るよう宣言を追加します。
- GitHub Actions（`.github/workflows/ci.yml`）で、push・プルリクエストごとに lint・型チェック・テスト・ビルドを実行します。
