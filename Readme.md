# Thrift – E-commerce Marketplace

A full-stack e-commerce application for buying and selling used items. Built with React, Vite, Express, and MySQL.

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, MySQL
- **Payments**: eSewa, Khalti, Cash on Delivery (COD)
- **Deployment**: Vercel (frontend), Railway (backend & database)

## Features

- Product listings with filters (category, price, size, condition)
- User authentication and profiles
- Shopping cart and wishlist
- Checkout with multiple payment options
- Seller dashboard with order tracking
- Admin analytics and product management
- Peer feedback/reviews system
- Password reset via email
- Bulk CSV product import

## Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.x or MariaDB

### Setup

1. **Backend**
```bash
cd Server
npm install
cp .env.example .env
# Fill in DB_HOST, DB_USER, DB_PASS, JWT_SECRET, payment keys
npm start
```
Server runs at `http://localhost:5000`

2. **Frontend**
```bash
cd Client
npm install
cp .env.example .env
npm run dev
```
Client runs at `http://localhost:5173`

## Deployment

- **Frontend**: Deploy `Client/` on Vercel
- **Backend**: Deploy `Server/` on Railway with MySQL database
- Set `VITE_API_URL` environment variable in Vercel to your Railway backend URL

## License

For educational/demo purposes.
