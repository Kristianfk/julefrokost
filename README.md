# Julefrokost-afstemning

Stemmeside og admin til årets firma-julefrokost. Fire kategorier (humørspreder, original, hverdagshelt, dansegulvsdronning/-konge). Man logger ind ved at skrive sit navn og skriver derefter selv navnet på sin kandidat i de kategorier, man vil stemme i. Det er tillidsbaseret: navnet er ikke en adgangskode. Resultater og løbende stemmer ses på `/admin`.

## Sæt det op på Vercel (ca. 5 minutter)

1. **Nyt projekt.** På vercel.com: *Add New → Project*, vælg dette repo (`julefrokost`). *Root Directory* lader du stå som den er. Framework: *Other*. Tryk Deploy (den første deploy virker først, når trin 2 og 3 er gjort).
2. **Database.** I projektet: *Storage → Create Database → Upstash Redis* (gratis plan er rigeligt) og forbind den til projektet. Vercel sætter selv `KV_REST_API_URL` og `KV_REST_API_TOKEN`.
3. **Adgangskode til admin.** *Settings → Environment Variables*: tilføj `ADMIN_PASSWORD` med en kode, I selv vælger.
4. **Deploy igen** (*Deployments → ⋯ → Redeploy*), så variablerne er med.

Stemmesiden ligger nu på projektets adresse, og admin på `/admin`. Del kun stemmesiden med kollegerne.

## Admin

- Ranglister pr. kategori, opdateret hvert 5. sekund.
- **Løbende stemmer:** valgene med klokkeslæt, uden navne.
- **Har stemt:** navnene alfabetisk, uden kobling til valgene. Hver person har én stemmeseddel (stemmer man igen, erstattes den gamle), og her kan en stemme fjernes.
- **Slå sammen:** hvis "Mette" og "Mette K." er samme person, lægges de sammen. Kan fortrydes.
- **Luk afstemningen**, når der ikke skal stemmes mere.
- **Nulstil alle stemmer** (kræver, at du skriver NULSTIL). Brug den efter test, før I deler linket.

## Kør lokalt

Kræver Node 20+.

```bash
npm install
npm run dev     # http://localhost:3000, admin på /admin med koden "test"
npm test        # røgtest af API'et
```

Lokalt bruges et lager i hukommelsen, så stemmer forsvinder, når serveren stoppes.

## Skrifter

Bodoni Moda og Albert Sans ligger i `public/fonts` (licens ved siden af), så siden ikke henter noget fra Google eller andre tredjeparter.

## Ret kategorierne

Titler og tekster står i `lib/categories.js`. Ret ikke et `id`, efter der er afgivet stemmer.
