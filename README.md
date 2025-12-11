# 🧠 FlashMind AI

**FlashMind AI** is an intelligent study companion that instantly transforms any topic into a comprehensive study set. Powered by **Google Gemini 2.5**, it generates interactive flashcards and quizzes, using **Vector Semantic Search** to cache and retrieve similar topics instantly.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green)
![AI](https://img.shields.io/badge/AI-Google%20Gemini-orange)

## ✨ Features

- **🚀 Instant Generation**: Type any topic (e.g., "Quantum Physics", "French Revolution") and get a structured study set in seconds.
- **⚡ Smart Caching (RAG)**: Uses **PostgreSQL + pgvector** to store embeddings. If a user asks for "React Hooks" and another asks for "ReactJS Hooks", the system recognizes the semantic similarity and serves the cached result instantly.
- **🃏 Interactive Flashcards**: 3D flip animations with difficulty rating.
- **📝 Practice Quizzes**: Auto-generated multiple-choice questions to test retention.
- **🔐 Secure Auth**: Email/Password and Google OAuth login support.
- **🎨 Modern UI**: Fully responsive, dark mode support, and smooth Framer Motion animations.
- **🚦 Robust Architecture**: Built with a Redis Job Queue (BullMQ) to handle high traffic and rate limiting.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **State**: Context API
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (with `pgvector` extension)
- **Queue System**: Redis + BullMQ
- **AI Model**: Google Gemini 2.5 Flash
- **Validation**: Zod

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose (for DB and Redis)
- Google Cloud Project with Gemini API Key

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/flashmind-ai.git
cd flashmind-ai
```

### 2. Environment Setup
Create a `.env` file in the `backend` folder:
```env
PORT=3000
DATABASE_URL=postgres://postgres:password@localhost:5432/flashmind
REDIS_URL=redis://localhost:6379
API_KEY=your_google_gemini_api_key
JWT_SECRET=your_super_secret_jwt_key
CLIENT_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id
```

### 3. Start Infrastructure (DB & Queue)
```bash
docker-compose up -d
```

### 4. Install Dependencies & Migrate
**Backend:**
```bash
cd backend
npm install
npm run migrate  # Creates tables in Postgres
```

**Frontend:**
```bash
cd frontend
npm install
```

### 5. Run the Application
Open two terminals:

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` to start learning!

## 📂 Project Structure

See `PROJECT_MAP.md` for a detailed breakdown of the file structure and architecture diagrams.

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
