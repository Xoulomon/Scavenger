//! Redis client for rate limiting and caching

use anyhow::Result;
use redis::AsyncCommands;
use std::time::Duration;

#[derive(Clone)]
pub struct RedisClient {
    client: redis::Client,
}

impl RedisClient {
    /// Create a new Redis client
    pub fn new(redis_url: &str) -> Result<Self> {
        let client = redis::Client::open(redis_url)?;
        Ok(Self { client })
    }
    
    /// Get a connection
    async fn get_conn(&self) -> Result<redis::aio::Connection> {
        let conn = self.client.get_async_connection().await?;
        Ok(conn)
    }
    
    /// Get a value from Redis
    pub async fn get<T: redis::FromRedisValue>(&self, key: &str) -> Result<Option<T>> {
        let mut conn = self.get_conn().await?;
        let value: Option<T> = conn.get(key).await?;
        Ok(value)
    }
    
    /// Set a value in Redis with TTL
    pub async fn set_with_ttl<T: redis::ToRedisArgs>(&self, key: &str, value: T, ttl: u64) -> Result<()> {
        let mut conn = self.get_conn().await?;
        let _: () = conn.set_ex(key, value, ttl as usize).await?;
        Ok(())
    }
    
    /// Increment a value in Redis
    pub async fn incr(&self, key: &str) -> Result<u32> {
        let mut conn = self.get_conn().await?;
        let count: u32 = conn.incr(key, 1).await?;
        Ok(count)
    }
    
    /// Set expiration on a key
    pub async fn expire(&self, key: &str, ttl_secs: usize) -> Result<()> {
        let mut conn = self.get_conn().await?;
        let _: () = conn.expire(key, ttl_secs).await?;
        Ok(())
    }
}
