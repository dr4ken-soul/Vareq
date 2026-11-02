import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const output = join(import.meta.dirname, "..", "docs", "design", "reference-comps");
await mkdir(output, { recursive: true });
const sections = [
  ["01-hero.svg", "01 / HERO", "Expose bridge races before deployment.", "AI proposes attack scenarios. Deterministic tests explore event orderings and replay failures for inspection."],
  ["02-problem.svg", "02 / PROBLEM", "The gap between events is part of the attack surface.", "A refund can become valid while a fill message is still in flight."],
  ["03-how-it-works.svg", "03 / HOW IT WORKS", "From bridge assumptions to an inspectable trace.", "Adapter  /  AI scenarios  /  Deterministic scheduling  /  Replay and inspect"],
  ["04-evidence.svg", "04 / EVIDENCE", "One schedule. Two bridge models.", "Vulnerable reference and trusted-coordinator mitigation. Both stay Not run until real execution."],
  ["05-builders.svg", "05 / BUILDERS", "Fit the test into the workflow you already use.", "Describe the adapter  →  Execute in CI  →  Inspect the artefact"],
  ["06-trust.svg", "06 / TRUST & LIMITS", "A useful trace is honest about its limits.", "Bounded scenarios. Controlled local replay. Public-chain uncertainty. Trusted coordinator assumptions."],
  ["07-final-action.svg", "07 / FINAL ACTION", "See the sequence, not just the outcome.", "Explore a published example without connecting a wallet."],
  ["08-footer.svg", "08 / FOOTER", "Vareq", "A bridge-testing workflow with explicit evidence and limits."],
];
const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

