@echo off
REM Automatic Database Backup Script for SHCL
cd /d "c:\Users\raamp\OneDrive\Desktop\shcl"
node backend/export_database.js
