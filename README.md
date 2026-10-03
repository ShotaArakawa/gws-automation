# gws-automation

Google フォームの回答から、Google ドキュメントのテンプレートを使って PDF を作成し、回答者・担当者へメールで送信して、スプレッドシートに記録するツールです。Google Apps Script だけで動くため、維持費はかかりません。

- 仕様：[docs/spec.md](docs/spec.md)
- **導入手順書（非エンジニア向け）：[docs/setup-guide.md](docs/setup-guide.md)**

> 現在の進捗：**M3（カスタムメニュー・導入手順書）実装済み**。次は M4（ユースケース別テンプレート 3 種）です。

## 機能

- フォーム送信時に自動で：テンプレートへ差し込み → PDF を保存 → 回答者へ PDF 付きメール → 担当者へ通知 → 「記録」シートに記録
- スプレッドシートのメニュー「書類の自動送信」
  - **初期設定**：「設定」シートのひな形を作成／設定を検証してフォーム送信トリガーを作成
  - **テスト送信**：最新の回答 1 件で書類を作り、実行した人だけに送信（記録・担当者通知はしない）
  - **失敗分を再送**：「記録」シートで「失敗」の回答を再処理（1 回 20 件まで）
- 設定や差し込みの不備は、ファイルを作る前にまとめて検出し、日本語で表示・通知
- 1 日のメール送信数が残り 10 通を切ると、担当者に 1 日 1 回通知

設定シートと差し込みの書き方は [導入手順書](docs/setup-guide.md) を参照してください。

## 導入代行者向け：テンプレートの配布

導入先には「スクリプト付きのスプレッドシート」をコピーしてもらいます。スプレッドシートをコピーすると、紐づいたスクリプトも一緒にコピーされます（トリガーはコピーされないため、導入先で「初期設定」を実行します）。

1. 開発者向けセットアップの手順でスプレッドシートを作り、`pnpm push` で最新のスクリプトを反映する
2. 配布用のスプレッドシートには **フォームをリンクせず**、「設定」「記録」シートも作らない（導入先の「初期設定」で作成されます）
3. スプレッドシートの共有を「リンクを知っている全員（閲覧者）」にし、`/edit` を `/copy` に変えた URL を渡すと、開いた人にコピー画面が表示される
4. 導入先には [docs/setup-guide.md](docs/setup-guide.md) を渡す

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
| `pnpm push` | ビルドして `clasp push --force`（appsscript.json もローカルの内容で上書き） |
| `pnpm test` | Vitest で単体テスト |
| `pnpm typecheck` | TypeScript の型チェック |
| `pnpm lint` / `pnpm format` | Biome によるチェック / 自動修正 |
| `pnpm check` | lint・型チェック・テスト・ビルドをまとめて実行（CI と同じ内容） |

## 仕組みのメモ

- clasp 3 は TypeScript を変換しないため、esbuild で 1 ファイルにまとめてから push します。
- Apps Script から名前で呼ばれる関数（トリガー・メニュー・エディタから実行する関数）は、`src/main.ts` で `globalThis` に公開します。`scripts/build.mjs` がそれを検出し、エディタの関数一覧にも出るよう宣言を追加します。
- GitHub Actions（`.github/workflows/ci.yml`）で、push・プルリクエストごとに lint・型チェック・テスト・ビルドを実行します。
