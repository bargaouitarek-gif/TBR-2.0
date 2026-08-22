# DCO native mail augmentation — acceptance

Case July 2026:
- TBR sale CHOURAQUI / client 2215124 exists in cc_ventes_2026_07.
- Imported DCO V2 does not contain client 2215124.
- Native DCO claim mail must include a dedicated `VENTES SAISIES DANS TBR MAIS ABSENTES DU DCO` section.
- CHOURAQUI must appear in that section.
- The missing sale must NOT be added automatically to the quantified shortage total (currently 160.00 EUR in the reference case).
- Existing quantified discrepancies remain unchanged.

The augmentation must not clear or rename existing localStorage keys and must not block the main UI.