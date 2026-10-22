use super::*;

/// Represents an auction for waste materials
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Auction {
    /// Unique identifier for the auction
    pub id: u64,
    /// ID of the waste being auctioned
    pub waste_id: u128,
    /// Address of the auction creator (waste owner)
    pub creator: Address,
    /// Starting price in tokens
    pub start_price: u128,
    /// Current highest bid
    pub current_bid: u128,
    /// Address of the current highest bidder
    pub bidder: Option<Address>,
    /// Timestamp when the auction ends
    pub end_time: u64,
    /// Whether the auction is active
    pub is_active: bool,
    /// List of all bidders for refund purposes
    pub bidders: soroban_sdk::Vec<Address>,
}

impl Auction {
    /// Creates a new auction
    pub fn new(
        env: &soroban_sdk::Env,
        id: u64,
        waste_id: u128,
        creator: Address,
        start_price: u128,
        duration: u64,
    ) -> Self {
        let end_time = env.ledger().timestamp() + duration;
        Self {
            id,
            waste_id,
            creator,
            start_price,
            current_bid: start_price,
            bidder: None,
            end_time,
            is_active: true,
            bidders: soroban_sdk::Vec::new(env),
        }
    }

    /// Checks if the auction has ended
    pub fn is_ended(&self, now: u64) -> bool {
        now >= self.end_time
    }

    /// Checks if a bid is valid (higher than current by at least 5%)
    pub fn is_valid_bid(&self, bid_amount: u128) -> bool {
        if bid_amount <= self.current_bid {
            return false;
        }
        let min_increment = (self.current_bid * 105) / 100;
        bid_amount >= min_increment
    }

    /// Places a bid on the auction
    pub fn place_bid(&mut self, bidder: Address, amount: u128) {
        if !self.bidders.contains(&bidder) {
            self.bidders.push_back(bidder.clone());
        }
        self.bidder = Some(bidder);
        self.current_bid = amount;
    }

    /// Ends the auction
    pub fn end(&mut self) {
        self.is_active = false;
    }
}

/// A listing of carbon credits offered for sale on the marketplace.
///
/// Credits listed here are escrowed: they are subtracted from the seller's
/// `RecyclingStats.carbon_credits_earned` when the listing is created and
/// returned (on cancel) or transferred to the buyer (on purchase).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CarbonListing {
    pub id: u64,
    pub seller: Address,
    /// Amount of carbon credits (grams of CO2 equivalent) on offer.
    pub amount: u128,
    /// Price per credit in the smallest token unit of the configured token.
    pub price_per_credit: i128,
    pub is_active: bool,
    pub created_at: u64,
}
