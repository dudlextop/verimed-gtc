import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QualityMetric } from "../quality-metric";

describe("QualityMetric", () => {
  it("показывает русскую подпись и процент", () => {
    render(<QualityMetric label="Точность выявления (Precision)" value={0.7988} />);
    expect(screen.getByText("Точность выявления (Precision)")).toBeInTheDocument();
    expect(screen.getByText(/79,9/)).toBeInTheDocument();
  });
});
