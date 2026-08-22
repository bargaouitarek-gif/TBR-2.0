# Acceptance criteria

1. Import a DCO for a month where TBR contains an active sale with client number `2215124` but the DCO does not.
2. The DCO screen must show a red integrity alert for client `2215124`.
3. The generated assisted claim email must list the missing sale in its own section.
4. The missing sale's estimated value must not be added automatically to the confirmed claim total.
5. Existing commission, pack and installation discrepancies must continue to be listed separately.
6. When a later DCO version for the same month has a different client-number set, TBR stores the snapshot and can flag removed clients on subsequent version comparisons.
