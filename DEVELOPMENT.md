# Development handoff — 2026-09-12

## User intent
Continue coding autonomously. Give regular progress updates (user requested at least once in 15 minutes); explain stage and exact required action when stopping. User explicitly authorized publishing current code to GitHub main on 2026-09-12. No paid LLM provider selected yet; do not ask for keys in chat.

## Current state
- Version 0.5, Node 24, native modules, SQLite, Ukrainian vanilla UI, no runtime npm dependencies.
- Server http://127.0.0.1:4317; start with npm start.
- Store layering: Store -> ResearchStore -> AssessmentStore -> TaskStore -> PlanStore, server uses PlanStore.
- 35 tests pass and isolated headless Edge browser smoke passes.
- Browser smoke covers project creation, source verification, structured assessment, schedules, recurring completion, research plan adoption, reload and mobile overflow; no JS errors.
- Playwright package is bundled at the runtime path discoverable through load_workspace_dependencies. Run with PLAYWRIGHT_MODULE pointing at that package. npm run test:browser.
- CUA and view_image helpers fail with setup refresh / trusted Node errors; headless browser through approved shell works.
- Sandbox helper repeatedly fails; approved escalated commands work. Do not infer missing workspace authorization.
- Local main and origin configured; first push to main verified at 4b62671. data directory ignored by Git.
- Live DB has real Ink Builder Program and network-docs research records. Do not mark source verified or user actions complete without user confirmation.

## Completed additions
1. Assessments with evidence and immutable revisions; source changes invalidate revisions in the same transaction.
2. Five manual scoring signals, coverage, separate risk/costs/deadline fields. No reward probabilities.
3. Exact timestamp/calendar validation, schedules, optimistic revisions, idempotent recurring completion; missing periods never invented as completed.
4. Rule-based research cues with exact source offsets, review-before-adoption, deterministic task IDs and stale evidence checks.
5. All new UI flows validated in a separate in-memory test server.

## Next work
- Await provider preference before configuring paid AI services; provider-neutral work can continue.
- Ink apps catalogue now reads public JSON data literals from same-origin Next.js assets without executing downloaded JavaScript. Saves names, descriptions and HTTPS websites in the source snapshot; individual app import remains future work.
- Wallet / chain receipt verification and transaction simulation are not implemented.
- API remains local single-user only; no on-chain execution, credential storage or external account access.
- Monitor only runs while server is alive, opt-in every 6h. Its current setting is not automatically changed.

## Latest addition
Cross-project agenda implemented and browser-tested; /api/agenda refreshes independently from forms. Current push request fulfilled; continued with agenda feature.

## Outcome ledger
OutcomeLedger is composed with the main store by the server. Records manual rewards/expenses, exact asset quantities and cent-valuations, unknown-value handling, idempotent requests and auditable voids. Browser smoke now covers record/void. No actual transactions or price lookups.

## Backups
POST /api/backup streams a session-protected SQLite backup. Temp files cleaned explicitly; portable DELETE journal avoids leftover WAL files. Restore CLI validates integrity/FKs/tables and reserves destination exclusively, refusing existing DB and sidecars. DROP_HUNTER_DB_PATH allows opening restored DB separately. Full round-trip and browser download tested.

## Погоджені джерела та ШІ-аналіз
Див. [RESEARCH_ROADMAP.md](RESEARCH_ROADMAP.md): шість джерел, запропонованих користувачем, вимоги до агентів, доказів, оцінки витрат і ризиків та етапи реалізації. Інтеграції цих джерел ще не реалізовані.

## Загальний список кандидатів
Пріоритет Ink скасовано за уточненням користувача. Додано пошук за назвою/нотатками та збережені статуси new/watching/active/paused/dismissed. Невідома або кілька мереж — окремий дозволений варіант. Статус не підтверджує винагороду та не змінює виконання завдань.
Початкова добірка асистента у research-candidates.json, імпорт у запущений локальний застосунок: node scripts/import-candidates.mjs. Повторний імпорт пропускає наявні назви. Це добірка за відкритими трекерами, не автономний LLM-пошук. Автоматичні адаптери шести трекерів і ШІ-модуль ще потребують реалізації.

