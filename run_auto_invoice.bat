@echo off
cd /d "c:\Users\roita\מעקב הוצאות כלים"
set TELEGRAM_BOT_TOKEN=8556418662:AAH6aW2enmyjYqZ-mZJ8rrvIkvlndtoK01o
set TELEGRAM_CHAT_ID=7008452440
C:\Python314\python.exe auto_invoice.py >> auto_invoice_task.log 2>&1
