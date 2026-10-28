# Stillroom – Photo Albums with Tags

Stillroom is a photo album web application that makes it easier to organize and manage photos. Users can create albums, upload photos, add tags, search for photos using tags, and share albums through a link.

I built this project using React for the frontend and Node.js with Express for the backend. SQLite is used to store album, photo, and tag information.

## What can you do with Stillroom?

- Create, rename, and delete albums.
- Upload photos in JPEG, PNG, and WebP formats.
- View photos and their thumbnails.
- Add tags to photos and search using multiple tags.
- Choose a photo as an album cover.
- Share an album using a link.
- Revoke a share link when it is no longer needed.

## Technologies Used

**Frontend**

- React
- Vite
- JavaScript
- Lucide React

**Backend**

- Node.js
- Express.js
- SQLite
- Multer
- Sharp
- Zod

**Testing**

- Vitest
- Supertest

## Project Structure

```text
Photo/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── validators/
│   ├── tests/
│   ├── uploads/
│   ├── .env.example
│   └── package.json
├── frontend/
│   └── package.json
└── README.md
```

## How to Run the Project

### 1. Install backend dependencies

Open a terminal in the project folder and run:

```bash
cd backend
npm install
```

### 2. Set up environment variables

Create a `.env` file inside the `backend` folder using `.env.example` as a reference.

Make sure the database path, port, and frontend URL match your project configuration. Do not share your `.env` file if it contains private information.

### 3. Start the backend

From the `backend` folder, run:

```bash
npm run dev
```

### 4. Install frontend dependencies

Open another terminal from the main project folder and run:

```bash
cd frontend
npm install
```

### 5. Start the frontend

From the `frontend` folder, run:

```bash
npm run dev
```

Open the local URL shown in your terminal. It is usually `http://localhost:5173`.

Make sure the frontend API URL points to your running backend.

## API Endpoints

| Method | Endpoint                                 | What it does               |
| ------ | ---------------------------------------- | -------------------------- |
| GET    | `/api/albums`                            | Gets all albums            |
| POST   | `/api/albums`                            | Creates an album           |
| PATCH  | `/api/albums/:id`                        | Updates an album           |
| DELETE | `/api/albums/:id`                        | Deletes an album           |
| PUT    | `/api/albums/:id/cover`                  | Sets an album cover        |
| POST   | `/api/albums/:id/photos`                 | Uploads photos             |
| GET    | `/api/albums/:id/photos`                 | Gets photos from an album  |
| DELETE | `/api/photos/:id`                        | Deletes a photo            |
| PUT    | `/api/photos/:id/tags`                   | Adds or updates photo tags |
| GET    | `/api/tags`                              | Gets all tags              |
| GET    | `/api/photos/search?tags=college,nature` | Searches photos by tags    |
| POST   | `/api/albums/:id/share`                  | Creates a share link       |
| DELETE | `/api/albums/:id/share`                  | Revokes a share link       |
| GET    | `/api/shared/:token`                     | Opens a shared album       |

## Running Tests

I used Vitest and Supertest to test the backend API.

To run the tests, open a terminal in the `backend` folder and execute:

```bash
npm test
```

The current test suite contains 22 tests:

- Album tests: 6
- Tag tests: 5
- Photo tests: 5
- Sharing tests: 6

All 22 tests passed in my latest test run.

The tests are configured to use a separate database file so that testing is kept separate from normal development data.

## Build the Frontend

To create a production build, run these commands from the `frontend` folder:

```bash
npm run build
```

To preview the build locally, run:

```bash
npm run preview
```

## A Note About Security

Before deploying the application publicly, album-management operations and share-link creation or revocation should be protected with appropriate authentication and access controls.
