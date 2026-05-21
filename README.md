# openapi-trigger-faker

Synthetic OpenAPI spec + scripts to mutate it. Cuando `openapi.json` cambia en `main`, dispara un `repository_dispatch` al repo del cliente (`open-api-client-test`) que regenera el SDK con `@hey-api/openapi-ts`.

Pensado como sandbox para probar el flow end-to-end antes de portarlo a [`turtle-kit`](../../TURTLE/turtle-kit/).

## Estructura

```
openapi.json                          # spec sintético (single source of truth)
scripts/mutate.mjs                    # mutaciones programáticas (add/remove/rename/bump)
.github/workflows/notify-client.yml   # cross-repo dispatch on push to main
```

## Mutaciones disponibles

```bash
# agregar endpoint
node scripts/mutate.mjs add-endpoint --path /v1/widgets --method get --op listWidgets --tag widgets

# eliminar endpoint
node scripts/mutate.mjs remove-endpoint --path /v1/items/{id} --method get

# renombrar operationId
node scripts/mutate.mjs rename-op --path /v1/items --method get --to listAllItems

# agregar campo a schema
node scripts/mutate.mjs add-field --schema Item --field color --type string

# bump version
node scripts/mutate.mjs bump-version --to 1.1.0
```

Flow típico: corrés un mutate, commiteás el `openapi.json` resultante, abrís PR, mergeás → el workflow dispara el regen del cliente.

## Setup del cross-repo dispatch

El workflow `notify-client.yml` necesita:

1. **Secret** `CLIENT_REPO_DISPATCH_TOKEN` (repo settings → Secrets → Actions):
   - Fine-grained PAT con permiso `Contents: read-only` + `Metadata: read-only` no alcanza — necesita **`Actions: read and write`** sobre el repo del cliente para llamar `POST /repos/{owner}/{repo}/dispatches`.
   - Alternativa más simple: classic PAT con scope `repo`.
2. **Variable** `CLIENT_REPO` (repo settings → Variables → Actions):
   - Valor: `<owner>/open-api-client-test`.

El client repo escucha el evento `openapi-spec-updated`. Payload enviado:

```json
{
  "event_type": "openapi-spec-updated",
  "client_payload": {
    "spec_sha": "<sha256 del openapi.json>",
    "source_commit": "<commit que tocó el spec>",
    "source_ref": "main"
  }
}
```

## Por qué este shape

- **Un JSON plano** en vez de un servidor: el cliente baja el spec via raw URL de GitHub, no necesita un endpoint vivo.
- **Mutaciones programáticas** en vez de ediciones manuales: cada cambio es reproducible y diff-friendly.
- **`repository_dispatch`** en vez de cron: el regen ocurre apenas mergeás, no en una ventana arbitraria.