for (let i = 0; i < sections.length; i++) {
  const [file, label, heading, body] = sections[i];
  const dark = i === 6;
  const band = i === 1 || i === 3 || i === 7;
  const bg = dark ? "#1C281E" : band ? "#E5EAE4" : "#F1F4F0";
  const fg = dark ? "#FCFBF7" : "#1C281E";
  const textColor = dark ? "#FCFBF7" : "#4C5F50";
  let content = '<text x="110" y="155" font-family="DM Mono,monospace" font-size="14" font-weight="500" letter-spacing="2" fill="' + (dark ? "#FCFBF7" : "#586C5C") + '">' + escapeXml(label) + '</text>';
  content += '<foreignObject x="110" y="220" width="780" height="260"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Bricolage Grotesque,system-ui,sans-serif;font-size:64px;font-weight:600;line-height:1.04;letter-spacing:-.04em;color:' + fg + '">' + escapeXml(heading) + '</div></foreignObject>';
  content += '<foreignObject x="112" y="520" width="700" height="180"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Source Sans 3,system-ui,sans-serif;font-size:25px;line-height:1.5;color:' + textColor + '">' + escapeXml(body) + '</div></foreignObject>';
  if (i === 0) {
    content += '<rect x="900" y="145" width="590" height="570" rx="22" fill="#FDFEFC" stroke="#7F9583" stroke-width="2"/>';
    content += '<text x="940" y="205" font-family="DM Mono,monospace" font-size="15" fill="#1C281E">ILLUSTRATIVE TRACE</text>';
    const rows = ["Lock", "Hold fill delivery", "Request refund", "Attempt fill"];
    for (let j = 0; j < rows.length; j++) content += '<text x="945" y="' + (290 + j * 90) + '" font-family="DM Mono,monospace" font-size="16" fill="#586C5C">0' + (j + 1) + '</text><text x="1010" y="' + (290 + j * 90) + '" font-family="DM Mono,monospace" font-size="18" fill="#1C281E">' + rows[j] + '</text><path d="M940 ' + (315 + j * 90) + 'H1450" stroke="#7F9583"/>';
    content += '<text x="940" y="675" font-family="Source Sans 3,system-ui,sans-serif" font-size="16" fill="#4C5F50">An illustration, not an executed run or receipt.</text>';
  } else if (i === 2) {
    const names = ["Adapter", "AI scenarios", "Deterministic scheduling", "Replay and inspect"];
    for (let j = 0; j < names.length; j++) {
      const x = j % 2 ? 820 : 110, y = j < 2 ? 500 : 700;
      content += '<rect x="' + x + '" y="' + y + '" width="650" height="145" rx="20" fill="#FAFCF8" stroke="#7F9583" stroke-width="2"/><text x="' + (x + 32) + '" y="' + (y + 45) + '" font-family="DM Mono,monospace" font-size="14" fill="#586C5C">0' + (j + 1) + '</text><text x="' + (x + 32) + '" y="' + (y + 95) + '" font-family="Bricolage Grotesque,system-ui,sans-serif" font-size="27" font-weight="600" fill="#1C281E">' + names[j] + '</text>';
    }
  } else if (i === 3) {
    for (let j = 0; j < 2; j++) {
      const x = 110 + j * 690, title = j ? "Trusted-coordinator mitigation" : "Vulnerable reference";
      content += '<rect x="' + x + '" y="490" width="650" height="245" rx="20" fill="#FAFCF8" stroke="#7F9583" stroke-width="2"/><text x="' + (x + 32) + '" y="550" font-family="Bricolage Grotesque,system-ui,sans-serif" font-size="25" font-weight="600" fill="#1C281E">' + title + '</text><rect x="' + (x + 32) + '" y="580" width="100" height="36" rx="18" fill="#FAFCF8" stroke="#4C5F50"/><text x="' + (x + 52) + '" y="604" font-family="DM Mono,monospace" font-size="13" fill="#4C5F50">Not run</text><path d="M' + (x + 32) + ' 650H' + (x + 610) + '" stroke="#7F9583"/><text x="' + (x + 32) + '" y="695" font-family="Source Sans 3,system-ui,sans-serif" font-size="17" fill="#4C5F50">Test-only fixture · no real assets</text>';
    }
  } else if (i === 4) {
    content += '<rect x="850" y="170" width="620" height="540" rx="22" fill="#FDFEFC" stroke="#7F9583" stroke-width="2"/><text x="895" y="230" font-family="DM Mono,monospace" font-size="15" fill="#1C281E">INTEGRATION OUTLINE</text>';
    const rows = ["Describe the adapter", "Execute in CI", "Inspect the artefact"];
    for (let j = 0; j < rows.length; j++) content += '<path d="M885 ' + (270 + j * 135) + 'H1435" stroke="#7F9583"/><text x="895" y="' + (330 + j * 135) + '" font-family="DM Mono,monospace" font-size="16" fill="#586C5C">0' + (j + 1) + '</text><text x="950" y="' + (330 + j * 135) + '" font-family="Source Sans 3,system-ui,sans-serif" font-size="22" font-weight="600" fill="#1C281E">' + rows[j] + '</text>';
  } else if (i === 5) {
    const rows = ["AI proposes; tests decide.", "Local replay is controlled.", "Public chains are not deterministic.", "The mitigation trusts a coordinator."];
    for (let j = 0; j < rows.length; j++) content += '<path d="M740 ' + (195 + j * 130) + 'H1470" stroke="#7F9583"/><text x="740" y="' + (250 + j * 130) + '" font-family="Bricolage Grotesque,system-ui,sans-serif" font-size="25" font-weight="600" fill="#1C281E">' + rows[j] + '</text><text x="740" y="' + (285 + j * 130) + '" font-family="DM Mono,monospace" font-size="13" fill="#586C5C">DISCLOSURE 0' + (j + 1) + '</text>';
  } else if (i === 6) {
    content += '<rect x="1120" y="655" width="280" height="64" rx="10" fill="#A34326"/><text x="1160" y="696" font-family="Source Sans 3,system-ui,sans-serif" font-size="18" font-weight="600" fill="#FCFBF7">Explore a test run</text>';
  } else if (i === 7) {
    content += '<text x="110" y="725" font-family="Bricolage Grotesque,system-ui,sans-serif" font-size="32" font-weight="600" fill="#1C281E">Vareq</text><text x="850" y="725" font-family="Source Sans 3,system-ui,sans-serif" font-size="18" fill="#A34326">How it works</text><text x="1080" y="725" font-family="Source Sans 3,system-ui,sans-serif" font-size="18" fill="#A34326">Inspector</text><text x="1280" y="725" font-family="Source Sans 3,system-ui,sans-serif" font-size="18" fill="#A34326">Event</text><path d="M110 800H1490" stroke="#7F9583"/><text x="110" y="845" font-family="DM Mono,monospace" font-size="14" fill="#586C5C">TESTNET DEMONSTRATION · NO PRODUCTION FUNDS</text>';
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="' + escapeXml(label) + ' reference composition"><rect width="1600" height="900" fill="' + bg + '"/>' + content + '</svg>\n';
  await writeFile(join(output, file), svg, "utf8");
}
console.log("Created " + sections.length + " editable section reference compositions.");
