# Qanat 7

**A full-stack media platform focused on Tunisian television, radio, and Arabic-language cartoons.**

Qanat 7 brings television channels, radio stations, and animated content together in a single web application. The project is built with Angular, Spring Boot, and MySQL, with an emphasis on a clean browsing experience and a backend that can grow as the catalogue expands.

> **Project status:** Under active development. The current TV catalogue contains three channels. More channels and improvements to the media catalogue are planned.

## Features

- **TV channels** — browse the currently available television channels and access their streams.
- **Radio stations** — explore radio content and listen through the integrated player.
- **Cartoons** — browse available animated content, including SpongeBob SquarePants , Sally.
- **Media-focused interface** — category navigation, channel cards, search, and a dedicated playback experience.
- **YouTube integration** — retrieve video metadata through the YouTube Data API.
- **Persistent data** — use MySQL for application data through Spring Data JPA and Hibernate.

The catalogue is still being expanded. Availability and playback depend on the media source, its accessibility, and any applicable regional or embedding restrictions.

## Tech stack

| Area | Technology |
|---|---|
| Frontend | Angular, TypeScript, HTML, SCSS |
| Backend | Java, Spring Boot |
| API | REST, JSON |
| ORM | Spring Data JPA, Hibernate |
| Database | MySQL |
| External API | YouTube Data API v3 , Radio Browser API |
| Build tools | npm, Angular CLI, Maven |
| Version control | Git, GitHub |

### Sally Cartoon Episode Collection

- **Web scraping:** Developed a process to collect and organize information about *Sally* cartoon episodes from online sources.
- **Episode discovery:** Worked on identifying individual episodes and organizing their available metadata for easier browsing.
- **Structured data:** Prepared episode information for integration into the Angular frontend through a JSON asset.
- **Ongoing development:** Improving episode matching and source accuracy to build a more complete catalogue of Sally episodes.

> **Note:** Episode availability and source verification are still being improved. The project does not yet guarantee a complete or fully verified collection of every episode.

## Architecture

The frontend and backend run independently and communicate over HTTP.

```text
Browser
   |
   v
Angular frontend
   |
   | HTTP / JSON
   v
Spring Boot REST API
   |
   +---- Spring Data JPA / Hibernate
   |                |
   |                v
   |              MySQL
   |
   +---- YouTube Data API
          (video metadata)
```

Angular handles the user interface and navigation. Spring Boot exposes API endpoints and manages backend logic. MySQL stores application data, while the YouTube integration retrieves video metadata for supported catalogue features.

## Repository structure

```text
9anet-7/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── cartoons/
│   │   │   ├── channel-player/
│   │   │   ├── media-controls/
│   │   │   └── services/
│   │   └── assets/
│   └── package.json
│
├── tunisian-iptv/
│   ├── src/
│   │   └── main/
│   │       ├── java/tn/tunisianiptv/
│   │       │   ├── controller/
│   │       │   ├── entity/
│   │       │   ├── repository/
│   │       │   └── service/
│   │       └── resources/
│   │           └── application.properties.example
│   └── pom.xml
│
├── .gitignore
└── README.md
```

This is a guide to the main project areas; the exact files may evolve during development.

## Prerequisites

Install the following before running the project:

- **Git** to clone the repository.
- **JDK 21** for the Spring Boot backend.
- **Node.js and npm** for the Angular frontend.
- **MySQL Server** for the database.
- A **YouTube Data API v3 key** for endpoints that retrieve YouTube metadata.

You do not need to install Maven globally if you use the included Maven Wrapper.

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/amennaffeti/9anet-7.git
cd 9anet-7
```

### 2. Create the MySQL database

Start your local MySQL server and create the database:

```sql
CREATE DATABASE tunisian_iptv;
```

The database must be running before you start the backend.

Creating the database does not automatically insert the initial channel catalogue. If channel data is not included in the repository or initialized by the application, you will need to import or create it separately.

### 3. Configure the backend

Go to the backend resources directory:

```text
tunisian-iptv/src/main/resources/
```

Copy the example configuration to a local configuration file.

**Windows PowerShell**, from the repository root:

```powershell
Copy-Item `
  tunisian-iptv/src/main/resources/application.properties.example `
  tunisian-iptv/src/main/resources/application.properties
