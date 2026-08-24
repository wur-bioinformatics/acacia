import { describe, it, expect } from "vitest";
import { flattenTree, parseNewick } from "../layout";
import { flatTreeToNewick } from "./export";

describe("flatTreeToNewick", () => {
  it("leaves plain names unquoted", () => {
    const nwk = flatTreeToNewick(flattenTree(parseNewick("(A:0.1,B:0.2);")));
    expect(nwk).toBe("(A:0.1,B:0.2):0;");
  });

  it("quotes names containing Newick-special characters", () => {
    const name = "sp|P20248|CCNA2_HUMAN  Cyclin-A2 OS=Homo sapiens";
    const nwk = flatTreeToNewick(flattenTree(parseNewick(`('${name}':0.1,B:0.2);`)));
    expect(nwk).toContain(`'${name}':0.1`);
  });

  it("round-trips names that need quoting", () => {
    const names = ["a b", "a,b(c):d;", "it's", "plain"];
    const source = `(${names.map((n) => `'${n.replace(/'/g, "''")}':0.1`).join(",")});`;
    const roundTripped = flattenTree(parseNewick(flatTreeToNewick(flattenTree(parseNewick(source)))));
    expect(roundTripped.leafOrder.map((id) => roundTripped.nodes.get(id)!.name)).toEqual(names);
  });
});
