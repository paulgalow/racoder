#!/bin/bash

isJson() {
  if ! jq -rM . >/dev/null 2>&1 <<<"$1"; then
    echo "Failed to parse JSON, or got false/null"
    return 1
  fi
}

# Fetch GitHub repository description
REPO_DESCRIPTION=$(curl --fail --silent --show-error \
  "https://api.github.com/repos/$GITHUB_REPOSITORY" \
  | jq -r '.description')

# Fetch GitHub repository README.md content
README_CONTENT=$(curl --fail --silent --show-error \
  "https://api.github.com/repos/$GITHUB_REPOSITORY/readme" \
  | jq -r '.content' \
  | base64 --decode)

# Authenticate with Docker Hub and get JWT token
JWT_TOKEN=$(curl --fail --silent --show-error \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username": "'"$DOCKER_USERNAME"'","password": "'"$DOCKER_ACCESS_TOKEN"'"}' \
  https://hub.docker.com/v2/users/login/ \
  | jq -r '.token')

# Prepare the payload for Docker Hub API
PAYLOAD=$(jq -n \
  --arg description "$REPO_DESCRIPTION" \
  --arg readme "$README_CONTENT" \
  '{description: $description, full_description: $readme}')

# Update Docker Hub repository description and README
RESPONSE=$(curl --fail --silent --show-error \
  -X PATCH \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -d "$PAYLOAD" \
  "https://hub.docker.com/v2/repositories/$GITHUB_REPOSITORY/")

if ! isJson "$RESPONSE"; then
  echo "Failed to update Docker Hub README and description"
  exit 1
fi

RESPONSE_FULL_DESCRIPTION=$(echo "$RESPONSE" | jq -r '.full_description')

# Check if the response contains the expected values
if [[ "$RESPONSE_FULL_DESCRIPTION" != "$README_CONTENT" ]]; then
  echo "Failed to update Docker Hub README and description"
  echo "Response: $(echo "$RESPONSE" | jq -r .)"
  exit 1
fi