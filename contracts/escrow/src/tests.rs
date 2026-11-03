use super::*;
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;

const ONE: u128 = 1_000_000_000_000_000_000_000_000;

fn ctx(pred: usize, deposit: u128, ts: u64) {
    let mut b = VMContextBuilder::new();
    b.current_account_id("escrow.testnet".parse().unwrap())
        .predecessor_account_id(accounts(pred))
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .block_timestamp(ts);
    testing_env!(b.build());
}

// accounts(0)=alice payer, (1)=bob recipient, (2)=charlie verifier, (3)=danny stranger
fn setup() -> (Contract, U64) {
    ctx(0, ONE, 1_000);
    let mut c = Contract::new();
    let id = c.create_escrow(accounts(1), accounts(2), "Logo in SVG, 3 colours".into(), U64(3600));
    (c, id)
}

#[test]
fn happy_path() {
    let (mut c, id) = setup();
    ctx(0, 5 * ONE, 2_000);
    c.fund(id);
    ctx(1, 0, 3_000);
    c.submit(id, "https://example.org/logo.svg".into());
    ctx(2, 0, 4_000);
    c.attest(id, true, "meets spec".into(), "nvidia/nemotron".into(), "ab".repeat(32));
    assert_eq!(c.get_escrow(id).unwrap().status, Status::Verified);
    ctx(0, 0, 5_000);
    let _ = c.release(id);
    let e = c.get_escrow(id).unwrap();
    assert_eq!(e.status, Status::Released);
    assert_eq!(e.amount.0, 5 * ONE);
    assert_eq!(e.history.len(), 5);
}

#[test]
#[should_panic(expected = "only verifier can attest")]
fn only_verifier_attests() {
    let (mut c, id) = setup();
    ctx(0, ONE, 2_000);
    c.fund(id);
    ctx(1, 0, 3_000);
    c.submit(id, "x".into());
    ctx(1, 0, 4_000);
    c.attest(id, true, "self-approve".into(), "m".into(), "h".into());
}

#[test]
#[should_panic(expected = "release requires Verified state")]
fn no_release_before_verified() {
    let (mut c, id) = setup();
    ctx(0, ONE, 2_000);
    c.fund(id);
    ctx(0, 0, 3_000);
    let _ = c.release(id);
}

#[test]
#[should_panic(expected = "only payer can fund")]
fn only_payer_funds() {
    let (mut c, id) = setup();
    ctx(3, ONE, 2_000);
    c.fund(id);
}

#[test]
#[should_panic(expected = "only recipient can submit")]
fn only_recipient_submits() {
    let (mut c, id) = setup();
    ctx(0, ONE, 2_000);
    c.fund(id);
    ctx(0, 0, 3_000);
    c.submit(id, "x".into());
}

#[test]
fn rejected_then_refund() {
    let (mut c, id) = setup();
    ctx(0, ONE, 2_000);
    c.fund(id);
    ctx(1, 0, 3_000);
    c.submit(id, "wrong file".into());
    ctx(2, 0, 4_000);
    c.attest(id, false, "not SVG".into(), "m".into(), "h".into());
    ctx(0, 0, 5_000);
    assert!(c.refund(id).is_some());
    assert_eq!(c.get_escrow(id).unwrap().status, Status::Refunded);
}

#[test]
#[should_panic(expected = "refund not allowed in current state")]
fn no_refund_before_timeout() {
    let (mut c, id) = setup();
    ctx(0, ONE, 2_000);
    c.fund(id);
    ctx(0, 0, 3_000);
    let _ = c.refund(id);
}

#[test]
fn refund_after_timeout() {
    let (mut c, id) = setup();
    ctx(0, ONE, 2_000);
    c.fund(id);
    ctx(0, 0, 1_000 + 3601 * 1_000_000_000);
    assert!(c.refund(id).is_some());
}

#[test]
#[should_panic(expected = "refund not allowed in current state")]
fn no_refund_after_verified() {
    let (mut c, id) = setup();
    ctx(0, ONE, 2_000);
    c.fund(id);
    ctx(1, 0, 3_000);
    c.submit(id, "ok".into());
    ctx(2, 0, 4_000);
    c.attest(id, true, "ok".into(), "m".into(), "h".into());
    ctx(0, 0, 1_000 + 9999 * 1_000_000_000);
    let _ = c.refund(id);
}

#[test]
#[should_panic(expected = "attach at least")]
fn storage_must_be_paid() {
    ctx(0, 0, 1_000);
    let mut c = Contract::new();
    c.create_escrow(accounts(1), accounts(2), "spec".into(), U64(3600));
}

#[test]
#[should_panic(expected = "spec too long")]
fn spec_len_capped() {
    ctx(0, ONE, 1_000);
    let mut c = Contract::new();
    c.create_escrow(accounts(1), accounts(2), "a".repeat(MAX_SPEC_LEN + 1), U64(3600));
}

#[test]
fn cancel_unfunded() {
    let (mut c, id) = setup();
    ctx(0, 0, 2_000);
    assert!(c.refund(id).is_none());
    assert_eq!(c.get_escrow(id).unwrap().status, Status::Refunded);
    assert_eq!(c.list_for_account(accounts(1), None).len(), 1);
}
