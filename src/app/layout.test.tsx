import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import RootLayout, { metadata } from "./layout";

// <html> は jsdom の <div> 内に描画できないため、返された要素ツリーを直接検証する
type HtmlProps = { lang?: string; children?: ReactNode };

describe("ルートレイアウト (layout.tsx)", () => {
  it("lang=\"ja\" の <html> の中の <body> に children を入れる", () => {
    const child = <p>子要素</p>;
    const html = RootLayout({ children: child }) as ReactElement<HtmlProps>;

    expect(html.type).toBe("html");
    expect(html.props.lang).toBe("ja");

    const body = html.props.children;
    expect(isValidElement(body)).toBe(true);
    const bodyEl = body as ReactElement<{ children?: ReactNode }>;
    expect(bodyEl.type).toBe("body");
    expect(bodyEl.props.children).toBe(child);
  });

  it("ページタイトルは「TODO」で、説明文が設定されている", () => {
    expect(metadata.title).toBe("TODO");
    expect(metadata.description).toBe("Next.jsで作ったシンプルなTODOリスト");
  });
});
