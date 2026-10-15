// Replaces the old live-RPC test. This suite uses an in-memory PostgreSQL DB,
// never Supabase or physical hardware, and requires health-app-web npm ci first.
import '../../health-app-web/tests/integration.mjs';
