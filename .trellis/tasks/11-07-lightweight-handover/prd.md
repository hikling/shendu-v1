# GitHub-linked compact handover

User explicitly wants all code synchronized to GitHub and the handover package kept as small as possible. Replace the previous110MB source archive with a tiny repository/document/version entry. Source, artwork and all development history remain in the GitHub repository. No application/UI/data behavior changes, production migration or external sending.

Acceptance: default package contains only a short README with verified public GitHub links, source commit/application tree metadata and integrity manifest; total ZIP under20KiB; no local file payloads. Docs accurately direct recipients to clone GitHub. Packaging tests/CI pass; source changes and Trellis closure synchronized to main; final package regenerated at exact final commit; obsolete large generated local ZIP/checksum removed only after replacement verifies.