```

Open `application.properties` and configure the database connection.

The example uses these environment variables:

| Variable | Purpose | Local default |
|---|---|---|
| `DB_URL` | JDBC connection URL | `jdbc:mysql://localhost:3306/tunisian_iptv` |
| `DB_USERNAME` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | Empty |
| `YOUTUBE_API_KEY` | YouTube Data API key | Empty |
| `PORT` | Backend HTTP port | `8080` |

The defaults are for local development only. Change them to match your environment.

Create your own YouTube Data API v3 key in Google Cloud Console and set `YOUTUBE_API_KEY` if you want to use the YouTube-backed endpoints. Some endpoints may be unavailable without a valid key or remaining API quota.

Never commit your real `application.properties` file, passwords, or API keys.

### 4. Start the Spring Boot backend

Open a terminal in the backend directory:

```bash
cd tunisian-iptv
```

On Windows:

```powershell
.\mvnw.cmd spring-boot:run
```

On macOS or Linux:

```bash
./mvnw spring-boot:run
```

When startup succeeds, the backend should be available at:

```text
http://localhost:8080
```

Keep this terminal running.

### 5. Start the Angular frontend

Open a second terminal from the repository root:

```bash
cd frontend
npm install
```

Start the development server:

```bash
npx ng serve
```

If the project defines an appropriate `start` script in `package.json`, `npm start` can also be used.

The frontend should be available at:

```text
http://localhost:4200
```

Open the URL in your browser.

If the browser cannot retrieve backend data, check that Spring Boot is running, the database connection is valid, and the backend's CORS configuration allows the frontend's development origin.

## API endpoints

The following endpoints are implemented or intended in the current development version. YouTube-backed endpoints depend on the API key and quota.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/channels` | Retrieve channel data |
| `POST` | `/api/channels/import-radios` | Import radio entries |
| `GET` | `/api/cartoons/spongebob` | Retrieve SpongeBob video metadata |
| `GET` | `/api/cartoons/sally/discover` | Search for candidate Sally episode videos, if enabled in the current backend |

The Sally discovery endpoint is a development feature, not a verified catalogue of all episodes. Search results can contain duplicates or incorrect episode matches, and the YouTube API has quota limits.

## Assets and media

Frontend assets are stored in `frontend/src/assets/` and are included in the Angular build when referenced correctly.

A cloned copy of the repository includes only the assets committed to Git. Files that exist only on a developer's computer are not available to other users.

Live TV streams and radio streams are external resources. Their availability can change independently of the application. Some sources may block embedding, require geographic access, or become unavailable.

Qanat 7 uses media sources and embedded players subject to their respective terms. The application does not imply ownership of third-party channels or video content.

## Troubleshooting

### The backend fails to start

- Confirm that the installed JDK is available and the expected Java version is selected.
- Confirm that MySQL is running.
- Check the JDBC URL, username, and password in `application.properties`.
- Read the startup error in the backend terminal.

### The frontend loads, but channel data is missing

- Confirm that Spring Boot is running on port `8080`.
- Open `http://localhost:8080/api/channels` directly to check the API response.
- Check the browser developer console and Network panel.
- Verify CORS configuration if the browser reports a cross-origin request error.

### Cartoon videos do not load

- Confirm that the YouTube API key is configured.
- Check the backend logs for API errors or quota exhaustion.
- Remember that a search result does not guarantee that a video is playable or available for embedding.

### Images or videos are missing

- Verify that the referenced file exists under `frontend/src/assets/`.
- Check the path used in the Angular template.
- Confirm that the file was committed to Git and pushed to the repository.

## Development roadmap

- [ ] Expand the Tunisian TV channel catalogue beyond the current three channels.
- [ ] Continue improving radio catalogue management.
- [ ] Validate and organize cartoon episode metadata.
- [ ] Improve search, loading states, and error handling.
- [ ] Add favorites and a persistent radio mini-player.
- [ ] Improve responsive layouts and playback usability.
- [ ] Add automated backend and frontend tests.
- [ ] Prepare production deployment and environment-specific configuration.

## Security

- Keep secrets in environment variables or local configuration files that are excluded from Git.
- Restrict API keys in Google Cloud Console where supported.
- Do not expose database credentials or API keys in frontend code.
- Configure production CORS origins explicitly.
- Use appropriate production database credentials and access restrictions.

## Author

**Amen Naffeti**  
Software Engineering Student

- GitHub: [@amennaffeti](https://github.com/amennaffeti)

---

Qanat 7 is an ongoing project. The codebase, catalogue, and feature set will continue to evolve as development progresses.
