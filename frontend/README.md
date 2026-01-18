# 🏥 Medical Vault – Decentralized Medical Record System

A privacy-first, patient-owned medical record system built on **Sui Blockchain**, using **end-to-end encryption**, **on-chain access control**, and **decentralized storage**.

---

## 📌 Overview

Medical Vault là hệ thống lưu trữ và quản lý hồ sơ y tế phi tập trung, trong đó bệnh nhân toàn quyền sở hữu và kiểm soát dữ liệu y tế của mình.  
Hệ thống đảm bảo **bảo mật – minh bạch – phân quyền** bằng cách kết hợp blockchain và mã hóa dữ liệu.

---

## ✨ Key Features

- Lưu trữ thông tin bệnh nhân, kết quả xét nghiệm, hình ảnh y tế theo từng lần khám
- Wallet-based authentication (Sui Wallet, Suiet)
- Quản lý quyền truy cập on-chain (Owner / Doctor / Member)
- Mã hóa dữ liệu đầu-cuối (Seal Network)
- Lưu trữ file y tế phi tập trung (Walrus)
- Log trail không thể chỉnh sửa

---

## 🏗 System Architecture

Frontend (Bun + Wallet)  
→ Backend API (NestJS)  
→ Sui Blockchain + Seal + Walrus

---

## 🧰 Technology Stack

- Frontend: Bun, React
- Backend: NestJS, TypeScript
- Blockchain: Sui Move
- Encryption: Seal Network
- Storage: Walrus
- Wallets: Sui Wallet, Suiet

---

## 🌐 Frontend

### Responsibilities
- Kết nối ví
- Ký message & transaction
- Gọi API backend
- Hiển thị medical folders & records

### Structure

```
frontend/
├── src/
│   ├── components/
│   ├── services/
│   ├── hooks/
│   └── utils/
└── bunfig.toml
```

---

## ⚙️ Backend

### Responsibilities
- Verify wallet signature
- Build & execute Sui transactions
- Encrypt / decrypt medical data
- Upload / download file từ Walrus

### Structure

```
backend/
├── src/
│   ├── controllers/
│   ├── services/
│   └── modules/
└── main.ts
```

---

## 📜 Smart Contracts

```
contracts/
├── seal_whitelist.move
├── medical_record.move
├── export.move
└── audit.move
```

---

## 🔐 Security Model

- Không lưu private key người dùng
- Quyền truy cập enforced on-chain
- Dữ liệu luôn được mã hóa
- Log log bất biến

---

## 🚀 Setup

### Backend
```
cd backend
npm install
npm run start:dev
```

### Frontend
```
cd frontend
bun install
bun dev
```

---

## 📄 License

MIT License
