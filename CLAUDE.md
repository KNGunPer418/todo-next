# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

（`AGENTS.md` は `next dev` が自動生成・復元するファイル。編集せず、変更が出たらそのままコミットする。Next.js のコードを書く前に `node_modules/next/dist/docs/` の該当ガイドを確認すること。）

## プロジェクト概要

Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS 4.1 で作ったシンプルな TODO リストアプリ。UI テキストはすべて日本語。バックエンド・API・DB はなく、データはブラウザの localStorage のみに保存する。

- 本番: https://todo-next-one-livid.vercel.app
- GitHub: https://github.com/KNGunPer418/todo-next（公開）
- `main` へ push すると Vercel に自動デプロイされる（他ブランチはプレビュー URL）。手動デプロイは `npx vercel deploy --prod`。

## コマンド

```bash
npm run dev        # 開発サーバー (http://localhost:3000, Turbopack)
npm run build      # 本番ビルド
npm run start      # 本番サーバー
npx eslint .       # lint（Next 16 では `next lint` は廃止）
npx tsc --noEmit   # 型チェック
npm test                                   # Vitest を 1 回実行
npm run test:watch                         # ウォッチモード
npm run test:coverage                      # カバレッジ付き（coverage/ に出力）
npx vitest run src/components/TodoApp.test.tsx   # 1 ファイルだけ
npx vitest run -t "期限が今日なら"                # テスト名で絞り込み
```

## テスト

- Vitest 3.2 + React Testing Library + user-event + jsdom。テストは対象ファイルと同じ場所に `*.test.tsx` として置く。
- **バージョンは Node 20.18 に合わせて固定している**（vitest 3.2 / vite 6 / @vitejs/plugin-react 4 / jsdom 26）。vitest 4・vite 7・plugin-react 5・jsdom 27 は Node 20.19 以上が必要。
- `vitest.config.mts` で `css.postcss.plugins: []` を指定し、Next 用の `postcss.config.mjs` を Vite に読ませないようにしている（読ませると「Invalid PostCSS Plugin」で失敗する）。
- `vitest.setup.ts` で、各テストの後に `cleanup`・`localStorage.clear()`・実タイマーへの復帰を行う。`restoreMocks: true` なので `vi.spyOn` はテストごとに元に戻る。
- 期限のテストは `vi.useFakeTimers({ toFake: ["Date"] })` で日付だけを固定する（user-event が止まらないよう、タイマーは偽装しない）。
- `layout.tsx` は `<html>` を返すので描画せず、戻り値の要素ツリーを直接検証している。

## アーキテクチャ

- `src/app/page.tsx` は Server Component で、クライアントコンポーネント `src/components/TodoApp.tsx` を描画するだけ。
- アプリの状態とロジックはすべて `TodoApp.tsx`（`"use client"`）の中にある。
  - localStorage キー: `todo-next:todos`（`Todo[]`）と `todo-next:filter`。
  - SSR とのハイドレーション不一致を避けるため、localStorage はマウント後の `useEffect` で読み込み、`loaded` フラグが立つまで保存しない。空表示などは `loaded` を見て出し分けている。
  - `storage` イベントで他タブの変更を反映する。
  - `Todo.due` は `"YYYY-MM-DD"` 文字列か `""`。期限判定は文字列比較で行う。`loadTodos()` は古いデータ（`due` なし）を補完するので、`Todo` 型を変えるときはここで移行処理を書く。
  - 編集中の Enter は `e.nativeEvent.isComposing` を確認し、日本語 IME の変換確定で誤って確定しないようにしている。
- スタイリングは Tailwind のユーティリティクラスではなく、`src/app/globals.css` に書いたプレーンな CSS クラス（`.app`, `.todo-item`, `.is-completed` など）と CSS 変数（`--bg`, `--accent` など。ダークモードは `prefers-color-scheme` で切り替え）で行っている。Tailwind は `@import` されているが実質使っていない。見た目を変えるときは `globals.css` の変数とクラスを編集する。

## 注意点

- **Tailwind は `~4.1` に固定している。** 4.3 系は ESM 専用の `magic-string` に依存していて、ローカルの Node 20.18 では `require()` できずビルドに失敗する。Node を 20.19 以上に上げるまでは更新しないこと。依存を変えたあとにこのエラーが出たら、`.next` を削除してから再ビルドする（Turbopack のキャッシュが残るため）。
- ESLint は Next 16 のフラット設定（`eslint-config-next/core-web-vitals` と `eslint-config-next/typescript`）を使う。`react-hooks/set-state-in-effect` ルールがあるので、マウント時に localStorage を読み込む箇所では意図的に無効化コメントを入れている。
- git の作成者はリポジトリローカル設定で GitHub の noreply アドレスにしてある。グローバル設定は未設定。

## テストコード作成時の厳守事項

### 絶対に守ってください。

#### テストコードの品質
- テストは必ず実際の機能を検証すること
- `except(true).toBe(true)`のような意味のないアサーションを絶対に書かないこと
- 各テストケースは具体的な入力と期待される出力を検証すること
- モックは必要最低限に留め、実際の動作に近い形でテストすること
#### ハードコーディングの禁止
- テストを通すためだけのハードコードは絶対に禁止
- 本番コードに`if(testMode)`のような条件分岐を入れない
- テスト用の特別な値(マジックナンバー)を本番コードの埋め込まない
- 環境変数や設定ファイルを使用して、テスト環境と本番環境を適切に分離すること

#### テスト実装の原則
- テストが失敗する状態から始めること(Red-Green-Refactor)
- 境界値、異常系、エラーケースも必ずテストすること
- カバレッジだけでなく、実際の品質も重視すること
- テストケース名は何をテストしているか明確に記述すること

#### 実装前の確認
- 機能の仕様を正しく理解してからテストを書くこと
- 不明な点があれば、仮の実装ではなく、ユーザに確認すること
