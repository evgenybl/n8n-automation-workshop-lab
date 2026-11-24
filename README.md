# n8n automation workshop lab

Work in progress. Private until it is finished and checked.

## Try it

<!-- try-it:command -->
```bash
docker compose up -d
node tools/load.js
curl -s -w ' %{http_code}\n' -X POST http://localhost:5678/webhook/stage-6-solution -H 'content-type: application/json' -d '{"name":"Maya Rivers","email":"maya.rivers@example.com","message":"How much would 12 workshop seats cost in March?","consent":true}'
```

<!-- try-it:output -->
```text
{"status":"waiting for approval","approval":"A1"} 202
```
