environment = "dev"

vpc_cidr = "10.0.0.0/16"

db_instance_class   = "db.t3.micro"
db_allocated_storage = 20
db_backup_retention = 7

ecs_desired_count = 1
ecs_min_capacity  = 1
ecs_max_capacity  = 1

enable_load_balancer = false

log_retention_days = 7

tags = {
  Environment = "dev"
  ManagedBy   = "Terraform"
  Project     = "Scavenger"
}
