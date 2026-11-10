# IDENTITY.AI (saladus)

Salajane „AI identiteedi“ pettus: mängija näeb tõsist skanni, admin valib õige nime teises aknas.

**See kaust ei ole dashboardil.** URL: `/games/saladus/`

## Nõuded

- PHP 8+ koos SQLite laiendusega
- Staatiline hosting (GitHub Pages) **ei piisa** — vaja PHP-d

## Kohalik käivitamine

Repo juurest:

```bash
php -S localhost:8080
```

| Leht | URL |
|------|-----|
| Mängija | http://localhost:8080/games/saladus/ |
| Admin | http://localhost:8080/games/saladus/admin.html |

## Voog

1. Mängija vajutab **Alusta tuvastamist**.
2. Admin näeb aktiivset skänni ja vajutab õiget nime.
3. Kui analüüs on piisavalt tõsiseltvõetav, admin vajutab **Paljasta mängijale**.
4. Mängija võib vajutada **Paljasta minu identiteet** — nimi tuleb siis, kui admin on paljastanud. Uus voor algab, kui järgmine inimene vajutab **Alusta** või eelmine **Uuesti** (serveri olek kirjutatakse uue skänni ajal üle).

Andmebaas: `data/identity.db` (gitis ei ole).

**Märkus:** admini leht on avalik; hoia URL-i endale, kui tahad, et keegi teine ei vajutaks vale nime.
