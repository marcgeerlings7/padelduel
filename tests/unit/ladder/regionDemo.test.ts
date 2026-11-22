import { describe, it, expect } from "vitest";
import { sortRegionsDemoLast } from "@/lib/region/demo";

describe("sortRegionsDemoLast", () => {
  it("zet de demoregio achteraan en behoudt de volgorde van de rest", () => {
    const regions = [{ slug: "demo" }, { slug: "utrecht" }, { slug: "zwolle" }];
    expect(sortRegionsDemoLast(regions).map((r) => r.slug)).toEqual(["utrecht", "zwolle", "demo"]);
  });

  it("zonder demoregio: ongewijzigd", () => {
    expect(sortRegionsDemoLast([{ slug: "a" }, { slug: "b" }]).map((r) => r.slug)).toEqual(["a", "b"]);
  });
});
