environment = "prod"

vpc_cidr = "10.2.0.0/16"

db_instance_class    = "db.r6i.large"
db_allocated_storage = 500
db_backup_retention  = 90
db_multi_az          = true
db_enhanced_backup   = true

ecs_desired_count = 3
ecs_min_capacity  = 2
ecs_max_capacity  = 10

enable_load_balancer = true

log_retention_days = 90

enable_autoscaling       = true
autoscaling_target_cpu   = 70

tags = {
  Environment = "prod"
  ManagedBy   = "Terraform"
  Project     = "Scavenger"
  CostCenter  = "Platform"
}
