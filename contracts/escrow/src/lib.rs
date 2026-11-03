//! ClearSend Intents escrow contract.
//!
//! Roles: payer (creates + funds), recipient (submits deliverable, receives funds),
//! verifier (records an attestation; in practice an AI agent holding a
//! function-call access key on the verifier account restricted to `attest`).
//!
//! States: Created -> Funded -> Submitted -> Verified | Rejected -> Released | Refunded
//! Timeout: after `deadline_ns` the payer may refund any non-final, non-verified escrow.

use near_sdk::json_types::{U128, U64};
use near_sdk::store::IterableMap;
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseResult,
};

pub const MAX_SPEC_LEN: usize = 2000;
pub const MAX_DELIVERABLE_LEN: usize = 2000;
pub const MAX_REASON_LEN: usize = 1000;
pub const MAX_SHORT_LEN: usize = 128;
pub const MIN_TIMEOUT_SECS: u64 = 60;
pub const MAX_TIMEOUT_SECS: u64 = 60 * 60 * 24 * 365;
const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(10);

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Created,
    Funded,
    Submitted,
    Verified,
    Rejected,
    Released,
    Refunded,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Attestation {
    pub approved: bool,
    pub reason: String,
    /// Model identifier used by the AI verifier (e.g. an OpenRouter model id).
    pub model: String,
    /// sha256 hex of the full verifier report kept off-chain.
    pub report_hash: String,
    pub attested_by: AccountId,
    pub at_ns: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Event {
    pub status: Status,
    pub by: AccountId,
    pub at_ns: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Escrow {
    pub id: U64,
    pub payer: AccountId,
    pub recipient: AccountId,
    pub verifier: AccountId,
    pub spec: String,
    pub amount: U128,
    pub deliverable: Option<String>,
    pub attestation: Option<Attestation>,
    pub status: Status,
    pub created_at_ns: U64,
    pub deadline_ns: U64,
    pub storage_paid: U128,
    pub history: Vec<Event>,
}

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Escrows,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    escrows: IterableMap<u64, Escrow>,
    next_id: u64,
}

fn check_len(s: &str, max: usize, field: &str) {
    require!(!s.trim().is_empty(), format!("{field} must not be empty"));
    require!(s.len() <= max, format!("{field} too long (max {max} bytes)"));
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self { escrows: IterableMap::new(StorageKey::Escrows), next_id: 0 }
    }

    /// Payer creates an escrow. Attached deposit pays for storage; excess is refunded.
    #[payable]
    pub fn create_escrow(
        &mut self,
        recipient: AccountId,
        verifier: AccountId,
        spec: String,
        timeout_secs: U64,
    ) -> U64 {
        let payer = env::predecessor_account_id();
        check_len(&spec, MAX_SPEC_LEN, "spec");
        require!(recipient != payer, "recipient must differ from payer");
        require!(verifier != recipient, "verifier must differ from recipient");
        let t = timeout_secs.0;
        require!((MIN_TIMEOUT_SECS..=MAX_TIMEOUT_SECS).contains(&t), "timeout out of range");

        let before = env::storage_usage();
        let id = self.next_id;
        self.next_id += 1;
        let now = env::block_timestamp();
        let escrow = Escrow {
            id: U64(id),
            payer: payer.clone(),
            recipient,
            verifier,
            spec,
            amount: U128(0),
            deliverable: None,
            attestation: None,
            status: Status::Created,
            created_at_ns: U64(now),
            deadline_ns: U64(now + t * 1_000_000_000),
            storage_paid: U128(0),
            history: vec![Event { status: Status::Created, by: payer.clone(), at_ns: U64(now) }],
        };
        self.escrows.insert(id, escrow);
        self.escrows.flush();
        // Reserve room for the deliverable + attestation written later, so
        // later calls by recipient/verifier never consume contract balance.
        let reserved = (MAX_DELIVERABLE_LEN + MAX_REASON_LEN + 3 * MAX_SHORT_LEN + 1000) as u64;
        let used = env::storage_usage() - before + reserved;
        let cost = env::storage_byte_cost().saturating_mul(used as u128);
        let attached = env::attached_deposit();
        require!(attached >= cost, format!("attach at least {} yoctoNEAR for storage", cost.as_yoctonear()));
        self.escrows.get_mut(&id).unwrap().storage_paid = U128(cost.as_yoctonear());
        let refund = attached.saturating_sub(cost);
        if !refund.is_zero() {
            Promise::new(payer).transfer(refund).detach();
        }
        env::log_str(&format!("EVENT_JSON:{{\"standard\":\"clearsend\",\"version\":\"1.0.0\",\"event\":\"created\",\"data\":{{\"id\":{id}}}}}"));
        U64(id)
    }

    /// Payer deposits the escrowed amount (attached yoctoNEAR).
    #[payable]
    pub fn fund(&mut self, id: U64) {
        let amount = env::attached_deposit();
        require!(!amount.is_zero(), "attach the amount to escrow");
        let e = self.get_mut(id.0);
        require!(env::predecessor_account_id() == e.payer, "only payer can fund");
        require!(e.status == Status::Created, "escrow not in Created state");
        require!(env::block_timestamp() < e.deadline_ns.0, "escrow expired");
        e.amount = U128(amount.as_yoctonear());
        Self::transition(e, Status::Funded);
    }

    /// Recipient submits a deliverable (text, URL or content hash).
    pub fn submit(&mut self, id: U64, deliverable: String) {
        check_len(&deliverable, MAX_DELIVERABLE_LEN, "deliverable");
        let e = self.get_mut(id.0);
        require!(env::predecessor_account_id() == e.recipient, "only recipient can submit");
        require!(e.status == Status::Funded, "escrow not in Funded state");
        e.deliverable = Some(deliverable);
        Self::transition(e, Status::Submitted);
    }

    /// Verifier (AI agent key on the verifier account) records its decision on-chain.
    pub fn attest(&mut self, id: U64, approved: bool, reason: String, model: String, report_hash: String) {
        check_len(&reason, MAX_REASON_LEN, "reason");
        check_len(&model, MAX_SHORT_LEN, "model");
        check_len(&report_hash, MAX_SHORT_LEN, "report_hash");
        let e = self.get_mut(id.0);
        let caller = env::predecessor_account_id();
        require!(caller == e.verifier, "only verifier can attest");
        require!(e.status == Status::Submitted, "escrow not in Submitted state");
        e.attestation = Some(Attestation {
            approved,
            reason,
            model,
            report_hash,
            attested_by: caller,
            at_ns: U64(env::block_timestamp()),
        });
        Self::transition(e, if approved { Status::Verified } else { Status::Rejected });
    }

    /// Release funds to the recipient. Only after Verified; payer, verifier or recipient may trigger.
    pub fn release(&mut self, id: U64) -> Promise {
        let e = self.get_mut(id.0);
        let caller = env::predecessor_account_id();
        require!(caller == e.payer || caller == e.verifier || caller == e.recipient, "not a party");
        require!(e.status == Status::Verified, "release requires Verified state");
        let amount = NearToken::from_yoctonear(e.amount.0);
        let to = e.recipient.clone();
        Self::transition(e, Status::Released);
        Promise::new(to)
            .transfer(amount)
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_FOR_CALLBACK).on_payout(id, Status::Verified))
    }

    /// Refund the payer. Allowed when Rejected, or by payer when Created/Funded/Submitted
    /// after the deadline, or by payer when still Created (nothing deposited).
    pub fn refund(&mut self, id: U64) -> Option<Promise> {
        let e = self.get_mut(id.0);
        let caller = env::predecessor_account_id();
        let now = env::block_timestamp();
        let expired = now >= e.deadline_ns.0;
        let allowed = match e.status {
            Status::Rejected => caller == e.payer || caller == e.verifier,
            Status::Created => caller == e.payer,
            Status::Funded | Status::Submitted => caller == e.payer && expired,
            _ => false,
        };
        require!(allowed, "refund not allowed in current state");
        let prev = e.status;
        let amount = NearToken::from_yoctonear(e.amount.0);
        let to = e.payer.clone();
        Self::transition(e, Status::Refunded);
        if amount.is_zero() {
            return None;
        }
        Some(
            Promise::new(to)
                .transfer(amount)
                .then(Self::ext(env::current_account_id()).with_static_gas(GAS_FOR_CALLBACK).on_payout(id, prev)),
        )
    }

    /// Callback: if the transfer failed (e.g. account deleted), restore the previous state
    /// so the funds can be released/refunded again.
    #[private]
    pub fn on_payout(&mut self, id: U64, prev: Status) -> bool {
        let ok = matches!(env::promise_result_checked(0, 0), Ok(_));
        if !ok {
            let e = self.get_mut(id.0);
            e.status = prev;
            e.history.push(Event { status: prev, by: env::current_account_id(), at_ns: U64(env::block_timestamp()) });
            env::log_str("payout failed; state restored");
        }
        ok
    }

    // ---------- views ----------
    pub fn get_escrow(&self, id: U64) -> Option<Escrow> {
        self.escrows.get(&id.0).cloned()
    }

    pub fn list_escrows(&self, from_index: Option<U64>, limit: Option<U64>) -> Vec<Escrow> {
        let from = from_index.map(|v| v.0).unwrap_or(0) as usize;
        let limit = limit.map(|v| v.0).unwrap_or(50).min(100) as usize;
        self.escrows.values().skip(from).take(limit).cloned().collect()
    }

    pub fn list_for_account(&self, account_id: AccountId, limit: Option<U64>) -> Vec<Escrow> {
        let limit = limit.map(|v| v.0).unwrap_or(50).min(100) as usize;
        self.escrows
            .values()
            .filter(|e| e.payer == account_id || e.recipient == account_id || e.verifier == account_id)
            .take(limit)
            .cloned()
            .collect()
    }

    pub fn total(&self) -> U64 {
        U64(self.escrows.len() as u64)
    }

    // ---------- internal ----------
    fn get_mut(&mut self, id: u64) -> &mut Escrow {
        self.escrows.get_mut(&id).unwrap_or_else(|| env::panic_str("escrow not found"))
    }

    fn transition(e: &mut Escrow, to: Status) {
        e.status = to;
        let at = env::block_timestamp();
        e.history.push(Event { status: to, by: env::predecessor_account_id(), at_ns: U64(at) });
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"clearsend\",\"version\":\"1.0.0\",\"event\":\"{:?}\",\"data\":{{\"id\":{}}}}}",
            to, e.id.0
        ));
    }
}

#[allow(dead_code)]
fn _unused(_: PromiseResult) {}

#[cfg(test)]
mod tests;
