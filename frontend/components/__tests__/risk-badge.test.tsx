import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RiskBadge } from "../risk-badge";

describe("RiskBadge", () => {
  it("показывает текстовый уровень риска вместе со значком", () => {
    render(<RiskBadge level="Критический" />);
    expect(screen.getByText("Критический")).toBeInTheDocument();
    expect(screen.getByText("Критический").parentElement?.querySelector("svg")).toBeTruthy();
  });
});
