# TODO

Next.js で作ったシンプルな TODO リストアプリです。

🔗 公開URL: https://todo-next-one-livid.vercel.app

## 機能

- TODO の追加・完了・削除
- 期限（任意）の設定。今日が期限なら青、期限切れは赤で表示
- ダブルクリックで編集（Enter で確定 / Esc でキャンセル）
- 「すべて / 未完了 / 完了済み」の絞り込み
- すべて完了にする・完了済みを一括削除
- ブラウザ（localStorage）に保存。他のタブの変更も反映
- ダークモード・スマホ対応

## 開発

```bash
npm install
npm run dev
```

http://localhost:3000 を開きます。

## 技術スタック

- Next.js 16 (App Router) / React 19 / TypeScript
- Tailwind CSS 4.1

## デプロイ

`main` ブランチにプッシュすると Vercel に自動デプロイされます。
