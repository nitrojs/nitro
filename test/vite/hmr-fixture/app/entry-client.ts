import * as shared from "../shared.json" with { type: "json" };

document.getElementById("client-state-value")!.textContent = shared.state + " (modified)";
