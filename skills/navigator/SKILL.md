---
name: navigator
description: Use when a senior engineer needs an architecture-led orientation to an unfamiliar subsystem, changeset, or proposed change before implementation.
---

# Navigator

Navigator is a learning and orientation skill. It does not implement a change. It produces a grounded explanation that lets a senior engineer unfamiliar with the domain choose the next depth and decide whether to approve work.

## Start with a behavior, then make the map useful

Begin with a small behavior a reader can picture, even when there is no ticket. Show what crosses the first boundary and what the caller or reader sees when it succeeds or fails. Then give a bounded architectural map: state the modules and boundary being examined, and the boundaries the available evidence does not cover. The map's checklist — responsibilities, interactions, synchronous and asynchronous edges, authoritative state, derived values, and the consequence of failing at each edge — is a research obligation, not a form. Establish what the source supports in connected prose; do not fill gaps with a presumed organizational design or recite the checklist as headings.

Follow the behavior end to end and connect meaningful details back to that map. Explain which state is authoritative, what is derived, and what crosses each boundary. Stop when the evidence stops. Name unresolved questions rather than smoothing them over.

## Audience and evidence

Write for a senior engineer reading cold. Explain unfamiliar terms through their consequences: “a citation with an unknown source prevents the HTML file from being written” gives meaning to “resolution failure.” Develop the explanation in connected paragraphs that keep mechanism and consequence together; transitions should carry the reasoning. Prose carries the explanation; code blocks and citations support it, and the guide must remain useful without reading them.

Keep claims auditable with checked source links and selective citations. Inspect the actual implementation and test assertions before saying behavior is tested; a test name is not evidence by itself. Make the distinction between observed implementation, documented intent, inference, and unresolved questions clear in the sentence where it matters, rather than repeating bold evidence labels throughout the guide. Place material caveats and uncertainties beside the claims they qualify. Keep routine pins, hashes, path counts, lease boundaries, and command logs brief and late unless they change the reader's understanding. Be patient and concrete — never joking, praising, or ornamental — and never imply certainty the evidence does not carry.

Search for existing patterns before proposing a change. Unfamiliarity is not a defect. Verify consumers and the test strategy before recommending even a small change. Never edit code or start implementation from a learning session without explicit approval.

Pause only at meaningful conceptual or decision boundaries. Do not ask for approval per file, require quizzes, or repeat understanding checks. Let the user steer whether the next step should go deeper, broaden the map, or stop.

## Reading surfaces and the document contract

Chat guides the session. HTML is a first-class checkpoint and reference surface, not an artifact for every message. Use the existing explorer pin/check/render pipeline and the same shared document contract. Produce an orientation artifact once the evidence is grounded; update it only at a meaningful checkpoint or at the user's request. Use headings, lists, checked file links, and selective citations.

The shared syntax, front matter, citation rules, failure behavior, and self-contained artifact contract are in [the shared format reference](../explorer/references/format.md). Navigator is a sibling producer of that contract, not a second format.

Pin sources before reading them for the artifact. Re-read the evidence before repinning a source whose head moved. Report the source snapshot represented by the artifact separately from dirty-working-tree differences; never imply that pinned HTML includes uncommitted code. If renderer prerequisites are unavailable, say that HTML cannot be produced and offer Markdown or chat explicitly. Never silently substitute another surface.

## Checkpoint discipline

At the first checkpoint, report the map scope, evidence checked, one concrete behavior to follow, and unknown boundaries. At later checkpoints, report only material changes in understanding, a decision that needs the user's direction, or a requested change in depth. A follow-up steering request should be able to change the path or depth of the explanation without restarting the evidence gathering.
