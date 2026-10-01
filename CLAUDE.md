# gws-automation — Googleフォーム回答から書類を自動作成・送信

Googleフォームの回答をもとに、Googleドキュメントのテンプレートへ差し込んで PDF を作り、回答者・担当者へメール送信し、スプレッドシートに記録するツール。
詳細な仕様は `docs/spec.md` を必ず読んでから作業すること。

## 最重要の制約：維持費0円
- Google Apps Script（GAS）だけで動かす。外部サーバーは使わない（必要になったら実装前に相談すること）。
- GAS のクォータ（メール送信数・実行時間6分など）を超えない設計にする。

## 技術スタック
- Google Apps Script（V8 ランタイム）
- TypeScript（strict）で書き、**esbuild でバンドルしてから clasp で push** する（clasp 3 では TypeScript の自動変換が無いため）
  - GAS から呼ばれる関数（`onFormSubmit`、メニュー用関数など）は `globalThis` に明示的に公開する
- clasp：ローカル開発・デプロイ
- テスト：Vitest。GAS の API（FormApp、DocumentApp、DriveApp、MailApp、SpreadsheetApp）は直接呼ばず、`src/adapters/` のインターフェース経由で使う。テストではモックに差し替え、ロジック（差し込み・バリデーション・設定読み込み）を単体テストする
- Lint/Format：Biome　CI：GitHub Actions（lint・typecheck・test）

## ディレクトリ構成（目安）
```
src/
  main.ts          # GAS に公開するエントリーポイント
  core/            # 純粋なロジック（GAS に依存しない）
  adapters/        # GAS API のラッパー（インターフェース＋実装）
test/
appsscript.json
```

## コーディング規約
- `any` 禁止。入力（フォーム回答・設定シート）は必ず検証してから使う。
- 設定値はコードに埋め込まず「設定」シートから読む。
- 個人情報をログ（console.log / Logger）に出さない。
- エラー時は担当者にエラー内容をメール通知し、記録シートに「失敗」として残す。
- UI の文言は日本語。コード・コミットメッセージは英語でよい。

## 進め方
- `docs/spec.md` のマイルストーン順に進める。各マイルストーン完了時に、セットアップ手順を README に追記する（非エンジニアの導入先にも渡せるレベルで）。
- 仕様に無い判断が必要になったら、勝手に決めずに選択肢を提示して確認すること。
