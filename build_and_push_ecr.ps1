# ==============================================================================
# ForgeQuality — Amazon ECR Build & Push Automation Script
# Target Account: 312116405617 | Region: us-east-1
# ==============================================================================

[CmdletBinding()]
param(
    [string]$AwsRegion = "us-east-1",
    [string]$AwsAccountId = "312116405617",
    [string]$BackendRepo = "forge-quality-system-backend",
    [string]$FrontendRepo = "forge-quality-system-frontend",
    [string]$Tag = "v1.0.0"
)

$ErrorActionPreference = "Stop"

$RegistryUri = "$AwsAccountId.dkr.ecr.$AwsRegion.amazonaws.com"
$BackendEcrUri = "$RegistryUri/$BackendRepo:$Tag"
$FrontendEcrUri = "$RegistryUri/$FrontendRepo:$Tag"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " ForgeQuality — ECR Build & Push Pipeline" -ForegroundColor Cyan
Write-Host " Region:         $AwsRegion"
Write-Host " Account ID:     $AwsAccountId"
Write-Host " Backend Target: $BackendEcrUri"
Write-Host " Frontend Target:$FrontendEcrUri"
Write-Host "==========================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 1. Pre-flight Check: Docker Availability
# ------------------------------------------------------------------------------
Write-Host "`n[1/6] Verifying Docker daemon..." -ForegroundColor Yellow
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker CLI is not recognized on PATH. Please ensure Docker Desktop is installed and running."
    exit 1
}

try {
    docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) { throw }
    Write-Host "Docker daemon is active and responsive." -ForegroundColor Green
} catch {
    Write-Error "Docker daemon is not running. Please start Docker Desktop before proceeding."
    exit 1
}

# ------------------------------------------------------------------------------
# 2. Pre-flight Check: AWS CLI Authentication
# ------------------------------------------------------------------------------
Write-Host "`n[2/6] Verifying AWS CLI authentication..." -ForegroundColor Yellow
try {
    $identityJson = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "Authenticated as: $($identityJson.Arn) (Account: $($identityJson.Account))" -ForegroundColor Green
    
    if ($identityJson.Account -ne $AwsAccountId) {
        Write-Warning "ACTIVE ACCOUNT MISMATCH: Current AWS CLI session is logged into Account [$($identityJson.Account)], but target ECR repositories belong to [$AwsAccountId]."
        Write-Warning "Ensure cross-account permissions exist, or run 'aws configure' / set AWS_PROFILE to authenticate as Account $AwsAccountId."
    }
} catch {
    Write-Error "AWS authentication check failed. Run 'aws configure' or export credentials before proceeding."
    exit 1
}

# ------------------------------------------------------------------------------
# 3. Guardrail: Check if Image Tags Already Exist (Prevent Overwriting)
# ------------------------------------------------------------------------------
Write-Host "`n[3/6] Checking for existing image tags in ECR..." -ForegroundColor Yellow
$backendTagCheck = aws ecr describe-images --repository-name $BackendRepo --image-ids imageTag=$Tag --region $AwsRegion 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Error "Tag '$Tag' already exists in $BackendRepo. Guardrail active: refusing to overwrite existing image."
    exit 1
}

$frontendTagCheck = aws ecr describe-images --repository-name $FrontendRepo --image-ids imageTag=$Tag --region $AwsRegion 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Error "Tag '$Tag' already exists in $FrontendRepo. Guardrail active: refusing to overwrite existing image."
    exit 1
}
Write-Host "Tag '$Tag' is available in both repositories. Proceeding." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 4. Build Docker Images
# ------------------------------------------------------------------------------
Write-Host "`n[4/6] Building Docker images..." -ForegroundColor Yellow

Write-Host "Building backend image: $BackendRepo:$Tag..." -ForegroundColor Cyan
docker build -t "$BackendRepo:$Tag" ./backend
if ($LASTEXITCODE -ne 0) { Write-Error "Backend Docker build failed."; exit 1 }

Write-Host "Building frontend image: $FrontendRepo:$Tag..." -ForegroundColor Cyan
docker build -t "$FrontendRepo:$Tag" ./frontend
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend Docker build failed."; exit 1 }

Write-Host "Both images built successfully." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 5. Authenticate Docker with Amazon ECR & Tag Images
# ------------------------------------------------------------------------------
Write-Host "`n[5/6] Authenticating Docker with Amazon ECR & Tagging..." -ForegroundColor Yellow

(aws ecr get-login-password --region $AwsRegion) | docker login --username AWS --password-stdin $RegistryUri
if ($LASTEXITCODE -ne 0) { Write-Error "ECR Docker login failed."; exit 1 }
Write-Host "ECR Docker login succeeded." -ForegroundColor Green

docker tag "$BackendRepo:$Tag" $BackendEcrUri
docker tag "$FrontendRepo:$Tag" $FrontendEcrUri
Write-Host "Images tagged for ECR." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 6. Push Images to ECR & Verify
# ------------------------------------------------------------------------------
Write-Host "`n[6/6] Pushing images to Amazon ECR..." -ForegroundColor Yellow

Write-Host "Pushing backend: $BackendEcrUri..." -ForegroundColor Cyan
docker push $BackendEcrUri
if ($LASTEXITCODE -ne 0) { Write-Error "Backend push failed."; exit 1 }

Write-Host "Pushing frontend: $FrontendEcrUri..." -ForegroundColor Cyan
docker push $FrontendEcrUri
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend push failed."; exit 1 }

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " Upload Verification" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

aws ecr describe-images `
  --repository-name $BackendRepo `
  --image-ids imageTag=$Tag `
  --region $AwsRegion `
  --query 'imageDetails[*].[imageTags, imageDigest, imageSizeInBytes, imagePushedAt]' `
  --output table

aws ecr describe-images `
  --repository-name $FrontendRepo `
  --image-ids imageTag=$Tag `
  --region $AwsRegion `
  --query 'imageDetails[*].[imageTags, imageDigest, imageSizeInBytes, imagePushedAt]' `
  --output table

Write-Host "`nSUCCESS: Both Docker images are now stored in Amazon ECR and ready for ECS Fargate deployment!" -ForegroundColor Green

