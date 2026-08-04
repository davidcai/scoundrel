import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExitTransition } from "./useExitTransition";

type Item = { id: string };
const keyOf = (item: Item) => item.id;

function Harness({ items }: { items: Item[] }) {
  const rendered = useExitTransition(items, keyOf, 200);
  return (
    <ul>
      {rendered.map((entry) => (
        <li key={entry.key} data-exiting={String(entry.exiting)}>
          {entry.item.id}
        </li>
      ))}
    </ul>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const ids = () => screen.getAllByRole("listitem").map((node) => node.textContent);
const exitingIds = () =>
  screen
    .getAllByRole("listitem")
    .filter((node) => node.dataset["exiting"] === "true")
    .map((node) => node.textContent);

describe("useExitTransition", () => {
  it("passes current items through untouched", () => {
    render(<Harness items={[{ id: "a" }, { id: "b" }]} />);
    expect(ids()).toEqual(["a", "b"]);
    expect(exitingIds()).toEqual([]);
  });

  it("retains a departed item marked as exiting", () => {
    const view = render(<Harness items={[{ id: "a" }, { id: "b" }]} />);
    view.rerender(<Harness items={[{ id: "a" }]} />);
    expect(ids()).toEqual(["a", "b"]);
    expect(exitingIds()).toEqual(["b"]);
  });

  it("drops the departed item after the duration", () => {
    const view = render(<Harness items={[{ id: "a" }, { id: "b" }]} />);
    view.rerender(<Harness items={[{ id: "a" }]} />);
    act(() => void vi.advanceTimersByTime(200));
    expect(ids()).toEqual(["a"]);
  });

  it("handles several departures at once", () => {
    const view = render(<Harness items={[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]} />);
    view.rerender(<Harness items={[]} />);
    expect(exitingIds()).toEqual(["a", "b", "c", "d"]);
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("does not re-add an item that returns while exiting", () => {
    const view = render(<Harness items={[{ id: "a" }, { id: "b" }]} />);
    view.rerender(<Harness items={[{ id: "a" }]} />);
    view.rerender(<Harness items={[{ id: "a" }, { id: "b" }]} />);
    expect(ids().filter((id) => id === "b")).toHaveLength(1);
  });

  it("resolves immediately at zero duration, as reduced motion requires", () => {
    function ZeroHarness({ items }: { items: Item[] }) {
      const rendered = useExitTransition(items, keyOf, 0);
      return <ul>{rendered.map((e) => <li key={e.key}>{e.item.id}</li>)}</ul>;
    }
    const view = render(<ZeroHarness items={[{ id: "a" }, { id: "b" }]} />);
    view.rerender(<ZeroHarness items={[{ id: "a" }]} />);
    act(() => void vi.advanceTimersByTime(0));
    expect(ids()).toEqual(["a"]);
  });
});
