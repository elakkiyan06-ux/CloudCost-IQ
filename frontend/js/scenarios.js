/**
 * CloudCost IQ - Pre-built Infrastructure Templates and Scenario Management
 */
const ScenarioTemplates = {
  templates: [
    {
      id: 'template-saas-web',
      name: 'Standard 3-Tier Production Web Stack',
      description: 'Production web service with ALB, 2x ARM t4g.medium compute, EBS gp3 storage, managed RDS PostgreSQL, S3 uploads, and monitoring.',
      environment: 'Production',
      items: [
        { resource_id: 'lb-aws-alb', custom_name: 'Public Ingress ALB', quantity: 1, usage_hours_per_month: 730 },
        { resource_id: 'vm-aws-t4g-medium', custom_name: 'API App Instances', quantity: 2, usage_hours_per_month: 730 },
        { resource_id: 'storage-ebs-gp3', custom_name: 'API Root SSD Disks', quantity: 100, usage_hours_per_month: 730 },
        { resource_id: 'db-aws-rds-postgres-t4g-medium', custom_name: 'Primary PostgreSQL DB', quantity: 1, usage_hours_per_month: 730 },
        { resource_id: 'storage-s3-standard', custom_name: 'Static Assets S3', quantity: 250, usage_hours_per_month: 730 },
        { resource_id: 'net-egress-internet-gb', custom_name: 'Internet Egress Bandwidth', quantity: 300, usage_hours_per_month: 730 },
        { resource_id: 'mon-cloudwatch-metrics', custom_name: 'Custom CloudWatch Metrics', quantity: 2, usage_hours_per_month: 730 }
      ]
    },
    {
      id: 'template-scheduled-dev',
      name: 'Cost-Optimized Scheduled Staging Stack',
      description: 'Staging environment configured for 8x5 weekday operation (174 hrs/month) with lightweight ARM compute and Single-AZ database.',
      environment: 'Staging',
      items: [
        { resource_id: 'vm-aws-t4g-small', custom_name: 'Staging App Instance', quantity: 1, usage_hours_per_month: 174 },
        { resource_id: 'storage-ebs-gp3', custom_name: 'Staging Root Disk', quantity: 40, usage_hours_per_month: 730 },
        { resource_id: 'db-aws-rds-postgres-t4g-micro', custom_name: 'Dev PostgreSQL Instance', quantity: 1, usage_hours_per_month: 174 },
        { resource_id: 'storage-s3-ia', custom_name: 'Staging Media Bucket', quantity: 50, usage_hours_per_month: 730 }
      ]
    },
    {
      id: 'template-heavy-baseline',
      name: 'Enterprise Monolith (Overprovisioned Baseline)',
      description: 'Heavy enterprise monolith running 24/7 with 2x memory-intensive r6i.2xlarge, 500GB io2 SSD, Multi-AZ database, and verbose logging.',
      environment: 'Enterprise',
      items: [
        { resource_id: 'lb-aws-alb', custom_name: 'Multi-Region Ingress ALB', quantity: 2, usage_hours_per_month: 730 },
        { resource_id: 'vm-aws-r6i-2xlarge', custom_name: 'Monolithic Backend VMs', quantity: 2, usage_hours_per_month: 730 },
        { resource_id: 'storage-ebs-io2', custom_name: 'High-IOPS DB Disks', quantity: 500, usage_hours_per_month: 730 },
        { resource_id: 'db-aws-rds-postgres-m6i-large-multiaz', custom_name: 'Multi-AZ PostgreSQL', quantity: 1, usage_hours_per_month: 730 },
        { resource_id: 'mon-cloudwatch-logs-ingest', custom_name: 'Unfiltered CloudWatch Logs', quantity: 200, usage_hours_per_month: 730 }
      ]
    },
    {
      id: 'template-k8s-microservices',
      name: 'Cloud-Native Kubernetes & Container Stack',
      description: 'AWS EKS managed control plane with serverless Fargate container pods, Network Load Balancer, and persistent volume storage.',
      environment: 'Production',
      items: [
        { resource_id: 'k8s-aws-eks-control-plane', custom_name: 'EKS Managed Control Plane', quantity: 1, usage_hours_per_month: 730 },
        { resource_id: 'k8s-aws-fargate-vcpu', custom_name: 'Fargate vCPU Allocations', quantity: 8, usage_hours_per_month: 730 },
        { resource_id: 'k8s-aws-fargate-gb', custom_name: 'Fargate RAM (GB) Allocations', quantity: 32, usage_hours_per_month: 730 },
        { resource_id: 'lb-aws-nlb', custom_name: 'High-Throughput NLB', quantity: 1, usage_hours_per_month: 730 },
        { resource_id: 'storage-ebs-gp3', custom_name: 'PVC Block Storage Volumes', quantity: 150, usage_hours_per_month: 730 }
      ]
    },
    {
      id: 'template-serverless-api',
      name: 'Serverless Event-Driven API Stack',
      description: 'Ultra-low idle cost serverless architecture: AWS Lambda requests, compute duration, Aurora Serverless ACU, and CloudFront CDN.',
      environment: 'Production',
      items: [
        { resource_id: 'serverless-lambda-requests', custom_name: 'Lambda API Requests (Millions)', quantity: 25, usage_hours_per_month: 730 },
        { resource_id: 'serverless-lambda-duration', custom_name: 'Compute Duration (100k GB-sec)', quantity: 50, usage_hours_per_month: 730 },
        { resource_id: 'db-aws-aurora-serverless-acu', custom_name: 'Aurora Serverless ACU', quantity: 2, usage_hours_per_month: 730 },
        { resource_id: 'storage-s3-standard', custom_name: 'Object Storage Bucket', quantity: 300, usage_hours_per_month: 730 },
        { resource_id: 'net-cdn-cloudfront-gb', custom_name: 'CloudFront CDN Egress', quantity: 500, usage_hours_per_month: 730 }
      ]
    }
  ],

  getTemplate(id) {
    return this.templates.find(t => t.id === id);
  }
};

window.ScenarioTemplates = ScenarioTemplates;
