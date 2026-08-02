# ResQMesh Backend 🚑

ResQMesh is an emergency response management backend built using **Node.js**, **Express**, and **MySQL**. It integrates **Google's Gemini API** for semantic incident classification, priority triage, and intelligent duplicate report detection. The backend handles emergency transmissions received from mesh network protocols (such as BLE Mesh and Wi-Fi Direct) and triggers instant multi-channel notifications via **Email (Nodemailer)** and **SMS (Twilio)**.

---

## Key Features

* **Mesh Network Packet Ingestion**: Ingests emergency packets containing coordinates, sender metadata, and raw messages.
* **AI-Powered Emergency Analysis**: Automatically determines incident type, prioritizes severity (Critical, High, Medium, Low), and generates concise summaries.
* **Semantic Duplicate Detection**: Uses Gemini to semantically analyze incoming messages against recent reports within a 2.0 km radius (using the Haversine formula) to merge duplicate incident reports—even when phrased differently.
* **Triage Logging**: Inserts analyzed incidents into a structured `processed_incidents` database table.
* **Multi-Channel Alerts**: Triggers real-time email notifications (with inline-styled Google Maps links) and Twilio SMS text alerts to responders.

---

## Technology Stack

* **Runtime**: Node.js (CommonJS)
* **Framework**: Express.js
* **Database**: MySQL (using `mysql2` driver)
* **AI Engine**: Google Gen AI SDK (`@google/genai`)
* **Notifications**: 
  * Nodemailer (Gmail SMTP)
  * Twilio SMS SDK
* **Security & Utility**: Helmet, CORS, Compression, Express Rate Limit, Dotenv

---

## Directory Structure

```
├── config/              # Database connectivity configurations
├── Controllers/         # API controllers (AI analysis, emergency ingestion)
├── models/              # Schema declarations and models
├── routes/              # Express routing definitions
├── services/            # Core business logic (AI, SMS, Email delivery)
├── resqmeshDB.sql       # Database schema initialization script
├── server.js            # Entry point for the Express application
└── .gitignore           # Ignored system and environment configuration files
```

---

## Setup & Installation

### 1. Prerequisites
* **Node.js** (v16.x or higher)
* **MySQL Server**

### 2. Installation
Clone the repository and install the project dependencies:
```bash
npm install
```

### 3. Database Migration
Create a MySQL database named `resqmesh` and run the migration script:
```bash
mysql -u your_user -p resqmesh < resqmeshDB.sql
```

### 4. Configuration
Create a `.env` file in the root directory and populate it with your credentials:
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=resqmesh
DB_PORT=3306

EMAIL_USER=your_gmail_address
EMAIL_PASS=your_gmail_app_password
ADMIN_EMAIL=recipient_email_address

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_sender_number
EMERGENCY_SMS_NUMBER=recipient_mobile_number

GEMINI_API_KEY=your_gemini_api_key
```

### 5. Running the Application
* **Development Mode (with auto-reload)**:
  ```bash
  npm run dev
  ```
* **Production Mode**:
  ```bash
  npm start
  ```

---

## API Reference

### 1. Emergency Reports
* **POST `/api/emergency/upload`**
  Uploads an emergency message, checks for duplicates, runs AI triage, updates database records, and sends email/SMS alerts.
  * **Payload**:
    ```json
    {
       "victim_name": "John Doe",
       "phone": "9876543210",
       "latitude": 17.3850,
       "longitude": 78.4867,
       "emergency_type": "Other",
       "message": "Building collapsed near the main square. People are trapped.",
       "network_used": "BLE Mesh"
    }
    ```

* **GET `/api/emergency/pending`**
  Fetches all unprocessed emergency messages.

* **POST `/api/emergency/process`**
  Manually assigns a rescue team and marks an incident as processed.

### 2. AI Service
* **POST `/api/ai/analyze`**
  Directly analyzes an array of text reports for classification.
  * **Payload**:
    ```json
    {
       "reports": [
          "Building A collapsed.",
          "People trapped inside Building A."
       ]
    }
    ```
