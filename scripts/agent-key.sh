#!/usr/bin/env bash
# Add or revoke the AI verifier agent's restricted function-call access key.
# Usage:
#   scripts/agent-key.sh add    <verifier-account> <escrow-contract> [allowance-NEAR] [network]
#   scripts/agent-key.sh revoke <verifier-account> <public-key ed25519:...>   [network]
#   scripts/agent-key.sh list   <verifier-account> [network]
# The key can ONLY call `attest` on the escrow contract, cannot attach deposits,
# and can burn at most <allowance> NEAR of gas. It can never transfer, release or refund.
set -euo pipefail
cmd=${1:?add|revoke|list}; acct=${2:?verifier account}
case "$cmd" in
  add)
    contract=${3:?escrow contract}; allowance=${4:-0.25}; net=${5:-testnet}
    near account add-key "$acct" grant-function-call-access \
      --allowance "$allowance NEAR" --contract-account-id "$contract" --function-names attest \
      autogenerate-new-keypair save-to-legacy-keychain network-config "$net" sign-with-legacy-keychain send
    echo "Copy the new private key from ~/.near-credentials/$net/$acct/ into AGENT_PRIVATE_KEY (never commit it)." ;;
  revoke)
    pk=${3:?public key}; net=${4:-testnet}
    near account delete-keys "$acct" public-keys "$pk" network-config "$net" sign-with-legacy-keychain send ;;
  list)
    net=${3:-testnet}
    near account list-keys "$acct" network-config "$net" now ;;
  *) echo "unknown command $cmd"; exit 1 ;;
esac
