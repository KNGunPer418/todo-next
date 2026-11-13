import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TodoApp from "./TodoApp";

const STORAGE_KEY = "todo-next:todos";
const FILTER_KEY = "todo-next:filter";

type StoredTodo = {
  id: string;
  text: string;
  done: boolean;
  due?: string;
  createdAt: number;
};

function makeTodo(overrides: Partial<StoredTodo> & { text: string }): StoredTodo {
  return {
    id: `id-${overrides.text}`,
    done: false,
    due: "",
    createdAt: 0,
    ...overrides,
  };
}

function seed(todos: StoredTodo[], filter?: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  if (filter !== undefined) localStorage.setItem(FILTER_KEY, filter);
}

function stored(): StoredTodo[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
}

function setup() {
  const user = userEvent.setup();
  render(<TodoApp />);
  return {
    user,
    titleInput: screen.getByRole("textbox", { name: "新しいTODO" }),
    dueInput: screen.getByLabelText("期限（任意）"),
    addButton: screen.getByRole("button", { name: "追加" }),
    toggleAll: screen.getByRole("checkbox", { name: "すべて完了にする" }),
  };
}

/** 画面に表示されている TODO のタイトルを上から順に返す */
function visibleTitles() {
  return screen.queryAllByRole("listitem").map((li) => {
    const title = li.querySelector(".todo-title");
    return title?.textContent ?? null;
  });
}

function itemByTitle(title: string) {
  const li = screen.getByText(title).closest("li");
  if (!li) throw new Error(`「${title}」の行が見つかりません`);
  return li;
}

/** 今日を 2026-11-13（ローカル時間の正午）に固定する */
function freezeToday() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 13, 12, 0, 0));
}

