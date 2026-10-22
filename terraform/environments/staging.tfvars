environment = "staging"

vpc_cidr = "10.1.0.0/16"

db_instance_class    = "db.t3.small"
db_allocated_storage = 100
db_backup_retention  = 14

ecs_desired_count = 2
ecs_min_capacity  = 2
ecs_max_capacity  = 4

enable_load_balancer = true

log_retention_days = 14

tags = {
  Environment = "staging"
  ManagedBy   = "Terraform"
  Project     = "Scavenger"
}
