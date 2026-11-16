#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# PROVISIONAMENTO AZURE CONTAINER APPS (ACA) — USANDO RECURSOS EXISTENTES (RG: Zello)
# ==============================================================================

RESOURCE_GROUP="Zello"
SUBSCRIPTION_ID="699484a1-c3c6-42c4-8f02-907c53b6e2c9"
ACA_ENV="env-zello-tcc"

BACK_APP_NAME="zello-back"
FRONT_APP_NAME="zello-front"
INITIAL_PLACEHOLDER_IMAGE="mcr.microsoft.com/k8se/quickstart:latest"

# Carrega variáveis do .env de forma segura (sem interpretar <, > ou # como sintaxe bash)
if [ -f ".env" ]; then
  echo "==> Carregando configurações de banco (zellodb) e bucket (zellostorage) do arquivo .env..."
  while IFS= read -r line || [ -n "$line" ]; do
    # Remove CR (\r) caso o arquivo tenha quebras de linha Windows (CRLF)
    line="${line%$'\r'}"
    # Ignora linhas vazias ou comentários
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
      continue
    fi
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
      export "$key=$val"
    fi
  done < .env
else
  echo "ERRO: Arquivo .env não encontrado na raiz de ZELLO-TCC-back."
  exit 1
fi

echo "==> 1. Selecionando Subscription ($SUBSCRIPTION_ID)..."
az account set --subscription "$SUBSCRIPTION_ID"

LOCATION=$(az group show --name "$RESOURCE_GROUP" --query location --output tsv)
echo "==> 2. Usando Resource Group existente '$RESOURCE_GROUP' na região '$LOCATION'..."

echo "==> 3. Garantindo que o firewall do PostgreSQL (zellodb) aceita conexões de serviços internos do Azure..."
az postgres flexible-server firewall-rule create \
  --resource-group "$RESOURCE_GROUP" \
  --name "zellodb" \
  --rule-name "AllowAzureServices" \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0 \
  --output none 2>/dev/null || true

echo "==> 4. Verificando Container Apps Environment ($ACA_ENV)..."
if az containerapp env show --name "$ACA_ENV" --resource-group "$RESOURCE_GROUP" --output none 2>/dev/null; then
  echo "    Environment '$ACA_ENV' já existe! Pulando criação."
else
  az containerapp env create \
    --name "$ACA_ENV" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION"
fi

echo "==> 5. Criando/Atualizando Container App do Backend ($BACK_APP_NAME) conectado ao zellodb e zellostorage..."
if az containerapp show --name "$BACK_APP_NAME" --resource-group "$RESOURCE_GROUP" --output none 2>/dev/null; then
  echo "    Container App '$BACK_APP_NAME' já existe! Atualizando variáveis..."
else
  az containerapp create \
    --name "$BACK_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$INITIAL_PLACEHOLDER_IMAGE" \
    --cpu 0.5 \
    --memory 1.0Gi \
    --min-replicas 1 \
    --max-replicas 2 \
    --ingress external \
    --target-port 3001
fi

# v5.0.0-4.1.3: o cliente chega à API por 3 proxies (ingress do frontend,
# nginx e ingress do backend), por isso TRUST_PROXY_HOPS=3.
# v5.0.0-13.3.1: credenciais ficam no cofre de segredos do Container App e
# chegam ao contêiner por referência (secretref:). Elas não aparecem como
# variáveis de ambiente em texto puro no portal nem nos logs de implantação.
az containerapp secret set \
  --name "$BACK_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --secrets \
    db-pass="$DB_PASS" \
    jwt-secret="$JWT_SECRET" \
    google-client-secret="$GOOGLE_CLIENT_SECRET" \
    mail-pass="$MAIL_PASS" \
    azure-sas-token="$AZURE_SAS_TOKEN" \
  --output none

az containerapp update \
  --name "$BACK_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars \
    PORT=3001 \
    NODE_ENV=production \
    TRUST_PROXY_HOPS="${TRUST_PROXY_HOPS:-3}" \
    DB_HOST="$DB_HOST" \
    DB_PORT="$DB_PORT" \
    DB_USER="$DB_USER" \
    DB_PASS=secretref:db-pass \
    DB_NAME="$DB_NAME" \
    DB_SSL=true \
    DB_SYNCHRONIZE=false \
    DB_MIGRATIONS_RUN=true \
    JWT_SECRET=secretref:jwt-secret \
    GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
    GOOGLE_CLIENT_SECRET=secretref:google-client-secret \
    MAIL_HOST="$MAIL_HOST" \
    MAIL_PORT="$MAIL_PORT" \
    MAIL_USER="$MAIL_USER" \
    MAIL_PASS=secretref:mail-pass \
    MAIL_SECURE="$MAIL_SECURE" \
    MAIL_FROM="$MAIL_FROM" \
    AZURE_SAS_URL="$AZURE_SAS_URL" \
    AZURE_SAS_TOKEN=secretref:azure-sas-token \
    CNPJ_LOOKUP_ENABLED="${CNPJ_LOOKUP_ENABLED:-true}" \
    WHATSAPP_ENABLED=false \
  --output none

