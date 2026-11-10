# Constraints — Ninho (Finanças Casal)

Last reviewed: 2026-11-10

## Floor (always enforced, no setup required)

- No suppression comments: `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `any`
- No unimplemented stubs: `throw new Error("Not implemented")`, empty `catch {}`
- No skipped or deleted tests without a reason in the commit message
- No secrets in source (`GAS_URL` and `GAS_SECRET_TOKEN` must remain server-only in Next.js API routes / Server Actions)
- Monetary arithmetic must be exact to the cent (2 decimal places, installment rounding residual applied to installment 1)
- Descriptive Neutrality: UI must never display coercive/punitive red budget-exceeded alerts on operational cost variations
- This file does not get weakened to make a change pass

## Enforced with numbers

| Dimension | Rule | Checked by | Runs at |
|-----------|------|-----------|---------|
| Types | Zero type errors | `npm run typecheck` | every task |
| Lint | Zero lint errors | `npm run lint` | every task |
| Unit Tests | 100% pass on domain & parser suites | `npm run test` | every task |
| Production Build | Clean Next.js production build | `npm run build` | task end |
