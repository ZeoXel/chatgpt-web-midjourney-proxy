# Repository Guidelines

## Always reply in Chinese

## Project Structure & Module Organization
- `src/` hosts the Vue 3 + Vite front-end; key domains sit in `views/`, composables in `hooks/`, and shared UI in `components/`. Keep new features modular by colocating stores under `store/` and utilities under `utils/`.
- `service/` contains the Express-based proxy and background jobs. Source lives in `service/src/`, with build artifacts emitted to `service/build/`.
- `public/` and `src/assets/` store static media, while deployment recipes live in `docker-compose/`, `kubernetes/`, and the assorted `README_*.md` playbooks. Update the relevant guide when changing infrastructure assumptions.

## Build, Test, and Development Commands
- `pnpm install` (root) prepares workspace dependencies and hooks; rerun after pulling major changes.
- `pnpm dev` launches the front-end on Vite; pair it with `pnpm --filter service dev` for a full-stack local setup.
- `pnpm build` and `pnpm preview` verify production bundles; use `pnpm --filter service build` plus `pnpm --filter service prod` to exercise the Node proxy build.
- `pnpm lint`, `pnpm type-check`, and `pnpm --filter service lint` keep both codebases aligned with the shared ESLint config; run them before opening a PR.

## Coding Style & Naming Conventions
- The repository relies on `@antfu/eslint-config` (2-space indent, semi-free, single quotes). Run `pnpm lint:fix` or the service equivalent to autofix stylistic nits.
- Write Vue components with `<script setup>` and PascalCase filenames (`ChatDrawer.vue`); composables and utilities stay camelCase.
- Co-locate feature styles in the `styles/` directory or scoped `<style>` blocks, and prefer Tailwind utility classes already configured in `tailwind.config.ts`.

## Testing Guidelines
- There is no dedicated unit-test runner today; enforce quality through linting, `pnpm type-check`, and targeted service scripts such as `pnpm --filter service test:supabase` or `test:assets`.
- When touching user flows, document manual verification steps referencing `PHASE1_TEST_GUIDE.md` or `TEST_RESULTS.md`. Add smoke scripts in `scripts/` when automation is feasible.
- Flag new environment variables in the appropriate deployment guide and provide mocks to avoid breaking CI.

## Commit & Pull Request Guidelines
- Follow the existing history: concise, action-first messages (often Chinese) like `修复sora图片上传`. Keep to present tense and scope one logical change per commit.
- PRs should include: summary of intent, affected modules, local validation commands, and screenshots or logs for UI/API changes. Link related issues and update docs (`docs/`, deployment guides) whenever behaviour changes.

## Security & Configuration Tips
- Secrets belong in `.env` files that mirror the keys explained across `DEPLOYMENT.md` and `VERCEL_DEPLOYMENT_GUIDE.md`; never commit actual keys or tokens.
- Review proxy rule changes with extra care—alterations in `service/src/**` can expose unintended endpoints. When handling asset uploads, confirm storage backends against `service/ASSETS_STORAGE_IMPLEMENTATION.md`.
