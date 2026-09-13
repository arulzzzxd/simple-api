module.exports = {
  PORT: process.env.PORT || 3000,
  MONGO_URI: process.env.MONGO_URI || "mongodb+srv://arulz-xd-owner:Haqqi0213@cluster0.fgxhxqm.mongodb.net/?appName=Cluster0",
  SESSION_SECRET: process.env.SESSION_SECRET || "cyan_neon_secret_key_12345",
  
  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "YOUR_GOOGLE_CLIENT_SECRET",
  
  // GitHub OAuth Configuration
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || "YOUR_GITHUB_CLIENT_ID",
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || "YOUR_GITHUB_CLIENT_SECRET",
  
  // Domain URL (Ganti dengan URL Vercel saat diproduksi)
  BASE_URL: process.env.BASE_URL || "http://localhost:3000"
};
