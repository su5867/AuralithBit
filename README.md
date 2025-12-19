# AuralithBit

AuralithBit is a web-based project that showcases the services, courses, and portfolio offerings of the **Auralith Bit Institute**. It is designed to provide visitors with a clear overview of the institute’s IT education programs, professional services, and contact information — built with a focus on responsive design and user experience.

## Description

AuralithBit serves as a **modern informational website** tailored for an educational institute offering courses and services in web development, software solutions, and IT training. The project demonstrates effective use of front-end technologies to create an engaging site structure that highlights:

- Core institute overview and mission
- Offered courses and training programs
- Services related to web and software development
- A contact interface for inquiries and enrollment

## Features

- Secure Admin Login
- Dashboard interface for managing system entities (users, data, etc.)
- Demo credentials for quick access
- Built with modern frontend technologies (e.g., Aurelia/React/Vue/Next.js — adjust based on actual stack)

## Technologies Used

- HTML5
- CSS3
- JavaScript

## Live Demo

The application is deployed on **Vercel** and accessible at:  
**https://auralith-bit.vercel.app/**

## Installation & Usage

1. Clone the repository:
   ```bash
   git clone https://github.com/su5867/AuralithBit.git
   ```

## Docker Deployment

### Local Deployment
1. Ensure Docker Desktop is running on your system.

2. Open Command Prompt and navigate to the project folder:
   ```bash
   cd auralith-student-management
   ```

3. Build the image:
   ```bash
   docker build -t auralith-student-management .
   ```

4. Run the container:
   ```bash
   docker run -p 5000:5000 auralith-student-management
   ```

The application will be accessible at `http://localhost:5000`.

### Cloud Deployment (Render)

To deploy this application to the cloud so it's accessible from any PC via a public URL:

1. **Push your code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Add Docker support"
   git push origin main
   ```

2. **Create a Render account** at [render.com](https://render.com) (free tier available).

3. **Connect your GitHub repository**:
   - Go to your Render dashboard.
   - Click "New" > "Web Service".
   - Connect your GitHub account and select the repository.

4. **Configure the deployment**:
   - **Name**: Choose a name for your service (e.g., auralith-student-management).
   - **Environment**: Select "Docker".
   - **Branch**: Select "main" (or your default branch).
   - **Build Command**: Leave blank (Render will use the Dockerfile).
   - **Start Command**: Leave blank (Render will use the CMD from Dockerfile).

5. **Deploy**:
   - Click "Create Web Service".
   - Render will build and deploy your application automatically.

6. **Access your application**:
   - Once deployed, Render will provide a public URL (e.g., `https://auralithbit.onrender.com`).
   - The application will be accessible from any device with internet access.

### Environment Variables (Optional)

If your application uses environment variables (e.g., for database connections, API keys), you can set them in Render:
- Go to your service dashboard > Environment.
- Add your environment variables there.

### Notes
- The free tier on Render has some limitations (e.g., service sleeps after 15 minutes of inactivity).
- For production use, consider upgrading to a paid plan for better performance and uptime.
