# config — Runtime and Infrastructure Configuration

This directory holds configuration files consumed by the application at runtime,
by monitoring tools, and by manual ops processes.

## Active files

| File                        | Consumer                                      |
| --------------------------- | --------------------------------------------- |
| `alertmanager.yml`          | Alertmanager (Prometheus alert routing)       |
| `elasticsearch.yml`         | Elasticsearch node configuration              |
| `filebeat.yml`              | Filebeat log shipper                          |
| `ilm-policy.json`           | Elasticsearch ILM policy                      |
| `jaeger-config.yml`         | Jaeger distributed tracing                    |
| `logstash.conf`             | Logstash pipeline                             |
| `monitoring-manifests.yml`  | Prometheus + Grafana k8s manifests            |
| `prometheus.yml`            | Prometheus scrape config                      |
| `vault-config.hcl`          | Vault server configuration                    |
| `vault-rotation-policy.hcl` | Vault secret rotation policy                  |
| `vault-secrets-config.hcl`  | Vault secrets engine setup                    |
| `environments.md`           | Human-readable environment variable reference |
| `grafana/`                  | Grafana dashboard and datasource provisioning |
| `vault-templates/`          | Vault agent template for env injection        |

## Guard: no dead config files

Config files must be consumed by an active service, CI workflow, or documented
operational runbook. If a file is no longer referenced, remove it and note it
here. Do not leave speculative or future-use configs in this directory.

## Removed in issue #1782

The following were removed as unreferenced dead config:

- `cloudfront-distribution.yaml` — CloudFront config never wired to any deployment; CDN is managed via Terraform if needed
- `cost-budget-alerts.yaml` — AWS budget alerts, superseded by `terraform/modules/cost_optimization`
- `release-versioning.yaml` — release versioning rules, not consumed by any CI step (tagging is handled by GitHub Actions)
- `route53-multi-region.yaml` — multi-region Route 53 config, multi-region not yet implemented
- `capacity-model.yaml` — capacity planning model, not consumed by any pipeline
- `auto-scaling-rules.yaml` — duplicate of HPA rules already in `k8s/deployment.yml`
