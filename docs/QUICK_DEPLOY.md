# Quick Deploy Guide - 3 Koraka! 🚀

**Status:** ✅ OPTIMIZED WORKFLOW  
**Vreme za deploy:** ~5 minuta (uključujući upload)

---

## 🎯 Workflow (Svaki dan)

### **1. Lokalno: Build i Pakovanje**

**Opcija A: Koristi PowerShell skriptu (Preporučeno)**

```powershell
# U PowerShell terminalu (Cursor / XAMPP)
cd "C:\xampp\htdocs\AI Woo Chat"

# Pokreni skriptu (automatski build + package)
.\build-and-package.ps1
```

**Opcija B: Ručno (PowerShell komande)**

```powershell
# Build projekta
npm run build

# Kreiraj deploy zip fajlove (PowerShell sintaksa)
Compress-Archive -Path ".next\standalone" -DestinationPath "deploy-standalone.zip" -Force
Compress-Archive -Path ".next\static", "public" -DestinationPath "deploy-assets.zip" -Force
```

**Napomena:** Na Windows-u koristi `Compress-Archive` umesto `zip` komande.

**Vreme:** ~2-3 minuta (build + zip)

---

### **2. Upload na Server**

Upload `deploy-standalone.zip` i `deploy-assets.zip` na server:
- **Metod:** FTP, cPanel File Manager, ili SCP
- **Lokacija:** `/home/thehappy/app.aiwoochat.com/app/`

**Vreme:** ~1-2 minuta (zavisi od brzine interneta)

---

### **3. Na Serveru: Deploy**

```bash
# SSH u server ili Terminal u cPanel-u
cd /home/thehappy/app.aiwoochat.com/app

# Pokreni deploy skriptu (automatski raspakuje i postavlja sve)
./unpack-and-deploy.sh

# Restart Node.js app u cPanel-u (Node.js App → Restart)
```

**Vreme:** ~30 sekundi

---

## ✅ Šta skripta automatski radi:

1. ✅ Raspakuje `deploy-standalone.zip` i `deploy-assets.zip`
2. ✅ Postavlja `.next/standalone/`, `.next/static/`, i `public/` na pravo mesto
3. ✅ **AUTOMATSKI kopira kompletan `static` folder u `standalone/.next/static/`** (FIX!)
4. ✅ Postavlja sve permission-e
5. ✅ Čisti temp fajlove

**Ne moraš više ručno da kopiraš static folder!** 🎉

---

## 📋 Finalni Checklist

- [ ] Lokalno: `npm run build` ✅
- [ ] Lokalno: Kreiraj `deploy-standalone.zip` i `deploy-assets.zip` ✅
- [ ] Upload oba zip fajla na server ✅
- [ ] Na serveru: `./unpack-and-deploy.sh` ✅
- [ ] Restart Node.js app u cPanel-u ✅
- [ ] Test: `https://app.aiwoochat.com` ✅

---

## ⚡ Brzi Tips

### Ako imaš grešku sa permission-ima:

```bash
# Na serveru, pre pokretanja skripte:
chmod -R 777 .next/standalone/ 2>/dev/null || true
chmod -R 777 .next/static/ 2>/dev/null || true
```

### Cleanup posle deploy-a:

```bash
# Obriši zip fajlove (opciono)
rm -f deploy*.zip
```

---

## 🔄 Primer Dnevnog Workflow-a

```
Lokalno (15:00):
├── Radim na izmenama...
├── Testiram lokalno: npm run dev
└── Kada završim:
    ├── npm run build
    ├── zip -r deploy-standalone.zip .next/standalone
    └── zip -r deploy-assets.zip .next/static public

Upload (15:05):
└── Upload deploy-standalone.zip + deploy-assets.zip

Server (15:06):
├── ./unpack-and-deploy.sh
└── Restart Node.js u cPanel-u

Gotovo! (15:07)
```

---

**Ukupno vreme: ~5-7 minuta** (umesto ceo dan! 🎯)

---

## 📝 Napomene

- Git pull na serveru **NISU potrebni** - koristiš lokalni build
- Source code (`src/`) se **NE upload-uje** - samo build output
- Skripta automatski postavlja sve - **nema ručnog kopiranja**!

---

**Last Updated:** 2025-01-17  
**Status:** ✅ OPTIMIZED - 3 koraka, automatski static folder setup
