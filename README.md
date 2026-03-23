# Next.js + Supabase Starter App

Developed by Braden Cannon, this production ready starter application integrates Next.js with Supabase. It serves as a robust foundation for new projects, providing secure authentication, automatic user profile generation, and proper Row Level Security database policies right out of the box.

## Project Description and Purpose
Setting up authentication and database security from scratch for every new project is time consuming. This starter template eliminates that repetitive work. It provides a pre-configured, highly secure Next.js 14 environment connected to a local Supabase instance. It includes standard features like user sign up, login, protected routing, and user profile management with avatar uploading.

## Prerequisites
Before you begin, ensure you have the following installed on your machine:
* Node.js (version 18 or higher)
* npm (Node Package Manager)
* Docker Desktop (required to run the local Supabase instance)
* Supabase CLI

## Quick Start
The absolute fastest way to get started is by using the included setup script. This script automatically handles dependencies, starts your database, and configures your environment variables.

1. Ensure Docker Desktop is running in the background.
2. Open your terminal in the project directory.
3. Run the automated setup script:
   `node setup.js`
4. Start the development server:
   `npm run dev`

## Manual Setup Instructions
If you prefer to understand exactly what is happening under the hood, or if the setup script fails, you can set up the project manually step by step.

1. Install all dependencies:
   `npm install`
2. Start the local Supabase container:
   `npx supabase start`
3. After Supabase starts, it will print your API URL and anon key to the terminal. Create a `.env.local` file in the root of your project and paste those values in:
   `NEXT_PUBLIC_SUPABASE_URL=your_api_url_here`
   `NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here`
4. Apply the database schemas and migrations to your local instance:
   `npx supabase db reset`
5. Run the Next.js application:
   `npm run dev`

## Project Structure and Code Organization
This project follows strict Next.js App Router conventions and isolates server logic from client interactivity.

* `/app`: Contains all of the Next.js routes, pages, and layouts. Protected routes check for active server sessions before rendering.
* `/components/ui`: Houses reusable, stateless presentation components like buttons and cards.
* `/components/auth`: Contains the server actions and forms responsible for the authentication flows.
* `/components/client`: Dedicated to interactive Client Components that require React state or browser APIs, such as the Avatar selection tool. Any custom hooks or complex client side logic are encapsulated directly within these components to keep the architecture flat and simple.
* `/utils/supabase`: Stores the utility functions for creating Supabase clients for both server environments and client environments.
* `/supabase`: Contains the Supabase configuration, declarative SQL schemas, and sequential migration files.

## How to Use This Starter App for New Projects
To use this as the base for a completely new project:
1. Clone or download this repository to your computer.
2. Delete the `.git` folder to remove the starter template history.
3. Run `git init` to start a fresh repository.
4. Run `node setup.js` to initialize your new local database.
5. Begin modifying the pages in the `/app` directory to build your specific application.

## Environment Variables
The application requires two specific environment variables to function properly. These connect your Next.js front end to your Supabase back end.

* `NEXT_PUBLIC_SUPABASE_URL`: The API URL for your Supabase instance.
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`: The public anonymous key used to safely query the database from the browser.

## Database Schema Overview
The database relies on a declarative schema located in `supabase/schemas/profiles.sql`. 

The primary table is `profiles`. It contains the following columns:
* `id`: A UUID that directly references the primary key in the protected `auth.users` table.
* `email`: The user email address.
* `full_name`: An optional text field for the user name.
* `avatar_url`: An optional text field pointing to the user profile image stored in Supabase Storage.
* `updated_at`: A timestamp that updates automatically.

**Automated Triggers:**
* A PostgreSQL trigger automatically fires when a new user signs up in the `auth.users` table, generating a corresponding `profiles` row instantly.
* A second trigger automatically updates the `updated_at` column whenever a profile row is modified.

## Storage Configuration
User profile pictures are securely hosted using Supabase Storage.
* Bucket: A public bucket named avatars is created automatically during the database migrations.
* Upload Flow: When a user selects an image on the profile page, the file is uploaded to the avatars bucket using a combination of their user ID and a timestamp to prevent naming collisions. The resulting public URL is then saved to their database profile.

## Authentication Patterns and Flow
This application uses `@supabase/ssr` to implement secure, cookie based authentication. 

**Patterns used:**
* **Server Components:** We use the `createSupabaseServerClient()` utility to access cookies and securely check the `user` object before rendering protected pages like the Dashboard or Profile.
* **Client Components:** We use the `createSupabaseClient()` utility for any browser based interactions.
* **Proxy (proxy.ts)** The proxy.ts file acts as our Next.js middleware, intercepting requests and refreshing stale authentication tokens automatically as the user navigates through the app.

## Unit Testing
The project is configured with Jest and React Testing Library. The test suite covers React components, utility functions, and authentication forms. 

Test files are co-located next to the files they test using a `.test.tsx` or `.test.ts` extension.

* To run the test suite once: `npm run test`
* To run the test suite in watch mode: `npm run test:watch`
* To add new tests: Create a new file next to your component named `ComponentName.test.tsx` and import `render` and `screen` from `@testing-library/react`.

## GitHub Actions Setup
This project includes a continuous integration workflow that automatically runs your database migrations when you push code to the main branch.

To configure this workflow:
1. Go to your GitHub repository settings.
2. Navigate to Secrets and Variables > Actions.
3. Add the following repository secrets:
   * `SUPABASE_ACCESS_TOKEN`: A personal access token generated from your Supabase account settings.
   * `SUPABASE_DB_PASSWORD`: The database password for your production Supabase project.
   * `SUPABASE_PROJECT_ID`: The unique reference ID for your production Supabase project found in your project URL.
4. Once added, any push to the main branch will trigger the `.github/workflows/supabase-migrations.yml` file and sync your database schemas.

## Deployment Instructions
To deploy this application to a production environment like Vercel:

1. Create a new project on the Supabase website.
2. Push your Next.js code to a GitHub repository.
3. Import the repository into Vercel.
4. Go to your Vercel project settings and add your production `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase dashboard.
5. Click deploy. Vercel will build and host your Next.js application.
6. In your production Supabase dashboard, go to Authentication > URL Configuration and update the Site URL to match your deployed Vercel domain.

## Troubleshooting
* **Docker Errors:** If the setup script or `npx supabase start` fails, ensure Docker Desktop is open and actively running in the background.
* **Port Conflicts:** If Supabase fails to start due to a port conflict, ensure no other local servers or databases are running on ports 5432 or 54321.
* **Missing Data:** If your app loads but shows no data, verify that your `.env.local` file exists and contains the correct URL and anon key.