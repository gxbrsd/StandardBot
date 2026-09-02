# Runtime data

StandardBot creates the `data/` directory automatically while it runs.

This directory may contain guild IDs, user IDs, ticket state, moderation history, message configuration and saved server models. It is intentionally excluded from Git through `.gitignore`.

Do not commit a production `data/` directory to a public repository.
