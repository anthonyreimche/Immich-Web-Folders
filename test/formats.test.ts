// Photos in a format Safelight can't open (HEIC and the like) are listed as the
// server's rendering of them, a JPEG named after the original, and known again
// by that name, as Safelight's catalogue may show it.

import { describe, expect, it } from "vitest";
import { renderedFrom, renditionName } from "../src/formats";

describe("renditionName", () => {
  it("leaves a photo Safelight opens under its own name", () => {
    for (const name of ["IMG_1.JPG", "a.jpeg", "b.png", "c.webp", "d.avif", "e.tif", "f.TIFF", "g.CR3", "h.nef", "i.dng", "j.RAF"])
      expect(renditionName(name)).toBeNull();
  });

  it("names the rendering of any other image after the original", () => {
    expect(renditionName("IMG_0001.HEIC")).toBe("IMG_0001.HEIC.jpg");
    expect(renditionName("scan.jxl")).toBe("scan.jxl.jpg");
    expect(renditionName("anim.gif")).toBe("anim.gif.jpg");
  });

  it("leaves a name without a type alone, for Safelight to pass over", () => {
    expect(renditionName("noext")).toBeNull();
  });
});

describe("renderedFrom", () => {
  it("tells the original's format from a rendering's name", () => {
    expect(renderedFrom("IMG_0001.HEIC.jpg")).toEqual({ original: "IMG_0001.HEIC", format: "HEIC" });
    expect(renderedFrom("scan.jxl.jpg")).toEqual({ original: "scan.jxl", format: "JXL" });
  });

  it("knows the name with the part Safelight adds to tell two photos of one name apart", () => {
    expect(renderedFrom("IMG_0001.HEIC (3f2a9c1d).jpg")).toEqual({ original: "IMG_0001.HEIC", format: "HEIC" });
  });

  it("knows no other name", () => {
    for (const name of ["IMG_0001.jpg", "IMG_0001.HEIC", "photo.jpg.jpg", "IMG_0001 (3f2a9c1d).jpg", "a.CR3"])
      expect(renderedFrom(name)).toBeNull();
  });
});
