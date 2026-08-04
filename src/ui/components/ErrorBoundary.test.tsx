import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom({ explode }: { explode: boolean }) {
  if (explode) throw new Error("kaboom");
  return <p>all good</p>;
}

// React logs caught render errors; silence it so test output stays readable.
beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
afterEach(() => vi.restoreAllMocks());

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary fallback={() => <p>fallback</p>}>
        <Boom explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("renders the fallback with the error when a child throws", () => {
    render(
      <ErrorBoundary fallback={(error) => <p>caught: {error.message}</p>}>
        <Boom explode={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("caught: kaboom")).toBeInTheDocument();
  });

  it("clears the error when reset is called", async () => {
    render(
      <ErrorBoundary fallback={(_error, reset) => <button onClick={reset}>retry</button>}>
        <Boom explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("all good")).toBeInTheDocument();

    render(
      <ErrorBoundary fallback={(_error, reset) => <button onClick={reset}>retry</button>}>
        <Boom explode={true} />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(screen.getAllByRole("button", { name: "retry" }).length).toBeGreaterThan(0);
  });
});
