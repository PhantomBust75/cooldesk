import { render, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, afterEach } from "vitest";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  afterEach(() => cleanup());

  it("renders initials from name", () => {
    const { container } = render(<Avatar name="Alice Smith" />);
    expect(container.textContent).toBe("AS");
  });

  it("uses palette[0] (#EDE9FE bg) for names starting with A (charCode 65, 65%5=0)", () => {
    const { container } = render(<Avatar name="Alice" />);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.style.backgroundColor).toBe("rgb(237, 233, 254)"); // #EDE9FE
  });

  it("uses palette[1] (#D1FAE5 bg) for names starting with B (charCode 66, 66%5=1)", () => {
    const { container } = render(<Avatar name="Bob" />);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.style.backgroundColor).toBe("rgb(209, 250, 229)"); // #D1FAE5
  });

  it("uses palette[4] (#DBEAFE bg) for names starting with E (charCode 69, 69%5=4)", () => {
    const { container } = render(<Avatar name="Eve" />);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.style.backgroundColor).toBe("rgb(219, 234, 254)"); // #DBEAFE
  });
});
