const citations = [{ display_url: "http://example.com" }];
function injectCitations(text, citations) {
  return text.replace(/(?:\[|\\\[)(?:Source\s*|Citation\s*)?\s*(\d+)\s*(?:\]|\\\])(?!\s*\()/gi, (match, numStr) => {
    const cit = citations[parseInt(numStr, 10) - 1];
    if (!cit) return match;
    const url = cit.display_url
      ? cit.display_url.replace(/"/g, "&quot;").replace(/'/g, "&#39;")
      : null;
    return url
      ? `<sup><a href="${url}" target="_blank" rel="noopener noreferrer" className="cite-link" class="cite-link">[${numStr}]</a></sup>`
      : `<sup className="cite-link" class="cite-link">[${numStr}]</sup>`;
  });
}
console.log(injectCitations("A credit card works by allowing you to borrow money from the issuing bank up to a set credit limit to make purchases [1].", citations));
