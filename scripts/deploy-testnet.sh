#!/usr/bin/env bash
# Build and deploy the escrow contract to a NEAR testnet account you control.
# Usage: scripts/deploy-testnet.sh <account.testnet>
# Create a free testnet account first:
#   near account create-account sponsor-by-faucet-service <name>.testnet autogenerate-new-keypair save-to-legacy-keychain network-config testnet create
set -euo pipefail
acct=${1:?account.testnet}
cd "$(dirname "$0")/../contracts/escrow"
cargo near build non-reproducible-wasm
near contract deploy "$acct" use-file target/near/clearsend_escrow.wasm \
  with-init-call new json-args '{}' prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
  network-config testnet sign-with-legacy-keychain send
