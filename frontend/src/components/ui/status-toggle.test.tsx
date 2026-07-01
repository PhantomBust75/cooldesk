import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, afterEach } from "vitest";
import { StatusToggle } from "./status-toggle";

describe("StatusToggle (segmented)", () => {
  afterEach(() => cleanup());

  it("renders both Active and Inactive buttons", () => {
    render(<StatusToggle active={true} onToggle={vi.fn()} />);
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
  });

  it("clicking Inactive calls onToggle when currently active", () => {
    const onToggle = vi.fn();
    render(<StatusToggle active={true} onToggle={onToggle} />);
    fireEvent.click(screen.getByText("Inactive"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("clicking Active does NOT call onToggle when already active (no-op)", () => {
    const onToggle = vi.fn();
    render(<StatusToggle active={true} onToggle={onToggle} />);
    fireEvent.click(screen.getByText("Active"));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("clicking Active calls onToggle when currently inactive", () => {
    const onToggle = vi.fn();
    render(<StatusToggle active={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByText("Active"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("clicking Inactive does NOT call onToggle when already inactive (no-op)", () => {
    const onToggle = vi.fn();
    render(<StatusToggle active={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByText("Inactive"));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("does not call onToggle when disabled", () => {
    const onToggle = vi.fn();
    render(<StatusToggle active={true} onToggle={onToggle} disabled={true} />);
    fireEvent.click(screen.getByText("Inactive"));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
