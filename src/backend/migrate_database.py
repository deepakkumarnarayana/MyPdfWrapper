#!/usr/bin/env python3
"""
Database migration script to add unified document fields to existing pdfs table
"""

import sqlite3
import os
from pathlib import Path

def migrate_database():
    """Add new columns to existing pdfs table for unified document architecture"""
    
    # Get database path
    project_root = Path(__file__).parent
    db_path = project_root / "storage" / "database.db"
    
    if not db_path.exists():
        print(f"Database not found at {db_path}")
        return False
    
    print(f"Migrating database: {db_path}")
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check current table structure
        cursor.execute("PRAGMA table_info(pdfs)")
        columns = [column[1] for column in cursor.fetchall()]
        
        print(f"Current columns: {columns}")
        
        # Add new columns if they don't exist
        new_columns = [
            ('document_type', 'VARCHAR(50) DEFAULT "book"'),
            ('authors', 'JSON'),
            ('type_metadata', 'JSON'),
            ('processing_status', 'VARCHAR(50) DEFAULT "completed"')
        ]
        
        for column_name, column_definition in new_columns:
            if column_name not in columns:
                sql = f"ALTER TABLE pdfs ADD COLUMN {column_name} {column_definition}"
                print(f"Executing: {sql}")
                cursor.execute(sql)
                print(f"✅ Added column: {column_name}")
            else:
                print(f"⏭️ Column already exists: {column_name}")
        
        # Create indexes for better performance
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_pdfs_document_type ON pdfs(document_type)",
            "CREATE INDEX IF NOT EXISTS idx_pdfs_processing_status ON pdfs(processing_status)"
        ]
        
        for index_sql in indexes:
            print(f"Executing: {index_sql}")
            cursor.execute(index_sql)
        
        # Update existing records to have proper document_type (use enum values)
        cursor.execute("UPDATE pdfs SET document_type = 'BOOK' WHERE document_type IS NULL OR document_type = 'book'")
        cursor.execute("UPDATE pdfs SET document_type = 'RESEARCH_PAPER' WHERE document_type = 'research_paper'")
        cursor.execute("UPDATE pdfs SET processing_status = 'completed' WHERE processing_status IS NULL")
        
        conn.commit()
        print("✅ Migration completed successfully!")
        
        # Verify the migration
        cursor.execute("PRAGMA table_info(pdfs)")
        new_columns_list = [column[1] for column in cursor.fetchall()]
        print(f"New table structure: {new_columns_list}")
        
        # Show sample data
        cursor.execute("SELECT id, filename, document_type, processing_status FROM pdfs LIMIT 3")
        sample_data = cursor.fetchall()
        print(f"Sample records: {sample_data}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    print("🚀 Starting database migration...")
    success = migrate_database()
    if success:
        print("🎉 Database migration completed successfully!")
    else:
        print("💥 Database migration failed!")
        exit(1)