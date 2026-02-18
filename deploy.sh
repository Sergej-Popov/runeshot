#!/bin/bash
set -uo pipefail

TARGET_DIR='//192.168.1.133/dev/runeshot'
REMOTE_HOST='sergej@192.168.1.133'
REMOTE_DIR='/stripe500gb/dev/runeshot'
LOG_FILE='deploy.log'
EXIT_CODE=0

pause_before_exit() {
  local exit_code="$1"
  echo "----------end----------"
  if [ "${exit_code}" -eq 0 ]; then
    echo "deploy finished successfully"
  else
    echo "deploy failed (exit code: ${exit_code})"
    echo "see log: ${LOG_FILE}"
  fi
  echo "press any key to finish"
  if [ -t 0 ]; then
    read -r -n 1
    echo
  else
    sleep 8
  fi
}

run_step() {
  local title="$1"
  shift
  echo
  echo "==> ${title}"
  echo "cmd: $*"
  "$@"
  local rc=$?
  if [ "${rc}" -ne 0 ]; then
    echo "FAILED (${rc}): ${title}"
    EXIT_CODE="${rc}"
    return "${rc}"
  fi
  echo "ok: ${title}"
}

sync_files() {
  rm -rf "${TARGET_DIR}/client" "${TARGET_DIR}/server" "${TARGET_DIR}/docker"
  rm -f "${TARGET_DIR}/docker-compose.yml" \
    "${TARGET_DIR}/Dockerfile.server" \
    "${TARGET_DIR}/Dockerfile.client" \
    "${TARGET_DIR}/.dockerignore" \
    "${TARGET_DIR}/package.json" \
    "${TARGET_DIR}/package-lock.json"

  cp -f ./docker-compose.yml "${TARGET_DIR}/docker-compose.yml"
  cp -f ./Dockerfile.server "${TARGET_DIR}/Dockerfile.server"
  cp -f ./Dockerfile.client "${TARGET_DIR}/Dockerfile.client"
  cp -f ./.dockerignore "${TARGET_DIR}/.dockerignore"
  cp -f ./package.json "${TARGET_DIR}/package.json"
  cp -f ./package-lock.json "${TARGET_DIR}/package-lock.json"

  tar -cf - \
    --exclude='./client/node_modules' \
    --exclude='./client/dist' \
    ./client | tar -C "${TARGET_DIR}" -xf -

  tar -cf - \
    --exclude='./server/node_modules' \
    --exclude='./server/dist' \
    ./server | tar -C "${TARGET_DIR}" -xf -

  tar -cf - ./docker | tar -C "${TARGET_DIR}" -xf -
}

exec > >(tee -a "${LOG_FILE}") 2>&1
trap 'pause_before_exit ${EXIT_CODE}' EXIT

echo "starting deploy"
echo "target: ${TARGET_DIR}"
echo "remote: ${REMOTE_HOST}:${REMOTE_DIR}"

if ! command -v tar >/dev/null 2>&1; then
  echo "ERROR: tar is required in Git Bash."
  EXIT_CODE=1
  exit 1
fi

if [ ! -d "${TARGET_DIR}" ]; then
  echo "ERROR: target directory is not accessible: ${TARGET_DIR}"
  EXIT_CODE=1
  exit 1
fi

run_step "sync files" sync_files || exit "${EXIT_CODE}"
run_step "rebuild and restart containers" ssh -t "${REMOTE_HOST}" "cd ${REMOTE_DIR} && sudo docker compose up -d --build --remove-orphans" || exit "${EXIT_CODE}"

EXIT_CODE=0
