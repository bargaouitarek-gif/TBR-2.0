# DCO regression — Juillet 2026

Ce cas est le garde-fou métier avant toute modification du contrôle DCO.

## Écarts chiffrés certains
- KHACHATRYAN — 2223533 — Commission vente : 80,00 €
- Borriello — 2213934 — Installation : 20,00 €
- LIU — 2229948 — Commission vente : 60,00 €
- TOTAL CERTAIN : 160,00 €

## Vente absente
- CHOURAQUI — 2215124 — doit être détecté comme vente TBR absente du DCO courant.
- La vente absente doit apparaître dans le contrôle écran ET dans le mail.
- Le motif doit expliquer que le numéro client est absent du DCO et que les rémunérations liées ne sont donc pas retrouvées.
- Les composantes financières disponibles dans TBR (vente, packs, installation) doivent être détaillées séparément.
- L'impact potentiel de la vente absente ne doit pas être mélangé au TOTAL CERTAIN de 160,00 €.

## Cohérence obligatoire
- Le total affiché à l'écran doit provenir du même registre que le total du mail.
- Aucun ancien total global ne doit remplacer le total détaillé lorsque les lignes détaillées sont disponibles.
- Une vente absente ne doit jamais disparaître du mail simplement parce qu'elle n'a aucune ligne DCO.
