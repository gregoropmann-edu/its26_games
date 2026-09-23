# ITS126 ühine mängude repo

See repo on ITS126 mängude kogumik: ühine **dashboard** ja iga õpilase oma mäng eraldi kaustas. Backend puudub — kõik on staatiline HTML, CSS ja JavaScript.

## Mis on dashboard?

Fail `index.html` juurkaustas näitab kõigi mängijate kaarte. Kaardile klõpsates avaneb vastava õpilase mäng aadressil `games/<slug>/` (tavaliselt `index.html` selles kaustas).

Õpilaste nimed ja värvitoonid on kirjas failis `assets/js/players.js` muutujas `window.ITS126_PLAYERS`. Dashboardi loogika on `assets/js/dashboard.js`, välimus `assets/css/dashboard.css`.

## Kuidas oma mängu lisada?

1. Leia oma kaust `games/<sinu-slug>/` (slug on väiketähtedega nimi, nt `christian`, `markus`).
2. Tööta **peamiselt** seal: oma `index.html`, stiilid ja skriptid võid hoida samas kaustas või alamkaustades.
3. Ära muuda juurkausta `index.html` ega `assets/js/players.js` ilma kokkuleppeta — nii väheneb merge-konfliktide oht klassis.

Kui lisad uue faili, hoia lingid **suhtelistena** (nt `./style.css`, mitte absoluutne tee juurest), et leht töötaks nii kohalikult kui ka GitHub Pages’il alamteel.

## Kohalik avamine ja server

Skriptid on tavapärased (mitte ES moodulid), et lehte saaks avada ka **topeltklõpsuga** `index.html` brauseris.

Soovitatav on siiski kasutada **lihtsat staatilist serverit** (VS Code Live Server, `python -m http.server` vms), eriti kui hiljem lisad rohkem faile või tahad ühtlast käitumist kõigis brauserites.

## Struktuur

| Asukoht | Roll |
|--------|------|
| `index.html` | Ühine avaleht |
| `assets/css/dashboard.css` | Dashboardi stiilid |
| `assets/js/players.js` | Õpilaste andmed |
| `assets/js/dashboard.js` | Kaartide joonistamine, taust, hiirefektid |
| `games/<slug>/` | Iga õpilase mängu sisu |
