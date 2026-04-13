@echo off
cd /d "c:\Users\roita\מעקב הוצאות כלים"
set TELEGRAM_BOT_TOKEN=8556418662:AAFKeMVDBoOA2EGSd-wWGci4Vzi1R_MF8Z8
set TELEGRAM_CHAT_ID=7008452440
C:\Python314\python.exe auto_invoice.py >> auto_invoice_task.log 2>&1
