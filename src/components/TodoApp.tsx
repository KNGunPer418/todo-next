"use client";

import { useEffect, useState } from "react";

type Todo = {
  id: string;
  text: string;
  done: boolean;
  due: string; // "YYYY-MM-DD" または ""
  createdAt: number;
};

type Filter = "all" | "active" | "done";

const STORAGE_KEY = "todo-next:todos";
const FILTER_KEY = "todo-next:filter";

const FILTER_LABELS: Record<Filter, string> = {
  all: "すべて",
  active: "未完了",
  done: "完了済み",
};

function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // 旧バージョン（期限なし）のデータにも対応
    return parsed.map((t: Todo) => ({ ...t, due: t.due ?? "" }));
  } catch {
    return [];
  }
}

function loadFilter(): Filter {
  try {
    const f = localStorage.getItem(FILTER_KEY);
    return f === "active" || f === "done" ? f : "all";
  } catch {
    return "all";
  }
}

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDue(due: string, today: string) {
  if (!due) return "";
  const [y, m, d] = due.split("-").map(Number);
  const label = `${m}/${d}`;
  if (due === today) return `期限: 今日 (${label})`;
  if (due < today) return `期限切れ: ${y}/${label}`;
  return `期限: ${y}/${label}`;
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [due, setDue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // localStorage はブラウザでしか読めないので、マウント後に読み込む
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setTodos(loadTodos());
    setFilter(loadFilter());
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    // 他のタブでの変更を反映
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setTodos(loadTodos());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
      localStorage.setItem(FILTER_KEY, filter);
    } catch {
      // 保存できなくてもアプリは動かす
    }
  }, [todos, filter, loaded]);

  const today = todayStr();
  const visibleTodos =
    filter === "active"
      ? todos.filter((t) => !t.done)
      : filter === "done"
        ? todos.filter((t) => t.done)
        : todos;
  const remaining = todos.filter((t) => !t.done).length;
  const doneCount = todos.length - remaining;

  function addTodo(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setTodos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, done: false, due, createdAt: Date.now() },
    ]);
    setInput("");
    setDue("");
  }

  function updateTodo(id: string, patch: Partial<Todo>) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id);
    setEditText(todo.text);
  }

  function commitEdit() {
    if (editingId === null) return;
    const text = editText.trim();
    if (text) updateTodo(editingId, { text });
    else deleteTodo(editingId);
    setEditingId(null);
  }

  const emptyMessage =
    todos.length === 0
      ? "TODOはありません"
      : `${FILTER_LABELS[filter]}のTODOはありません`;

  return (
    <main className="app">
      <header className="app-header">
        <h1>TODO</h1>
        <p className="summary" aria-live="polite">
          {todos.length > 0 && `${doneCount} / ${todos.length} 完了`}
        </p>
      </header>

      <form className="new-todo" onSubmit={addTodo} autoComplete="off">
        <input
          className="title-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="やることを入力して Enter"
          maxLength={200}
          aria-label="新しいTODO"
          required
        />
        <input
          className="due-input"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label="期限（任意）"
        />
        <button type="submit">追加</button>
      </form>

      <div className="toolbar">
        <label className="toggle-all">
          <input
            type="checkbox"
            checked={todos.length > 0 && remaining === 0}
            disabled={todos.length === 0}
            onChange={(e) => {
              const done = e.target.checked;
              setTodos((prev) => prev.map((t) => ({ ...t, done })));
            }}
          />
          <span>すべて完了にする</span>
        </label>
        <nav className="filters" aria-label="表示の絞り込み">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? "is-active" : undefined}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </nav>
      </div>

      {visibleTodos.length > 0 && (
        <ul className="todo-list">
          {visibleTodos.map((todo) => {
            const classes = ["todo-item"];
            if (todo.done) classes.push("is-completed");
            if (todo.due && todo.due < today) classes.push("is-overdue");
            if (todo.due === today) classes.push("is-today");

            return (
              <li key={todo.id} className={classes.join(" ")}>
                <input
                  className="todo-check"
                  type="checkbox"
                  checked={todo.done}
                  onChange={(e) => updateTodo(todo.id, { done: e.target.checked })}
                  aria-label="完了"
                />
                <div className="todo-body">
                  {editingId === todo.id ? (
                    <input
                      className="todo-edit"
                      type="text"
                      autoFocus
                      maxLength={200}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing) return; // 日本語変換中の Enter は無視
                        if (e.key === "Enter") commitEdit();
                        else if (e.key === "Escape") setEditingId(null);
                      }}
                      aria-label="TODOを編集"
                    />
                  ) : (
                    <span
                      className="todo-title"
                      onDoubleClick={() => startEdit(todo)}
                    >
                      {todo.text}
                    </span>
                  )}
                  {todo.due && (
                    <span className="todo-due">{formatDue(todo.due, today)}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="todo-delete"
                  aria-label="削除"
                  onClick={() => deleteTodo(todo.id)}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {loaded && visibleTodos.length === 0 && (
        <p className="empty">{emptyMessage}</p>
      )}

      <footer className="app-footer">
        <span>{loaded && `残り ${remaining} 件`}</span>
        {doneCount > 0 && (
          <button
            type="button"
            className="link-button"
            onClick={() => setTodos((prev) => prev.filter((t) => !t.done))}
          >
            完了済みを削除
          </button>
        )}
      </footer>

      <p className="hint">ダブルクリックで編集 ・ Esc で編集をキャンセル</p>
    </main>
  );
}
