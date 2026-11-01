import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import App, { PhotoUploadSection } from "./App";

function PhotoUploadHarness() {
  const [photos, setPhotos] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  return <PhotoUploadSection photos={photos} setPhotos={setPhotos} dragging={dragging} setDragging={setDragging} existingCount={0} />;
}

describe("ForgeQuality application", () => {
  it("shows the secure sign-in screen", () => {
    render(<App />);
    expect(screen.getByText("Manufacturing,")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to workspace" })).toBeInTheDocument();
  });

  it("accepts multiple image formats and previews selected photos", () => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test-photo") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const { container } = render(<PhotoUploadHarness />);
    const picker = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(picker).toHaveAttribute("multiple");
    expect(picker).toHaveAttribute("accept", "image/*");
    const photos = [
      new File(["front"], "part-front.jpg", { type: "image/jpeg" }),
      new File(["side"], "part-side.webp", { type: "image/webp" }),
    ];
    fireEvent.change(picker!, { target: { files: photos } });
    expect(screen.getByAltText("Preview of part-front.jpg")).toBeInTheDocument();
    expect(screen.getByAltText("Preview of part-side.webp")).toBeInTheDocument();
  });

  it("accepts photos dropped into the upload area", () => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test-photo") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const { container } = render(<PhotoUploadHarness />);
    const droppedPhoto = new File(["photo"], "dropped.png", { type: "image/png" });
    const dropArea = container.querySelector(".photo-dropzone");
    fireEvent.drop(dropArea!, { dataTransfer: { files: [droppedPhoto] } });
    expect(screen.getByAltText("Preview of dropped.png")).toBeInTheDocument();
  });
});
