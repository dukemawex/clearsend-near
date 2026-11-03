//! Integration tests against a local NEAR sandbox (near-workspaces).
//! Build first: `cargo near build non-reproducible-wasm`.
use near_workspaces::types::{AccessKey, KeyType, NearToken, SecretKey};
use near_workspaces::{Account, Contract};
use serde_json::json;

async fn setup() -> anyhow::Result<(near_workspaces::Worker<near_workspaces::network::Sandbox>, Contract, Account, Account, Account)> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = std::fs::read("target/near/clearsend_escrow.wasm")?;
    let contract = worker.dev_deploy(&wasm).await?;
    contract.call("new").transact().await?.into_result()?;
    let payer = worker.dev_create_account().await?;
    let recipient = worker.dev_create_account().await?;
    let verifier = worker.dev_create_account().await?;
    Ok((worker, contract, payer, recipient, verifier))
}

async fn create(contract: &Contract, payer: &Account, recipient: &Account, verifier: &Account, timeout: u64) -> anyhow::Result<u64> {
    let id: String = payer
        .call(contract.id(), "create_escrow")
        .args_json(json!({"recipient": recipient.id(), "verifier": verifier.id(), "spec": "Translate the attached 1-page contract into French", "timeout_secs": timeout.to_string()}))
        .deposit(NearToken::from_millinear(100))
        .transact().await?.into_result()?.json()?;
    Ok(id.parse()?)
}

#[tokio::test]
async fn full_flow_with_agent_function_call_key() -> anyhow::Result<()> {
    let (worker, contract, payer, recipient, verifier) = setup().await?;
    let id = create(&contract, &payer, &recipient, &verifier, 3600).await?;

    payer.call(contract.id(), "fund").args_json(json!({"id": id.to_string()}))
        .deposit(NearToken::from_near(2)).transact().await?.into_result()?;
    recipient.call(contract.id(), "submit").args_json(json!({"id": id.to_string(), "deliverable": "https://example.org/fr.pdf sha256:abcd"}))
        .transact().await?.into_result()?;

    // Security: verifier gives the AI agent a function-call key limited to `attest` with a 0.25 NEAR gas allowance.
    let agent_sk = SecretKey::from_random(KeyType::ED25519);
    verifier.batch(verifier.id())
        .add_key(agent_sk.public_key(), AccessKey::function_call_access(contract.id(), &["attest"], Some(NearToken::from_millinear(250))))
        .transact().await?.into_result()?;
    let agent = Account::from_secret_key(verifier.id().clone(), agent_sk, &worker);

    // The agent key cannot call release (not allowlisted).
    let denied = agent.call(contract.id(), "release").args_json(json!({"id": id.to_string()})).transact().await;
    assert!(denied.is_err() || denied.unwrap().is_failure(), "agent key must not call release");

    agent.call(contract.id(), "attest")
        .args_json(json!({"id": id.to_string(), "approved": true, "reason": "French translation present, 1 page", "model": "nvidia/nemotron-3-ultra-550b-a55b:free", "report_hash": "00".repeat(32)}))
        .transact().await?.into_result()?;

    let before = recipient.view_account().await?.balance;
    payer.call(contract.id(), "release").args_json(json!({"id": id.to_string()})).gas(near_workspaces::types::Gas::from_tgas(50))
        .transact().await?.into_result()?;
    let after = recipient.view_account().await?.balance;
    assert!(after.as_yoctonear() - before.as_yoctonear() == NearToken::from_near(2).as_yoctonear());

    let e: serde_json::Value = contract.view("get_escrow").args_json(json!({"id": id.to_string()})).await?.json()?;
    assert_eq!(e["status"], "Released");
    assert_eq!(e["attestation"]["attested_by"], verifier.id().to_string());

    // Revoke the agent key; further use fails.
    verifier.batch(verifier.id()).delete_key(agent.secret_key().public_key()).transact().await?.into_result()?;
    Ok(())
}

#[tokio::test]
async fn rejected_is_refunded_and_stranger_cannot_attest() -> anyhow::Result<()> {
    let (worker, contract, payer, recipient, verifier) = setup().await?;
    let id = create(&contract, &payer, &recipient, &verifier, 3600).await?;
    payer.call(contract.id(), "fund").args_json(json!({"id": id.to_string()})).deposit(NearToken::from_near(1)).transact().await?.into_result()?;
    recipient.call(contract.id(), "submit").args_json(json!({"id": id.to_string(), "deliverable": "lorem ipsum"})).transact().await?.into_result()?;

    let stranger = worker.dev_create_account().await?;
    let r = stranger.call(contract.id(), "attest")
        .args_json(json!({"id": id.to_string(), "approved": true, "reason": "x", "model": "m", "report_hash": "h"}))
        .transact().await?;
    assert!(r.is_failure());

    verifier.call(contract.id(), "attest")
        .args_json(json!({"id": id.to_string(), "approved": false, "reason": "Not French", "model": "m", "report_hash": "h"}))
        .transact().await?.into_result()?;
    let r = payer.call(contract.id(), "release").args_json(json!({"id": id.to_string()})).transact().await?;
    assert!(r.is_failure(), "release must fail when rejected");
    let before = payer.view_account().await?.balance;
    payer.call(contract.id(), "refund").args_json(json!({"id": id.to_string()})).gas(near_workspaces::types::Gas::from_tgas(50)).transact().await?.into_result()?;
    let after = payer.view_account().await?.balance;
    assert!(after > before);
    Ok(())
}

#[tokio::test]
async fn timeout_refund() -> anyhow::Result<()> {
    let (worker, contract, payer, recipient, verifier) = setup().await?;
    let id = create(&contract, &payer, &recipient, &verifier, 60).await?;
    payer.call(contract.id(), "fund").args_json(json!({"id": id.to_string()})).deposit(NearToken::from_near(1)).transact().await?.into_result()?;
    let early = payer.call(contract.id(), "refund").args_json(json!({"id": id.to_string()})).transact().await?;
    assert!(early.is_failure());
    worker.fast_forward(200).await?; // ~200 blocks > 60s
    payer.call(contract.id(), "refund").args_json(json!({"id": id.to_string()})).gas(near_workspaces::types::Gas::from_tgas(50)).transact().await?.into_result()?;
    let e: serde_json::Value = contract.view("get_escrow").args_json(json!({"id": id.to_string()})).await?.json()?;
    assert_eq!(e["status"], "Refunded");
    Ok(())
}
