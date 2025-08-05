#!/usr/bin/env python3
"""
AI Proxy Database Migration Script
Creates and migrates all AI proxy related tables with proper indexes and constraints.
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime
import logging

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, inspect
from alembic import command
from alembic.config import Config

from app.config import get_settings
from app.database import Base, get_db
from app.models import (
    User, PDF, Flashcard, Annotation, StudySession,
    AIUsageLog, AIRateLimit, AIResponseCache, AICircuitBreaker, AIQuotaLimit,
    AIProvider, AIRequestStatus
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AIProxyDatabaseMigrator:
    """Database migrator for AI Proxy tables and indexes"""
    
    def __init__(self):
        self.settings = get_settings()
        self.engine = None
        self.SessionLocal = None
        
    async def initialize(self):
        """Initialize database connection"""
        try:
            self.engine = create_async_engine(
                self.settings.actual_database_url,
                echo=self.settings.debug,
                future=True
            )
            
            self.SessionLocal = sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            logger.info(f"Connected to database: {self.settings.actual_database_url}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize database connection: {e}")
            return False
    
    async def check_existing_tables(self) -> dict:
        """Check which tables already exist"""
        try:
            async with self.engine.begin() as conn:
                # Get list of existing tables
                inspector = inspect(conn.sync_connection)
                existing_tables = inspector.get_table_names()
                
                ai_tables = [
                    'ai_usage_logs',
                    'ai_rate_limits', 
                    'ai_response_cache',
                    'ai_circuit_breakers',
                    'ai_quota_limits'
                ]
                
                table_status = {}
                for table in ai_tables:
                    table_status[table] = table in existing_tables
                
                logger.info(f"Existing AI tables: {[t for t, exists in table_status.items() if exists]}")
                return table_status
                
        except Exception as e:
            logger.error(f"Failed to check existing tables: {e}")
            return {}
    
    async def create_tables(self):
        """Create all tables if they don't exist"""
        try:
            async with self.engine.begin() as conn:
                # Create all tables
                await conn.run_sync(Base.metadata.create_all)
                
            logger.info("All tables created successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            return False
    
    async def create_indexes(self):
        """Create additional indexes for performance"""
        indexes = [
            # AI Usage Logs indexes
            "CREATE INDEX IF NOT EXISTS idx_ai_usage_provider_date ON ai_usage_logs(provider, created_at)",
            "CREATE INDEX IF NOT EXISTS idx_ai_usage_user_status ON ai_usage_logs(user_id, status)",
            "CREATE INDEX IF NOT EXISTS idx_ai_usage_session_date ON ai_usage_logs(session_id, created_at)",
            "CREATE INDEX IF NOT EXISTS idx_ai_usage_cost ON ai_usage_logs(estimated_cost_usd) WHERE estimated_cost_usd > 0",
            
            # AI Rate Limits indexes
            "CREATE INDEX IF NOT EXISTS idx_ai_rate_limit_windows ON ai_rate_limits(provider, minute_window, hour_window)",
            "CREATE INDEX IF NOT EXISTS idx_ai_rate_limit_user_provider ON ai_rate_limits(user_id, provider)",
            "CREATE INDEX IF NOT EXISTS idx_ai_rate_limit_cleanup ON ai_rate_limits(updated_at) WHERE updated_at < datetime('now', '-7 days')",
            
            # AI Response Cache indexes
            "CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_response_cache(expires_at)",
            "CREATE INDEX IF NOT EXISTS idx_ai_cache_provider_model ON ai_response_cache(provider, model)",
            "CREATE INDEX IF NOT EXISTS idx_ai_cache_hit_count ON ai_response_cache(hit_count DESC)",
            
            # AI Circuit Breakers indexes
            "CREATE INDEX IF NOT EXISTS idx_ai_circuit_provider_state ON ai_circuit_breakers(provider, state)",
            "CREATE INDEX IF NOT EXISTS idx_ai_circuit_failure_time ON ai_circuit_breakers(last_failure_time)",
            
            # AI Quota Limits indexes
            "CREATE INDEX IF NOT EXISTS idx_ai_quota_user_provider ON ai_quota_limits(user_id, provider)",
            "CREATE INDEX IF NOT EXISTS idx_ai_quota_exceeded ON ai_quota_limits(is_daily_exceeded, is_monthly_exceeded)",
            "CREATE INDEX IF NOT EXISTS idx_ai_quota_reset_times ON ai_quota_limits(last_daily_reset, last_monthly_reset)",
        ]
        
        try:
            async with self.engine.begin() as conn:
                for index_sql in indexes:
                    try:
                        await conn.execute(text(index_sql))
                        logger.info(f"Created index: {index_sql.split('ON')[1].split('(')[0].strip() if 'ON' in index_sql else 'Unknown'}")
                    except Exception as e:
                        logger.warning(f"Failed to create index: {e}")
                        
            logger.info("Index creation completed")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create indexes: {e}")
            return False
    
    async def create_triggers(self):
        """Create database triggers for data maintenance"""
        triggers = []
        
        # SQLite specific triggers
        if 'sqlite' in self.settings.actual_database_url:
            triggers = [
                # Auto-cleanup expired cache entries
                """
                CREATE TRIGGER IF NOT EXISTS cleanup_expired_cache
                AFTER INSERT ON ai_response_cache
                BEGIN
                    DELETE FROM ai_response_cache 
                    WHERE expires_at < datetime('now') 
                    AND random() % 100 = 0;  -- Random cleanup 1% of the time
                END;
                """,
                
                # Auto-update quota exceeded flags
                """
                CREATE TRIGGER IF NOT EXISTS update_quota_exceeded
                AFTER UPDATE OF daily_spent_usd, monthly_spent_usd ON ai_quota_limits
                BEGIN
                    UPDATE ai_quota_limits SET
                        is_daily_exceeded = CASE 
                            WHEN NEW.daily_spent_usd >= NEW.daily_limit_usd THEN 1 
                            ELSE 0 
                        END,
                        is_monthly_exceeded = CASE 
                            WHEN NEW.monthly_spent_usd >= NEW.monthly_limit_usd THEN 1 
                            ELSE 0 
                        END,
                        updated_at = datetime('now')
                    WHERE id = NEW.id;
                END;
                """,
                
                # Auto-reset daily quotas
                """
                CREATE TRIGGER IF NOT EXISTS reset_daily_quota
                AFTER UPDATE OF last_daily_reset ON ai_quota_limits
                WHEN date(NEW.last_daily_reset) < date('now')
                BEGIN
                    UPDATE ai_quota_limits SET
                        daily_spent_usd = 0,
                        daily_requests = 0,
                        is_daily_exceeded = 0,
                        last_daily_reset = datetime('now')
                    WHERE id = NEW.id;
                END;
                """
            ]
        
        try:
            async with self.engine.begin() as conn:
                for trigger_sql in triggers:
                    try:
                        await conn.execute(text(trigger_sql))
                        trigger_name = trigger_sql.split('TRIGGER')[1].split('IF NOT EXISTS')[1].split()[0] if 'TRIGGER' in trigger_sql else 'Unknown'
                        logger.info(f"Created trigger: {trigger_name}")
                    except Exception as e:
                        logger.warning(f"Failed to create trigger: {e}")
                        
            logger.info("Trigger creation completed")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create triggers: {e}")
            return False
    
    async def seed_initial_data(self):
        """Seed database with initial configuration data"""
        try:
            async with self.SessionLocal() as session:
                # Create default circuit breakers for each provider
                for provider in AIProvider:
                    # Check if circuit breaker already exists
                    result = await session.execute(
                        text("SELECT id FROM ai_circuit_breakers WHERE provider = :provider"),
                        {"provider": provider.value}
                    )
                    
                    if not result.fetchone():
                        circuit_breaker_sql = """
                        INSERT INTO ai_circuit_breakers 
                        (provider, state, failure_count, success_count, failure_threshold, recovery_timeout_seconds, created_at, updated_at)
                        VALUES (:provider, 'closed', 0, 0, :failure_threshold, :recovery_timeout, :now, :now)
                        """
                        
                        await session.execute(text(circuit_breaker_sql), {
                            "provider": provider.value,
                            "failure_threshold": self.settings.circuit_breaker_failure_threshold,
                            "recovery_timeout": self.settings.circuit_breaker_recovery_timeout,
                            "now": datetime.utcnow()
                        })
                        
                        logger.info(f"Created default circuit breaker for {provider.value}")
                
                await session.commit()
                logger.info("Initial data seeding completed")
                return True
                
        except Exception as e:
            logger.error(f"Failed to seed initial data: {e}")
            return False
    
    async def optimize_database(self):
        """Optimize database performance"""
        optimization_queries = []
        
        # SQLite specific optimizations
        if 'sqlite' in self.settings.actual_database_url:
            optimization_queries = [
                "PRAGMA journal_mode = WAL;",  # Write-Ahead Logging
                "PRAGMA synchronous = NORMAL;",  # Balance between safety and speed
                "PRAGMA cache_size = 10000;",  # 10MB cache
                "PRAGMA temp_store = MEMORY;",  # Store temp tables in memory
                "PRAGMA mmap_size = 268435456;",  # 256MB memory-mapped I/O
                "ANALYZE;",  # Update query planner statistics
            ]
        
        try:
            async with self.engine.begin() as conn:
                for query in optimization_queries:
                    try:
                        await conn.execute(text(query))
                        logger.info(f"Applied optimization: {query.split()[1] if len(query.split()) > 1 else query}")
                    except Exception as e:
                        logger.warning(f"Failed to apply optimization {query}: {e}")
                        
            logger.info("Database optimization completed")
            return True
            
        except Exception as e:
            logger.error(f"Failed to optimize database: {e}")
            return False
    
    async def verify_migration(self):
        """Verify that migration was successful"""
        try:
            async with self.SessionLocal() as session:
                # Test each AI table
                test_queries = [
                    ("ai_usage_logs", "SELECT COUNT(*) FROM ai_usage_logs"),
                    ("ai_rate_limits", "SELECT COUNT(*) FROM ai_rate_limits"),
                    ("ai_response_cache", "SELECT COUNT(*) FROM ai_response_cache"),
                    ("ai_circuit_breakers", "SELECT COUNT(*) FROM ai_circuit_breakers"),
                    ("ai_quota_limits", "SELECT COUNT(*) FROM ai_quota_limits"),
                ]
                
                results = {}
                for table_name, query in test_queries:
                    try:
                        result = await session.execute(text(query))
                        count = result.scalar()
                        results[table_name] = count
                        logger.info(f"Table {table_name}: {count} rows")
                    except Exception as e:
                        logger.error(f"Failed to query {table_name}: {e}")
                        results[table_name] = "ERROR"
                
                # Verify indexes exist
                if 'sqlite' in self.settings.actual_database_url:
                    result = await session.execute(text("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_ai_%'"))
                    indexes = [row[0] for row in result.fetchall()]
                    logger.info(f"AI-related indexes: {len(indexes)} found")
                
                logger.info("Migration verification completed successfully")
                return results
                
        except Exception as e:
            logger.error(f"Migration verification failed: {e}")
            return {}
    
    async def run_migration(self):
        """Run complete migration process"""
        logger.info("Starting AI Proxy database migration...")
        
        # Initialize connection
        if not await self.initialize():
            logger.error("Failed to initialize database connection")
            return False
        
        try:
            # Check existing tables
            existing_tables = await self.check_existing_tables()
            
            # Create tables
            if not await self.create_tables():
                logger.error("Failed to create tables")
                return False
            
            # Create indexes
            if not await self.create_indexes():
                logger.warning("Some indexes failed to create")
            
            # Create triggers
            if not await self.create_triggers():
                logger.warning("Some triggers failed to create")
            
            # Seed initial data
            if not await self.seed_initial_data():
                logger.warning("Failed to seed initial data")
            
            # Optimize database
            if not await self.optimize_database():
                logger.warning("Database optimization failed")
            
            # Verify migration
            verification_results = await self.verify_migration()
            if not verification_results:
                logger.error("Migration verification failed")
                return False
            
            logger.info("AI Proxy database migration completed successfully!")
            return True
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            return False
        
        finally:
            if self.engine:
                await self.engine.dispose()
    
    async def rollback_migration(self):
        """Rollback AI proxy tables (use with caution!)"""
        logger.warning("Starting AI Proxy database rollback...")
        
        if not await self.initialize():
            logger.error("Failed to initialize database connection")
            return False
        
        try:
            async with self.engine.begin() as conn:
                # Drop AI tables in reverse dependency order
                tables_to_drop = [
                    'ai_usage_logs',
                    'ai_rate_limits',
                    'ai_response_cache', 
                    'ai_circuit_breakers',
                    'ai_quota_limits'
                ]
                
                for table in tables_to_drop:
                    try:
                        await conn.execute(text(f"DROP TABLE IF EXISTS {table}"))
                        logger.info(f"Dropped table: {table}")
                    except Exception as e:
                        logger.error(f"Failed to drop table {table}: {e}")
            
            logger.info("AI Proxy database rollback completed")
            return True
            
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            return False
        
        finally:
            if self.engine:
                await self.engine.dispose()


async def main():
    """Main migration function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='AI Proxy Database Migration')
    parser.add_argument('--rollback', action='store_true', help='Rollback migration (drops AI tables)')
    parser.add_argument('--verify-only', action='store_true', help='Only verify existing migration')
    
    args = parser.parse_args()
    
    migrator = AIProxyDatabaseMigrator()
    
    if args.rollback:
        logger.warning("ROLLBACK MODE: This will drop all AI proxy tables!")
        confirmation = input("Are you sure you want to rollback? Type 'yes' to confirm: ")
        if confirmation.lower() == 'yes':
            success = await migrator.rollback_migration()
        else:
            logger.info("Rollback cancelled")
            return
    elif args.verify_only:
        if not await migrator.initialize():
            sys.exit(1)
        try:
            results = await migrator.verify_migration()
            if results:
                logger.info("Verification completed successfully")
            else:
                logger.error("Verification failed")
                sys.exit(1)
        finally:
            if migrator.engine:
                await migrator.engine.dispose()
        return
    else:
        success = await migrator.run_migration()
    
    if success:
        logger.info("Migration completed successfully!")
    else:
        logger.error("Migration failed!")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())