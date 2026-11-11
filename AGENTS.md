# CV Match — AI Agent Instructions

## General engineering rules
- Inspect the existing project structure and follow its established framework, package manager, conventions, and documentation before changing code.
- Prefer small, maintainable, typed changes. Add or update tests for meaningful behavior changes.
- Do not expose secrets, commit `.env` values, or place personal CV/resume data in logs, screenshots, traces, fixtures, or Git.
- Do not delete data, migrations, infrastructure, or user content without explicit approval.
- Do not merge pull requests, deploy, change production configuration, or run production database migrations without explicit approval.
- Report changed files, verification actually performed, results, limitations, and remaining work. Never claim a check passed unless it was run.

## Browser automation — Agent Browser
- Use Vercel `agent-browser` for real-browser verification of UI and user workflows; a successful build or unit test alone does not prove the browser experience works.
- Before first use in an environment, check `agent-browser --version`. If unavailable, install the CLI with `npm install -g agent-browser`, then install its browser with `agent-browser install`. On Linux, use `agent-browser install --with-deps` only when required system browser libraries are missing and the environment permits installing them.
- Before using the tool, load the version-matched instructions with `agent-browser skills get core` and follow them. The discovery skill can be installed with `npx skills add vercel-labs/agent-browser` when the agent harness supports skills.
- Standard interaction loop: `agent-browser open <URL>` → `agent-browser snapshot -i` → interact using fresh element refs → take a new snapshot after navigation or meaningful DOM changes. Use `agent-browser --help` for current command syntax.
- Verify the actual changed workflows, visible controls, forms and validation, navigation, error/empty states, keyboard/focus behavior where relevant, and responsive layouts at relevant phone, tablet, and desktop widths.
- Inspect browser console/errors and capture screenshots for material UI changes or regressions. A click is not considered successful unless the resulting page/state is checked.
- Use only synthetic development/preview data and explicitly authorized test accounts. CVs/resumes and candidate information are personal data: never expose, save, or enter real CV content or personal data into browser sessions, screenshots, traces, fixtures, or Git unless explicitly authorized and necessary.
- Never use browser automation to submit real job applications, send messages, publish content, or perform irreversible actions. Do not bypass authentication or authorization to claim a protected workflow passed.
- If a route requires authentication, report it as blocked/not tested unless an authorized test account and safe non-production environment are available.
- Report the exact URL/environment, routes and viewport sizes tested, actions performed, observed results, console errors, screenshots/evidence, and anything not tested. Clearly distinguish browser-tested behavior from build/unit-test results.
- Do not add `agent-browser` as an application runtime dependency or commit browser binaries/auth state unless the project explicitly requires and approves that change.
