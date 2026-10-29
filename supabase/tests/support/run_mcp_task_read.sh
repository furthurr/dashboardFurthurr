#!/usr/bin/env bash
# Disposable plain-PostgreSQL checks. Auth/Storage are stand-ins, not service E2E.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
container="furthurr-mcp-task-test-$$"
trap 'docker stop "$container" >/dev/null 2>&1 || true' EXIT
docker run --rm --detach --name "$container" --network none \
  --env POSTGRES_HOST_AUTH_METHOD=trust postgres:16 >/dev/null
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
sql() { docker exec -i "$container" psql -X -q -U postgres -d "$1" -v ON_ERROR_STOP=1; }
for database in bootstrap incremental; do
  docker exec "$container" createdb -U postgres "$database"
  sql "$database" < "$root/supabase/tests/support/mcp_harness.sql"
  if [[ "$database" == bootstrap ]]; then
    sql "$database" < "$root/supabase-schema.sql"
  else
    # Baseline of this implementation; intentionally excludes the new migration.
    git -C "$root" show 267cc910b2f5623f3b9e1ee3d86f3bfebd2c40e9:supabase-schema.sql | sql "$database"
    sql "$database" < "$root/supabase/migrations/202610280003_mcp_task_read.sql"
  fi
  sql "$database" < "$root/supabase/tests/mcp_task_read.sql"
  sql "$database" < "$root/supabase/tests/mcp_identity.sql"
  sql "$database" < "$root/supabase/tests/boards.sql"
  sql "$database" < "$root/supabase/tests/task_assignments.sql"
done
