#!/usr/bin/env python3
"""
Database Browser Script
=======================

This script provides an interactive way to browse and inspect the database.

Usage:
    python scripts/debug/browse_database.py

Features:
    - Interactive database browser
    - Show table schemas
    - Query data with pagination
    - Execute custom SQL queries
"""

import sys
import sqlite3
from pathlib import Path

# Add backend to path
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root / 'src' / 'backend'))

from app.config import get_settings

def get_db_path():
    """Get the database file path"""
    settings = get_settings()
    return settings.actual_database_url.replace('sqlite+aiosqlite:///', '')

def show_tables(cursor):
    """Show all tables in the database"""
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    
    print("📊 Available Tables:")
    for i, (table,) in enumerate(tables, 1):
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"  {i}. {table} ({count} records)")
    return [table[0] for table in tables]

def show_table_schema(cursor, table_name):
    """Show the schema of a specific table"""
    print(f"\n📋 Schema for table '{table_name}':")
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    
    print("  Column Name      Type        Not Null  Default       Primary Key")
    print("  " + "-" * 65)
    for col in columns:
        cid, name, type_, notnull, default, pk = col
        default_str = str(default) if default else ""
        pk_str = "YES" if pk else ""
        print(f"  {name:<15} {type_:<11} {bool(notnull):<9} {default_str:<13} {pk_str}")

def show_table_data(cursor, table_name, limit=10):
    """Show data from a specific table"""
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    total_count = cursor.fetchone()[0]
    
    if total_count == 0:
        print(f"\n📭 Table '{table_name}' is empty")
        return
    
    print(f"\n📄 Data from table '{table_name}' (showing first {limit} of {total_count} records):")
    
    # Get column names
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [col[1] for col in cursor.fetchall()]
    
    # Get data
    cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit}")
    rows = cursor.fetchall()
    
    if not rows:
        print("  No data found")
        return
    
    # Print header
    print("  " + " | ".join(f"{col:<15}" for col in columns))
    print("  " + "-" * (len(columns) * 17))
    
    # Print data
    for row in rows:
        print("  " + " | ".join(f"{str(val):<15}" for val in row))

def execute_custom_query(cursor, query):
    """Execute a custom SQL query"""
    try:
        cursor.execute(query)
        if query.strip().upper().startswith('SELECT'):
            rows = cursor.fetchall()
            if rows:
                # Get column names from cursor description
                columns = [desc[0] for desc in cursor.description]
                print("  " + " | ".join(f"{col:<15}" for col in columns))
                print("  " + "-" * (len(columns) * 17))
                for row in rows:
                    print("  " + " | ".join(f"{str(val):<15}" for val in row))
            else:
                print("  No results found")
        else:
            print(f"  Query executed successfully. Rows affected: {cursor.rowcount}")
    except Exception as e:
        print(f"  ❌ Error executing query: {e}")

def main():
    """Main interactive browser"""
    print("="*70)
    print("🗄️  DATABASE BROWSER")
    print("="*70)
    
    settings = get_settings()
    db_path = get_db_path()
    
    print(f"Environment: {settings.environment}")
    print(f"Database: {db_path}")
    print(f"File exists: {Path(db_path).exists()}")
    print(f"File size: {Path(db_path).stat().st_size if Path(db_path).exists() else 0} bytes")
    print()
    
    if not Path(db_path).exists():
        print("❌ Database file not found!")
        return
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        while True:
            print("\n" + "="*50)
            print("MENU:")
            print("1. Show all tables")
            print("2. Show table schema")
            print("3. Show table data")
            print("4. Execute custom SQL query")
            print("5. Database statistics")
            print("0. Exit")
            
            choice = input("\nEnter your choice (0-5): ").strip()
            
            if choice == '0':
                break
            elif choice == '1':
                tables = show_tables(cursor)
            elif choice == '2':
                tables = show_tables(cursor)
                try:
                    table_num = int(input("\nEnter table number: ")) - 1
                    if 0 <= table_num < len(tables):
                        show_table_schema(cursor, tables[table_num])
                    else:
                        print("Invalid table number")
                except ValueError:
                    print("Invalid input")
            elif choice == '3':
                tables = show_tables(cursor)
                try:
                    table_num = int(input("\nEnter table number: ")) - 1
                    if 0 <= table_num < len(tables):
                        limit = input("Number of records to show (default 10): ").strip()
                        limit = int(limit) if limit else 10
                        show_table_data(cursor, tables[table_num], limit)
                    else:
                        print("Invalid table number")
                except ValueError:
                    print("Invalid input")
            elif choice == '4':
                query = input("\nEnter SQL query: ").strip()
                if query:
                    execute_custom_query(cursor, query)
            elif choice == '5':
                print("\n📊 Database Statistics:")
                tables = show_tables(cursor)
                
                # Database file info
                db_stat = Path(db_path).stat()
                print(f"\nFile size: {db_stat.st_size:,} bytes ({db_stat.st_size/1024:.1f} KB)")
                
                # Total records across all tables
                total_records = 0
                for table in tables:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    count = cursor.fetchone()[0]
                    total_records += count
                print(f"Total records: {total_records}")
            else:
                print("Invalid choice")
                
    except KeyboardInterrupt:
        print("\n\nGoodbye!")
    finally:
        conn.close()

if __name__ == "__main__":
    main()