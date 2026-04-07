# הגדרת Gmail API — צעד אחד בלבד

## מה צריך לעשות (5 דקות, פעם אחת)

### שלב 1 — פתח Google Cloud Console
👉 https://console.cloud.google.com/apis/credentials

### שלב 2 — בחר פרויקט קיים או צור חדש
- לחץ על הפרויקט בראש הדף → "New Project"
- שם: `ai-invoice-tracker`

### שלב 3 — אפשר את Gmail API
👉 https://console.cloud.google.com/apis/library/gmail.googleapis.com
- לחץ **Enable**

### שלב 4 — צור OAuth Credentials
👉 https://console.cloud.google.com/apis/credentials
1. לחץ **+ CREATE CREDENTIALS → OAuth client ID**
2. Application type: **Desktop app**
3. Name: `Invoice Tracker`
4. לחץ **Create**
5. לחץ **⬇ DOWNLOAD JSON**
6. **שמור את הקובץ בשם `gmail_credentials.json`** בתיקייה:
   `C:\Users\roita\מעקב הוצאות כלים\`

### שלב 5 — הרץ פעם ראשונה (פותח דפדפן לאישור)
```
cd "C:\Users\roita\מעקב הוצאות כלים"
python auto_invoice.py
```
- יפתח Chrome לכניסה ל-Google
- אשר גישה
- מאותו רגע הכל אוטומטי!

---

## זהו! מה קורה מעכשיו כל שבוע:
1. הסקריפט מחפש מיילים חדשים עם חשבוניות
2. פותח PDF ומחלץ את הסכום
3. מוסיף לרשימת הטרנזקציות
4. בונה מחדש את ה-Excel
5. דוחף ל-GitHub אוטומטית
