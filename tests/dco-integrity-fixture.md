# Test DCO integrity — July 2026

Expected behavior for the DCO integrity patch:

- A TBR sale with client number `2215124` that is not present in the imported DCO rows must be flagged as **VENTE TBR ABSENTE**.
- The missing sale must not be automatically added to the confirmed claim amount.
- Existing negative commission, pack and installation discrepancies remain listed separately.
- A new DCO version with a different client-number set is remembered for later version-to-version comparison.

This fixture documents the regression case that motivated version 1.2.0 of `tbr-dco-claim-mail.js`.
