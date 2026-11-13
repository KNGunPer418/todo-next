import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("トップページ (page.tsx)", () => {
  it("TODO アプリ（見出し・入力欄・追加ボタン）を表示する", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: "TODO" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "新しいTODO" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "追加" })).toBeInTheDocument();
  });
});