describe("TodoApp", () => {
  describe("初期表示", () => {
    it("保存データがないとき、空メッセージと「残り 0 件」を表示し、一覧・進捗・完了済み削除ボタンは出さない", () => {
      setup();

      expect(screen.getByRole("heading", { level: 1, name: "TODO" })).toBeInTheDocument();
      expect(screen.getByText("TODOはありません")).toBeInTheDocument();
      expect(screen.getByText("残り 0 件")).toBeInTheDocument();
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
      expect(screen.queryByText(/^\d+ \/ \d+ 完了$/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "完了済みを削除" })).not.toBeInTheDocument();
    });

    it("TODO が 0 件のとき「すべて完了にする」は無効で未チェック", () => {
      const { toggleAll } = setup();

      expect(toggleAll).toBeDisabled();
      expect(toggleAll).not.toBeChecked();
    });

    it("フィルターは「すべて」が選択状態になっている", () => {
      setup();

      expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "未完了" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: "完了済み" })).toHaveAttribute("aria-pressed", "false");
    });
  });

  describe("TODO の追加", () => {
    it("入力して Enter を押すと一覧に追加され、入力欄が空になる", async () => {
      const { user, titleInput } = setup();

      await user.type(titleInput, "牛乳を買う{Enter}");

      expect(visibleTitles()).toEqual(["牛乳を買う"]);
      expect(titleInput).toHaveValue("");
      expect(screen.getByText("残り 1 件")).toBeInTheDocument();
      expect(screen.getByText("0 / 1 完了")).toBeInTheDocument();
      expect(screen.queryByText("TODOはありません")).not.toBeInTheDocument();
    });

    it("「追加」ボタンでも追加できる", async () => {
      const { user, titleInput, addButton } = setup();

      await user.type(titleInput, "掃除");
      await user.click(addButton);

      expect(visibleTitles()).toEqual(["掃除"]);
    });

    it("新しい TODO は一覧の末尾に追加される", async () => {
      const { user, titleInput } = setup();

      await user.type(titleInput, "1つ目{Enter}");
      await user.type(titleInput, "2つ目{Enter}");
      await user.type(titleInput, "3つ目{Enter}");

      expect(visibleTitles()).toEqual(["1つ目", "2つ目", "3つ目"]);
    });

    it("前後の空白は取り除いて保存される", async () => {
      const { user, titleInput } = setup();

      await user.type(titleInput, "  洗濯  {Enter}");

      expect(visibleTitles()).toEqual(["洗濯"]);
      expect(stored().map((t) => t.text)).toEqual(["洗濯"]);
    });

    it("空白だけの入力では追加されない", async () => {
      const { user, titleInput } = setup();

      await user.type(titleInput, "   {Enter}");

      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
      expect(screen.getByText("TODOはありません")).toBeInTheDocument();
    });

    it("何も入力せずに送信しても追加されない", async () => {
      const { user, addButton } = setup();

      await user.click(addButton);

      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    });

    it("タイトルはちょうど 200 文字まで入力でき、201 文字目は入らない", async () => {
      const { user, titleInput } = setup();
      const text200 = "あ".repeat(200);

      await user.click(titleInput);
      await user.paste(text200 + "い");
      await user.keyboard("{Enter}");

      expect(stored()[0].text).toBe(text200);
      expect(stored()[0].text).toHaveLength(200);
    });

    it("追加した TODO は未完了・期限なしで作られ、それぞれ別の id を持つ", async () => {
      const { user, titleInput } = setup();

      await user.type(titleInput, "A{Enter}");
      await user.type(titleInput, "B{Enter}");

      const [a, b] = stored();
      expect(a).toMatchObject({ text: "A", done: false, due: "" });
      expect(b).toMatchObject({ text: "B", done: false, due: "" });
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("期限", () => {
    beforeEach(() => {
      freezeToday();
    });

    it("期限を指定して追加すると保存され、追加後に期限の入力欄が空になる", async () => {
      const { user, titleInput, dueInput } = setup();

      await user.type(titleInput, "レポート提出");
      fireEvent.change(dueInput, { target: { value: "2026-12-01" } });
      await user.keyboard("{Enter}");

      expect(stored()[0].due).toBe("2026-12-01");
      expect(dueInput).toHaveValue("");
    });

    it("期限が今日なら「期限: 今日 (11/13)」と表示し、is-today クラスが付く", () => {
      seed([makeTodo({ text: "今日の用事", due: "2026-11-13" })]);
      setup();

      const li = itemByTitle("今日の用事");
      expect(within(li).getByText("期限: 今日 (11/13)")).toBeInTheDocument();
      expect(li).toHaveClass("is-today");
      expect(li).not.toHaveClass("is-overdue");
    });

    it("期限が昨日なら「期限切れ: 2026/11/12」と表示し、is-overdue クラスが付く", () => {
      seed([makeTodo({ text: "昨日の用事", due: "2026-11-12" })]);
      setup();

      const li = itemByTitle("昨日の用事");
      expect(within(li).getByText("期限切れ: 2026/11/12")).toBeInTheDocument();
      expect(li).toHaveClass("is-overdue");
      expect(li).not.toHaveClass("is-today");
    });

    it("期限が明日なら「期限: 2026/11/14」と表示し、今日・期限切れのクラスは付かない", () => {
      seed([makeTodo({ text: "明日の用事", due: "2026-11-14" })]);
      setup();

      const li = itemByTitle("明日の用事");
      expect(within(li).getByText("期限: 2026/11/14")).toBeInTheDocument();
      expect(li).not.toHaveClass("is-today");
      expect(li).not.toHaveClass("is-overdue");
    });

    it("年をまたぐ期限（前年の大みそか）も期限切れになる", () => {
      seed([makeTodo({ text: "去年の用事", due: "2025-12-31" })]);
      setup();

      const li = itemByTitle("去年の用事");
      expect(within(li).getByText("期限切れ: 2025/12/31")).toBeInTheDocument();
      expect(li).toHaveClass("is-overdue");
    });

    it("期限なしの TODO には期限の表示が出ない", () => {
      seed([makeTodo({ text: "いつでも", due: "" })]);
      setup();

      const li = itemByTitle("いつでも");
      expect(li.querySelector(".todo-due")).toBeNull();
      expect(within(li).queryByText(/期限/)).not.toBeInTheDocument();
    });

    it("期限切れでも完了済みなら is-completed クラスが付く", () => {
      seed([makeTodo({ text: "済んだ用事", due: "2026-11-01", done: true })]);
      setup();

      expect(itemByTitle("済んだ用事")).toHaveClass("is-completed", "is-overdue");
    });
  });

  describe("完了の切り替え", () => {
    it("チェックすると完了になり、件数と進捗が更新される", async () => {
      seed([makeTodo({ text: "A" }), makeTodo({ text: "B" })]);
      const { user } = setup();

      const li = itemByTitle("A");
      await user.click(within(li).getByRole("checkbox", { name: "完了" }));

      expect(within(li).getByRole("checkbox", { name: "完了" })).toBeChecked();
      expect(li).toHaveClass("is-completed");
      expect(screen.getByText("残り 1 件")).toBeInTheDocument();
      expect(screen.getByText("1 / 2 完了")).toBeInTheDocument();
      expect(stored().find((t) => t.text === "A")?.done).toBe(true);
      expect(stored().find((t) => t.text === "B")?.done).toBe(false);
    });

    it("完了済みのチェックを外すと未完了に戻る", async () => {
      seed([makeTodo({ text: "A", done: true })]);
      const { user } = setup();

      const li = itemByTitle("A");
      await user.click(within(li).getByRole("checkbox", { name: "完了" }));

      expect(li).not.toHaveClass("is-completed");
      expect(screen.getByText("残り 1 件")).toBeInTheDocument();
      expect(stored()[0].done).toBe(false);
    });
  });

  describe("すべて完了にする", () => {
    it("チェックすると全件が完了になる", async () => {
      seed([makeTodo({ text: "A" }), makeTodo({ text: "B", done: true }), makeTodo({ text: "C" })]);
      const { user, toggleAll } = setup();

      expect(toggleAll).not.toBeChecked();
      await user.click(toggleAll);

      expect(stored().every((t) => t.done)).toBe(true);
      expect(toggleAll).toBeChecked();
      expect(screen.getByText("残り 0 件")).toBeInTheDocument();
      expect(screen.getByText("3 / 3 完了")).toBeInTheDocument();
    });

    it("全件完了の状態で外すと全件が未完了になる", async () => {
      seed([makeTodo({ text: "A", done: true }), makeTodo({ text: "B", done: true })]);
      const { user, toggleAll } = setup();

      expect(toggleAll).toBeChecked();
      await user.click(toggleAll);

      expect(stored().every((t) => !t.done)).toBe(true);
      expect(toggleAll).not.toBeChecked();
    });

    it("1 件ずつ完了にして全件完了になると、自動的にチェック状態になる", async () => {
      seed([makeTodo({ text: "A" }), makeTodo({ text: "B" })]);
      const { user, toggleAll } = setup();

      await user.click(within(itemByTitle("A")).getByRole("checkbox"));
      expect(toggleAll).not.toBeChecked();
      await user.click(within(itemByTitle("B")).getByRole("checkbox"));
      expect(toggleAll).toBeChecked();
    });

    it("TODO を追加すると有効になる", async () => {
      const { user, titleInput, toggleAll } = setup();

      await user.type(titleInput, "A{Enter}");

      expect(toggleAll).toBeEnabled();
    });
  });

  describe("絞り込み", () => {
    beforeEach(() => {
      seed([
        makeTodo({ text: "未完了1" }),
        makeTodo({ text: "完了1", done: true }),
        makeTodo({ text: "未完了2" }),
      ]);
    });

    it("「未完了」を選ぶと未完了だけが表示される", async () => {
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: "未完了" }));

      expect(visibleTitles()).toEqual(["未完了1", "未完了2"]);
      expect(screen.getByRole("button", { name: "未完了" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "false");
    });

    it("「完了済み」を選ぶと完了済みだけが表示される", async () => {
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: "完了済み" }));

      expect(visibleTitles()).toEqual(["完了1"]);
    });

    it("「すべて」に戻すと全件が元の順で表示される", async () => {
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: "完了済み" }));
      await user.click(screen.getByRole("button", { name: "すべて" }));

      expect(visibleTitles()).toEqual(["未完了1", "完了1", "未完了2"]);
    });

    it("絞り込み中は、表示件数ではなく全体の残り件数を表示する", async () => {
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: "完了済み" }));

      expect(screen.getByText("残り 2 件")).toBeInTheDocument();
      expect(screen.getByText("1 / 3 完了")).toBeInTheDocument();
    });

    it("「未完了」表示中に完了にすると、その TODO は一覧から消える", async () => {
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: "未完了" }));
      await user.click(within(itemByTitle("未完了1")).getByRole("checkbox"));

      expect(visibleTitles()).toEqual(["未完了2"]);
    });

    it("該当がないとき、フィルターに応じた空メッセージを表示する", async () => {
      const { user, toggleAll } = setup();

      await user.click(toggleAll); // 全件完了
      await user.click(screen.getByRole("button", { name: "未完了" }));
      expect(screen.getByText("未完了のTODOはありません")).toBeInTheDocument();
      expect(screen.queryByRole("list")).not.toBeInTheDocument();

      await user.click(toggleAll); // 全件未完了
      await user.click(screen.getByRole("button", { name: "完了済み" }));
      expect(screen.getByText("完了済みのTODOはありません")).toBeInTheDocument();
    });

    it("選んだフィルターは localStorage に保存される", async () => {
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: "完了済み" }));

      expect(localStorage.getItem(FILTER_KEY)).toBe("done");
    });
  });

  describe("削除", () => {
    it("× ボタンでその TODO だけが削除される", async () => {
      seed([makeTodo({ text: "A" }), makeTodo({ text: "B" }), makeTodo({ text: "C" })]);
      const { user } = setup();

      await user.click(within(itemByTitle("B")).getByRole("button", { name: "削除" }));

      expect(visibleTitles()).toEqual(["A", "C"]);
      expect(stored().map((t) => t.text)).toEqual(["A", "C"]);
    });

    it("最後の 1 件を削除すると空メッセージが表示される", async () => {
      seed([makeTodo({ text: "A" })]);
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: "削除" }));

      expect(screen.getByText("TODOはありません")).toBeInTheDocument();
      expect(stored()).toEqual([]);
    });
  });

  describe("完了済みを削除", () => {
    it("完了済みが 0 件のときはボタンを表示しない", () => {
      seed([makeTodo({ text: "A" })]);
      setup();

      expect(screen.queryByRole("button", { name: "完了済みを削除" })).not.toBeInTheDocument();
    });

    it("完了済みだけを削除し、未完了は残す", async () => {
      seed([
        makeTodo({ text: "A", done: true }),
        makeTodo({ text: "B" }),
        makeTodo({ text: "C", done: true }),
      ]);
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: "完了済みを削除" }));

      expect(visibleTitles()).toEqual(["B"]);
      expect(stored().map((t) => t.text)).toEqual(["B"]);
      expect(screen.queryByRole("button", { name: "完了済みを削除" })).not.toBeInTheDocument();
    });
  });

  describe("編集", () => {
    beforeEach(() => {
      seed([makeTodo({ text: "元のタイトル" }), makeTodo({ text: "別のTODO" })]);
    });

    async function startEditing(title = "元のタイトル") {
      const ctx = setup();
      await ctx.user.dblClick(screen.getByText(title));
      const editInput = screen.getByRole("textbox", { name: "TODOを編集" });
      return { ...ctx, editInput };
    }

    it("ダブルクリックすると現在のタイトルが入った編集欄にフォーカスが当たる", async () => {
      const { editInput } = await startEditing();

      expect(editInput).toHaveValue("元のタイトル");
      expect(editInput).toHaveFocus();
    });

    it("Enter で変更が確定し、前後の空白は取り除かれる", async () => {
      const { user, editInput } = await startEditing();

      await user.clear(editInput);
      await user.type(editInput, "  新しいタイトル  {Enter}");

      expect(screen.queryByRole("textbox", { name: "TODOを編集" })).not.toBeInTheDocument();
      expect(visibleTitles()).toEqual(["新しいタイトル", "別のTODO"]);
      expect(stored()[0].text).toBe("新しいタイトル");
    });

    it("Esc で編集をキャンセルすると元のタイトルのまま", async () => {
      const { user, editInput } = await startEditing();

      await user.clear(editInput);
      await user.type(editInput, "書きかけ{Escape}");

      expect(screen.queryByRole("textbox", { name: "TODOを編集" })).not.toBeInTheDocument();
      expect(visibleTitles()).toEqual(["元のタイトル", "別のTODO"]);
      expect(stored()[0].text).toBe("元のタイトル");
    });

    it("編集欄からフォーカスが外れると変更が確定する", async () => {
      const { user, editInput } = await startEditing();

      await user.clear(editInput);
      await user.type(editInput, "フォーカスで確定");
      await user.click(screen.getByRole("heading", { name: "TODO" }));

      expect(visibleTitles()).toEqual(["フォーカスで確定", "別のTODO"]);
    });

    it("空にして確定するとその TODO は削除される", async () => {
      const { user, editInput } = await startEditing();

      await user.clear(editInput);
      await user.type(editInput, "   {Enter}");

      expect(visibleTitles()).toEqual(["別のTODO"]);
      expect(stored().map((t) => t.text)).toEqual(["別のTODO"]);
    });

    it("日本語入力の変換中の Enter では確定しない", async () => {
      const { editInput } = await startEditing();

      fireEvent.change(editInput, { target: { value: "へんかんちゅう" } });
      fireEvent.keyDown(editInput, { key: "Enter", isComposing: true });

      expect(screen.getByRole("textbox", { name: "TODOを編集" })).toHaveValue("へんかんちゅう");
      expect(stored()[0].text).toBe("元のタイトル");

      // 変換確定後の Enter では確定する
      fireEvent.keyDown(editInput, { key: "Enter", isComposing: false });
      expect(visibleTitles()).toEqual(["へんかんちゅう", "別のTODO"]);
    });

    it("編集しても完了状態と期限は変わらない", async () => {
      localStorage.clear();
      seed([makeTodo({ text: "期限つき", done: true, due: "2030-01-01" })]);
      const { user, editInput } = await startEditing("期限つき");

      await user.clear(editInput);
      await user.type(editInput, "改名{Enter}");

      expect(stored()[0]).toMatchObject({ text: "改名", done: true, due: "2030-01-01" });
    });
  });

  describe("保存と読み込み", () => {
    it("保存済みの TODO とフィルターを起動時に復元する", () => {
      seed(
        [makeTodo({ text: "保存済みA" }), makeTodo({ text: "保存済みB", done: true })],
        "active",
      );
      setup();

      expect(visibleTitles()).toEqual(["保存済みA"]);
      expect(screen.getByRole("button", { name: "未完了" })).toHaveAttribute("aria-pressed", "true");
    });

    it("起動直後に空の状態で保存データを上書きしない", () => {
      const original = [makeTodo({ text: "消えてはいけない" })];
      seed(original);
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      setup();

      // 一瞬でも空配列が書き込まれると、他のタブには空の一覧が通知されてしまう
      const writes = setItem.mock.calls.filter(([key]) => key === STORAGE_KEY);
      expect(writes.map(([, value]) => value)).not.toContain("[]");
      expect(stored()).toEqual(original);
    });

    it("期限の項目がない古いデータも、期限なしとして読み込める", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ id: "old", text: "旧データ", done: false, createdAt: 0 }]),
      );
      setup();

      expect(visibleTitles()).toEqual(["旧データ"]);
      expect(itemByTitle("旧データ").querySelector(".todo-due")).toBeNull();
    });

    it("古いデータを操作して保存し直すと、期限が空文字で補完される", async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ id: "old", text: "旧データ", done: false, createdAt: 0 }]),
      );
      const { user } = setup();

      await user.click(within(itemByTitle("旧データ")).getByRole("checkbox"));

      expect(stored()[0]).toEqual({
        id: "old",
        text: "旧データ",
        done: true,
        due: "",
        createdAt: 0,
      });
    });

    it("保存データが壊れた JSON なら空の状態で起動する", () => {
      localStorage.setItem(STORAGE_KEY, "{壊れたデータ");
      setup();

      expect(screen.getByText("TODOはありません")).toBeInTheDocument();
    });

    it("保存データが配列でなければ空の状態で起動する", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ text: "配列ではない" }));
      setup();

      expect(screen.getByText("TODOはありません")).toBeInTheDocument();
    });

    it("保存されたフィルター値が不正なら「すべて」になる", () => {
      seed([makeTodo({ text: "A", done: true })], "unknown");
      setup();

      expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
      expect(visibleTitles()).toEqual(["A"]);
    });

    it("localStorage の読み込みで例外が出ても空の状態で起動する", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      setup();

      expect(screen.getByText("TODOはありません")).toBeInTheDocument();
    });

    it("localStorage への保存で例外が出ても追加・表示はできる", async () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      const { user, titleInput } = setup();

      await user.type(titleInput, "保存できなくても表示{Enter}");

      expect(visibleTitles()).toEqual(["保存できなくても表示"]);
    });
  });

  describe("他のタブとの同期", () => {
    it("他のタブで TODO が変更されると、その内容を反映する", () => {
      seed([makeTodo({ text: "最初" })]);
      setup();

      seed([makeTodo({ text: "最初" }), makeTodo({ text: "別タブで追加" })]);
      act(() => {
        window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
      });

      expect(visibleTitles()).toEqual(["最初", "別タブで追加"]);
    });

    it("関係のないキーの変更では一覧を読み直さない", () => {
      seed([makeTodo({ text: "最初" })]);
      setup();

      seed([makeTodo({ text: "読み直されてはいけない" })]);
      act(() => {
        window.dispatchEvent(new StorageEvent("storage", { key: "other-app:key" }));
      });

      expect(visibleTitles()).toEqual(["最初"]);
    });
  });
});