BACK_FQDN=$(az containerapp show \
  --name "$BACK_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv)
BACK_URL="https://${BACK_FQDN}"

echo "==> 6. Criando/Verificando Container App do Frontend ($FRONT_APP_NAME)..."
if az containerapp show --name "$FRONT_APP_NAME" --resource-group "$RESOURCE_GROUP" --output none 2>/dev/null; then
  echo "    Container App '$FRONT_APP_NAME' já existe!"
else
  az containerapp create \
    --name "$FRONT_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$INITIAL_PLACEHOLDER_IMAGE" \
    --cpu 0.25 \
    --memory 0.5Gi \
    --min-replicas 1 \
    --max-replicas 2 \
    --ingress external \
    --target-port 80
fi

FRONT_FQDN=$(az containerapp show \
  --name "$FRONT_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv)
FRONT_URL="https://${FRONT_FQDN}"

# O frontend encaminha /api para o backend (mesmo site: cookies SameSite=Strict).
az containerapp update \
  --name "$FRONT_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars API_UPSTREAM="$BACK_URL" \
  --output none

echo "==> 7. Atualizando URLs de CORS e Callback OAuth no Backend ($BACK_APP_NAME)..."
az containerapp update \
  --name "$BACK_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars \
    FRONTEND_BASE_URL="$FRONT_URL" \
    CORS_ALLOWED_ORIGINS="${FRONT_URL}" \
    GOOGLE_CALLBACK_URL="${FRONT_URL}/api/auth/google/callback" \
    GOOGLE_REDIRECT_URL="${FRONT_URL}/explore" \
  --output none

echo ""
echo "=============================================================================="
echo "CONTAINER APPS CRIADOS COM SUCESSO!"
echo "=============================================================================="
echo "Resource Group:                 ${RESOURCE_GROUP}"
echo "Banco conectado:                ${DB_HOST} (${DB_NAME})"
echo "Bucket conectado:               ${AZURE_SAS_URL}"
echo "URL do Backend (VITE_API_URL):  ${BACK_URL}"
echo "URL do Frontend:                ${FRONT_URL}"
echo "Documentação da API:            desativada em produção (v5.0.0-13.4.5)"
echo "=============================================================================="
echo ""
echo "==> 8. Criando Managed Identity + OIDC para o GitHub Actions (compatível com conta estudante PUCPR)..."
IDENTITY_NAME="id-zello-github"

az identity create \
  --name "$IDENTITY_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none

CLIENT_ID=$(az identity show --name "$IDENTITY_NAME" --resource-group "$RESOURCE_GROUP" --query clientId --output tsv)
PRINCIPAL_ID=$(az identity show --name "$IDENTITY_NAME" --resource-group "$RESOURCE_GROUP" --query principalId --output tsv)
TENANT_ID=$(az account show --query tenantId --output tsv)

echo "    Atribuindo permissão Contributor no Resource Group '$RESOURCE_GROUP'..."
az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}" \
  --output none 2>/dev/null || true

echo "    Configurando Federated Credentials (OIDC) para os repositórios GitHub..."
for pair in \
  "fc-back-develop:TCC-2026-ZELLO/zello-tcc-back:refs/heads/develop" \
  "fc-back-main:TCC-2026-ZELLO/zello-tcc-back:refs/heads/main" \
  "fc-back-upper-dev:TCC-2026-ZELLO/ZELLO-TCC-back:refs/heads/develop" \
  "fc-back-upper-main:TCC-2026-ZELLO/ZELLO-TCC-back:refs/heads/main" \
  "fc-front-develop:TCC-2026-ZELLO/ZELLO-TCC-Front:refs/heads/develop" \
  "fc-front-main:TCC-2026-ZELLO/ZELLO-TCC-Front:refs/heads/main"; do
  FC_NAME="${pair%%:*}"
  REST="${pair#*:}"
  REPO="${REST%%:*}"
  REF="${REST#*:}"

  az identity federated-credential create \
    --name "$FC_NAME" \
    --identity-name "$IDENTITY_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --issuer "https://token.actions.githubusercontent.com" \
    --subject "repo:${REPO}:ref:${REF}" \
    --audiences "api://AzureADTokenExchange" \
    --output none 2>/dev/null || true
done

echo ""
echo "Copie o JSON abaixo e salve no secret AZURE_CREDENTIALS nos dois repositórios GitHub:"
echo "------------------------------------------------------------------------------"
cat <<EOF
{
  "clientId": "${CLIENT_ID}",
  "tenantId": "${TENANT_ID}",
  "subscriptionId": "${SUBSCRIPTION_ID}"
}
EOF
echo "------------------------------------------------------------------------------"