## Пошук із трекера
Кнопка «Знайти нові проєкти» викликає POST /api/discovery/projects та читає публічні картки Airdrops.io. До 40 кандидатів за запит, інтервал 60 секунд, дублікати за назвою/URL пропускаються. Існуючі нотатки, статуси й перевірки не перезаписуються. Джерело та час записуються в нотатки. Це імпорт кандидатів без ШІ-оцінки; інші трекери ще не підключені. 37 тестів та браузерний сценарій кнопки пройшли.

## Пріоритет джерел — уточнення користувача
1. CryptoRank: https://cryptorank.io/ru/drophunting
2. Incrypted: https://incrypted.com/airdrops/
Ці два джерела підключати першими. Збирати не лише назви кандидатів, а й покрокові плани участі, посилання на дії, дедлайни та дату перевірки. Зберігати версії планів, показувати додані/змінені кроки; не перезаписувати власні завдання користувача й не скидати виконання без його рішення. Виявлені зміни умов позначати для повторного перегляду.
Airdrops.io — додаткове джерело. DropsTab, CertiK Skynet та AirdropAlert залишаються у плані. Пріоритет джерел не означає пріоритет окремої мережі.
Поточний автоматичний імпорт усе ще використовує Airdrops.io; інтеграції двох основних джерел ще не реалізовані.

План сервера, Android, Telegram та робота: [ASSISTANT_ROADMAP.md](ASSISTANT_ROADMAP.md).

## Локальний ШІ — перший етап
ПК: Intel i5-1235U, 16 GB RAM, Intel Iris Xe. Ollama 0.34.0, модель qwen3:4b. API викликається лише через 127.0.0.1:11434; платні сервіси не налаштовані.
Робот має чат із локальною моделлю, вибором проєкту й історією SQLite (agent_messages). На картці кнопка «Аналіз локальним ШІ» зберігає чернетку у settings agentReview:<id>. Ці висновки не підтверджують джерело, не змінюють завдання та не означають нову перевірку сайту. Модель не має інструментів виконання чи браузера.
Це перший локальний модуль аналізу й діалогу, не завершена система автономного пошуку. Автоматичне навчання ваг, щоденний моніторинг основних трекерів і взаємодія окремих агентів залишаються наступними етапами. Уточнення користувача враховуються через останню історію розмови.
Запуск середовища: відкрити Ollama, потім npm start. Модель встановлюється командою ollama pull qwen3:4b.

Уточнення користувача: Ollama, моделі та журнали фізично зберігати лише на диску D. Каталоги D:\AI\Ollama, D:\AI\OllamaData, D:\AI\OllamaLogs. Старі шляхи на C — лише junction для сумісності. OLLAMA_MODELS=D:\AI\OllamaData\models.

Після живої перевірки базову qwen3:4b замінено на qwen3:4b-instruct: базова модель ігнорувала вимкнення міркування. Обірвані відповіді (done_reason=length) не зберігати.

## Latest research/import work
Incrypted is now the preferred tracker option; 31 live candidates imported. DailyResearch checks watching/active Incrypted cards once daily while server runs, keeps previous snapshot, and triggers local analysis on changes. Full guide retrieval is a separate button using a public instruction link; guide text is passed to local analysis. CryptoRank still returns 403 to direct reads. MaterialImport accepts user-pasted CryptoRank text (16k chars), stores immutable versions, deduplicates unchanged content, invalidates manual verification on change. Browser session access remains unavailable; no cookies copied or challenge bypassed. 43 tests pass plus existing browser smoke. Server/Telegram/full autonomous cross-source search remain incomplete.
