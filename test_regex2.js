const regex = /(?:\[|\\\[)(?:Source\s*|Citation\s*)?\s*(\d+)\s*(?:\]|\\\])(?!\s*\()/gi;
const citations = [{ display_url: "http://example.com" }];

function test(text) {
  const result = text.replace(regex, (match, numStr) => `CITE(${numStr})`);
  console.log(`"${text}" -> "${result}"`);
}

test("This is true [1].");
test("This is true \\[1\\].");
test("This is true [Source 1].");
test("This is true [ Citation 1 ].");
test("Markdown link [1](http://a.com).");
test("This is [1] and [2].");
test("No space[1]");
